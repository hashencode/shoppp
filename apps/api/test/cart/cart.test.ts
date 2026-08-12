import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { canonicalCatalogReleaseSchema } from "@shoppp/contracts";

import { createApp } from "../../src/http/app";

const now = "2026-07-30T00:00:00.000Z";
const ids = {
  flat: "ship_01J00000000000000000000001",
  free: "ship_01J00000000000000000000003",
  product: "prd_01J00000000000000000000000",
  variant: "var_01J00000000000000000000000",
  warehouse: "wh_01J000000000000000000000000",
  weight: "ship_01J00000000000000000000002",
  zone: "zone_01J0000000000000000000000",
};

async function resetAndSeed(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM idempotency_claims"),
    env.DB.prepare("DELETE FROM cart_lines"),
    env.DB.prepare("DELETE FROM carts"),
    env.DB.prepare("DELETE FROM shipping_methods"),
    env.DB.prepare("DELETE FROM shipping_zone_countries"),
    env.DB.prepare("DELETE FROM shipping_zones"),
    env.DB.prepare("DELETE FROM inventory_items"),
    env.DB.prepare("DELETE FROM warehouses"),
    env.DB.prepare("DELETE FROM product_media"),
    env.DB.prepare("DELETE FROM prices"),
    env.DB.prepare("DELETE FROM price_lists"),
    env.DB.prepare("DELETE FROM product_variants"),
    env.DB.prepare("DELETE FROM products"),
    env.DB.prepare("DELETE FROM catalog_releases"),
  ]);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO products (id, slug, name, description, status, seo_title, seo_description, published_at, created_at, updated_at) VALUES (?, 'atlas', 'Atlas', 'Carry-on', 'published', 'Atlas', 'Atlas carry-on', ?, ?, ?)",
    ).bind(ids.product, now, now, now),
    env.DB.prepare(
      "INSERT INTO product_variants (id, product_id, sku, title, option_values_json, weight_grams, length_mm, width_mm, height_mm, status, created_at, updated_at) VALUES (?, ?, 'ATLAS-BLK', 'Black', '{\"color\":\"Black\"}', 2900, 550, 350, 220, 'active', ?, ?)",
    ).bind(ids.variant, ids.product, now, now),
    env.DB.prepare(
      "INSERT INTO price_lists (id, code, currency, status, created_at, updated_at) VALUES ('pl_usd', 'GLOBAL-USD', 'USD', 'active', ?, ?)",
    ).bind(now, now),
    env.DB.prepare(
      "INSERT INTO prices (id, price_list_id, variant_id, amount, created_at, updated_at) VALUES ('price_usd', 'pl_usd', ?, 12900, ?, ?)",
    ).bind(ids.variant, now, now),
    env.DB.prepare(
      "INSERT INTO warehouses (id, code, name, created_at) VALUES (?, 'PRIMARY', 'Primary', ?)",
    ).bind(ids.warehouse, now),
    env.DB.prepare(
      "INSERT INTO inventory_items (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, oversell_limit, version, updated_at) VALUES (?, ?, 10, 0, 0, 0, ?)",
    ).bind(ids.variant, ids.warehouse, now),
    env.DB.prepare(
      "INSERT INTO shipping_zones (id, name, status, created_at, updated_at) VALUES (?, 'US', 'active', ?, ?)",
    ).bind(ids.zone, now, now),
    env.DB.prepare(
      "INSERT INTO shipping_zone_countries (zone_id, country_code) VALUES (?, 'US')",
    ).bind(ids.zone),
    ...[
      [ids.flat, "Ground", "flat", 700, null, null, null],
      [ids.weight, "Weight", "weight", 450, null, 1, 5_000],
      [ids.free, "Free threshold", "flat", 900, 10_000, null, null],
    ].map(([id, name, type, amount, threshold, min, max]) =>
      env.DB.prepare(
        "INSERT INTO shipping_methods (id, zone_id, name, calculation_type, price_amount, currency, free_threshold_amount, min_weight_grams, max_weight_grams, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, 'active', ?, ?)",
      ).bind(id, ids.zone, name, type, amount, threshold, min, max, now, now),
    ),
  ]);
}

