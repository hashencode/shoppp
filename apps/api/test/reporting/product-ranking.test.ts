import { env } from "cloudflare:workers";
import { canonicalCatalogReleaseSchema } from "@shoppp/contracts";
import { beforeAll, describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import { getProductSalesReport } from "../../src/reporting/product-ranking";
import {
  getPublicRelease,
  publicProductName,
  publicProductPath,
} from "../../src/reporting/public-products";

function productId(slug: string): string {
  return `prod_${slug.replaceAll("-", "").padEnd(24, "0")}`;
}

const NOW = "2026-09-29T12:00:00.000Z";
const query = { currency: "USD", startDate: "2026-09-29", endDate: "2026-09-29", timeZone: "UTC" };

async function order(
  id: string,
  productKey: string,
  amount: number,
  options: {
    status?: string;
    currency?: string;
    environment?: string;
    testMode?: number;
    createdAt?: string;
  } = {},
) {
  const currency = options.currency ?? "USD";
  const environment = options.environment ?? "staging";
  const createdAt = options.createdAt ?? NOW;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO inventory_reservation_groups
      (id, cart_id, idempotency_key, status, expires_at, created_at, updated_at)
      VALUES (?, 'cart_fixture_0001', ?, 'active', ?, ?, ?)`,
    ).bind(`irg_${id}`, `reservation_${id}`, NOW, NOW, NOW),
    env.DB.prepare(
      `INSERT INTO checkout_attempts
      (id, cart_id, reservation_group_id, provider, environment, test_mode, idempotency_key,
       currency, subtotal_amount, discount_amount, shipping_amount, tax_amount, grand_total_amount,
       shipping_address_json, email, status, created_at, updated_at)
      VALUES (?, 'cart_fixture_0001', ?, 'stripe', ?, ?, ?, ?, ?, 0, 900, 0, ?, '{}',
              'ranking@example.test', 'completed', ?, ?)`,
    ).bind(
      `checkout_${id}`,
      `irg_${id}`,
      environment,
      options.testMode ?? 0,
      `checkout_key_${id}`,
      currency,
      amount,
      amount + 900,
      createdAt,
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO orders
      (id, public_reference, guest_access_token_hash, checkout_attempt_id, environment, test_mode,
       email, currency, subtotal_amount, discount_amount, shipping_amount, tax_amount,
       grand_total_amount, payment_status, order_status, fulfillment_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ranking@example.test', ?, ?, 0, 900, 0, ?, ?, 'confirmed',
              'unfulfilled', ?, ?)`,
    ).bind(
      id,
      `ORD-${id}`,
      `hash_${id}`,
      `checkout_${id}`,
      environment,
      options.testMode ?? 0,
      currency,
      amount,
      amount + 900,
      options.status ?? "paid",
      createdAt,
      createdAt,
    ),
    env.DB.prepare(
      `INSERT INTO order_lines
      (id, order_id, product_id, variant_id, sku, product_name, variant_name, option_values_json,
       quantity, unit_price_amount, discount_amount, tax_amount, line_total_amount, currency)
      VALUES (?, ?, ?, ?, ?, ?, 'Variant', '{}', 1, ?, 0, 0, ?, ?)`,
    ).bind(
      `line_${id}`,
      id,
      productId(productKey),
      `var_${id.replaceAll("-", "").padEnd(24, "0")}`,
      `sku_${id}`,
      `Snapshot ${id}`,
      amount,
      amount,
      currency,
    ),
  ]);
}

