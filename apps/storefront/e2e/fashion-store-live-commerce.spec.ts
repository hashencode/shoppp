import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.setTimeout(60_000);

const cartToken = "fashion_live_cart_token_12345678901234567890";
const shippingMethodId = "ship_01J00000000000000000000000";
const variantId = "var_01JFSHIRTGREENXL000000001";
const atlasVariantId = "var_01J00000000000000000000000";
const checkoutAttemptId = "chk_01J00000000000000000000000";
const orderAccessToken = "order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
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
    variantId?: string;
  } = {},
) {
  const quantity = options.quantity ?? 1;
  const lineVariantId = options.variantId ?? variantId;
  const atlas = lineVariantId === atlasVariantId;
  const selectedShippingMethodId = options.selectedShippingMethodId ?? null;
  const shippingTotal = selectedShippingMethodId ? 1_200 : 0;
  const unitAmount = atlas ? 12_900 : 6_500;
  const subtotal = quantity * unitAmount;
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
              productName: atlas ? "Atlas Carry-on" : "Relaxed corduroy shirt",
              quantity,
              unitPrice: { amount: unitAmount, currency: "USD" },
              variantId: lineVariantId,
              variantName: atlas ? "Standard" : "Green / XL",
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

function liveProduct(productId: string) {
  const atlas = productId.endsWith("0000000001");
  const name = atlas ? "Atlas Carry-on" : "Relaxed corduroy shirt";
  const slug = atlas ? "atlas-carry-on" : "relaxed-corduroy-shirt";
  const ids = atlas
    ? [atlasVariantId]
    : ["var_01JFSHIRTGOLDS00000000001", "var_01JFSHIRTGOLDM00000000001", variantId];
  const optionValues = atlas
    ? [{ Style: "Standard" }]
    : [
        { Color: "Gold", Size: "M" },
        { Color: "Gold", Size: "XL" },
        { Color: "Green", Size: "XL" },
      ];
  return {
    description: `${name} live description`,
    id: productId,
    media: [],
    name,
    options: atlas
      ? [{ name: "Style", values: ["Standard"] }]
      : [
          { name: "Color", values: ["Gold", "Green"] },
          { name: "Size", values: ["M", "XL"] },
        ],
    seo: { description: `${name} description`, title: name },
    slug,
    status: "published",
    variants: ids.map((id, index) => ({
      available: true,
      id,
      options: optionValues[index]!,
      price: { amount: atlas ? 12_900 : 6_500 + index * 100, currency: "USD" },
      sku: `${atlas ? "ATLAS" : "SHIRT"}-${index + 1}`,
    })),
  };
}

function paidOrderAccess() {
  return {
    order: {
      createdAt: "2026-08-14T00:00:00.000Z",
      currency: "USD",
      email: "ada@example.test",
      fulfillmentStatus: "unfulfilled",
      lines: [
        {
          currency: "USD",
          discountAmount: 0,
          lineTotalAmount: 6_500,
          productName: "Relaxed corduroy shirt",
          quantity: 1,
          sku: "SHIRT-XL",
          taxAmount: 0,
          unitPriceAmount: 6_500,
          variantName: "Green / XL",
        },
      ],
      orderStatus: "confirmed",
      paymentStatus: "paid",
      publicReference: "SHOPPP-ABC123",
      shippingAddress,
      totals: {
        discountTotal: 0,
        grandTotal: 6_500,
        shippingTotal: 0,
        subtotal: 6_500,
        taxTotal: 0,
      },
    },
    status: "paid",
  };
}

async function installOrderAccessState(page: Page) {
  await page.addInitScript(
    ({ attemptId, token }) => {
      sessionStorage.setItem("shoppp.current-order-access", JSON.stringify({ attemptId, token }));
    },
    { attemptId: checkoutAttemptId, token: orderAccessToken },
  );
}

test("payment cancellation and duplicate return preserve the authoritative cart", async ({
  page,
}) => {
  await installOrderAccessState(page);
  await installLiveCommerce(page, async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path === `/orders/${orderAccessToken}`) {
      await route.fulfill({
        contentType: "application/json",
        json: { data: { status: "pending" } },
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/checkout/complete?return=canceled", { waitUntil: "networkidle" });
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Payment was not confirmed");
  await expect(heading).toBeFocused();
  await expect(page.getByRole("status")).toContainText("cart has been preserved");
  await expect(page.getByRole("link", { name: "Return to bag" })).toHaveAttribute("href", "/cart");

  await page.reload();
  await expect(heading).toHaveText("Payment return already received");
  await expect(heading).toBeFocused();
  await expect(page.getByRole("status")).toContainText("latest Commerce status");
});

test("payment return retries a failed lookup and refreshes the cart only after confirmation", async ({
  page,
}) => {
  let orderRequests = 0;
  let cartRefreshes = 0;
  await installOrderAccessState(page);
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (path === `/orders/${orderAccessToken}`) {
      orderRequests += 1;
      if (orderRequests === 1) {
        await route.abort("failed");
      } else {
        await route.fulfill({ contentType: "application/json", json: { data: paidOrderAccess() } });
      }
      return;
    }
    if (path === "/cart" && request.method() === "GET") {
      cartRefreshes += 1;
      await route.fulfill({
        contentType: "application/json",
        json: { data: cart({ quantity: 0 }) },
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/checkout/complete", { waitUntil: "networkidle" });
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Payment status could not be checked");
  await expect(heading).toBeFocused();
  expect(cartRefreshes).toBe(1);

  await page.getByRole("button", { name: "Retry status check" }).click();
  await expect(heading).toHaveText("Payment confirmed");
  await expect(heading).toBeFocused();
  await expect(page.getByRole("link", { name: "View order" })).toHaveAttribute(
    "href",
    `/orders/${orderAccessToken}`,
  );
  expect(cartRefreshes).toBe(2);
});

test("live Cart and Checkout remain content-complete and transaction-read-only without JavaScript", async ({
  browser,
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    const noJsPage = await noJsContext.newPage();
    await noJsPage.goto(new URL("/cart", baseURL).href);
    const cartPage = noJsPage.locator("[data-fashion-store-cart]");
    await expect(cartPage.getByRole("heading", { name: "Shopping cart" })).toBeVisible();
    await expect(cartPage.getByText("Shopping actions require JavaScript.")).toBeVisible();
    const cartButtons = cartPage.getByRole("button");
    expect(await cartButtons.count()).toBeGreaterThan(0);
    for (const button of await cartButtons.all()) await expect(button).toBeDisabled();

    await noJsPage.goto(new URL("/checkout", baseURL).href);
    const checkoutPage = noJsPage.locator("[data-fashion-store-checkout]");
    await expect(checkoutPage.getByText("Billing details")).toBeVisible();
    await expect(checkoutPage.getByText("Shopping actions require JavaScript.")).toBeVisible();
    await expect(checkoutPage.getByRole("button", { name: "Place order" })).toBeDisabled();
    await expect(checkoutPage.getByRole("link", { name: "Return to bag" })).toHaveAttribute(
      "href",
      "/cart",
    );
  } finally {
    await noJsContext.close();
  }
});

test("live non-Home and platform routes share Experience presentation around authoritative facts", async ({
  page,
}) => {
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const productMatch = path.match(/^\/catalog\/products\/by-id\/([^/]+)\/live$/);
    if (productMatch && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: liveProduct(decodeURIComponent(productMatch[1]!)) },
      });
      return;
    }
    if (path === `/orders/${orderAccessToken}` && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: { data: paidOrderAccess() } });
      return;
    }
    await route.abort();
  });

  await page.goto("/products/atlas-carry-on", { waitUntil: "networkidle" });
  await expect(page.locator(".header-top-bar")).toContainText("Live Experience announcement");
  await expect(page.locator("[data-fashion-store-header]")).toContainText(
    "Live Experience header support",
  );
  await expect(page.locator("footer")).toContainText("Live Experience footer support");

  await page.goto(`/orders/${orderAccessToken}`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-order-presentation-help]")).toContainText(
    "Live Experience order help",
  );
  await expect(page.locator("[data-order-presentation-policy-link]")).toHaveAttribute(
    "href",
    "/policies/privacy",
  );
  await expect(page.getByText("Order SHOPPP-ABC123 · ada@example.test")).toBeVisible();

  await page.goto("/policies/privacy", { waitUntil: "networkidle" });
  await expect(page.locator("[data-policy-presentation]")).toContainText(
    "Live Experience policy help",
  );
  await expect(page.locator("[data-policy-presentation-document-link]")).toHaveAttribute(
    "href",
    "/policies/shipping",
  );
  await expect(page.locator("[data-policy-presentation-related-link]")).toHaveAttribute(
    "href",
    "/policies/returns",
  );
  await expect(page.getByText(/We process contact, delivery, order/)).toBeVisible();
});

