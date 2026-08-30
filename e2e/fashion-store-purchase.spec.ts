import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import { requiredEnvironment } from "./support";

const phase = process.env.FASHION_U12_PHASE;

async function requireSuccessfulSettlement(response: APIResponse): Promise<void> {
  if (response.ok()) return;
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: unknown };
  } | null;
  const providerCode = payload?.error?.code;
  const code =
    typeof providerCode === "string" && /^[a-z0-9_]{1,120}$/.test(providerCode)
      ? providerCode
      : `http_${response.status()}`;
  throw new Error(`Fashion staging settlement failed: ${code}`);
}

async function authorizePrivatePreview(page: Page): Promise<void> {
  const authorityOrigin = requiredEnvironment("FASHION_U12_API_ORIGIN");
  const previewOrigin = requiredEnvironment("STOREFRONT_E2E_BASE_URL");
  const handoffOrigin = requiredEnvironment("FASHION_U12_HANDOFF_ORIGIN");
  const snapshotId = requiredEnvironment("FASHION_U12_SNAPSHOT_ID");
  const catalogReleaseId = requiredEnvironment("FASHION_U12_CATALOG_RELEASE_ID");
  const serviceToken = requiredEnvironment("FASHION_U13_SERVICE_TOKEN");
  const grant = await page.request.post(
    `${authorityOrigin}/admin/storefront-experiences/snapshots/${snapshotId}/grants`,
    {
      data: {
        catalogReleaseId,
        origin: previewOrigin,
        reason: `Fashion staging U12 ${requiredEnvironment("FASHION_U12_RUN_ID")}`,
      },
      headers: { Authorization: `Bearer ${serviceToken}` },
    },
  );
  expect(grant.ok()).toBe(true);
  const value = (await grant.json()) as { data?: { grant?: string; redeemUrl?: string } };
  expect(value.data?.redeemUrl).toBe(`${previewOrigin}/__preview/session`);
  expect(value.data?.grant).toMatch(/^[A-Za-z0-9_-]{32,256}$/);
  const redemption = await page.request.post(value.data!.redeemUrl!, {
    data: { grant: value.data!.grant },
    headers: { Origin: handoffOrigin },
    maxRedirects: 0,
  });
  expect(redemption.status()).toBe(303);
  expect(redemption.headers().location).toBe("/");
}

async function registerResource(
  request: APIRequestContext,
  resourceType: "cart" | "checkout_attempt",
  resourceId: string,
): Promise<void> {
  const response = await request.post(
    `${requiredEnvironment("FASHION_U12_API_ORIGIN")}/internal/testing/fashion-staging/runs/${requiredEnvironment("FASHION_U12_RUN_ID")}/resources`,
    {
      data: {
        owner: requiredEnvironment("FASHION_U12_OWNER"),
        resourceId,
        resourceType,
      },
      headers: {
        Authorization: `Bearer ${requiredEnvironment("FASHION_U12_ACCEPTANCE_TOKEN")}`,
      },
    },
  );
  expect(response.status()).toBe(204);
}

async function productById(page: Page, id: string): Promise<Record<string, unknown>> {
  const response = await page.request.get(
    `${requiredEnvironment("STOREFRONT_E2E_BASE_URL")}/api/catalog/products/by-id/${id}/live?currency=${requiredEnvironment("FASHION_U12_CURRENCY")}`,
  );
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { data?: Record<string, unknown> };
  expect(payload.data?.id).toBe(id);
  return payload.data!;
}

function productString(product: Record<string, unknown>, field: "name" | "slug"): string {
  const value = product[field];
  if (typeof value !== "string" || !value) throw new Error(`Product ${field} is required`);
  return value;
}

