import { expect, test } from "@playwright/test";

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
    await expect(page.locator("[data-product-id]")).toHaveCount(4);
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.locator("body").evaluate((body) => body.clientWidth),
    );
  });
}

test("Shop filtering, sorting, pagination, and Wishlist stay page-local", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "fetch" || request.resourceType() === "xhr")
      requests.push(request.url());
  });
  await page.goto("/shop");
  await page.getByRole("button", { name: "Furniture" }).click();
  await expect(page.locator("[data-product-id]")).toHaveCount(2);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Default sorting").selectOption("price-high");
  await expect(page.locator("[data-product-id]").first()).toHaveAttribute(
    "data-product-id",
    "modern-stool",
  );
  const wishlist = page.getByRole("button", { name: /Add Modern stool to wishlist/ });
  await wishlist.click();
  await expect(wishlist).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByRole("button", { name: "2", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(requests).toEqual([]);
});
