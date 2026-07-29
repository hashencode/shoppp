import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createApp } from "../../src/http/app";

const NOW = "2026-07-30T00:00:00.000Z";

const validProduct = {
  categories: [{ name: "Travel", slug: "travel" }],
  collections: [{ name: "Launch collection", slug: "launch-collection" }],
  description: "A durable carry-on designed for international travel.",
  media: [
    {
      altText: "Black carry-on suitcase viewed from the front",
      height: 1200,
      r2Key: "catalog/products/carry-on-black.webp",
      width: 1200,
    },
  ],
  name: "Carry-on",
  seoDescription: "Shop the lightweight Carry-on for international travel.",
  seoTitle: "Carry-on suitcase",
  slug: "carry-on",
  variants: [
    {
      optionValues: { color: "Black" },
      prices: [{ amount: 12_900, currency: "USD", priceListCode: "GLOBAL-USD" }],
      sku: "CASE-CARRY-BLK",
      title: "Black",
      weightGrams: 2_900,
    },
  ],
};

async function resetCatalog(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM idempotency_claims"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM catalog_releases"),
    env.DB.prepare("DELETE FROM product_media"),
    env.DB.prepare("DELETE FROM prices"),
    env.DB.prepare("DELETE FROM price_lists"),
    env.DB.prepare("DELETE FROM product_variants"),
    env.DB.prepare("DELETE FROM products"),
    env.DB.prepare("DELETE FROM admin_identities"),
  ]);
}

async function seedOperator(role: string, subject = "catalog-user"): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO admin_identities (id, access_subject, email, display_name, role, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
  )
    .bind(`admin-${subject}`, subject, `${subject}@example.test`, subject, role, NOW, NOW)
    .run();
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      ...init.headers,
    },
  });
}

