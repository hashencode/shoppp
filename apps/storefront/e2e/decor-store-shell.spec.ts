import { expect, test } from "@playwright/test";

test("an unfinished secondary route remains unavailable", async ({ page }) => {
  const response = await page.goto("/single-product");
  expect(response?.status()).toBe(404);
  await expect(page.locator("[data-decor-store-secondary-shell]")).toHaveCount(0);
});

test("accepted home does not mount the secondary shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-decor-store-source-parity]")).toHaveCount(1);
  await expect(page.locator("[data-decor-store-secondary-shell]")).toHaveCount(0);
});