async function seedDeployedRelease(
  releaseId: string,
  productId = ids.product,
  variantId = ids.variant,
  variantStatus: "active" | "disabled" = "active",
): Promise<void> {
  const manifest = canonicalCatalogReleaseSchema.parse({
    collections: [],
    generatedAt: now,
    policies: [
      {
        description: "Privacy policy",
        effectiveDate: "2026-07-30",
        sections: [{ body: "Private storefront policy.", heading: "Privacy" }],
        slug: "privacy",
        title: "Privacy",
      },
    ],
    products: [
      {
        collectionIds: [],
        collectionSlugs: [],
        description: "Carry-on",
        id: productId,
        media: [],
        name: "Atlas",
        seoDescription: "Atlas carry-on",
        seoTitle: "Atlas",
        slug: "atlas-release-slug",
        status: "published",
        variants: [
          {
            id: variantId,
            optionValues: { color: "Black" },
            prices: [{ amount: 12_900, currency: "USD" }],
            sku: "ATLAS-BLK",
            status: variantStatus,
            title: "Black",
            weightGrams: 2_900,
          },
        ],
      },
    ],
    redirects: [],
    releaseId,
    routes: ["/products/atlas-release-slug", "/policies/privacy"],
    schemaVersion: 2,
    site: {
      defaultCurrency: "USD",
      freshnessHours: 24,
      name: "Fashion staging",
      origin: "https://preview.example.test",
    },
  });
  await env.DB.prepare(
    `INSERT INTO catalog_releases
       (id, status, manifest_json, approved_at, deployed_at, created_at, updated_at)
     VALUES (?, 'deployed', ?, ?, ?, ?, ?)`,
  )
    .bind(releaseId, JSON.stringify(manifest), now, now, now, now)
    .run();
}

function cartRequest(path: string, token?: string, init: RequestInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `CartToken ${token}` } : {}),
      ...init.headers,
    },
  });
}