test("live browse-to-order journey converges on an authoritative paid return", async ({
  page,
}, testInfo) => {
  let currentCart = cart({ quantity: 0 });
  let checkoutInput: Record<string, unknown> | undefined;
  let cartRefreshesAfterCheckout = 0;
  let checkoutCreated = false;
  const returnUrl = new URL("/checkout/complete", String(testInfo.project.use.baseURL)).href;
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const productMatch = path.match(/^\/catalog\/products\/by-id\/([^/]+)\/live$/);
    if (productMatch && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: liveProduct(decodeURIComponent(productMatch[1]!)) },
      });
      return;
    }
    if (path === "/cart" && request.method() === "GET") {
      if (checkoutCreated) cartRefreshesAfterCheckout += 1;
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    if (path === "/cart/lines" && request.method() === "POST") {
      currentCart = cart();
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    if (path === "/platform/config") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: { turnstile: { required: false, siteKey: null } } },
      });
      return;
    }
    if (path === "/cart/shipping" && request.method() === "PUT") {
      currentCart = cart({
        address: shippingAddress,
        selectedShippingMethodId: shippingMethodId,
      });
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    if (path === "/checkout/sessions" && request.method() === "POST") {
      checkoutInput = request.postDataJSON() as Record<string, unknown>;
      checkoutCreated = true;
      currentCart = cart({ quantity: 0 });
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: {
            attemptId: checkoutAttemptId,
            checkoutUrl: returnUrl,
            expiresAt: "2026-08-14T12:00:00.000Z",
            orderAccessToken,
            status: "payment_pending",
          },
        },
        status: 201,
      });
      return;
    }
    if (path === `/orders/${orderAccessToken}` && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: { data: paidOrderAccess() } });
      return;
    }
    await route.abort();
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Allow cookies" }).click();
  await page
    .locator("[data-fashion-store-product-card]")
    .filter({ hasText: "Relaxed corduroy shirt" })
    .first()
    .getByRole("link", { name: "Relaxed corduroy shirt", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products\/relaxed-corduroy-shirt$/);

  const product = page.locator("[data-fashion-store-live-product]");
  await product.getByRole("radio", { name: "Green" }).check();
  await product.getByRole("radio", { name: "XL" }).check();
  await product.getByRole("button", { name: "Add to cart" }).click();
  await expect(product.getByRole("status")).toContainText("was added to your cart");
  const headerCart = page.locator(".header-cart");
  await headerCart.hover();
  await headerCart.locator('a[href="/cart"]').click();

  await page.locator("[data-fashion-store-cart][data-runtime-status='ready']").waitFor();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.locator("[data-fashion-store-checkout][data-runtime-status='ready']").waitFor();
  await page.getByLabel("First name *").fill("Ada");
  await page.getByLabel("Last name *").fill("Buyer");
  await page.getByLabel("Street address *").fill(shippingAddress.line1);
  await page.getByLabel("Town / City *").fill(shippingAddress.city);
  await page.getByLabel("State *").selectOption(shippingAddress.region);
  await page.getByLabel("ZIP *").fill(shippingAddress.postalCode);
  await page.getByLabel("Phone *").fill("5125550100");
  await page.getByLabel("Email address *").fill("ada@example.test");
  await expect(page.getByRole("radio", { name: "Tracked delivery" })).toBeChecked();
  await page.locator(".your-order-box .terms-condition-box label").click();
  await expect(page.locator('input[type="checkbox"][required]')).toBeChecked();
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/checkout\/complete$/);
  const returnHeading = page.getByRole("heading", { level: 1 });
  await expect(returnHeading).toHaveText("Payment confirmed");
  await expect(returnHeading).toBeFocused();
  await expect(page.getByRole("status")).toContainText("SHOPPP-ABC123");
  expect(checkoutInput).toMatchObject({
    acceptTerms: true,
    cartId: "cart_01J00000000000000000000000",
    currency: "USD",
    email: "ada@example.test",
    shippingMethodId,
  });
  expect(cartRefreshesAfterCheckout).toBe(1);
});

