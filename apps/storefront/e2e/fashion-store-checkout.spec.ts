import { isFashionStoreViewport } from "./support/fashion-store-project";
import { expect, test, type Page, type Route } from "@playwright/test";

import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const sourceOrigin = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}`;
const shippingMethodId = "ship_01J00000000000000000000000";
const cartToken = "fashion_checkout_cart_token_12345678901234567890";
const orderToken = "order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const shippingAddress = {
  city: "New York",
  countryCode: "US",
  line1: "123 Commerce Street",
  name: "Ada Buyer",
  phone: "2125550100",
  postalCode: "10001",
  region: "NY",
};

function checkoutCart(
  options: { canCheckout?: boolean; address?: typeof shippingAddress | null } = {},
) {
  return {
    adjustments: [],
    canCheckout: options.canCheckout ?? true,
    currency: "USD",
    expiresAt: "2026-08-08T00:00:00.000Z",
    id: "cart_01J00000000000000000000000",
    lines: [
      {
        availableQuantity: 20,
        lineTotal: { amount: 2_300, currency: "USD" },
        productName: "Textured sweater",
        quantity: 1,
        unitPrice: { amount: 2_300, currency: "USD" },
        variantId: "var_01J00000000000000000000000",
        variantName: "Pink",
      },
      {
        availableQuantity: 20,
        lineTotal: { amount: 7_000, currency: "USD" },
        productName: "Bermuda shorts",
        quantity: 2,
        unitPrice: { amount: 3_500, currency: "USD" },
        variantId: "var_01J00000000000000000000001",
        variantName: "Brown",
      },
      {
        availableQuantity: 20,
        lineTotal: { amount: 1_500, currency: "USD" },
        productName: "Pocket sweatshirt",
        quantity: 1,
        unitPrice: { amount: 1_500, currency: "USD" },
        variantId: "var_01J00000000000000000000002",
        variantName: "White",
      },
    ],
    selectedShippingMethodId: shippingMethodId,
    shippingAddress: options.address === undefined ? null : options.address,
    shippingMethods: [
      {
        amount: 0,
        currency: "USD",
        estimatedDaysMax: 5,
        estimatedDaysMin: 3,
        id: shippingMethodId,
        name: "Free shipping",
      },
      {
        amount: 1_200,
        currency: "USD",
        estimatedDaysMax: 5,
        estimatedDaysMin: 3,
        id: "ship_01J00000000000000000000001",
        name: "Flat",
      },
      {
        amount: 0,
        currency: "USD",
        estimatedDaysMax: 5,
        estimatedDaysMin: 3,
        id: "ship_01J00000000000000000000002",
        name: "Local pickup",
      },
    ],
    totals: {
      discountTotal: 0,
      grandTotal: 40_500,
      shippingTotal: 0,
      subtotal: 40_500,
      taxTotal: 1_929,
    },
  };
}

async function fulfillCheckoutApi(
  route: Route,
  options: {
    canCheckout?: boolean;
    configurationFailure?: boolean;
    emptyCart?: boolean;
    onCheckout?: (body: unknown) => void;
    onShipping?: (body: unknown) => void;
    turnstile?: { required: boolean; siteKey: string | null };
  } = {},
): Promise<void> {
  const request = route.request();
  const path = new URL(request.url()).pathname.replace(/^\/api/, "");
  if (path === "/platform/config") {
    if (options.configurationFailure) {
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      json: { data: { turnstile: options.turnstile ?? { required: false, siteKey: null } } },
    });
    return;
  }
  if (path === "/cart" && request.method() === "GET") {
    const cart = checkoutCart({ canCheckout: options.canCheckout });
    if (options.emptyCart) {
      cart.canCheckout = false;
      cart.lines = [];
      cart.shippingMethods = [];
      cart.selectedShippingMethodId = null;
      cart.totals = {
        discountTotal: 0,
        grandTotal: 0,
        shippingTotal: 0,
        subtotal: 0,
        taxTotal: 0,
      };
    }
    await route.fulfill({
      contentType: "application/json",
      json: { data: cart },
    });
    return;
  }
  if (path === "/cart/shipping") {
    options.onShipping?.(request.postDataJSON());
    await route.fulfill({
      contentType: "application/json",
      json: { data: checkoutCart({ address: shippingAddress }) },
    });
    return;
  }
  if (path === "/checkout/sessions") {
    options.onCheckout?.(request.postDataJSON());
    await route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          attemptId: "chk_01J00000000000000000000000",
          checkoutUrl: `${new URL(request.url()).origin}/checkout/complete?session_id=cs_fashion`,
          expiresAt: "2026-08-08T00:30:00.000Z",
          orderAccessToken: orderToken,
          status: "payment_pending",
        },
      },
    });
    return;
  }
  if (path === `/orders/${orderToken}`) {
    await route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          order: {
            createdAt: "2026-08-07T00:05:00.000Z",
            currency: "USD",
            email: "ada@example.test",
            fulfillmentStatus: "unfulfilled",
            lines: [],
            orderStatus: "confirmed",
            paymentStatus: "paid",
            publicReference: "ORD-FASHION1",
            shippingAddress,
            totals: checkoutCart().totals,
          },
          status: "paid",
        },
      },
    });
    return;
  }
  await route.abort();
}

async function prepareCheckout(
  page: Page,
  options: Parameters<typeof fulfillCheckoutApi>[1] = {},
): Promise<void> {
  await page.addInitScript(({ token }) => localStorage.setItem("shoppp.guest-cart-token", token), {
    token: cartToken,
  });
  await page.route("**/api/**", (route) => fulfillCheckoutApi(route, options));
  await page.goto("/checkout", { waitUntil: "networkidle" });
  await page.locator("[data-fashion-store-checkout][data-runtime-status='ready']").waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await page.getByRole("button", { name: "Allow cookies" }).click();
}

async function fillBilling(page: Page): Promise<void> {
  await page.getByLabel("First name *").fill("Ada");
  await page.getByLabel("Last name *").fill("Buyer");
  await page.getByLabel("Street address *").fill(shippingAddress.line1);
  await page.getByLabel("Town / City *").fill(shippingAddress.city);
  await page.getByLabel("State *").selectOption(shippingAddress.region);
  await page.getByLabel("ZIP *").fill(shippingAddress.postalCode);
  await page.getByLabel("Phone *").fill(shippingAddress.phone);
  await page.getByLabel("Email address *").fill("ada@example.test");
}

test("Checkout preserves source billing, order, delivery, payment, and responsive geometry", async ({
  page,
}, testInfo) => {
  await prepareCheckout(page);
  const checkout = page.locator("[data-fashion-store-checkout]");
  await expect(checkout.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await expect(checkout.locator(".fashion-checkout-billing input")).toHaveCount(18);
  await expect(checkout.locator(".your-order-table tr.product")).toHaveCount(3);
  await expect(checkout.locator(".shipping-methods input")).toHaveCount(3);
  await expect(checkout.locator(".fashion-payment-option")).toHaveCount(4);
  await expect(checkout.locator(".your-order-box")).toContainText("$405.00");

  if (isFashionStoreViewport(testInfo, "desktop")) {
    const source = await page.context().newPage();
    try {
      await source.goto(`${sourceOrigin}/demo-fashion-store-checkout.html`, {
        waitUntil: "networkidle",
      });
      await source.evaluate(async () => document.fonts.ready);
      const [sourceBody, implementationBody] = await Promise.all([
        source.locator("section:nth-of-type(2) .row.align-items-start").boundingBox(),
        checkout.locator("section:nth-of-type(2) form.row.align-items-start").boundingBox(),
      ]);
      expect(sourceBody).not.toBeNull();
      expect(implementationBody).not.toBeNull();
      expect(Math.abs(sourceBody!.width - implementationBody!.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sourceBody!.x - implementationBody!.x)).toBeLessThanOrEqual(2);
    } finally {
      await source.close();
    }
  }
});

test("checkout-account-open interaction: optional account and shipping fields stay local", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Dependent-field evidence runs once.");
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") mutations.push(request.url());
  });
  await prepareCheckout(page);
  const account = page.locator("#fashion-create-account + .box");
  await account.click();
  await expect(page.getByLabel("Account username *")).toBeVisible();
  await account.focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Account username *")).toBeHidden();
  await page.getByText("Ship to a different address?", { exact: true }).click();
  await expect(page.locator(".address-fields")).toBeVisible();
  expect(mutations).toEqual([]);
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "checkout-dependent-fields",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("checkout-payment-paypal interaction: payment rows support pointer and keyboard", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Payment evidence runs once.");
  await prepareCheckout(page);
  const paypal = page.getByRole("radio", { name: /PayPal/ });
  await paypal.click();
  await expect(paypal).toBeChecked();
  await expect(page.locator(".fashion-payment-option").last().locator(".collapse")).toHaveClass(
    /show/,
  );
  const check = page.getByRole("radio", { name: "Check payments" });
  await check.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Cash on delivery" })).toBeChecked();
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "checkout-payment-accordion",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("Checkout fixture validation records intent without creating a session", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Session evidence runs once.");
  let checkoutCount = 0;
  let checkoutBody: unknown;
  await prepareCheckout(page, {
    onCheckout(body) {
      checkoutCount += 1;
      checkoutBody = body;
    },
  });
  await fillBilling(page);
  await page.getByLabel("Email address *").fill("invalid");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByLabel("Email address *")).toBeFocused();
  expect(checkoutCount).toBe(0);
  await page.getByLabel("Email address *").fill("ada@example.test");
  await page.locator(".your-order-box .terms-condition-box label").click();
  const submit = page.getByRole("button", { name: "Place order" });
  await submit.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  expect(checkoutCount).toBe(0);
  expect(checkoutBody).toBeUndefined();
  await expect(page.locator("[data-fashion-store-checkout]")).toHaveAttribute(
    "data-session-count",
    "0",
  );
  await expect(page.getByRole("status")).toContainText(
    "Checkout preview intent recorded. No order or payment session was created.",
  );
  await expect(page).toHaveURL(/\/checkout$/);
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "checkout-session-progression",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("Checkout fixture stays isolated from Commerce availability and configuration", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Fallback evidence runs once.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareCheckout(page, { canCheckout: false });
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
  await expect(page.locator(".your-order-table tr.product")).toHaveCount(3);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-fashion-store-checkout]")).toHaveCount(1);
  await expect(page.locator(".fashion-payment-option")).toHaveCount(4);
  const failedConfiguration = await page.context().newPage();
  try {
    await prepareCheckout(failedConfiguration, { configurationFailure: true });
    await expect(failedConfiguration.locator("[data-fashion-store-checkout]")).toHaveAttribute(
      "data-runtime-status",
      "ready",
    );
    await expect(failedConfiguration.getByRole("button", { name: "Place order" })).toBeEnabled();
  } finally {
    await failedConfiguration.close();
  }
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "checkout-dependent-fields", mode: "fallback" },
    { actionOutcome: true, behaviorId: "checkout-payment-accordion", mode: "fallback" },
    { actionOutcome: true, behaviorId: "checkout-session-progression", mode: "fallback" },
  );
});

test("Checkout fixture ignores an empty Commerce response and preserves source fixtures", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Commerce evidence runs once.");
  await prepareCheckout(page, { emptyCart: true });
  await expect(page.locator(".your-order-table tr.product")).toHaveCount(3);
  await expect(page.locator(".your-order-table")).toContainText("$405.00");
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
});
