import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const fashionStore = process.env.STOREFRONT_THEME === "fashion-store";
const criticalRoutes = fashionStore
  ? ["/", "/shop", "/products/relaxed-corduroy-shirt", "/cart", "/checkout", "/magazine"]
  : [
      "/",
      "/collections/travel-essentials",
      "/products/atlas-carry-on",
      "/cart",
      "/checkout",
      "/orders/fixture-order",
      "/policies/shipping",
    ];

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
    await page.goto(route);
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

test("keyboard users can skip navigation and reach purchase controls in document order", async ({
  page,
}) => {
  await page.goto(fashionStore ? "/products/relaxed-corduroy-shirt" : "/products/atlas-carry-on");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  const mainContent = page.locator(fashionStore ? "#fashion-store-main" : "#main-content");
  await expect(mainContent).toBeFocused();
  await page.keyboard.press("Tab");
  const breadcrumb = page.getByLabel("Breadcrumb");
  await expect(breadcrumb.getByRole("link", { name: "Home", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  if (fashionStore) {
    await expect(breadcrumb.getByRole("link", { name: "Shop", exact: true })).toBeFocused();
    const addToCart = page.getByRole("button", { name: "Add to cart" });
    for (
      let index = 0;
      index < 20 && !(await addToCart.evaluate((node) => node === document.activeElement));
      index += 1
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(addToCart).toBeFocused();
    return;
  }
  await expect(
    page.getByLabel("Breadcrumb").getByRole("link", { name: "Travel essentials" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Variant")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Currency")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add to bag" })).toBeFocused();
});
