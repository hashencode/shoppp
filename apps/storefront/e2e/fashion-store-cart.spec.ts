import { expect, test, type Page } from "@playwright/test";

import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const sourceOrigin = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}`;
const variantIds = [
  "var_01J00000000000000000000000",
  "var_01J00000000000000000000001",
  "var_01J00000000000000000000002",
] as const;

const cart = (quantities = [1, 1, 1], selectedShippingMethodId: string | null = null) => {
  const products = [
    ["Textured sweater", 2_300, "Pink"],
    ["Bermuda shorts", 3_500, "Brown"],
    ["Pocket sweatshirt", 1_500, "White"],
  ] as const;
  const lines = products.map(([productName, amount, variantName], index) => ({
    availableQuantity: 20,
    lineTotal: { amount: amount * (quantities[index] ?? 1), currency: "USD" },
    productName,
    quantity: quantities[index] ?? 1,
    unitPrice: { amount, currency: "USD" },
    variantId: variantIds[index]!,
    variantName,
  }));
  const subtotal = lines.reduce((total, line) => total + line.lineTotal.amount, 0);
  const shippingTotal = selectedShippingMethodId?.endsWith("1") ? 1_200 : 0;
  return {
    adjustments: [],
    canCheckout: true,
    currency: "USD",
    expiresAt: "2026-08-08T00:00:00.000Z",
    id: "cart_01J00000000000000000000000",
    lines,
    selectedShippingMethodId,
    shippingAddress: null,
    shippingMethods: [
      { amount: 0, currency: "USD", id: "ship_01J00000000000000000000000", name: "Free shipping" },
      { amount: 1_200, currency: "USD", id: "ship_01J00000000000000000000001", name: "Flat" },
      { amount: 0, currency: "USD", id: "ship_01J00000000000000000000002", name: "Local pickup" },
    ],
    totals: {
      discountTotal: 0,
      grandTotal: subtotal + shippingTotal,
      shippingTotal,
      subtotal,
      taxTotal: 0,
    },
  };
};

async function prepareCart(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("shoppp.guest-cart-token", "cart-token"));
  await page.goto("/cart", { waitUntil: "networkidle" });
  await page.locator("[data-fashion-store-cart][data-runtime-status='ready']").waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await page.getByRole("button", { name: "Allow cookies" }).click();
}

test("Cart preserves source rows, totals, controls, and responsive geometry", async ({
  page,
}, testInfo) => {
  await prepareCart(page);
  const source = await page.context().newPage();
  await source.goto(`${sourceOrigin}/demo-fashion-store-cart.html`, { waitUntil: "networkidle" });
  await source.evaluate(async () => document.fonts.ready);

  const cartPage = page.locator("[data-fashion-store-cart]");
  await expect(cartPage.getByRole("heading", { name: "Shopping cart" })).toBeVisible();
  await expect(cartPage.locator(".cart-products tbody tr")).toHaveCount(3);
  await expect(cartPage.locator(".cart-products")).toContainText("Textured sweater");
  await expect(cartPage.locator(".cart-products")).toContainText("Bermuda shorts");
  await expect(cartPage.locator(".cart-products")).toContainText("Pocket sweatshirt");
  await expect(cartPage.locator(".total-price-table")).toContainText("$405.00");
  await expect(cartPage.locator(".shipping input")).toHaveCount(3);
  await expect(cartPage.locator("img.cart-product-image")).toHaveCount(3);

  const [referenceBox, implementationBox] = await Promise.all([
    source.locator("section:nth-of-type(2) .row.align-items-start").boundingBox(),
    cartPage.locator("section:nth-of-type(2) .row.align-items-start").boundingBox(),
  ]);
  expect(referenceBox).not.toBeNull();
  expect(implementationBox).not.toBeNull();
  expect(Math.abs(referenceBox!.width - implementationBox!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(referenceBox!.x - implementationBox!.x)).toBeLessThanOrEqual(2);
  await source.close();

  expect(["fashion-store-desktop", "fashion-store-laptop", "fashion-store-tablet", "fashion-store-mobile"]).toContain(testInfo.project.name);
});

test("cart-first-line-quantity-2 interaction: quantity and removal dispatch once through guest cart", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Mutation evidence runs once.");
  let patchCount = 0;
  let deleteCount = 0;
  let quantityBody: unknown;
  await page.route("**/api/cart/lines/**", async (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      patchCount += 1;
      quantityBody = route.request().postDataJSON();
      await route.fulfill({ contentType: "application/json", json: { data: cart([2, 1, 1]) } });
      return;
    }
    deleteCount += 1;
    const response = cart([2, 1, 1]);
    response.lines = response.lines.filter((line) => line.variantId !== variantIds[1]);
    await route.fulfill({ contentType: "application/json", json: { data: response } });
  });
  await prepareCart(page);
  const firstRow = page.locator(".cart-products tbody tr").first();
  await firstRow.getByRole("button", { name: "Increase Textured sweater quantity" }).click();
  await expect.poll(() => patchCount).toBe(1);
  expect(quantityBody).toEqual({ quantity: 2 });
  await expect(firstRow.getByRole("spinbutton", { name: "Textured sweater quantity" })).toHaveValue("2");
  await expect(page.locator("[data-fashion-store-cart]")).toHaveAttribute("data-mutation-count", "1");

  const remove = page.getByRole("button", { name: "Remove Bermuda shorts" });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => deleteCount).toBe(1);
  await expect(page.locator(".cart-products tbody tr")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Remove Pocket sweatshirt" })).toBeFocused();
  await expect(page.locator("[data-fashion-store-cart]")).toHaveAttribute("data-mutation-count", "2");
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "cart-line-mutations",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("cart-shipping-open interaction: calculator validates locally and quotes once", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Shipping evidence runs once.");
  let quoteCount = 0;
  let quoteBody: unknown;
  await page.route("**/api/cart/shipping", async (route) => {
    quoteCount += 1;
    quoteBody = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      json: { data: cart([1, 1, 1], "ship_01J00000000000000000000000") },
    });
  });
  await prepareCart(page);
  const trigger = page.getByRole("button", { name: "Calculate shipping" });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await page.locator("#shipping-accordion button", { hasText: "Update" }).click();
  const country = page.locator("#shipping-accordion select").first();
  await expect(country).toHaveAttribute("aria-invalid", "true");
  expect(quoteCount).toBe(0);
  await country.selectOption("US");
  await page.getByPlaceholder("Town/City").fill("Austin");
  await page.getByPlaceholder("ZIP").fill("78701");
  await page.locator("#shipping-accordion button", { hasText: "Update" }).click();
  await expect.poll(() => quoteCount).toBe(1);
  expect(quoteBody).toMatchObject({
    shippingAddress: { city: "Austin", countryCode: "US", postalCode: "78701" },
    shippingMethodId: "ship_01J00000000000000000000000",
  });
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "cart-shipping-calculator",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("cart-coupon-invalid interaction: local controls never post coupon data and checkout carries the guest boundary", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Local-control evidence runs once.");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });
  await prepareCart(page);
  const coupon = page.getByPlaceholder("Coupon code");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(coupon).toBeFocused();
  await coupon.fill("SOURCE10");
  await page.getByRole("button", { name: "Apply" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-fashion-store-cart]")).toHaveAttribute("data-local-action-count", "2");
  expect(requests).toEqual([]);

  await page.evaluate(() => document.querySelector<HTMLElement>(".header-cart")?.classList.add("open"));
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText("Preview template unavailable")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("shoppp.guest-cart-token"))).toBe("cart-token");
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "cart-local-controls",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("Cart fallback keeps native lines, calculator, local controls, and checkout destination readable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Fallback evidence runs once.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareCart(page);
  await expect(page.locator(".cart-products tbody tr")).toHaveCount(3);
  await expect(page.locator(".cart-products input[type='number']")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Calculate shipping" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Proceed to checkout" })).toHaveAttribute("href", "/checkout");
  await prepareCart(page);
  await expect(page.locator(".cart-products tbody tr")).toHaveCount(3);
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "cart-line-mutations", mode: "fallback" },
    { actionOutcome: true, behaviorId: "cart-shipping-calculator", mode: "fallback" },
    { actionOutcome: true, behaviorId: "cart-local-controls", mode: "fallback" },
  );
});