test("live Product requires a valid grouped option combination and stays truthful without JavaScript", async ({
  browser,
  page,
}) => {
  let submitted: Record<string, unknown> | undefined;
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const productMatch = path.match(/^\/catalog\/products\/by-id\/([^/]+)\/live$/);
    if (productMatch && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: liveProduct(decodeURIComponent(productMatch[1]!)) },
      });
      return;
    }
    if (path === "/cart" && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: cart({ quantity: 0 }) },
      });
      return;
    }
    if (path === "/cart/lines" && request.method() === "POST") {
      submitted = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ contentType: "application/json", json: { data: cart() } });
      return;
    }
    await route.abort();
  });

  await page.goto("/products/relaxed-corduroy-shirt", { waitUntil: "networkidle" });
  const product = page.locator("[data-fashion-store-live-product]");
  await expect(product.getByRole("group", { name: "Color" })).toBeVisible();
  await expect(product.getByRole("group", { name: "Size" })).toBeVisible();
  await product.getByRole("button", { name: "Add to cart" }).click();
  const optionError = product.locator("[data-product-option-error]");
  await expect(optionError).toContainText("Choose Color and Size");
  await expect(optionError).toBeFocused();

  await product.getByRole("radio", { name: "Green" }).check();
  await expect(product.getByRole("radio", { name: "M" })).toBeDisabled();
  await product.getByRole("radio", { name: "XL" }).check();
  await expect(product.locator("[data-live-product-price]")).toContainText("$67.00");
  await product.getByRole("button", { name: "Add to cart" }).click();
  await expect(product.getByRole("status")).toContainText("was added to your cart");
  expect(submitted).toMatchObject({ quantity: 1, variantId });

  const accessibility = await new AxeBuilder({ page })
    .include("[data-fashion-store-live-product]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
    JSON.stringify(accessibility.violations, null, 2),
  ).toEqual([]);

  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    const noJsPage = await noJsContext.newPage();
    await noJsPage.goto(new URL("/products/relaxed-corduroy-shirt", page.url()).href);
    const noJsProduct = noJsPage.locator("[data-fashion-store-live-product]");
    await expect(noJsProduct.getByText("Shopping actions require JavaScript.")).toBeVisible();
    await expect(noJsProduct.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    await expect(
      noJsProduct.getByRole("link", { name: "Browse the published catalog" }),
    ).toHaveAttribute("href", "/shop");
  } finally {
    await noJsContext.close();
  }
});

