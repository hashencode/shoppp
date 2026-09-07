import { expect, test } from "@playwright/test";

test("renders truthful statuses for an empty live Home collection", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const home = page.locator("[data-fashion-store-live-home]");
  await expect(home).toHaveCount(1);
  await expect(home.locator('[data-home-section="best-sellers"] [role="status"]')).toHaveText(
    "This collection does not have published products yet.",
  );
  await expect(home.locator('[data-home-section="featured-products"] [role="status"]')).toHaveText(
    "This collection does not have published products yet.",
  );
  await expect(home.locator("[data-fashion-store-product-card]")).toHaveCount(0);
});
