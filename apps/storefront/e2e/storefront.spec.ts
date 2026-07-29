import { expect, test } from "@playwright/test";

test("published product is complete static HTML without JavaScript", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-desktop");
  const response = await page.goto("/products/atlas-carry-on");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Atlas Carry-on" })).toBeVisible();
  await expect(page.getByText("$129.00")).toBeVisible();
  await expect(
    page.getByLabel("Breadcrumb").getByRole("link", { name: "Travel essentials" }),
  ).toBeVisible();
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

test("mobile enhancement changes currency while keeping one responsive route", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/products/atlas-carry-on");
  await page.getByLabel("Currency").selectOption("EUR");
  await expect(page.getByText("€119.00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to bag" })).toBeVisible();
  expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe("/products/atlas-carry-on");
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
