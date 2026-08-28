import { expect, test } from "@playwright/test";
import { isDecorStoreBusinessRequest } from "./support/decor-store-network";

const layouts = [
  ["/shop", "left"],
  ["/shop/no-sidebar", "none"],
  ["/shop/right-sidebar", "right"],
] as const;

for (const [route, layout] of layouts) {
  test(`${route} renders the ${layout} Shop layout`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
    if (layout === "none") await expect(page.locator("[data-sidebar]")).toHaveCount(0);
    else await expect(page.locator(`[data-sidebar="${layout}"]`)).toBeVisible();
    await expect(page.locator("[data-product-id]")).toHaveCount(12);
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.locator("body").evaluate((body) => body.clientWidth),
    );
  });
}

test("Shop filtering, sorting, pagination, and Wishlist stay page-local", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isDecorStoreBusinessRequest(request)) requests.push(request.url());
  });
  await page.goto("/shop");
  const furniture = page.getByRole("button", { name: "Furnitures", exact: true });
  await furniture.click();
  await expect(page.locator("[data-product-id]:visible")).toHaveCount(2);
  await furniture.click();
  await page.getByLabel("Default sorting").selectOption("5");
  await expect(page.locator("[data-product-id]").first()).toHaveAttribute(
    "data-product-id",
    "wood-stool",
  );
  await page.getByLabel("Default sorting").selectOption("4");
  await expect(page.locator("[data-product-id]").first()).toHaveAttribute(
    "data-product-id",
    "decor-lamp",
  );
  for (const value of ["1", "2", "3", "Default sorting"]) {
    await page.getByLabel("Default sorting").selectOption(value);
    await expect(page.locator("[data-product-id]").first()).toHaveAttribute(
      "data-product-id",
      "table-clock",
    );
  }
  await page.locator("[data-product-id]").first().hover();
  const wishlist = page.getByRole("button", { name: /Add Table clock to wishlist/ });
  await wishlist.click();
  await expect(wishlist).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByRole("button", { name: "2", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(requests).toEqual([]);
});
