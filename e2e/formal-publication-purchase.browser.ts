import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { expect, test } from "@playwright/test";
import {
  cartSchema,
  checkoutRequestSchema,
  productSchema,
  type Cart,
} from "../packages/contracts/src";
import { readPublicValidationInput } from "../apps/storefront/e2e/public-validation-input";
import { beginFormalPublicationPurchase } from "./formal-publication-purchase-journey";

// Explicit local configuration only: the generated artifact is read without rebuilding it.
const validation = readPublicValidationInput();
if (!validation || validation.input.themeId !== "fashion-store")
  throw new Error("Local native purchase seam requires the retained public fashion-store input.");
const { input, product } = validation;
const variant = product.variants.find(
  ({ status, prices }) => status === "active" && prices.some(({ currency }) => currency === "USD"),
);
if (!variant) throw new Error("Local native purchase seam requires an active USD variant.");
const price = variant.prices.find(({ currency }) => currency === "USD")!;
const options = Object.keys(variant.optionValues).map((name) => ({
  name,
  values: [...new Set(product.variants.map(({ optionValues }) => optionValues[name]!))],
}));
const liveProduct = productSchema.parse({
  id: product.id,
  slug: product.slug,
  name: product.name,
  description: product.description,
  status: product.status,
  media: [],
  options,
  optionDefinitions: options.map(({ name, values }) => ({
    name,
    presentation: "text",
    values: values.map((label) => ({ label })),
  })),
  seo: { title: product.seoTitle, description: product.seoDescription },
  variants: product.variants.map((value) => ({
    id: value.id,
    sku: value.sku,
    options: value.optionValues,
    price: value.prices.find(({ currency }) => currency === "USD"),
    available: value.status === "active",
  })),
});
const cartId = "cart_01J00000000000000000000000";
const shippingMethodId = "ship_01J00000000000000000000000";
let cart: Cart = cartSchema.parse({
  id: cartId,
  currency: "USD",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  adjustments: [],
  canCheckout: false,
  lines: [],
  selectedShippingMethodId: null,
  shippingAddress: null,
  shippingMethods: [
    { id: shippingMethodId, name: "Tracked delivery", amount: 1200, currency: "USD" },
  ],
  totals: { subtotal: 0, discountTotal: 0, taxTotal: 0, shippingTotal: 0, grandTotal: 0 },
});
const publicRoot = resolve(import.meta.dirname, "../apps/storefront/.output/public");
const requests: Array<{
  path: string;
  method: string;
  body?: unknown;
  authorization: string | undefined;
}> = [];
const unexpectedApi: string[] = [];
let origin = "";
const server = createServer(async (request, response) => {
  const url = new URL(request.url!, origin);
  const json = (data: unknown, status = 200) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data }));
  };
  if (url.pathname === "/local-provider-checkout") {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<!doctype html><h1>Local provider handoff</h1>");
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const body = raw ? JSON.parse(raw) : undefined;
    const path = url.pathname.slice(4);
    requests.push({
      path,
      method: request.method!,
      body,
      authorization: request.headers.authorization,
    });
    if (path === "/platform/events" || path === "/platform/traffic/events") {
      response.writeHead(204).end();
      return;
    }
    if (path === "/platform/traffic/identity") {
      json({ ticket: "local_traffic_ticket", expiresAt: cart.expiresAt });
      return;
    }
    if (
      path === `/catalog/products/by-id/${product.id}/live` ||
      path === `/catalog/products/${product.slug}/live`
    ) {
      json(liveProduct);
      return;
    }
    if (path === "/platform/config") {
      json({ turnstile: { required: false, siteKey: null } });
      return;
    }
    if (path === "/cart") {
      json(
        request.method === "POST"
          ? { cart, token: "local_cart_token_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" }
          : cart,
      );
      return;
    }
    if (path === "/cart/lines" && request.method === "POST") {
      cart = cartSchema.parse({
        ...cart,
        canCheckout: true,
        lines: [
          {
            availableQuantity: 1,
            lineTotal: price,
            productName: product.name,
            quantity: 1,
            unitPrice: price,
            variantId: variant.id,
            variantName: variant.title,
          },
        ],
        totals: { ...cart.totals, subtotal: price.amount, grandTotal: price.amount },
      });
      json(cart);
      return;
    }
    if (path === "/cart/shipping" && request.method === "PUT") {
      cart = cartSchema.parse({
        ...cart,
        shippingAddress: body.shippingAddress,
        selectedShippingMethodId: shippingMethodId,
        totals: { ...cart.totals, shippingTotal: 1200, grandTotal: price.amount + 1200 },
      });
      json(cart);
      return;
    }
    if (path === "/checkout/sessions" && request.method === "POST") {
      checkoutRequestSchema.parse(body);
      json(
        {
          attemptId: "chk_01J00000000000000000000000",
          checkoutUrl: `${origin}/local-provider-checkout`,
          expiresAt: cart.expiresAt,
          orderAccessToken: "local_order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
          status: "payment_pending",
        },
        201,
      );
      return;
    }
    unexpectedApi.push(`${request.method} ${path}`);
    response.writeHead(404).end();
    return;
  }
  const direct = resolve(publicRoot, `.${decodeURIComponent(url.pathname)}`);
  if (!direct.startsWith(`${publicRoot}${sep}`) && direct !== publicRoot) {
    response.writeHead(404).end();
    return;
  }
  try {
    const file = (await stat(direct)).isDirectory() ? resolve(direct, "index.html") : direct;
    const mime: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".webp": "image/webp",
      ".woff2": "font/woff2",
    };
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
test.beforeAll(async () => {
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Local fixture did not bind a port.");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (!server.listening) return;
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
});
test("the compiled approved public artifact executes the formal native purchase selectors", async ({
  page,
  request,
}) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  expect(await (await request.get(`${origin}/__shoppp-release.json`)).json()).toEqual({
    schemaVersion: 1,
    sourceEnvironment: input.sourceEnvironment,
    identity: input.inputIdentity,
  });
  expect(await (await request.get(`${origin}/__shoppp-catalog.json`)).text()).toBe(
    input.catalogManifestJson,
  );
  await beginFormalPublicationPurchase(page, {
    product,
    variant,
    canonicalOrigin: input.catalogRelease.site.origin,
    buyerEmail: "local-buyer@example.test",
    baseUrl: origin,
  });
  await expect(page).toHaveURL(`${origin}/local-provider-checkout`);
  await expect(page.getByRole("heading", { name: "Local provider handoff" })).toBeVisible();
  const add = requests.filter(({ path }) => path === "/cart/lines");
  expect(add).toHaveLength(1);
  expect(add[0]!.body).toMatchObject({
    variantId: variant.id,
    quantity: 1,
    expectedUnitPrice: price,
  });
  expect(add[0]!.authorization).toMatch(/^CartToken local_cart_token_/);
  const checkout = requests.filter(({ path }) => path === "/checkout/sessions");
  expect(checkout).toHaveLength(1);
  expect(checkout[0]!.body).toMatchObject({
    acceptTerms: true,
    cartId,
    countryCode: "US",
    currency: "USD",
    email: "local-buyer@example.test",
    shippingMethodId,
    shippingAddress: {
      name: "Release Buyer",
      line1: "100 Market Street",
      city: "San Francisco",
      region: "CA",
      postalCode: "94105",
      countryCode: "US",
    },
  });
  expect(unexpectedApi).toEqual([]);
});