describe("guest cart authority", () => {
  beforeEach(resetAndSeed);

  test("serves live currency and availability from API authority", async () => {
    const response = await createApp().fetch(
      new Request("https://api.example.test/catalog/products/atlas/live?currency=USD"),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        slug: "atlas",
        variants: [
          {
            available: true,
            id: ids.variant,
            price: { amount: 12_900, currency: "USD" },
          },
        ],
      },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  test("resolves a live product by stable ID after its slug changes", async () => {
    await seedDeployedRelease("release-stable-product");
    await env.DB.prepare("UPDATE products SET slug = 'atlas-renamed' WHERE id = ?")
      .bind(ids.product)
      .run();
    const response = await createApp().fetch(
      new Request(
        `https://api.example.test/catalog/products/by-id/${ids.product}/live?currency=USD`,
        { headers: { "X-Preview-Catalog-Release": "release-stable-product" } },
      ),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { id: ids.product, slug: "atlas-renamed", variants: [{ id: ids.variant }] },
    });
  });

  test("binds the first deployed release and rejects foreign variants or later release changes", async () => {
    await seedDeployedRelease("release-cart-a");
    await seedDeployedRelease(
      "release-cart-b",
      "prd_01JFOREIGNPRODUCT0000000000",
      "var_01JFOREIGNVARIANT0000000000",
    );
    await seedDeployedRelease("release-cart-disabled", ids.product, ids.variant, "disabled");
    const app = createApp();
    const created = await app.fetch(
      cartRequest("/cart", undefined, {
        body: JSON.stringify({ currency: "USD" }),
        headers: { "Idempotency-Key": "cart-create-release-bound-1" },
        method: "POST",
      }),
      env,
    );
    const { data } = await created.json<{ data: { token: string } }>();
    const added = await app.fetch(
      cartRequest("/cart/lines", data.token, {
        body: JSON.stringify({
          quantity: 1,
          releaseId: "release-cart-b",
          variantId: ids.variant,
        }),
        headers: {
          "Idempotency-Key": "cart-add-release-bound-001",
          "X-Preview-Catalog-Release": "release-cart-a",
        },
        method: "POST",
      }),
      env,
    );
    expect(added.status).toBe(200);

    const conflict = await app.fetch(
      cartRequest("/cart/lines", data.token, {
        body: JSON.stringify({ quantity: 1, variantId: ids.variant }),
        headers: {
          "Idempotency-Key": "cart-add-release-conflict-1",
          "X-Preview-Catalog-Release": "release-cart-b",
        },
        method: "POST",
      }),
      env,
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: { code: "cart_release_conflict" } });

    const foreign = await app.fetch(
      cartRequest("/cart", undefined, {
        body: JSON.stringify({ currency: "USD" }),
        headers: { "Idempotency-Key": "cart-create-foreign-release-1" },
        method: "POST",
      }),
      env,
    );
    const foreignCart = await foreign.json<{ data: { token: string } }>();
    const rejected = await app.fetch(
      cartRequest("/cart/lines", foreignCart.data.token, {
        body: JSON.stringify({ quantity: 1, variantId: ids.variant }),
        headers: {
          "Idempotency-Key": "cart-add-foreign-variant-01",
          "X-Preview-Catalog-Release": "release-cart-b",
        },
        method: "POST",
      }),
      env,
    );
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({
      error: { code: "catalog_variant_not_in_release" },
    });

    const disabled = await app.fetch(
      cartRequest("/cart", undefined, {
        body: JSON.stringify({ currency: "USD" }),
        headers: { "Idempotency-Key": "cart-create-disabled-release-1" },
        method: "POST",
      }),
      env,
    );
    const disabledCart = await disabled.json<{ data: { token: string } }>();
    const disabledVariant = await app.fetch(
      cartRequest("/cart/lines", disabledCart.data.token, {
        body: JSON.stringify({ quantity: 1, variantId: ids.variant }),
        headers: {
          "Idempotency-Key": "cart-add-disabled-variant-01",
          "X-Preview-Catalog-Release": "release-cart-disabled",
        },
        method: "POST",
      }),
      env,
    );
    expect(disabledVariant.status).toBe(422);
    expect(await disabledVariant.json()).toMatchObject({
      error: { code: "catalog_variant_not_in_release" },
    });
  });

  test("creates, resumes, mutates, and safely replays one opaque-token cart", async () => {
    await seedDeployedRelease("release-static-001");
    const app = createApp();
    const createdResponse = await app.fetch(
      cartRequest("/cart", undefined, {
        body: JSON.stringify({ currency: "USD" }),
        headers: { "Idempotency-Key": "cart-create-resume-000001" },
        method: "POST",
      }),
      env,
    );
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json<{
      data: { cart: { lines: unknown[] }; token: string };
    }>();
    expect(created.data.token).not.toContain("cart_");
    expect(created.data.cart.lines).toEqual([]);

    const mutation = () =>
      app.fetch(
        cartRequest("/cart/lines", created.data.token, {
          body: JSON.stringify({
            expectedUnitPrice: { amount: 12_900, currency: "USD" },
            quantity: 2,
            releaseId: "release-static-001",
            variantId: ids.variant,
          }),
          headers: { "Idempotency-Key": "cart-line-add-00000001" },
          method: "POST",
        }),
        env,
      );
    const first = await mutation();
    const replay = await mutation();
    expect(first.status).toBe(200);
    expect(await replay.text()).toBe(await first.text());

    const resumed = await app.fetch(cartRequest("/cart", created.data.token), env);
    expect(await resumed.json()).toMatchObject({
      data: {
        currency: "USD",
        lines: [{ quantity: 2, unitPrice: { amount: 12_900, currency: "USD" } }],
        totals: { grandTotal: 25_800, subtotal: 25_800 },
      },
    });

    expect(
      (
        await app.fetch(
          cartRequest(`/cart/lines/${ids.variant}`, created.data.token, {
            body: JSON.stringify({ quantity: 3 }),
            headers: { "Idempotency-Key": "cart-line-update-000001" },
            method: "PATCH",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.fetch(
          cartRequest(`/cart/lines/${ids.variant}`, created.data.token, {
            headers: { "Idempotency-Key": "cart-line-delete-000001" },
            method: "DELETE",
          }),
          env,
        )
      ).status,
    ).toBe(200);
  });

  test("makes stale price explicit and requires acknowledgement", async () => {
    await seedDeployedRelease("stale-release");
    const app = createApp();
    const response = await app.fetch(
      cartRequest("/cart", undefined, {
        body: JSON.stringify({ currency: "USD" }),
        headers: { "Idempotency-Key": "cart-create-stale-0000001" },
        method: "POST",
      }),
      env,
    );
    const { data } = await response.json<{ data: { token: string } }>();
    const added = await app.fetch(
      cartRequest("/cart/lines", data.token, {
        body: JSON.stringify({
          expectedUnitPrice: { amount: 11_900, currency: "USD" },
          quantity: 1,
          releaseId: "stale-release",
          variantId: ids.variant,
        }),
        headers: { "Idempotency-Key": "cart-stale-price-000001" },
        method: "POST",
      }),
      env,
    );
    expect(await added.json()).toMatchObject({
      data: {
        adjustments: [
          {
            code: "price_changed",
            requiresAcknowledgement: true,
            variantId: ids.variant,
          },
        ],
        canCheckout: false,
        totals: { grandTotal: 12_900 },
      },
    });
    const acknowledged = await app.fetch(
      cartRequest("/cart/adjustments/acknowledge", data.token, {
        body: JSON.stringify({ codes: [`price_changed:${ids.variant}`] }),
        headers: { "Idempotency-Key": "cart-ack-price-00000001" },
        method: "POST",
      }),
      env,
    );
    expect(await acknowledged.json()).toMatchObject({
      data: { adjustments: [], canCheckout: true },
    });
  });

  test("returns recoverable field errors and authoritative shipping quotes", async () => {
    const app = createApp();
    const created = await app.fetch(
      cartRequest("/cart", undefined, {
        body: JSON.stringify({ currency: "USD" }),
        headers: { "Idempotency-Key": "cart-create-shipping-0001" },
        method: "POST",
      }),
      env,
    );
    const { data } = await created.json<{ data: { token: string } }>();
    const invalid = await app.fetch(
      cartRequest("/cart/lines", data.token, {
        body: JSON.stringify({ quantity: 0, variantId: ids.variant }),
        headers: { "Idempotency-Key": "cart-invalid-quantity-01" },
        method: "POST",
      }),
      env,
    );
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({
      error: {
        code: "validation_failed",
        details: [expect.objectContaining({ path: ["quantity"] })],
      },
    });
    const wrongCurrency = await app.fetch(
      cartRequest("/cart/lines", data.token, {
        body: JSON.stringify({
          expectedUnitPrice: { amount: 12_900, currency: "EUR" },
          quantity: 1,
          variantId: ids.variant,
        }),
        headers: { "Idempotency-Key": "cart-invalid-currency-01" },
        method: "POST",
      }),
      env,
    );
    expect(wrongCurrency.status).toBe(422);
    expect(await wrongCurrency.json()).toMatchObject({
      error: { code: "currency_mismatch" },
    });
    const overflow = await app.fetch(
      cartRequest("/cart/lines", data.token, {
        body: JSON.stringify({ quantity: 21, variantId: ids.variant }),
        headers: { "Idempotency-Key": "cart-quantity-overflow-1" },
        method: "POST",
      }),
      env,
    );
    expect(overflow.status).toBe(422);
    expect(await overflow.json()).toMatchObject({
      error: {
        code: "validation_failed",
        details: [expect.objectContaining({ path: ["quantity"] })],
      },
    });

    await app.fetch(
      cartRequest("/cart/lines", data.token, {
        body: JSON.stringify({ quantity: 1, variantId: ids.variant }),
        headers: { "Idempotency-Key": "cart-shipping-line-0001" },
        method: "POST",
      }),
      env,
    );
    const quote = await app.fetch(
      cartRequest("/cart/shipping", data.token, {
        body: JSON.stringify({
          shippingAddress: {
            city: "Portland",
            countryCode: "US",
            line1: "100 Market Street",
            name: "Example Shopper",
            postalCode: "97205",
            region: "OR",
          },
          shippingMethodId: ids.weight,
        }),
        headers: { "Idempotency-Key": "cart-shipping-quote-001" },
        method: "PUT",
      }),
      env,
    );
    expect(await quote.json()).toMatchObject({
      data: {
        selectedShippingMethodId: ids.weight,
        shippingMethods: [
          { amount: 700, id: ids.flat },
          { amount: 1_350, id: ids.weight },
          { amount: 0, id: ids.free },
        ],
        totals: { grandTotal: 14_250, shippingTotal: 1_350 },
      },
    });
    expect(
      await env.DB.prepare(
        `SELECT state, response_status
           FROM idempotency_claims
          WHERE scope = 'cart.shipping.quote' AND key = 'cart-shipping-quote-001'`,
      ).first(),
    ).toEqual({ response_status: 200, state: "completed" });
    expect(await env.DB.prepare("SELECT shipping_method_id FROM carts LIMIT 1").first()).toEqual({
      shipping_method_id: ids.weight,
    });
    const unavailableMethod = await app.fetch(
      cartRequest("/cart/shipping", data.token, {
        body: JSON.stringify({
          shippingAddress: {
            city: "Portland",
            countryCode: "US",
            line1: "100 Market Street",
            name: "Example Shopper",
            postalCode: "97205",
          },
          shippingMethodId: "ship_01J00000000000000000000999",
        }),
        headers: { "Idempotency-Key": "cart-shipping-method-bad" },
        method: "PUT",
      }),
      env,
    );
    expect(unavailableMethod.status).toBe(422);
    expect(await env.DB.prepare("SELECT shipping_method_id FROM carts LIMIT 1").first()).toEqual({
      shipping_method_id: ids.weight,
    });

    const invalidAddress = await app.fetch(
      cartRequest("/cart/shipping", data.token, {
        body: JSON.stringify({
          shippingAddress: {
            city: "Portland",
            countryCode: "US",
            line1: "100 Market Street",
            name: "Example Shopper",
            postalCode: "!!",
          },
        }),
        headers: { "Idempotency-Key": "cart-shipping-address-bad" },
        method: "PUT",
      }),
      env,
    );
    expect(invalidAddress.status).toBe(422);
    expect(await invalidAddress.json()).toMatchObject({
      error: {
        code: "validation_failed",
        details: expect.arrayContaining([
          expect.objectContaining({ path: ["shippingAddress", "postalCode"] }),
        ]),
      },
    });

    const unsupported = await app.fetch(
      cartRequest("/cart/shipping", data.token, {
        body: JSON.stringify({
          shippingAddress: {
            city: "Paris",
            countryCode: "FR",
            line1: "1 Rue Exemple",
            name: "Example Shopper",
            postalCode: "75001",
          },
        }),
        headers: { "Idempotency-Key": "cart-shipping-unsupported" },
        method: "PUT",
      }),
      env,
    );
    expect(unsupported.status).toBe(422);
    expect(await unsupported.json()).toMatchObject({
      error: { code: "shipping_destination_unavailable" },
    });
  });

  test("preserves cart expiry checks when quoting shipping in one D1 batch", async () => {
    const app = createApp();
    const created = await app.fetch(
      cartRequest("/cart", undefined, {
        body: JSON.stringify({ currency: "USD" }),
        headers: { "Idempotency-Key": "cart-create-expired-00001" },
        method: "POST",
      }),
      env,
    );
    const { data } = await created.json<{ data: { token: string } }>();
    await env.DB.prepare("UPDATE carts SET expires_at = ?").bind("2020-01-01T00:00:00.000Z").run();

    const quote = await app.fetch(
      cartRequest("/cart/shipping", data.token, {
        body: JSON.stringify({
          shippingAddress: {
            city: "Portland",
            countryCode: "US",
            line1: "100 Market Street",
            name: "Example Shopper",
            postalCode: "97205",
          },
        }),
        headers: { "Idempotency-Key": "cart-shipping-expired-001" },
        method: "PUT",
      }),
      env,
    );

    expect(quote.status).toBe(409);
    expect(await quote.json()).toMatchObject({ error: { code: "cart_expired" } });
    expect(await env.DB.prepare("SELECT status FROM carts LIMIT 1").first()).toEqual({
      status: "expired",
    });
  });
});
