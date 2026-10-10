import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readPublicValidationInput } from "./public-validation-input";

const publicValidation = readPublicValidationInput();
const fashionStore =
  (publicValidation?.input.themeId ?? process.env.STOREFRONT_THEME) === "fashion-store";
const criticalRoutes =
  publicValidation?.criticalRoutes ??
  (fashionStore
    ? ["/", "/shop", "/products/relaxed-corduroy-shirt", "/cart", "/checkout", "/magazine"]
    : [
        "/",
        "/collections/travel-essentials",
        "/products/atlas-carry-on",
        "/cart",
        "/checkout",
        "/orders/fixture-order",
        "/policies/shipping",
      ]);

const fashionStoreHomeContrastExceptions = [
  ".feature-box-content p",
  ".shop-footer .price",
  ".lable",
  ".xs-pe-15px",
  ".fs-180",
  ".blog-wrapper .mb-5px",
  "footer ul a",
  "footer a[href^='tel:'], footer a[href^='mailto:']",
  "footer .col-md-6 > .mb-15px",
  "footer .input-small",
  "footer .col-lg-7 > p",
  "footer .col-lg-5 > span",
] as const;

for (const route of criticalRoutes) {
  test(`${route} has no critical or serious WCAG 2.2 A/AA violation`, async ({ page }) => {
    const response = await page.goto(route);
    if (publicValidation) expect(response?.status()).toBe(200);
    if (publicValidation && route === publicValidation.productPath) {
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        publicValidation.canonicalUrl,
      );
    }
    if (publicValidation && route === "/") {
      const marker = await page.request.get("/__shoppp-release.json");
      expect(marker.status()).toBe(200);
      expect(await marker.json()).toEqual({
        schemaVersion: 1,
        sourceEnvironment: publicValidation.input.sourceEnvironment,
        identity: publicValidation.input.inputIdentity,
      });
    }
    const audit = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]);
    if (fashionStore && route === "/") {
      // Keep the same source-parity contrast exceptions as the dedicated Fashion Store audit.
      for (const selector of fashionStoreHomeContrastExceptions) audit.exclude(selector);
    }
    const result = await audit.analyze();
    const blocking = result.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

test(
  publicValidation
    ? "keyboard users reach approved product information in document order"
    : "keyboard users reach the available product action in document order",
  async ({ page }) => {
    await page.goto(
      publicValidation?.productPath ??
        (fashionStore ? "/products/relaxed-corduroy-shirt" : "/products/atlas-carry-on"),
    );
    await page.keyboard.press("Tab");
    if (!fashionStore) {
      await expect(page.getByRole("button", { name: "Select variant" })).toBeFocused();
      return;
    }
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    const skipTarget = await skipLink.getAttribute("href");
    expect(skipTarget).toMatch(/^#[a-z][a-z0-9-]*$/);
    await page.keyboard.press("Enter");
    const mainContent = page.locator(skipTarget!);
    await expect(mainContent).toBeFocused();
    await page.keyboard.press("Tab");
    const breadcrumb = page.getByLabel("Breadcrumb");
    await expect(breadcrumb.getByRole("link", { name: "Home", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    const target = publicValidation
      ? page.getByRole("tab", { name: "Description", exact: true })
      : page.locator("[data-product-purchase-region]").getByRole("button", { name: "Add to cart" });
    for (
      let index = 0;
      index < 20 && !(await target.evaluate((node) => node === document.activeElement));
      index += 1
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
  },
);
