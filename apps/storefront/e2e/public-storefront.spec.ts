import { expect, test } from "@playwright/test";
import { readPublicValidationInput } from "./public-validation-input";

const validation = readPublicValidationInput();
if (!validation) throw new Error("Public browser proof requires an approved public build input.");
const { input, product, productPath, canonicalUrl } = validation;

test("generated public artifact retains the approved identity and Catalog bytes", async ({
  request,
}) => {
  const marker = await request.get("/__shoppp-release.json");
  expect(marker.status()).toBe(200);
  expect(await marker.json()).toEqual({
    schemaVersion: 1,
    sourceEnvironment: input.sourceEnvironment,
    identity: input.inputIdentity,
  });
  const catalog = await request.get("/__shoppp-catalog.json");
  expect(catalog.status()).toBe(200);
  expect(await catalog.text()).toBe(input.catalogManifestJson);
});

test(`${product.name} at ${productPath} has approved static content and canonical origin`, async ({
  page,
}) => {
  const response = await page.goto(productPath);
  expect(response?.status()).toBe(200);
  const title = page.locator("[data-fashion-store-product] .product-info > h4");
  await expect(title).toHaveText(product.name);
  await expect(title).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonicalUrl);
  const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(structuredData.map((value) => JSON.parse(value))).toContainEqual(
    expect.objectContaining({
      "@type": "Product",
      name: product.name,
      offers: expect.objectContaining({ url: canonicalUrl }),
    }),
  );
});

test("shop navigation hydrates the approved product route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  const response = await page.goto("/shop");
  expect(response?.status()).toBe(200);
  await page.locator(`a[href="${validation.productPath}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${validation.productPath}/?$`));
  const title = page.locator("[data-fashion-store-product] .product-info > h4");
  await expect(title).toHaveText(validation.product.name);
  await expect(title).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    validation.canonicalUrl,
  );
});

test("unknown public routes return a real 404", async ({ request }) => {
  const response = await request.get("/not-a-real-page");
  expect(response.status()).toBe(404);
});

test("public transaction pages preserve no-JavaScript recovery without a hydration notice", async ({
  page,
}, testInfo) => {
  for (const [path, marker, heading, recoveryName, recoveryHref] of [
    ["/cart", "data-fashion-store-cart", "Shopping cart", "Browse the published catalog", "/shop"],
    ["/checkout", "data-fashion-store-checkout", "Checkout", "Return to bag", "/cart"],
  ]) {
    await page.goto(path!);
    const main = page.locator(`[${marker}]`);
    await expect(main.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    const notice = page.getByRole("region", { name: "JavaScript limitations" });
    if (testInfo.project.name === "no-js-desktop") {
      await expect(notice).toContainText("Shopping actions require JavaScript.");
      const recovery = main.getByRole("link", { name: recoveryName, exact: true });
      await expect(recovery).toBeVisible();
      await expect(recovery).toHaveAttribute("href", recoveryHref!);
      if (path === "/cart") {
        const buttons = main.getByRole("button");
        expect(await buttons.count()).toBeGreaterThan(0);
        for (const button of await buttons.all()) await expect(button).toBeDisabled();
      } else {
        await expect(main.getByRole("button", { name: "Place order", exact: true })).toBeDisabled();
      }
    } else {
      await expect(notice).toHaveCount(0);
    }
  }
});
