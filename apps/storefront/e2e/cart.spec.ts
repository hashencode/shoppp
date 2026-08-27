import { expect, test } from "@playwright/test";

const variantId = "var_01J00000000000000000000000";
const expectedReleaseId = process.env.RELEASE_ID ?? "representative-release-2026-07-30";
const cart = {
  adjustments: [],
  canCheckout: true,
  currency: "USD",
  expiresAt: "2026-08-06T00:00:00.000Z",
  id: "cart_01J0000000000000000000000",
  lines: [
    {
      availableQuantity: 10,
      lineTotal: { amount: 12_900, currency: "USD" },
      productName: "Atlas Carry-on",
      quantity: 1,
      unitPrice: { amount: 12_900, currency: "USD" },
      variantId,
      variantName: "Black",
    },
  ],
  selectedShippingMethodId: null,
  shippingAddress: null,
  shippingMethods: [],
  totals: {
    discountTotal: 0,
    grandTotal: 12_900,
    shippingTotal: 0,
    subtotal: 12_900,
    taxTotal: 0,
  },
};

test("desktop and mobile add the same variant and render the API-authoritative quote", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (path.includes("/catalog/products/")) {
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            variants: [
              {
                available: true,
                id: variantId,
                options: { color: "Black" },
                price: { amount: 12_900, currency: "USD" },
                sku: "ATLAS-BLK",
              },
            ],
          },
        },
      });
      return;
    }
    if (path === "/cart" && request.method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            cart: { ...cart, lines: [], totals: { ...cart.totals, grandTotal: 0, subtotal: 0 } },
            token: "opaque_guest_token_12345678901234567890",
          },
        },
      });
      return;
    }
    if (path === "/cart/lines") submitted = request.postDataJSON() as Record<string, unknown>;
    await route.fulfill({ contentType: "application/json", json: { data: cart } });
  });

  const liveProduct = page.waitForResponse(
    (response) => new URL(response.url()).pathname.includes("/catalog/products/") && response.ok(),
  );
  await page.goto("/products/atlas-carry-on");
  await liveProduct;
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page).toHaveURL(/\/cart\/?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your bag" })).toBeVisible();
  await expect(page.getByText("$129.00").last()).toBeVisible();
  expect(submitted).toMatchObject({
    expectedUnitPrice: { amount: 12_900, currency: "USD" },
    quantity: 1,
    releaseId: expectedReleaseId,
    variantId,
  });
});