function productRequest(body: unknown, path = "/admin/catalog/products"): Request {
  return request(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function appFor(subject = "catalog-user", buildTrigger = vi.fn()) {
  return {
    app: createApp({
      accessVerifier: async () => ({
        email: `${subject}@example.test`,
        subject,
      }),
      buildTrigger,
      previewTokenSecret: "test-preview-secret-at-least-32-bytes",
    }),
    buildTrigger,
  };
}

async function uploadValidMedia(app: ReturnType<typeof createApp>): Promise<void> {
  const response = await app.fetch(
    request("/admin/media/catalog/products/carry-on-black.webp", {
      body: new Uint8Array([82, 73, 70, 70]),
      headers: {
        "Content-Length": "4",
        "Content-Type": "image/webp",
      },
      method: "PUT",
    }),
    env,
  );
  expect(response.status).toBe(201);
}

describe("catalog management and publishing", () => {
  beforeEach(async () => {
    await resetCatalog();
    await seedOperator("catalog_manager");
  });

  test("creates a complete draft, previews it, and publishes one correlated build", async () => {
    const buildTrigger = vi.fn(async () => ({ correlationId: "build-correlation-001" }));
    const { app } = appFor("catalog-user", buildTrigger);
    await uploadValidMedia(app);

    const createResponse = await app.fetch(productRequest(validProduct), env);
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json<{ data: { id: string; status: string } }>();
    expect(created.data.status).toBe("draft");

    const updateResponse = await app.fetch(
      request(`/admin/catalog/products/${created.data.id}`, {
        body: JSON.stringify({ ...validProduct, name: "Carry-on Pro", slug: "carry-on-pro" }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(updateResponse.status).toBe(200);
    const detailResponse = await app.fetch(
      request(`/admin/catalog/products/${created.data.id}`),
      env,
    );
    expect(await detailResponse.json()).toMatchObject({
      data: { product: { name: "Carry-on Pro", slug: "carry-on-pro" } },
    });

    const previewResponse = await app.fetch(
      request(`/admin/catalog/products/${created.data.id}/preview`, { method: "POST" }),
      env,
    );
    expect(previewResponse.status).toBe(200);
    expect(await previewResponse.json()).toMatchObject({
      data: {
        expiresAt: expect.any(String),
        token: expect.any(String),
      },
    });

    const buildPublishRequest = () =>
      request(`/admin/catalog/products/${created.data.id}/publish`, {
        body: JSON.stringify({ reason: "Approved launch catalog release" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "publish-carry-on-0001",
        },
        method: "POST",
      });
    const first = await app.fetch(buildPublishRequest(), env);
    const replay = await app.fetch(buildPublishRequest(), env);

    expect(first.status).toBe(202);
    expect(replay.status).toBe(202);
    expect(await replay.text()).toBe(await first.text());
    expect(buildTrigger).toHaveBeenCalledTimes(1);
    expect(
      await env.DB.prepare(
        "SELECT status, build_correlation_id FROM catalog_releases ORDER BY created_at DESC LIMIT 1",
      ).first(),
    ).toEqual({ build_correlation_id: "build-correlation-001", status: "building" });
    expect(
      await env.DB.prepare("SELECT status FROM products WHERE id = ?")
        .bind(created.data.id)
        .first(),
    ).toEqual({ status: "published" });
    expect(
      await env.DB.prepare(
        "SELECT reason FROM audit_events WHERE action = 'catalog.publish' ORDER BY created_at DESC LIMIT 1",
      ).first(),
    ).toEqual({ reason: "Approved launch catalog release" });
    const list = await app.fetch(request("/admin/catalog/products"), env);
    expect(await list.json()).toMatchObject({
      data: [
        {
          build_correlation_id: "build-correlation-001",
          build_status: "building",
        },
      ],
    });
  });

  test.each([
    ["missing SKU", { ...validProduct, variants: [{ ...validProduct.variants[0], sku: "" }] }],
    [
      "fractional price",
      {
        ...validProduct,
        variants: [
          {
            ...validProduct.variants[0],
            prices: [{ ...validProduct.variants[0]!.prices[0]!, amount: 129.99 }],
          },
        ],
      },
    ],
    ["missing SEO", { ...validProduct, seoDescription: "", seoTitle: "" }],
  ])("blocks an invalid draft: %s", async (_label, body) => {
    const { app } = appFor();
    await uploadValidMedia(app);
    expect((await app.fetch(productRequest(body), env)).status).toBe(422);
  });

  test("enforces unique slugs and safe media type, size, and prefix", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    expect((await app.fetch(productRequest(validProduct), env)).status).toBe(201);
    expect((await app.fetch(productRequest(validProduct), env)).status).toBe(409);

    const unsafeType = await app.fetch(
      request("/admin/media/catalog/products/payload.svg", {
        body: "<svg/>",
        headers: { "Content-Length": "6", "Content-Type": "image/svg+xml" },
        method: "PUT",
      }),
      env,
    );
    expect(unsafeType.status).toBe(415);

    const unsafePrefix = await app.fetch(
      request("/admin/media/private/secret.webp", {
        body: "no",
        headers: { "Content-Length": "2", "Content-Type": "image/webp" },
        method: "PUT",
      }),
      env,
    );
    expect(unsafePrefix.status).toBe(422);

    const oversized = await app.fetch(
      request("/admin/media/catalog/products/huge.webp", {
        body: "no",
        headers: { "Content-Length": String(10 * 1024 * 1024 + 1), "Content-Type": "image/webp" },
        method: "PUT",
      }),
      env,
    );
    expect(oversized.status).toBe(413);
  });

  test("reuses one price list across multiple variants in the same draft", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const response = await app.fetch(
      productRequest({
        ...validProduct,
        slug: "carry-on-set",
        variants: [
          validProduct.variants[0],
          {
            ...validProduct.variants[0],
            optionValues: { color: "Silver" },
            sku: "CASE-CARRY-SLV",
            title: "Silver",
          },
        ],
      }),
      env,
    );
    expect(response.status).toBe(201);
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM price_lists WHERE code = ?")
          .bind("GLOBAL-USD")
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });

  test("allows a view-only operator to read but denies and audits mutation", async () => {
    await seedOperator("support", "support-user");
    const { app } = appFor("support-user");

    expect((await app.fetch(request("/admin/catalog/products"), env)).status).toBe(200);
    expect((await app.fetch(productRequest(validProduct), env)).status).toBe(403);
    expect(
      await env.DB.prepare(
        "SELECT action, result FROM audit_events WHERE actor_id = ? ORDER BY created_at DESC LIMIT 1",
      )
        .bind("admin-support-user")
        .first(),
    ).toEqual({ action: "catalog.write", result: "denied" });
  });
});