test("live Product enables retry after initial Commerce revalidation fails", async ({ page }) => {
  let productUnavailable = true;
  let cartPosts = 0;
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const productMatch = path.match(/^\/catalog\/products\/by-id\/([^/]+)\/live$/);
    if (productMatch && request.method() === "GET") {
      if (productUnavailable) await route.abort("failed");
      else {
        await route.fulfill({
          contentType: "application/json",
          json: { data: liveProduct(decodeURIComponent(productMatch[1]!)) },
        });
      }
      return;
    }
    if (path === "/cart" && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: cart({ quantity: 0 }) },
      });
      return;
    }
    if (path === "/cart/lines" && request.method() === "POST") {
      cartPosts += 1;
      await route.fulfill({ contentType: "application/json", json: { data: cart() } });
      return;
    }
    await route.abort();
  });

  await page.goto("/products/relaxed-corduroy-shirt", { waitUntil: "networkidle" });
  const product = page.locator("[data-fashion-store-live-product]");
  const retry = product.getByRole("button", { name: "Retry and add to cart" });
  await expect(retry).toBeEnabled();
  productUnavailable = false;
  await retry.click();
  await product.getByRole("radio", { name: "Green" }).check();
  await product.getByRole("radio", { name: "XL" }).check();
  await product.getByRole("button", { name: "Add to cart" }).click();
  await expect(product.getByRole("status")).toContainText("was added to your cart");
  expect(cartPosts).toBe(1);
});

