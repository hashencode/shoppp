import { expect, test } from "@playwright/test";

const token = "order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const cartToken = "opaque_guest_token_12345678901234567890";
const shippingAddress = {
  city: "New York",
  countryCode: "US",
  line1: "123 Commerce Street",
  name: "Ada Buyer",
  postalCode: "10001",
  region: "NY",
};
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
      variantId: "var_01J00000000000000000000000",
      variantName: "Black",
    },
  ],
  selectedShippingMethodId: "ship_01J000000000000000000000",
  shippingAddress,
  shippingMethods: [
    {
      amount: 1_350,
      currency: "USD",
      estimatedDaysMax: 5,
      estimatedDaysMin: 3,
      id: "ship_01J000000000000000000000",
      name: "Tracked delivery",
    },
  ],
  totals: {
    discountTotal: 0,
    grandTotal: 14_250,
    shippingTotal: 1_350,
    subtotal: 12_900,
    taxTotal: 0,
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ cartToken: storedCartToken }) =>
      localStorage.setItem("shoppp.guest-cart-token", storedCartToken),
    { cartToken },
  );
});

test("checkout persists the opaque access token and displays only provider-verified payment", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  let submitted: Record<string, unknown> | undefined;
  let orderLookups = 0;
  await page.route("https://api.example.invalid/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/cart") {
      await route.fulfill({ contentType: "application/json", json: { data: cart } });
      return;
    }
    if (path === "/checkout/sessions") {
      submitted = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            attemptId: "chk_01J00000000000000000000000",
            checkoutUrl: `${new URL(page.url()).origin}/checkout/complete?session_id=cs_test`,
            expiresAt: "2026-07-30T00:30:00.000Z",
            orderAccessToken: token,
            status: "payment_pending",
          },
        },
      });
      return;
    }
    if (path === `/orders/${token}`) {
      orderLookups += 1;
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            order: {
              createdAt: "2026-07-30T00:05:00.000Z",
              currency: "USD",
              email: "ada@example.test",
              fulfillmentStatus: "unfulfilled",
              lines: [
                {
                  currency: "USD",
                  discountAmount: 0,
                  lineTotalAmount: 12_900,
                  productName: "Atlas Carry-on",
                  quantity: 1,
                  sku: "ATLAS-BLK",
                  taxAmount: 0,
                  unitPriceAmount: 12_900,
                  variantName: "Black",
                },
              ],
              orderStatus: "confirmed",
              paymentStatus: "paid",
              publicReference: "ORD-TEST001",
              shippingAddress,
              totals: cart.totals,
            },
            status: "paid",
          },
        },
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/checkout");
  await expect(page.getByRole("radio", { name: /Tracked delivery/ })).toBeChecked();
  await page.getByLabel("Email").fill("ada@example.test");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to secure payment" }).click();

  await expect(page).toHaveURL(/\/checkout\/complete\/?\?session_id=cs_test$/);
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
  await expect(page.getByText("Order ORD-TEST001 is confirmed.")).toBeVisible();
  expect(orderLookups).toBe(1);
  expect(submitted).toMatchObject({
    acceptTerms: true,
    cartId: cart.id,
    countryCode: "US",
    currency: "USD",
    email: "ada@example.test",
    shippingAddress,
    shippingMethodId: cart.selectedShippingMethodId,
  });
});

test("a forged return URL cannot approve an order", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  let orderLookups = 0;
  await page.route("https://api.example.invalid/orders/**", async (route) => {
    orderLookups += 1;
    await route.abort();
  });

  await page.goto("/checkout/complete?session_id=forged");

  await expect(
    page.getByText(
      "This return URL cannot confirm payment. Use the secure order link from your checkout session.",
    ),
  ).toBeVisible();
  expect(orderLookups).toBe(0);
});
