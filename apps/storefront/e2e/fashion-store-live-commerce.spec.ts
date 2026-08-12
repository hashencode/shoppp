import { expect, test, type Page, type Route } from "@playwright/test";

const cartToken = "fashion_live_cart_token_12345678901234567890";
const shippingMethodId = "ship_01J00000000000000000000000";
const variantId = "var_01JFSHIRTGREENXL000000001";
const shippingAddress = {
  city: "Austin",
  countryCode: "US",
  line1: "123 Commerce Street",
  name: "Ada Buyer",
  postalCode: "78701",
  region: "TX",
};

function cart(
  options: {
    address?: typeof shippingAddress | null;
    quantity?: number;
    selectedShippingMethodId?: string | null;
  } = {},
) {
  const quantity = options.quantity ?? 1;
  const selectedShippingMethodId = options.selectedShippingMethodId ?? null;
  const shippingTotal = selectedShippingMethodId ? 1_200 : 0;
  const subtotal = quantity * 6_500;
  return {
    adjustments: [],
    canCheckout: true,
    currency: "USD",
    expiresAt: "2026-08-12T01:00:00.000Z",
    id: "cart_01J00000000000000000000000",
    lines:
      quantity === 0
        ? []
        : [
            {
              availableQuantity: 20,
              lineTotal: { amount: subtotal, currency: "USD" },
              productName: "Relaxed corduroy shirt",
              quantity,
              unitPrice: { amount: 6_500, currency: "USD" },
              variantId,
              variantName: "Green / XL",
            },
          ],
    selectedShippingMethodId,
    shippingAddress: options.address ?? null,
    shippingMethods: [
      {
        amount: 1_200,
        currency: "USD",
        estimatedDaysMax: 5,
        estimatedDaysMin: 3,
        id: shippingMethodId,
        name: "Tracked delivery",
      },
    ],
    totals: {
      discountTotal: 0,
      grandTotal: subtotal + shippingTotal,
      shippingTotal,
      subtotal,
      taxTotal: 0,
    },
  };
}

async function installLiveCommerce(page: Page, onRequest: (route: Route) => Promise<void>) {
  await page.addInitScript(({ token }) => localStorage.setItem("shoppp.guest-cart-token", token), {
    token: cartToken,
  });
  await page.route("**/api/**", onRequest);
}

test("live checkout waits for a complete address, then applies one optionless shipping quote", async ({
  page,
}) => {
  const shippingRequests: unknown[] = [];
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (path === "/platform/config") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: { turnstile: { required: false, siteKey: null } } },
      });
      return;
    }
    if (path === "/cart" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: { data: cart() } });
      return;
    }
    if (path === "/cart/shipping" && request.method() === "PUT") {
      shippingRequests.push(request.postDataJSON());
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: cart({ address: shippingAddress, selectedShippingMethodId: shippingMethodId }),
        },
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/checkout", { waitUntil: "networkidle" });
  await page.locator("[data-fashion-store-checkout][data-runtime-status='ready']").waitFor();
  await page.getByRole("button", { name: "Allow cookies" }).click();
  const shipping = page.getByRole("radio", { name: "Tracked delivery" });
  await expect(shipping).not.toBeChecked();
  await page.waitForTimeout(450);
  expect(shippingRequests).toEqual([]);

  await page.getByLabel("First name *").fill("Ada");
  await page.getByLabel("Last name *").fill("Buyer");
  await page.getByLabel("Street address *").fill(shippingAddress.line1);
  await page.getByLabel("Town / City *").fill(shippingAddress.city);
  await page.getByLabel("ZIP *").fill(shippingAddress.postalCode);

  await expect.poll(() => shippingRequests).toHaveLength(1);
  expect(shippingRequests[0]).toEqual({ shippingAddress });
  await expect(shipping).toBeChecked();
  await expect(page.locator(".your-order-box")).toContainText("$77.00");
});

test("live MiniCart stays mounted and reflects cart-page mutations in both directions", async ({
  page,
}) => {
  let currentCart = cart();
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (path === "/cart" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    if (path === `/cart/lines/${variantId}` && request.method() === "PATCH") {
      currentCart = cart({ quantity: 2 });
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    if (path === `/cart/lines/${variantId}` && request.method() === "DELETE") {
      currentCart = cart({ quantity: 0 });
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    await route.abort();
  });

  await page.goto("/cart", { waitUntil: "networkidle" });
  await page.locator("[data-fashion-store-cart][data-runtime-status='ready']").waitFor();
  await page.getByRole("button", { name: "Allow cookies" }).click();
  const headerCart = page.locator(".header-cart");
  await expect(headerCart).toHaveCount(1);
  await page.getByRole("button", { name: "Increase Relaxed corduroy shirt quantity" }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Relaxed corduroy shirt quantity" }),
  ).toHaveValue("2");

  await page.getByRole("button", { name: "Open preview cart" }).click();
  await expect(headerCart.locator(".cart-count")).toHaveText("2");
  await expect(headerCart.locator(".cart-item-list")).toContainText("Relaxed corduroy shirt");
  await expect(headerCart.locator(".cart-item-list")).toContainText("2 × $65.00");
  await expect(headerCart.locator(".cart-total")).toContainText("$130.00");

  await headerCart.getByRole("button", { name: "Remove Relaxed corduroy shirt from cart" }).click();
  await expect(page.locator(".cart-products tbody tr")).toHaveCount(0);
  await expect(page.locator(".total-price-table")).toContainText("$0.00");
  await expect(headerCart.locator(".cart-count")).toHaveText("0");
  await expect(headerCart.locator(".cart-item-list")).toContainText("Your cart is empty.");
});