test("live Home preserves all sections and card outcomes across input modes", async ({
  browser,
  page,
}) => {
  let submitted: Record<string, unknown> | undefined;
  let productRevalidationCount = 0;
  const handleCommerce = async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const productMatch = path.match(/^\/catalog\/products\/by-id\/([^/]+)\/live$/);
    if (productMatch && request.method() === "GET") {
      productRevalidationCount += 1;
      const productId = decodeURIComponent(productMatch[1]!);
      await route.fulfill({
        contentType: "application/json",
        json: { data: liveProduct(productId) },
      });
      return;
    }
    if (path === "/cart" && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: cart({ quantity: 0 }) },
      });
      return;
    }
    if (path === "/cart/lines" && request.method() === "POST") {
      submitted = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        contentType: "application/json",
        json: { data: cart({ variantId: atlasVariantId }) },
      });
      return;
    }
    await route.abort();
  };
  await installLiveCommerce(page, handleCommerce);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  await expect(page.locator("body")).toHaveClass(/fashion-store-home/);
  await expect(page.locator(".header-cart > button")).toHaveCSS("padding-left", "14px");
  const home = page.locator("[data-fashion-store-live-home]");
  await expect(home).toHaveCount(1);
  await expect(home.locator("[data-home-section]")).toHaveCount(10);
  const accessibility = await new AxeBuilder({ page })
    .include("[data-fashion-store-live-home]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
    JSON.stringify(accessibility.violations, null, 2),
  ).toEqual([]);
  await expect
    .poll(() =>
      home
        .locator("[data-home-section]")
        .evaluateAll((sections) =>
          sections.map((section) => section.getAttribute("data-home-section")),
        ),
    )
    .toEqual([
      "hero",
      "services",
      "categories",
      "best-sellers",
      "promotion",
      "collection",
      "brands",
      "featured-products",
      "marquee",
      "magazine",
    ]);
  await expect(home.locator('[data-home-section="services"] .row > div')).toHaveCount(4);
  await expect(home.locator('[data-home-section="categories"] .row > div')).toHaveCount(4);
  await expect(home.locator('[data-home-section="collection"] img')).toHaveCount(4);
  await expect(home.locator('[data-home-section="brands"] .row > div')).toHaveCount(5);
  await expect(home.locator('[data-home-section="magazine"] article')).toHaveCount(4);
  expect(
    await home
      .locator(
        '[data-home-section]:not([data-home-section="best-sellers"]):not([data-home-section="featured-products"]) img',
      )
      .evaluateAll((images) =>
        images.every(
          (image) =>
            image.getAttribute("src")?.startsWith("/_nuxt/themes/fashion-store/") &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);

  const cards = home.locator("[data-fashion-store-product-card]");
  await expect(cards).toHaveCount(4);
  expect(productRevalidationCount).toBe(0);
  const directCard = cards.filter({ hasText: "Atlas Carry-on" }).first();
  const optionsCard = cards.filter({ hasText: "Relaxed corduroy shirt" }).first();
  await expect(directCard).toHaveAttribute("data-card-variant", "home");
  await expect(directCard).toHaveAttribute("data-action-state", "available");
  const directAdd = directCard.getByRole("button", { name: "Add to cart" });
  await directAdd.focus();
  await expect(directAdd).toBeFocused();
  await expect(directAdd).toHaveCSS("visibility", "visible");
  await expect(directCard.getByRole("button", { name: "Add to wishlist" })).toHaveCount(0);
  await directAdd.press("Enter");
  await expect(directCard).toHaveAttribute("data-action-state", "succeeded");
  await expect(directCard.getByRole("status")).toContainText("was added to your cart");
  expect(productRevalidationCount).toBe(1);
  expect(submitted).toMatchObject({ quantity: 1, variantId: atlasVariantId });

  await optionsCard.hover();
  await expect(optionsCard.getByRole("link", { name: "Choose options" })).toHaveAttribute(
    "href",
    "/products/relaxed-corduroy-shirt",
  );

  for (const width of [575, 576, 767, 768, 991, 992, 1199, 1200, 1399, 1400]) {
    await page.setViewportSize({ height: 900, width });
    await expect(directCard).toBeVisible();
    expect(
      await directCard.evaluate((element) => element.getBoundingClientRect().right <= innerWidth),
    ).toBe(true);
  }

  const title = optionsCard.getByRole("link", { name: "Relaxed corduroy shirt", exact: true });
  await title.focus();
  await expect(title).toBeFocused();
  await title.press("Enter");
  await expect(page).toHaveURL(/\/products\/relaxed-corduroy-shirt$/);
  await expect(page.locator("body")).not.toHaveClass(/fashion-store-home/);
  await expect(page.locator(".header-cart > button")).toHaveCSS("padding-left", "18px");
  await expect(page.getByRole("link", { name: "Account", exact: true })).toHaveCount(0);

  const touchContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
    viewport: { height: 844, width: 390 },
  });
  try {
    const touchPage = await touchContext.newPage();
    await installLiveCommerce(touchPage, handleCommerce);
    await touchPage.goto("/", { waitUntil: "domcontentloaded" });
    const touchCard = touchPage
      .locator("[data-fashion-store-product-card]")
      .filter({ hasText: "Atlas Carry-on" })
      .first();
    await expect(touchCard).toHaveAttribute("data-action-state", "available");
    await touchPage.getByRole("button", { name: "Allow cookies" }).click();
    await touchCard.getByRole("button", { name: "Add to cart" }).tap();
    await expect(touchCard).toHaveAttribute("data-action-state", "succeeded");
    await touchPage.goto("/", { waitUntil: "domcontentloaded" });
    await expect(touchCard).toHaveAttribute("data-action-state", "available");
    await touchPage.getByRole("button", { name: "Allow cookies" }).click();
    await touchPage
      .locator("[data-fashion-store-product-card]")
      .filter({ hasText: "Atlas Carry-on" })
      .first()
      .locator(".shop-image > a")
      .tap();
    await expect(touchPage).toHaveURL(/\/products\/atlas-carry-on$/);
  } finally {
    await touchContext.close();
  }
});