async function openProduct(page: Page, product: Record<string, unknown>): Promise<void> {
  const slug = productString(product, "slug");
  await page.goto(`/products/${slug}`, { waitUntil: "networkidle" });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/products/${slug}$`),
  );
}

async function selectConfiguredOptions(page: Page): Promise<void> {
  const values = JSON.parse(requiredEnvironment("FASHION_U12_OPTION_VALUES")) as unknown;
  if (
    !Array.isArray(values) ||
    values.length < 1 ||
    values.some((value) => typeof value !== "string")
  ) {
    throw new Error("FASHION_U12_OPTION_VALUES must be a non-empty JSON string array");
  }
  const product = page.locator("[data-fashion-store-live-product]");
  for (const value of values) await product.getByRole("radio", { name: value }).check();
}

test("Fashion staging completes the no-interception archetype and sandbox purchase journey", async ({
  page,
}) => {
  test.skip(phase !== "journey", "Runs only inside the locked destructive journey phase.");
  await authorizePrivatePreview(page);
  const single = await productById(
    page,
    requiredEnvironment("FASHION_U12_SINGLE_VARIANT_PRODUCT_ID"),
  );
  const multiple = await productById(
    page,
    requiredEnvironment("FASHION_U12_MULTI_VARIANT_PRODUCT_ID"),
  );
  const unavailable = await productById(
    page,
    requiredEnvironment("FASHION_U12_UNAVAILABLE_PRODUCT_ID"),
  );
  const variants = (product: Record<string, unknown>) =>
    product.variants as { available?: boolean }[];
  expect(variants(single)).toHaveLength(1);
  expect(variants(multiple).length).toBeGreaterThan(1);
  expect(variants(unavailable).every((variant) => variant.available === false)).toBe(true);

  const resourceRegistrations: Promise<void>[] = [];
  const commerceRequests: string[] = [];
  page.on("response", (response) => {
    const request = response.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/") || path === "/api/cart") {
      commerceRequests.push(`${request.method()} ${path}`);
    }
    if (!response.ok()) return;
    if (path === "/api/cart" && request.method() === "POST") {
      resourceRegistrations.push(
        response.json().then((payload: { data?: { cart?: { id?: string } } }) => {
          const id = payload.data?.cart?.id;
          if (!id) throw new Error("Cart creation returned no stable ID");
          return registerResource(page.request, "cart", id);
        }),
      );
    }
  });

  type CheckoutCapture = {
    payload: { data?: { attemptId?: string; checkoutUrl?: string } };
    status: number;
  };
  let resolveCheckoutPayload!: (capture: CheckoutCapture) => void;
  const checkoutPayloadPromise = new Promise<CheckoutCapture>((resolve) => {
    resolveCheckoutPayload = resolve;
  });
  await page.route("**/api/checkout/sessions", async (route) => {
    const response = await route.fetch();
    const body = await response.body();
    resolveCheckoutPayload({
      payload: JSON.parse(body.toString()) as CheckoutCapture["payload"],
      status: response.status(),
    });
    await route.fulfill({ body, response });
  });

  const slug = requiredEnvironment("FASHION_U12_PRODUCT_SLUG");
  const name = requiredEnvironment("FASHION_U12_PRODUCT_NAME");
  expect(productString(single, "slug")).toBe(slug);
  expect(productString(single, "name")).toBe(name);

  await openProduct(page, multiple);
  await page.getByRole("button", { name: "Allow cookies" }).click();
  await selectConfiguredOptions(page);
  await expect(
    page.locator("[data-fashion-store-live-product]").getByRole("button", {
      name: "Add to cart",
    }),
  ).toBeEnabled();

  await openProduct(page, unavailable);
  const unavailableProduct = page.locator("[data-fashion-store-live-product]");
  await expect(unavailableProduct.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  await expect(unavailableProduct.getByRole("status")).toContainText(/currently unavailable\./i);

  await openProduct(page, single);
  const product = page.locator("[data-fashion-store-live-product]");
  await product.getByRole("button", { name: "Add to cart" }).click();
  await expect(product.getByRole("status")).toContainText("was added to your cart");

  const headerCart = page.locator(".header-cart");
  await headerCart.hover();
  await headerCart.getByRole("button", { name: `Remove ${name} from cart` }).click();
  await expect(product.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  await product.getByRole("button", { name: "Add to cart" }).click();
  await headerCart.hover();
  await headerCart.locator('a[href="/cart"]').click();

  await page.locator("[data-fashion-store-cart][data-runtime-status='ready']").waitFor();
  await page.getByRole("button", { name: `Increase ${name} quantity` }).click();
  await expect(page.getByRole("spinbutton", { name: `${name} quantity` })).toHaveValue("2");
  await page
    .getByRole("button", { name: `Remove ${name}`, exact: true })
    .first()
    .click();
  await expect(page.getByRole("spinbutton", { name: `${name} quantity` })).toHaveCount(0);
  await page.goto(`/products/${slug}`, { waitUntil: "networkidle" });
  await page
    .locator("[data-fashion-store-live-product]")
    .getByRole("button", { name: "Add to cart" })
    .click();
  await page.locator(".header-cart").hover();
  await page.locator(".header-cart").locator('a[href="/cart"]').click();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();

  await page.locator("[data-fashion-store-checkout][data-runtime-status='ready']").waitFor();
  await page.getByLabel("First name *").fill("Ada");
  await page.getByLabel("Last name *").fill("Buyer");
  await page.getByLabel("Street address *").fill("100 Market Street");
  await page.getByLabel("Town / City *").fill("San Francisco");
  await page.getByLabel("State *").selectOption("CA");
  await page.getByLabel("ZIP *").fill("94105");
  await page.getByLabel("Phone *").fill("5125550100");
  await page.getByLabel("Email address *").fill("fashion-u12@example.test");
  await expect(page.getByRole("radio").first()).toBeChecked();
  await page.locator(".your-order-box .terms-condition-box label").click();
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole("button", { name: "Place order" }).click();

  const { payload: checkout, status: checkoutStatus } = await checkoutPayloadPromise;
  expect(checkoutStatus).toBe(201);
  expect(checkout.data?.attemptId).toMatch(/^chk_[A-Za-z0-9_]+$/);
  expect(checkout.data?.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  resourceRegistrations.push(
    registerResource(page.request, "checkout_attempt", checkout.data!.attemptId!),
  );
  await Promise.all(resourceRegistrations);
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  await expect(page.locator("body")).toContainText(name);
  await expect(page.locator("body")).toContainText("$129.00");
  const settlement = await page.request.post(
    `${requiredEnvironment("FASHION_U12_API_ORIGIN")}/internal/testing/fashion-staging/runs/${requiredEnvironment("FASHION_U12_RUN_ID")}/settle`,
    {
      data: {
        checkoutAttemptId: checkout.data!.attemptId!,
        owner: requiredEnvironment("FASHION_U12_OWNER"),
      },
      headers: {
        Authorization: `Bearer ${requiredEnvironment("FASHION_U12_ACCEPTANCE_TOKEN")}`,
      },
    },
  );
  await requireSuccessfulSettlement(settlement);
  const settlementPayload = (await settlement.json()) as { data?: { orderReference?: string } };
  expect(settlementPayload.data?.orderReference).toMatch(/^[A-Z]+-[A-Z0-9]+$/);
  await page.goto(
    new URL("/checkout/complete", requiredEnvironment("STOREFRONT_E2E_BASE_URL")).href,
    {
      waitUntil: "networkidle",
    },
  );
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    page.getByText(`Order reference: ${settlementPayload.data!.orderReference}.`),
  ).toBeVisible();
  expect(commerceRequests).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^POST \/api\/cart$/),
      expect.stringMatching(/^POST \/api\/cart\/lines$/),
      expect.stringMatching(/^POST \/api\/checkout\/sessions$/),
      expect.stringMatching(/^GET \/api\/orders\//),
    ]),
  );
});

test("Fashion staging cleanup leaves a fresh-session sellable postcondition", async ({ page }) => {
  test.skip(phase !== "postcondition", "Runs only after lifecycle cleanup completes.");
  await authorizePrivatePreview(page);
  const registrations: Promise<void>[] = [];
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname !== "/api/cart" ||
      response.request().method() !== "POST" ||
      !response.ok()
    ) {
      return;
    }
    registrations.push(
      response.json().then((payload: { data?: { cart?: { id?: string } } }) => {
        const id = payload.data?.cart?.id;
        if (!id) throw new Error("Postcondition cart creation returned no stable ID");
        return registerResource(page.request, "cart", id);
      }),
    );
  });
  const slug = requiredEnvironment("FASHION_U12_PRODUCT_SLUG");
  await page.goto(`/products/${slug}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Allow cookies" }).click();
  const product = page.locator("[data-fashion-store-live-product]");
  await expect(product.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  await product.getByRole("button", { name: "Add to cart" }).click();
  await expect(product.getByRole("status")).toContainText("was added to your cart");
  await Promise.all(registrations);
});