async function release(
  id: string,
  products: string[],
  deployedAt: string,
  options: {
    status?: string;
    purpose?: string;
    environment?: string;
  } = {},
) {
  const manifest = canonicalCatalogReleaseSchema.parse({
    releaseId: id,
    schemaVersion: 2,
    generatedAt: NOW,
    collections: [],
    redirects: [],
    policies: [
      {
        description: "Privacy",
        effectiveDate: "2026-09-29",
        slug: "privacy",
        title: "Privacy",
        sections: [{ heading: "Privacy", body: "Policy" }],
      },
    ],
    products: products.map((productKey) => ({
      id: productId(productKey),
      name: `Public ${productKey}`,
      slug: productKey,
      description: "Product",
      collectionIds: [],
      collectionSlugs: [],
      media: [],
      seoTitle: "Product",
      seoDescription: "Product",
      status: "published",
      variants: [
        {
          id: `var_${productKey.replaceAll("-", "").padEnd(24, "0")}`,
          sku: productKey,
          title: "Default",
          status: "active",
          optionValues: {},
          prices: [{ amount: 100, currency: "USD" }],
          weightGrams: 0,
        },
      ],
    })),
    routes: ["/policies/privacy", ...products.map((productId) => `/products/${productId}`)],
    site: {
      defaultCurrency: "USD",
      freshnessHours: 24,
      name: "Shop",
      origin: env.STOREFRONT_ORIGIN,
    },
  });
  await env.DB.prepare(
    `INSERT INTO catalog_releases
    (id, status, purpose, environment, manifest_json, approved_at, deployed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      options.status ?? "deployed",
      options.purpose ?? "public",
      options.environment ?? "staging",
      JSON.stringify(manifest),
      NOW,
      deployedAt,
      NOW,
      NOW,
    )
    .run();
}

beforeAll(async () => {
  await seedLaunchFixture(env.DB);
  await order("rank-a1", "rank-a", 300, { status: "partially_refunded" });
  await order("rank-a2", "rank-a", 700, {
    status: "refunded",
    createdAt: "2026-09-29T13:00:00.000Z",
  });
  await order("rank-b", "rank-b", 1000);
  await order("rank-test", "excluded-test", 9000, { testMode: 1 });
  await order("rank-env", "excluded-env", 9000, { environment: "production" });
  await order("rank-eur", "excluded-eur", 9000, { currency: "EUR" });
  await order("rank-pending", "excluded-pending", 9000, { status: "pending" });
  await order("rank-old", "excluded-old", 9000, { createdAt: "2026-09-28T23:59:59.000Z" });
  await order("rank-next", "excluded-next", 9000, { createdAt: "2026-09-30T00:00:00.000Z" });
  await release("rank-release-old", ["rank-a", "rank-b", "no-sales"], "2026-09-28T00:00:00.000Z");
  await release("rank-release-current", ["rank-b"], NOW);
  await release("rank-release-failed", ["rank-a"], "2026-09-30T00:00:00.000Z", {
    status: "failed",
  });
  await release("rank-release-private", ["rank-a"], "2026-09-30T00:00:00.000Z", {
    purpose: "private-preview",
  });
  await release("rank-release-other-env", ["rank-a"], "2026-09-30T00:00:00.000Z", {
    environment: "production",
  });
});

describe("product sales and public product resolution", () => {
  test("merges variants, retains refunded sales, excludes order-level shipping and isolates facts", async () => {
    const report = await getProductSalesReport(env, query);
    expect(report).toEqual({
      ...query,
      storefrontOrigin: env.STOREFRONT_ORIGIN,
      products: [
        { productId: productId("rank-a"), name: "Snapshot rank-a2", grossSales: 1000, path: null },
        {
          productId: productId("rank-b"),
          name: "Public rank-b",
          grossSales: 1000,
          path: "/products/rank-b",
        },
      ],
    });
  });

  test("current release is selected before checking product membership; historical no-sale names survive", async () => {
    const current = await getPublicRelease(env);
    expect(current?.releaseId).toBe("rank-release-current");
    expect(publicProductPath(current, productId("rank-a"))).toBeNull();
    const historical = await getPublicRelease(env, "rank-release-old");
    expect(publicProductName(historical, productId("no-sales"))).toBe("Public no-sales");
    expect(publicProductPath(current, productId("no-sales"))).toBeNull();
    for (const id of [
      "rank-release-failed",
      "rank-release-private",
      "rank-release-other-env",
      "missing",
    ]) {
      expect(await getPublicRelease(env, id)).toBeNull();
    }
  });

  test("invalid configured origins suppress links without losing financial history", async () => {
    const report = await getProductSalesReport(
      { ...env, STOREFRONT_ORIGIN: "https://example.test/path" },
      query,
    );
    expect(report.storefrontOrigin).toBeNull();
    expect(report.products.every((product) => product.path === null)).toBe(true);
    expect(report.products.map((product) => product.grossSales)).toEqual([1000, 1000]);
  });

  test("empty financial range returns an empty ranking", async () => {
    expect(
      (
        await getProductSalesReport(env, {
          ...query,
          startDate: "2026-09-27",
          endDate: "2026-09-27",
        })
      ).products,
    ).toEqual([]);
  });
});