test("live Home card failures stay truthful and recoverable", async ({ page }) => {
  let mode: "cart-error" | "product-error" | "unavailable" = "unavailable";
  let cartPostCount = 0;
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const productMatch = path.match(/^\/catalog\/products\/by-id\/([^/]+)\/live$/);
    if (productMatch && request.method() === "GET") {
      if (mode === "product-error") {
        await route.abort("failed");
        return;
      }
      const product = liveProduct(decodeURIComponent(productMatch[1]!));
      if (mode === "unavailable") {
        product.variants = product.variants.map((variant) => ({ ...variant, available: false }));
      }
      await route.fulfill({ contentType: "application/json", json: { data: product } });
      return;
    }
    if (path === "/cart" && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: cart({ quantity: 0 }) },
      });
      return;
    }
    if (path === "/cart/lines" && request.method() === "POST") {
      cartPostCount += 1;
      await route.fulfill({
        contentType: "application/json",
        json: { error: { code: "commerce_unavailable", message: "Commerce unavailable" } },
        status: 503,
      });
      return;
    }
    await route.abort();
  });

  const atlasCard = () =>
    page.locator("[data-fashion-store-product-card]").filter({ hasText: "Atlas Carry-on" }).first();

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(atlasCard()).toHaveAttribute("data-action-state", "available");
  await atlasCard().getByRole("button", { name: "Add to cart" }).click();
  await expect(atlasCard()).toHaveAttribute("data-action-state", "unavailable");
  await expect(atlasCard().locator('button[aria-label="Unavailable"]')).toBeDisabled();
  expect(cartPostCount).toBe(0);

  mode = "product-error";
  await page.reload({ waitUntil: "networkidle" });
  await expect(atlasCard()).toHaveAttribute("data-action-state", "available");
  await atlasCard().getByRole("button", { name: "Add to cart" }).click();
  await expect(atlasCard()).toHaveAttribute("data-action-state", "retry");
  await expect(atlasCard().getByRole("button", { name: "Retry add to cart" })).toBeEnabled();
  expect(cartPostCount).toBe(0);

  mode = "cart-error";
  await page.reload({ waitUntil: "networkidle" });
  await expect(atlasCard()).toHaveAttribute("data-action-state", "available");
  await atlasCard().getByRole("button", { name: "Add to cart" }).click();
  await expect(atlasCard()).toHaveAttribute("data-action-state", "retry");
  await expect(atlasCard().getByRole("alert")).toContainText("try again");
  await expect(atlasCard().getByRole("button", { name: "Retry add to cart" })).toBeEnabled();
  expect(cartPostCount).toBe(1);
});

