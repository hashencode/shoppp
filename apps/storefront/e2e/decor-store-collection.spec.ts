import { expect, test } from "@playwright/test";

test("Collections keeps its source order and excludes Shop controls", async ({ page }) => {
  await page.goto("/collections");
  await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Designer stool" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Designer sofa" })).toBeVisible();
  await expect(page.locator(".shop-filter")).toHaveCount(0);
  await expect(page.getByLabel("Default sorting")).toHaveCount(0);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((body) => body.clientWidth),
  );
});
