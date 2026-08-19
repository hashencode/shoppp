import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { requiredEnvironment } from "./support";

const phase = process.env.FASHION_U12_PHASE;

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
    if (path === "/api/checkout/sessions" && request.method() === "POST") {
      resourceRegistrations.push(
        response.json().then((payload: { data?: { attemptId?: string } }) => {
          const id = payload.data?.attemptId;
          if (!id) throw new Error("Checkout creation returned no stable attempt ID");
          return registerResource(page.request, "checkout_attempt", id);
        }),
      );
    }
  });

  const slug = requiredEnvironment("FASHION_U12_PRODUCT_SLUG");
  const name = requiredEnvironment("FASHION_U12_PRODUCT_NAME");
  await page.goto(`/products/${slug}`, { waitUntil: "networkidle" });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/products/${slug}$`),
  );
  await page.getByRole("button", { name: "Allow cookies" }).click();
  await selectConfiguredOptions(page);
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
    .getByRole("button", { name: `Remove ${name} from cart` })
    .first()
    .click();
  await expect(page.getByRole("spinbutton", { name: `${name} quantity` })).toHaveCount(0);
  await page.goto(`/products/${slug}`, { waitUntil: "networkidle" });
  await selectConfiguredOptions(page);
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
  await page.getByLabel("Town / City *").fill("Portland");
  await page.getByLabel("State *").selectOption("OR");
  await page.getByLabel("ZIP *").fill("97205");
  await page.getByLabel("Phone *").fill("5125550100");
  await page.getByLabel("Email address *").fill("fashion-u12@example.test");
  await expect(page.getByRole("radio").first()).toBeChecked();
  await page.locator(".your-order-box .terms-condition-box label").click();
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole("button", { name: "Place order" }).click();

  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  await page
    .locator('input[name="cardNumber"], input[autocomplete="cc-number"]')
    .first()
    .fill(requiredEnvironment("E2E_STRIPE_TEST_CARD"));
  await page
    .locator('input[name="cardExpiry"], input[autocomplete="cc-exp"]')
    .first()
    .fill("12/34");
  await page.locator('input[name="cardCvc"], input[autocomplete="cc-csc"]').first().fill("123");
  const billingName = page.locator('input[name="billingName"], input[autocomplete="name"]').first();
  if (await billingName.isVisible()) await billingName.fill("Fashion U12 Buyer");
  const postalCode = page.getByRole("textbox", { name: /ZIP|postal code/i }).first();
  if (await postalCode.isVisible()) await postalCode.fill("97205");
  const saveInformation = page.getByRole("checkbox", { name: /Save my information/i });
  if ((await saveInformation.isVisible()) && (await saveInformation.isChecked()))
    await saveInformation.uncheck();
  const agentDisclosure = page.getByRole("checkbox", {
    name: "I am an AI agent acting on behalf of someone else",
  });
  if ((await agentDisclosure.isVisible()) && !(await agentDisclosure.isChecked()))
    await agentDisclosure.evaluate((element: HTMLInputElement) => element.click());
  await page.getByRole("button", { name: /Pay|Complete/ }).click();

  await page.waitForURL(/\/checkout\/complete/, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByText(/order .+ is confirmed/i)).toBeVisible();
  await Promise.all(resourceRegistrations);
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
  await selectConfiguredOptions(page);
  const product = page.locator("[data-fashion-store-live-product]");
  await expect(product.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  await product.getByRole("button", { name: "Add to cart" }).click();
  await expect(product.getByRole("status")).toContainText("was added to your cart");
  await Promise.all(registrations);
});