test("live Home card can be added again after MiniCart removal", async ({ page }) => {
  let currentCart = cart({ quantity: 0 });
  let cartPosts = 0;
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const productMatch = path.match(/^\/catalog\/products\/by-id\/([^/]+)\/live$/);
    if (productMatch && request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: { data: liveProduct(decodeURIComponent(productMatch[1]!)) },
      });
      return;
    }
    if (path === "/cart" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    if (path === "/cart/lines" && request.method() === "POST") {
      cartPosts += 1;
      currentCart = cart({ variantId: atlasVariantId });
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    if (path === `/cart/lines/${atlasVariantId}` && request.method() === "DELETE") {
      currentCart = cart({ quantity: 0 });
      await route.fulfill({ contentType: "application/json", json: { data: currentCart } });
      return;
    }
    await route.abort();
  });

  await page.goto("/", { waitUntil: "networkidle" });
  const card = page
    .locator("[data-fashion-store-product-card]")
    .filter({ hasText: "Atlas Carry-on" })
    .first();
  await card.getByRole("button", { name: "Add to cart" }).click();
  await expect(card).toHaveAttribute("data-action-state", "succeeded");

  const headerCart = page.locator(".header-cart");
  await headerCart.hover();
  await headerCart.getByRole("button", { name: "Remove Atlas Carry-on from cart" }).click();
  await expect(card).toHaveAttribute("data-action-state", "available");
  await card.getByRole("button", { name: "Add to cart" }).click();
  await expect(card).toHaveAttribute("data-action-state", "succeeded");
  expect(cartPosts).toBe(2);
});

test("live build-local search clears stale results and supports keyboard navigation", async ({
  page,
}) => {
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    if (path === "/cart" && request.method() === "GET") {
      await route.fulfill({ contentType: "application/json", json: { data: cart() } });
      return;
    }
    await route.abort();
  });

  await page.goto("/", { waitUntil: "networkidle" });
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole("link", { name: "Search" }).click();
  const input = page.getByPlaceholder("Enter your keywords...");
  await expect(input).toBeFocused();

  await input.fill("corduroy");
  await input.press("Enter");
  await expect(page.getByRole("list", { name: "Catalog search results" })).toContainText(
    "Relaxed corduroy shirt",
  );

  await input.fill("no-published-match");
  await expect(page.getByRole("list", { name: "Catalog search results" })).toHaveCount(0);
  await input.press("Enter");
  await expect(
    page.getByRole("status").filter({
      hasText: "No published catalog results match this search.",
    }),
  ).toHaveText("No published catalog results match this search.");

  await input.fill("a");
  await input.press("Enter");
  const results = page.getByRole("list", { name: "Catalog search results" });
  await expect(results.getByRole("link")).toHaveCount(3);
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/products\/atlas-carry-on$/);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await expect(page.locator("body")).not.toHaveClass(/fashion-store-home|show-search-popup/);
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
    "data-runtime-instance-count",
    "1",
  );
  await expect(page.locator(".header-cart > button")).toHaveCSS("padding-left", "18px");
  await page.goBack();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(page.locator("body")).toHaveClass(/fashion-store-home/);
  await expect(page.locator(".header-cart > button")).toHaveCSS("padding-left", "14px");
});

