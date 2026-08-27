import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

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

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "X-Test-Admin-Identity": "test-token",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
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
      testIdentityVerifier: async () => ({
        email: `${subject}@example.test`,
        principalKind: "human",
        subject,
      }),
      buildTrigger,
      buildManifestToken: "test-build-manifest-token-at-least-32-bytes",
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
    await seedHumanAdmin(env.DB, {
      email: "catalog-user@example.test",
      id: "admin-catalog-user",
      roleId: ADMIN_ROLE_IDS.catalogManager,
      subject: "catalog-user",
    });
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
    const release = await env.DB.prepare(
      "SELECT id, manifest_json FROM catalog_releases ORDER BY created_at DESC LIMIT 1",
    ).first<{ id: string; manifest_json: string }>();
    const manifest = JSON.parse(release!.manifest_json) as {
      collections: Array<{ id: string; productIds: string[]; status: string }>;
      products: Array<{ collectionIds: string[]; id: string; slug: string }>;
      routes: string[];
    };
    expect(manifest.products).toEqual([
      expect.objectContaining({ id: created.data.id, slug: "carry-on-pro" }),
    ]);
    expect(manifest.collections).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        productIds: [created.data.id],
        status: "published",
      }),
    ]);
    expect(manifest.products[0]?.collectionIds).toEqual([manifest.collections[0]?.id]);
    expect(manifest.routes).toContain("/products/carry-on-pro");
    const releaseResponse = await app.fetch(
      new Request(`https://api.example.test/build/catalog/releases/${release!.id}`, {
        headers: {
          Authorization: "Bearer test-build-manifest-token-at-least-32-bytes",
        },
      }),
      env,
    );
    expect(releaseResponse.status).toBe(200);
    expect(releaseResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(await releaseResponse.json()).toMatchObject({ releaseId: release!.id });
    expect(
      (
        await app.fetch(
          new Request(`https://api.example.test/build/catalog/releases/${release!.id}`),
          env,
        )
      ).status,
    ).toBe(401);
    const list = await app.fetch(request("/admin/catalog/products"), env);
    expect(await list.json()).toMatchObject({
      data: [
        {
          build_correlation_id: "build-correlation-001",
          build_status: "building",
        },
      ],
    });

    const deployedRequest = () =>
      new Request(`https://api.example.test/build/catalog/releases/${release!.id}/status`, {
        body: JSON.stringify({ status: "deployed" }),
        headers: {
          Authorization: "Bearer test-build-manifest-token-at-least-32-bytes",
          "Content-Type": "application/json",
          "Idempotency-Key": `catalog-build-${release!.id}-deployed`,
        },
        method: "POST",
      });
    const deployed = await app.fetch(deployedRequest(), env);
    const deployedReplay = await app.fetch(deployedRequest(), env);
    expect(deployed.status).toBe(200);
    expect(await deployedReplay.text()).toBe(await deployed.clone().text());
    expect(await deployed.json()).toMatchObject({
      data: {
        deployedAt: expect.any(String),
        failureCode: null,
        releaseId: release!.id,
        status: "deployed",
      },
    });
    expect(
      await env.DB.prepare(
        "SELECT status, deployed_at, failure_code FROM catalog_releases WHERE id = ?",
      )
        .bind(release!.id)
        .first(),
    ).toEqual({
      deployed_at: expect.any(String),
      failure_code: null,
      status: "deployed",
    });
    expect(
      await env.DB.prepare(
        "SELECT action, actor_type, result FROM audit_events WHERE target_id = ? AND action = 'catalog.build.result'",
      )
        .bind(release!.id)
        .first(),
    ).toEqual({
      action: "catalog.build.result",
      actor_type: "machine",
      result: "succeeded",
    });
    expect(
      (
        await app.fetch(
          new Request(`https://api.example.test/build/catalog/releases/${release!.id}/status`, {
            body: JSON.stringify({
              failureCode: "late_failure",
              status: "failed",
            }),
            headers: {
              Authorization: "Bearer test-build-manifest-token-at-least-32-bytes",
              "Content-Type": "application/json",
              "Idempotency-Key": `catalog-build-${release!.id}-late-failure`,
            },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(409);
  });

  test("records an authenticated failed build with a stable machine result", async () => {
    const { app } = appFor();
    const releaseId = "failed-release-001";
    await env.DB.prepare(
      `INSERT INTO catalog_releases
        (id, status, manifest_json, approved_at, created_at, updated_at)
       VALUES (?, 'building', '{}', ?, ?, ?)`,
    )
      .bind(releaseId, NOW, NOW, NOW)
      .run();
    const statusRequest = (body: unknown, token = "test-build-manifest-token-at-least-32-bytes") =>
      new Request(`https://api.example.test/build/catalog/releases/${releaseId}/status`, {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `catalog-build-${releaseId}-failed`,
        },
        method: "POST",
      });

    expect(
      (
        await app.fetch(
          statusRequest({ failureCode: "staging_journey_failed", status: "failed" }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      await env.DB.prepare("SELECT status, failure_code FROM catalog_releases WHERE id = ?")
        .bind(releaseId)
        .first(),
    ).toEqual({ failure_code: "staging_journey_failed", status: "failed" });

    expect(
      (
        await app.fetch(
          statusRequest({ failureCode: "another_failure", status: "failed" }, "wrong-token"),
          env,
        )
      ).status,
    ).toBe(401);
  });

  test("removes a staging proof marker while recording the terminal result", async () => {
    const { app } = appFor();
    const releaseId = "proving-release-001";
    await env.DB.prepare(
      `INSERT INTO catalog_releases
        (id, status, manifest_json, approved_at, created_at, updated_at)
       VALUES (?, 'building', '{}', ?, ?, ?)`,
    )
      .bind(releaseId, NOW, NOW, NOW)
      .run();
    await env.DB.prepare(
      "UPDATE catalog_releases SET build_correlation_id = 'staging-proof:original-correlation' WHERE id = ?",
    )
      .bind(releaseId)
      .run();
    const response = await app.fetch(
      new Request(`https://api.example.test/build/catalog/releases/${releaseId}/status`, {
        body: JSON.stringify({ status: "deployed" }),
        headers: {
          Authorization: "Bearer test-build-manifest-token-at-least-32-bytes",
          "Content-Type": "application/json",
          "Idempotency-Key": `catalog-build-${releaseId}-deployed`,
        },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: "deployed" } });
    expect(
      await env.DB.prepare("SELECT build_correlation_id FROM catalog_releases WHERE id = ?")
        .bind(releaseId)
        .first(),
    ).toEqual({ build_correlation_id: "original-correlation" });
  });

  test("converges concurrent identical build callbacks to one terminal audit", async () => {
    const { app } = appFor();
    const releaseId = "concurrent-release-001";
    await env.DB.prepare(
      `INSERT INTO catalog_releases
        (id, status, manifest_json, approved_at, created_at, updated_at)
       VALUES (?, 'building', '{}', ?, ?, ?)`,
    )
      .bind(releaseId, NOW, NOW, NOW)
      .run();
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        app.fetch(
          new Request(`https://api.example.test/build/catalog/releases/${releaseId}/status`, {
            body: JSON.stringify({ status: "deployed" }),
            headers: {
              Authorization: "Bearer test-build-manifest-token-at-least-32-bytes",
              "Content-Type": "application/json",
              "Idempotency-Key": `catalog-build-${releaseId}-${String(index).padStart(4, "0")}`,
            },
            method: "POST",
          }),
          env,
        ),
      ),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE target_id = ? AND action = 'catalog.build.result'",
        )
          .bind(releaseId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
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

  test("keeps Commerce product identity stable across slug and lifecycle changes", async () => {
    const buildTrigger = vi.fn(async () => ({ correlationId: "identity-build-001" }));
    const { app } = appFor("catalog-user", buildTrigger);
    await uploadValidMedia(app);
    const identityProduct = {
      ...validProduct,
      collections: [{ name: "Identity collection", slug: "identity-collection" }],
      slug: "identity-original",
    };
    const created = await (
      await app.fetch(productRequest(identityProduct), env)
    ).json<{ data: { id: string } }>();
    const originalProductId = created.data.id;

    expect(
      (
        await app.fetch(
          request(`/admin/catalog/products/${originalProductId}`, {
            body: JSON.stringify({ ...identityProduct, slug: "identity-renamed" }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    await env.DB.prepare("UPDATE products SET status = 'archived' WHERE id = ?")
      .bind(originalProductId)
      .run();
    await env.DB.prepare("UPDATE products SET status = 'draft' WHERE id = ?")
      .bind(originalProductId)
      .run();
    expect(
      await env.DB.prepare("SELECT id, slug FROM products WHERE id = ?")
        .bind(originalProductId)
        .first(),
    ).toEqual({ id: originalProductId, slug: "identity-renamed" });
    const originalCollection = await env.DB.prepare(
      "SELECT id FROM collections WHERE slug = 'identity-collection'",
    ).first<{ id: string }>();
    await env.DB.prepare(
      "UPDATE collections SET slug = 'identity-collection-renamed', status = 'archived' WHERE id = ?",
    )
      .bind(originalCollection!.id)
      .run();
    await env.DB.prepare("UPDATE collections SET status = 'draft' WHERE id = ?")
      .bind(originalCollection!.id)
      .run();
    expect(
      await env.DB.prepare("SELECT id, slug FROM collections WHERE id = ?")
        .bind(originalCollection!.id)
        .first(),
    ).toEqual({ id: originalCollection!.id, slug: "identity-collection-renamed" });

    await env.DB.batch([
      env.DB.prepare("DELETE FROM product_media WHERE product_id = ?").bind(originalProductId),
      env.DB.prepare("DELETE FROM collection_products WHERE product_id = ?").bind(
        originalProductId,
      ),
      env.DB.prepare("DELETE FROM product_categories WHERE product_id = ?").bind(originalProductId),
      env.DB.prepare(
        "DELETE FROM prices WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)",
      ).bind(originalProductId),
      env.DB.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(originalProductId),
      env.DB.prepare("DELETE FROM products WHERE id = ?").bind(originalProductId),
      env.DB.prepare("DELETE FROM collections WHERE id = ?").bind(originalCollection!.id),
    ]);
    const recreated = await (
      await app.fetch(
        productRequest({
          ...identityProduct,
          collections: [{ name: "Identity collection", slug: "identity-collection-renamed" }],
          slug: "identity-renamed",
        }),
        env,
      )
    ).json<{ data: { id: string } }>();
    const productId = recreated.data.id;
    expect(productId).not.toBe(originalProductId);
    const recreatedCollection = await env.DB.prepare(
      "SELECT id FROM collections WHERE slug = 'identity-collection-renamed'",
    ).first<{ id: string }>();
    expect(recreatedCollection!.id).not.toBe(originalCollection!.id);
    expect(
      (
        await app.fetch(
          request(`/admin/catalog/products/${productId}`, {
            body: JSON.stringify({
              ...identityProduct,
              collections: [{ name: "Identity collection", slug: "identity-collection-renamed" }],
              slug: "identity-final",
            }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    await env.DB.prepare(
      "UPDATE collections SET slug = 'identity-collection-final', status = 'archived' WHERE id = ?",
    )
      .bind(recreatedCollection!.id)
      .run();
    await env.DB.prepare("UPDATE collections SET status = 'draft' WHERE id = ?")
      .bind(recreatedCollection!.id)
      .run();
    await env.DB.prepare("UPDATE products SET status = 'archived' WHERE id = ?")
      .bind(productId)
      .run();
    await env.DB.prepare("UPDATE products SET status = 'draft' WHERE id = ?").bind(productId).run();

    const publish = await app.fetch(
      request(`/admin/catalog/products/${productId}/publish`, {
        body: JSON.stringify({ reason: "Identity publication" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "publish-identity-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(publish.status).toBe(202);
    const release = await env.DB.prepare(
      "SELECT manifest_json FROM catalog_releases ORDER BY created_at DESC LIMIT 1",
    ).first<{ manifest_json: string }>();
    const manifest = JSON.parse(release!.manifest_json);
    expect(manifest.products[0]).toMatchObject({
      collectionIds: [recreatedCollection!.id],
      id: productId,
    });
    expect(manifest.collections[0]).toMatchObject({
      id: recreatedCollection!.id,
      productIds: [productId],
      slug: "identity-collection-final",
    });
  });

  test("allows a view-only operator to read but denies and audits mutation", async () => {
    await seedHumanAdmin(env.DB, {
      email: "support-user@example.test",
      id: "admin-support-user",
      roleId: ADMIN_ROLE_IDS.support,
      subject: "support-user",
    });
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
