import { expect, test } from "@playwright/test";

test("Product gallery, options, quantity, tabs, and Wishlist remain local", async ({ page }) => {
  const businessRequests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) businessRequests.push(request.url());
  });
  await page.goto("/products/minimalist-wooden-chair");
  await expect(page.getByRole("heading", { name: "Minimalist wooden chair" })).toBeVisible();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByAltText(/Minimalist wooden chair side/)).toBeVisible();
  await page.getByLabel("Black").check();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByRole("status", { name: "Quantity" })).toHaveText("2");
  const wishlist = page.getByRole("button", { name: "Add product to wishlist" });
  await wishlist.click();
  await expect(wishlist).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Reviews (3)" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("25,000+");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  expect(businessRequests).toEqual([]);
});

test("Wishlist removal is ephemeral and refresh restores its fixture", async ({ page }) => {
  await page.goto("/wishlist");
  await expect(page.locator("[data-product-id]")).toHaveCount(7);
  await page.getByRole("button", { name: "Add Table clock to wishlist" }).click();
  await expect(page.locator("[data-product-id]")).toHaveCount(6);
  await page.reload();
  await expect(page.locator("[data-product-id]")).toHaveCount(7);
});