test("live routes keep unsupported pages truthful and policies Catalog-bound", async ({ page }) => {
  const nonGetRequests: string[] = [];
  await installLiveCommerce(page, async (route) => {
    const request = route.request();
    if (request.method() !== "GET") nonGetRequests.push(`${request.method()} ${request.url()}`);
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path.startsWith("/api/catalog/products/by-id/")) {
      await route.fulfill({
        json: { data: liveProduct(decodeURIComponent(path.split("/").at(-2)!)) },
      });
      return;
    }
    if (request.method() === "GET" && path === "/api/cart") {
      await route.fulfill({ json: { data: cart({ quantity: 0 }) } });
      return;
    }
    await route.fulfill({
      json: { error: { code: "not_found", message: "Not found" } },
      status: 404,
    });
  });

  await page.goto("/account", { waitUntil: "networkidle" });
  const account = page.locator("[data-fashion-store-live-content]");
  await expect(account).toHaveAttribute("data-content-state", "unavailable");
  await expect(account.getByRole("heading", { level: 1 })).toHaveText("Account unavailable");
  await expect(account.getByRole("link", { name: "Continue shopping" })).toHaveAttribute(
    "href",
    "/shop",
  );
  await expect(account.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

  await page.goto("/wishlist", { waitUntil: "networkidle" });
  const wishlist = page.locator("[data-fashion-store-live-content]");
  await expect(wishlist).toHaveAttribute("data-content-state", "unavailable");
  await expect(wishlist.getByRole("heading", { level: 1 })).toHaveText("Wishlist");
  await expect(wishlist).toContainText("Saved wishlists are not available yet.");
  const recoveryCards = wishlist.locator("[data-fashion-store-product-card]");
  await expect(recoveryCards).toHaveCount(2);
  await expect(recoveryCards.nth(0)).toHaveAttribute("data-action-state", "available");
  await expect(recoveryCards.nth(1)).toHaveAttribute("data-action-state", "available");
  await expect(recoveryCards.nth(0)).toHaveAttribute(
    "data-product-id",
    "prod_01JFASHIONLIVE0000000001",
  );
  await expect(recoveryCards.nth(0).getByRole("link").first()).toHaveAttribute(
    "href",
    "/products/atlas-carry-on",
  );
  await expect(wishlist.locator(".fashion-wishlist-remove")).toHaveCount(0);
  await expect(wishlist.getByRole("link", { name: "Continue shopping" })).toHaveAttribute(
    "href",
    "/shop",
  );
  await expect(wishlist.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
  expect(
    (await new AxeBuilder({ page }).include("[data-fashion-store-live-content]").analyze())
      .violations,
  ).toEqual([]);

  await page.goto("/policies/live-preview-policy-proof", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live preview policy proof");
  await expect(
    page.getByText("This notice exists only in the selected live preview Catalog Release."),
  ).toBeVisible();
  await expect(page.getByText("Effective date: 2026-08-14")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Selected release authority");
  await expect(
    page.getByText(
      "Selected-release policy content must never fall back to the generated default Catalog.",
    ),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://live-policy.example.test/policies/live-preview-policy-proof",
  );

  await page.goto("/shop/no-sidebar", { waitUntil: "networkidle" });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/shop$/);
  const missing = await page.goto("/shop/unknown", { waitUntil: "networkidle" });
  expect(missing?.status()).toBe(404);
  expect(nonGetRequests).toEqual([]);
});

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
  await page.getByLabel("State *").selectOption(shippingAddress.region);
  await page.getByLabel("ZIP *").fill(shippingAddress.postalCode);

  await expect.poll(() => shippingRequests).toHaveLength(1);
  expect(shippingRequests[0]).toEqual({
    shippingAddress: { ...shippingAddress, line2: "", phone: "" },
  });
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
  await expect(headerCart).toHaveAttribute("data-fashion-store-commerce-mode", "live");
  await page.getByRole("button", { name: "Increase Relaxed corduroy shirt quantity" }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Relaxed corduroy shirt quantity" }),
  ).toHaveValue("2");

  await headerCart.hover();
  await expect(headerCart.locator(".cart-count")).toHaveText("2");
  await expect(headerCart.locator(".cart-item-list")).toContainText("Relaxed corduroy shirt");
  await expect(headerCart.locator(".cart-item-list")).toContainText("2 × $65.00");
  await expect(headerCart.locator(".cart-total")).toContainText("$130.00");

  const removeLine = headerCart.getByRole("button", {
    name: "Remove Relaxed corduroy shirt from cart",
  });
  await expect(removeLine).toHaveCount(1);
  await expect(removeLine).toHaveClass(/\bclose\b/);
  await removeLine.click();
  await expect(page.locator(".cart-products tbody tr")).toHaveCount(0);
  await expect(page.locator(".total-price-table")).toContainText("$0.00");
  await expect(headerCart.locator(".cart-count")).toHaveText("0");
  await expect(headerCart.locator(".cart-item-list")).toContainText("Your cart is empty.");
});
