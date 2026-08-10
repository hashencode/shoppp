import { expect, test, type Page } from "@playwright/test";

import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const sourceOrigin = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}`;

const cart = (quantity: number) => ({
  adjustments: [],
  canCheckout: true,
  currency: "USD",
  expiresAt: "2026-08-08T00:00:00.000Z",
  id: "cart_01J00000000000000000000000",
  lines: [
    {
      availableQuantity: 20,
      lineTotal: { amount: 6_500 * quantity, currency: "USD" },
      productName: "Relaxed corduroy shirt",
      quantity,
      unitPrice: { amount: 6_500, currency: "USD" },
      variantId: "var_01J00000000000000000000000",
      variantName: "Gold / S",
    },
  ],
  selectedShippingMethodId: null,
  shippingAddress: null,
  shippingMethods: [],
  totals: {
    discountTotal: 0,
    grandTotal: 6_500 * quantity,
    shippingTotal: 0,
    subtotal: 6_500 * quantity,
    taxTotal: 0,
  },
});

async function prepare(page: Page, path: "/account" | "/wishlist"): Promise<void> {
  await page.goto(path, { waitUntil: "networkidle" });
  await page
    .locator(`[data-fashion-store-${path.slice(1)}][data-runtime-status='ready']`)
    .waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await page.getByRole("button", { name: "Allow cookies" }).click();
}

test("Wishlist and Account preserve their independent source content and responsive geometry", async ({
  page,
}, testInfo) => {
  await prepare(page, "/wishlist");
  const wishlist = page.locator("[data-fashion-store-wishlist]");
  await expect(wishlist.locator(".fashion-wishlist-grid > .grid-item")).toHaveCount(8);
  await expect(wishlist.locator(".shop-footer").first()).toContainText("Textured sweater");
  await expect(wishlist.locator(".shop-footer").last()).toContainText("Texture regular");
  await expect(wishlist.locator(".fashion-wishlist-add")).toHaveCount(8);
  await expect(wishlist.locator(".fashion-wishlist-remove")).toHaveCount(8);
  await expect(wishlist.locator(".shop-footer > a").first()).toHaveAttribute(
    "href",
    "/products/relaxed-corduroy-shirt",
  );

  await prepare(page, "/account");
  const account = page.locator("[data-fashion-store-account]");
  await expect(account.getByRole("heading", { name: "My account" })).toBeVisible();
  await expect(account.locator("form")).toHaveCount(2);
  await expect(account.locator('input[type="password"]')).toHaveCount(2);
  await expect(account.getByLabel("Remember me")).not.toBeChecked();

  if (testInfo.project.name === "fashion-store-desktop") {
    const source = await page.context().newPage();
    try {
      await source.goto(`${sourceOrigin}/demo-fashion-store-account.html`, {
        waitUntil: "networkidle",
      });
      const [sourceForms, implementationForms] = await Promise.all([
        source.locator("section:nth-of-type(2) .row").boundingBox(),
        account.locator(".fashion-account-forms").boundingBox(),
      ]);
      expect(Math.abs(sourceForms!.x - implementationForms!.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(sourceForms!.width - implementationForms!.width)).toBeLessThanOrEqual(2);
    } finally {
      await source.close();
    }
  }
});

test("wishlist-first-product-actions interaction: cart and removal stay host-owned or local", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Interaction evidence runs once.");
  await page.addInitScript(() => localStorage.setItem("shoppp.guest-cart-token", "cart-token"));
  let addRequests = 0;
  let requestBody: unknown;
  await page.route("**/cart", (route) =>
    route.fulfill({ contentType: "application/json", json: { data: cart(0) } }),
  );
  await page.route("**/cart/lines", async (route) => {
    addRequests += 1;
    requestBody = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", json: { data: cart(1) } });
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepare(page, "/wishlist");
  const firstCard = page.locator(".fashion-wishlist-grid > .grid-item").first();
  await firstCard.hover();
  await firstCard.getByRole("button", { name: "Add to cart" }).click();
  await expect.poll(() => addRequests).toBe(1);
  await expect(page.locator("[data-fashion-store-wishlist]")).toHaveAttribute(
    "data-cart-add-count",
    "1",
  );
  expect(requestBody).toEqual({
    expectedUnitPrice: { amount: 6500, currency: "USD" },
    quantity: 1,
    releaseId: "representative-release-2026-07-30",
    variantId: "var_01JFSHIRTBLUEM00000000001",
  });

  const remove = firstCard.getByRole("button", { name: /Remove Textured sweater/ });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".fashion-wishlist-grid > .grid-item")).toHaveCount(7);
  await expect(page.getByRole("button", { name: /Remove Traveller shirt/ })).toBeFocused();
  recordThemeBehaviorEvidence(
    testInfo,
    {
      actionOutcome: true,
      behaviorId: "wishlist-product-actions",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "wishlist-local-removal",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
  );
});

test("Wishlist fallback restores its populated baseline without persistence claims", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Fallback evidence runs once.");
  await prepare(page, "/wishlist");
  await page.getByRole("button", { name: /Remove Textured sweater/ }).click();
  await expect(page.locator(".fashion-wishlist-grid > .grid-item")).toHaveCount(7);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".fashion-wishlist-grid > .grid-item")).toHaveCount(8);
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "wishlist-product-actions", mode: "fallback" },
    { actionOutcome: true, behaviorId: "wishlist-local-removal", mode: "fallback" },
  );
});

test("account-forms-ready static: Account preserves two-column source presentation", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "fashion-store-desktop",
    "Focused static evidence runs once.",
  );
  await prepare(page, "/account");
  await expect(page.locator(".fashion-account-forms")).toBeVisible();
  await expect(page.locator(".fashion-account-register-panel")).toHaveCSS("box-shadow", /rgb/);
});

test("Account validates both forms locally and emits no credential or personal-data request", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Interaction evidence runs once.");
  await prepare(page, "/account");
  const nonGetRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") nonGetRequests.push(`${request.method()} ${request.url()}`);
  });

  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.locator("#fashion-login-email")).toBeFocused();
  await page.locator("#fashion-login-email").fill("member@example.test");
  await page.locator("#fashion-login-password").fill("not-transmitted");
  await page.getByLabel("Remember me").focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Remember me")).toBeChecked();
  await page.getByRole("button", { name: "Login" }).press("Enter");
  await expect(page.locator("[data-fashion-store-account]")).toHaveAttribute(
    "data-login-submit-count",
    "1",
  );

  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.locator("#fashion-register-name")).toBeFocused();
  await page.locator("#fashion-register-name").fill("member");
  await page.locator("#fashion-register-email").fill("invalid");
  await page.locator("#fashion-register-password").fill("not-transmitted");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.locator("#fashion-register-email")).toBeFocused();
  await page.locator("#fashion-register-email").fill("member@example.test");
  await page.getByRole("button", { name: "Register" }).press("Enter");
  await expect(page.locator("[data-fashion-store-account]")).toHaveAttribute(
    "data-register-submit-count",
    "1",
  );
  expect(nonGetRequests).toEqual([]);
  await expect(page.locator("[data-fashion-store-account]")).not.toContainText(
    /success|account created|logged in/i,
  );
  recordThemeBehaviorEvidence(
    testInfo,
    {
      actionOutcome: true,
      behaviorId: "account-login-validation",
      branches: [
        { id: "invalid", outcome: true, viewportId: "desktop" },
        { id: "valid", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "account-register-validation",
      branches: [
        { id: "invalid", outcome: true, viewportId: "desktop" },
        { id: "valid", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
  );
});

test("Account fallback resets local fields, remember state, and submission counters", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Fallback evidence runs once.");
  await prepare(page, "/account");
  await page.locator("#fashion-login-email").fill("member@example.test");
  await page.getByLabel("Remember me").focus();
  await page.keyboard.press("Space");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#fashion-login-email")).toHaveValue("");
  await expect(page.getByLabel("Remember me")).not.toBeChecked();
  await expect(page.locator("[data-fashion-store-account]")).toHaveAttribute(
    "data-login-submit-count",
    "0",
  );
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "account-login-validation", mode: "fallback" },
    { actionOutcome: true, behaviorId: "account-register-validation", mode: "fallback" },
  );
});
