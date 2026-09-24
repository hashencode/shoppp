import { expect, test } from "@playwright/test";

test("published product is complete static HTML without JavaScript", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-desktop");
  const response = await page.goto("/products/atlas-carry-on");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Atlas Carry-on" })).toBeVisible();
  await expect(page.getByText("$129.00")).toBeVisible();
  await expect(page.getByText("Fixture variants")).toBeVisible();
  await expect(page.getByRole("button", { name: "Select variant" })).toBeVisible();
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute(
    "href",
    "https://shop.example.invalid/products/atlas-carry-on",
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  await expect(
    page.getByRole("img", { name: "Black Atlas carry-on suitcase standing upright" }),
  ).toHaveAttribute("width", "1200");
});

test("mobile fallback keeps one responsive static product route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/products/atlas-carry-on");
  await expect(page.getByRole("heading", { name: "Atlas Carry-on" })).toBeVisible();
  await expect(page.getByText("$129.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Select variant" })).toBeVisible();
  await expect(page.getByLabel("Currency")).toHaveCount(0);
  expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe("/products/atlas-carry-on");
});

test("client navigation hydrates generated product payloads", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/");
  await page
    .getByRole("link", { name: /Atlas Carry-on/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/products\/atlas-carry-on\/?$/);
  await expect(page.getByRole("heading", { name: "Atlas Carry-on" })).toBeVisible();
  await expect(page.getByText("$129.00")).toBeVisible();
});

test("unknown routes are real 404s and changed slugs are permanent redirects", async ({
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-desktop");
  const missing = await request.get("/not-a-real-page");
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("Page not found");

  const redirected = await request.get("/products/carry-on", { maxRedirects: 0 });
  expect(redirected.status()).toBe(301);
  expect(redirected.headers().location).toBe("/products/atlas-carry-on");
});
