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
  optionDefinitions: [
    {
      name: "color",
      presentation: "color",
      values: [{ label: "Black", swatch: "#111111" }],
    },
  ],
  seoDescription: "Shop the lightweight Carry-on for international travel.",
  seoTitle: "Carry-on suitcase",
  slug: "carry-on",
  variants: [
    {
      optionValues: { color: "Black" },
      prices: [
        {
          amount: 12_900,
          compareAtAmount: 15_000,
          currency: "USD",
          priceListCode: "GLOBAL-USD",
        },
      ],
      sku: "CASE-CARRY-BLK",
      title: "Black",
      weightGrams: 2_900,
    },
  ],
};

async function resetCatalog(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("PRAGMA defer_foreign_keys = ON"),
    env.DB.prepare("DELETE FROM idempotency_claims"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM catalog_releases"),
    env.DB.prepare("DELETE FROM policy_versions"),
    env.DB.prepare("DELETE FROM collection_memberships"),
    env.DB.prepare("DELETE FROM collection_versions"),
    env.DB.prepare("DELETE FROM collections"),
    env.DB.prepare("DELETE FROM product_reviews"),
    env.DB.prepare("DELETE FROM product_revisions"),
    env.DB.prepare("DELETE FROM product_media"),
    env.DB.prepare("DELETE FROM product_media_assets"),
    env.DB.prepare("DELETE FROM prices"),
    env.DB.prepare("DELETE FROM price_lists"),
    env.DB.prepare("DELETE FROM stock_ledger_entries"),
    env.DB.prepare("DELETE FROM inventory_items"),
    env.DB.prepare("DELETE FROM warehouses"),
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

async function productVersion(productId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT version FROM products WHERE id = ?")
    .bind(productId)
    .first<{ version: number }>();
  if (!row) throw new Error(`Missing product ${productId}.`);
  return row.version;
}

async function seedPublishedPolicies(): Promise<void> {
  for (const kind of ["privacy", "returns", "shipping", "terms"] as const) {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO policy_versions
        (policy_id, version, kind, slug, title, effective_date, sections_json, status,
         approval_digest, approved_by, approved_at, approval_environment, published_at,
         created_at, updated_at)
       VALUES (?, 1, ?, ?, ?, '2026-07-30', ?, 'published', ?, 'admin-catalog-user', ?, ?, ?, ?, ?)`,
    )
      .bind(
        `policy.${kind}`,
        kind,
        kind,
        `${kind} policy`,
        JSON.stringify([{ id: `section.${kind}`, kind: "paragraph", text: `${kind} policy` }]),
        "a".repeat(64),
        NOW,
        env.ENVIRONMENT,
        NOW,
        NOW,
        NOW,
      )
      .run();
  }
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
    await seedPublishedPolicies();
  });

  test("accepts legacy draft writers and derives neutral text option presentation", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const { optionDefinitions: _omitted, ...legacyPayload } = validProduct;

    const response = await app.fetch(productRequest(legacyPayload), env);

    expect(response.status).toBe(201);
    const created = await response.json<{ data: { id: string } }>();
    expect(
      await env.DB.prepare("SELECT option_definitions_json FROM products WHERE id = ?")
        .bind(created.data.id)
        .first(),
    ).toEqual({
      option_definitions_json: JSON.stringify([
        { name: "color", presentation: "text", values: [{ label: "Black" }] },
      ]),
    });
    expect(
      await env.DB.prepare(
        "SELECT collection_id, collection_version, product_id, position FROM collection_memberships WHERE product_id = ?",
      )
        .bind(created.data.id)
        .first(),
    ).toMatchObject({ collection_version: 1, position: 0, product_id: created.data.id });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM collection_products WHERE product_id = ?",
        )
          .bind(created.data.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);
  });

  test("fails closed on Product membership changes while preserving safe Product edits", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const beforeMemberships = (
      await env.DB.prepare(
        `SELECT collection_id, collection_version, product_id, position
           FROM collection_memberships WHERE product_id = ? ORDER BY collection_id, position`,
      )
        .bind(created.data.id)
        .all()
    ).results;

    const membershipChange = await app.fetch(
      request(`/admin/catalog/products/${created.data.id}`, {
        body: JSON.stringify({
          ...validProduct,
          collections: [{ name: "Different", slug: "different" }],
          name: "Must not persist",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(membershipChange.status).toBe(409);
    expect(await membershipChange.json()).toMatchObject({
      error: { code: "collection_membership_maintenance_required" },
    });
    expect(
      await env.DB.prepare("SELECT name FROM products WHERE id = ?").bind(created.data.id).first(),
    ).toEqual({ name: validProduct.name });

    const safeEdit = await app.fetch(
      request(`/admin/catalog/products/${created.data.id}`, {
        body: JSON.stringify({ ...validProduct, name: "Safe product edit" }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(safeEdit.status).toBe(200);
    expect(
      await env.DB.prepare("SELECT name FROM products WHERE id = ?").bind(created.data.id).first(),
    ).toEqual({ name: "Safe product edit" });
    expect(
      (
        await env.DB.prepare(
          `SELECT collection_id, collection_version, product_id, position
             FROM collection_memberships WHERE product_id = ? ORDER BY collection_id, position`,
        )
          .bind(created.data.id)
          .all()
      ).results,
    ).toEqual(beforeMemberships);
  });

  test("creates a complete draft, previews it, and publishes one correlated build", async () => {
    const buildTrigger = vi.fn(async () => {
      expect(
        await env.DB.prepare("SELECT status FROM products WHERE slug = ?")
          .bind("carry-on-pro")
          .first(),
      ).toEqual({ status: "published" });
      return { correlationId: "build-correlation-001" };
    });
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
      data: {
        prices: [{ amount: 12_900, compare_at_amount: 15_000 }],
        product: { name: "Carry-on Pro", slug: "carry-on-pro" },
      },
    });
    const [releaseMedia, releaseVariant] = await Promise.all([
      env.DB.prepare("SELECT id FROM product_media WHERE product_id = ?")
        .bind(created.data.id)
        .first<{ id: string }>(),
      env.DB.prepare("SELECT id FROM product_variants WHERE product_id = ?")
        .bind(created.data.id)
        .first<{ id: string }>(),
    ]);
    const releasePresentation = {
      brand: "Shoppp",
      defaultVariantId: releaseVariant!.id,
      detail: {
        body: "Built for frequent travel.",
        bullets: ["Durable shell"],
        heading: "Designed for the journey",
      },
      detailMediaId: releaseMedia!.id,
      specifications: [{ label: "Capacity", value: "38 L" }],
    };
    expect(
      (
        await app.fetch(
          request(`/admin/catalog/products/${created.data.id}/presentation`, {
            body: JSON.stringify({
              expectedVersion: await productVersion(created.data.id),
              presentation: releasePresentation,
            }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          }),
          env,
        )
      ).status,
    ).toBe(200);

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
      products: Array<{
        collectionIds: string[];
        id: string;
        media: Array<{ id?: string }>;
        presentation?: typeof releasePresentation & { reviewDisplay?: { count: number } };
        slug: string;
        variants: Array<{
          prices: Array<{ amount: number; compareAtAmount?: number; currency: string }>;
        }>;
      }>;
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
    expect(manifest.products[0]?.variants[0]?.prices).toEqual([
      { amount: 12_900, compareAtAmount: 15_000, currency: "USD" },
    ]);
    expect(manifest.products[0]?.media[0]?.id).toBe(releaseMedia!.id);
    expect(manifest.products[0]?.presentation).toMatchObject(releasePresentation);
    expect(manifest.products[0]?.presentation?.reviewDisplay).toMatchObject({ count: 0 });
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

  test("freezes Product edits before manifest build and restores editability when the build hook fails", async () => {
    const buildTrigger = vi.fn(async () => {
      throw new Error("build unavailable");
    });
    const { app } = appFor("catalog-user", buildTrigger);
    await uploadValidMedia(app);
    const created = await (
      await app.fetch(productRequest(validProduct), env)
    ).json<{ data: { id: string } }>();

    const response = await app.fetch(
      request(`/admin/catalog/products/${created.data.id}/publish`, {
        body: JSON.stringify({
          expectedVersion: await productVersion(created.data.id),
          reason: "Test failed build rollback",
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "publish-failed-build-0001",
        },
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(500);
    expect(
      await env.DB.prepare("SELECT status, published_at FROM products WHERE id = ?")
        .bind(created.data.id)
        .first(),
    ).toEqual({ published_at: null, status: "draft" });
    expect(
      await env.DB.prepare(
        "SELECT status, failure_code FROM catalog_releases WHERE product_id = ? ORDER BY created_at DESC LIMIT 1",
      )
        .bind(created.data.id)
        .first(),
    ).toEqual({ failure_code: "build_hook_failed", status: "failed" });
  });

  test("updates only option presentation metadata and preserves variant-dependent rows", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    const snapshot = async () => ({
      media: (
        await env.DB.prepare(
          "SELECT id, product_id, variant_id, r2_key, alt_text, width, height, position, created_at FROM product_media WHERE product_id = ? ORDER BY id",
        )
          .bind(productId)
          .all()
      ).results,
      prices: (
        await env.DB.prepare(
          "SELECT p.* FROM prices p JOIN product_variants v ON v.id = p.variant_id WHERE v.product_id = ? ORDER BY p.id",
        )
          .bind(productId)
          .all()
      ).results,
      variants: (
        await env.DB.prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY id")
          .bind(productId)
          .all()
      ).results,
    });
    const before = await snapshot();
    const optionDefinitions = [
      {
        name: "color",
        presentation: "color",
        values: [{ label: "Black", swatch: "#222222" }],
      },
    ];

    const response = await app.fetch(
      request(`/admin/catalog/products/${productId}/option-definitions`, {
        body: JSON.stringify({
          expectedVersion: await productVersion(productId),
          optionDefinitions,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { optionDefinitions } });
    expect(await snapshot()).toEqual(before);
    expect(
      await env.DB.prepare("SELECT option_definitions_json FROM products WHERE id = ?")
        .bind(productId)
        .first(),
    ).toEqual({ option_definitions_json: JSON.stringify(optionDefinitions) });

    const variant = await env.DB.prepare(
      "SELECT id FROM product_variants WHERE product_id = ? AND sku = ?",
    )
      .bind(productId, validProduct.variants[0]!.sku)
      .first<{ id: string }>();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO warehouses (id, code, name, created_at) VALUES (?, ?, ?, ?)",
      ).bind("warehouse-option-save", "OPTION-SAVE", "Option save", NOW),
      env.DB.prepare(
        `INSERT INTO inventory_items
          (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, oversell_limit, version, updated_at)
         VALUES (?, ?, 1, 0, 0, 0, ?)`,
      ).bind(variant!.id, "warehouse-option-save", NOW),
    ]);
    const { optionDefinitions: _omitted, ...ordinaryPayload } = validProduct;
    const ordinarySave = await app.fetch(
      request(`/admin/catalog/products/${productId}`, {
        body: JSON.stringify({
          ...ordinaryPayload,
          expectedVersion: await productVersion(productId),
          name: "Carry-on renamed",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(ordinarySave.status).toBe(200);
    expect(
      await env.DB.prepare("SELECT id FROM product_variants WHERE product_id = ? AND sku = ?")
        .bind(productId, validProduct.variants[0]!.sku)
        .first(),
    ).toEqual({ id: variant!.id });
    expect(
      await env.DB.prepare("SELECT option_definitions_json FROM products WHERE id = ?")
        .bind(productId)
        .first(),
    ).toEqual({ option_definitions_json: JSON.stringify(optionDefinitions) });
  });

  test("rejects mismatched option definitions atomically with field-addressable errors", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    const original = await env.DB.prepare(
      "SELECT option_definitions_json FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();

    for (const optionDefinitions of [
      [{ name: "Color", presentation: "color", values: [{ label: "Black", swatch: "#111111" }] }],
      [{ name: "color", presentation: "color", values: [{ label: "White", swatch: "#ffffff" }] }],
      [{ name: "color", presentation: "color", values: [{ label: "Black", swatch: "red" }] }],
      [{ name: "color", presentation: "color", values: [{ label: "Black" }] }],
      [
        { name: "color", presentation: "text", values: [{ label: "Black" }] },
        { name: "color", presentation: "text", values: [{ label: "Black" }] },
      ],
    ]) {
      const response = await app.fetch(
        request(`/admin/catalog/products/${productId}/option-definitions`, {
          body: JSON.stringify({
            expectedVersion: await productVersion(productId),
            optionDefinitions,
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }),
        env,
      );
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: { details: expect.anything() } });
      expect(
        await env.DB.prepare("SELECT option_definitions_json FROM products WHERE id = ?")
          .bind(productId)
          .first(),
      ).toEqual(original);
    }
  });

  test("keeps published and archived option presentation immutable", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    for (const status of ["published", "archived"] as const) {
      await env.DB.prepare("UPDATE products SET status = ? WHERE id = ?")
        .bind(status, productId)
        .run();
      const response = await app.fetch(
        request(`/admin/catalog/products/${productId}/option-definitions`, {
          body: JSON.stringify({
            expectedVersion: await productVersion(productId),
            optionDefinitions: validProduct.optionDefinitions,
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }),
        env,
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: { code: "published_product_immutable" },
      });
    }
  });

  test("rejects a stale option-presentation write without replacing newer product state", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    const expectedVersion = await productVersion(productId);
    await env.DB.prepare("UPDATE products SET version = version + 1 WHERE id = ?")
      .bind(productId)
      .run();

    const response = await app.fetch(
      request(`/admin/catalog/products/${productId}/option-definitions`, {
        body: JSON.stringify({
          expectedVersion,
          optionDefinitions: [
            {
              name: "color",
              presentation: "color",
              values: [{ label: "Black", swatch: "#222222" }],
            },
          ],
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      env,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "stale_product_version" } });
    expect(
      await env.DB.prepare("SELECT option_definitions_json, version FROM products WHERE id = ?")
        .bind(productId)
        .first(),
    ).toEqual({
      option_definitions_json: JSON.stringify(validProduct.optionDefinitions),
      version: expectedVersion + 1,
    });
  });

  test("updates Product presentation atomically without replacing media or Variant rows", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    const media = (
      await env.DB.prepare("SELECT * FROM product_media WHERE product_id = ?")
        .bind(productId)
        .all<Record<string, unknown>>()
    ).results;
    const variants = (
      await env.DB.prepare("SELECT * FROM product_variants WHERE product_id = ?")
        .bind(productId)
        .all<Record<string, unknown>>()
    ).results;
    const presentation = {
      brand: "Shoppp",
      defaultVariantId: String(variants[0]!.id),
      detail: {
        body: "Built for frequent travel.",
        bullets: ["Durable shell", "Quiet wheels"],
        eyebrow: "Travel better",
        heading: "Designed for the journey",
      },
      detailMediaId: String(media[0]!.id),
      specifications: [
        { label: "Material", value: "Recycled polycarbonate" },
        { label: "Capacity", value: "38 L" },
      ],
    };

    const response = await app.fetch(
      request(`/admin/catalog/products/${productId}/presentation`, {
        body: JSON.stringify({ expectedVersion: await productVersion(productId), presentation }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { presentation, version: 2 } });
    expect(
      await env.DB.prepare("SELECT presentation_json, version FROM products WHERE id = ?")
        .bind(productId)
        .first(),
    ).toEqual({ presentation_json: JSON.stringify(presentation), version: 2 });
    expect(
      (
        await env.DB.prepare("SELECT * FROM product_media WHERE product_id = ?")
          .bind(productId)
          .all()
      ).results,
    ).toEqual(media);
    expect(
      (
        await env.DB.prepare("SELECT * FROM product_variants WHERE product_id = ?")
          .bind(productId)
          .all()
      ).results,
    ).toEqual(variants);

    expect(
      (
        await app.fetch(
          request(`/admin/catalog/products/${productId}`, {
            body: JSON.stringify({ ...validProduct, name: "Carry-on refreshed" }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT presentation_json FROM products WHERE id = ? AND presentation_json IS NOT NULL",
      )
        .bind(productId)
        .first(),
    ).toEqual({ presentation_json: JSON.stringify(presentation) });
    expect(
      (
        await env.DB.prepare("SELECT id FROM product_media WHERE product_id = ?")
          .bind(productId)
          .all<{ id: string }>()
      ).results.map(({ id }) => id),
    ).toEqual(media.map(({ id }) => id));
    expect(
      (
        await env.DB.prepare("SELECT id FROM product_variants WHERE product_id = ?")
          .bind(productId)
          .all<{ id: string }>()
      ).results.map(({ id }) => id),
    ).toEqual(variants.map(({ id }) => id));

    const removingDefault = await app.fetch(
      request(`/admin/catalog/products/${productId}`, {
        body: JSON.stringify({
          ...validProduct,
          variants: [{ ...validProduct.variants[0], sku: "REPLACEMENT-SKU" }],
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(removingDefault.status).toBe(422);
    expect(await removingDefault.json()).toMatchObject({
      error: { code: "product_presentation_reference_removed", details: expect.anything() },
    });
  });

  test("rejects invalid, stale, and immutable Product presentation writes", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    const initialVersion = await productVersion(productId);
    const requestPresentation = (presentation: unknown, expectedVersion = initialVersion) =>
      app.fetch(
        request(`/admin/catalog/products/${productId}/presentation`, {
          body: JSON.stringify({ expectedVersion, presentation }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }),
        env,
      );

    for (const presentation of [
      {
        defaultVariantId: "var_01J00000000000000000000099",
        specifications: [],
      },
      { detailMediaId: "med_01J00000000000000000000099", specifications: [] },
      {
        specifications: [
          { label: "Material", value: "One" },
          { label: "material", value: "Two" },
        ],
      },
    ]) {
      const response = await requestPresentation(presentation);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: { details: expect.anything() } });
      expect(await productVersion(productId)).toBe(initialVersion);
    }

    await env.DB.prepare("UPDATE products SET version = version + 1 WHERE id = ?")
      .bind(productId)
      .run();
    expect((await requestPresentation({ specifications: [] })).status).toBe(409);
    await env.DB.prepare("UPDATE products SET status = 'published' WHERE id = ?")
      .bind(productId)
      .run();
    expect(
      (await requestPresentation({ specifications: [] }, await productVersion(productId))).status,
    ).toBe(409);
    expect(
      await env.DB.prepare("SELECT presentation_json FROM products WHERE id = ?")
        .bind(productId)
        .first(),
    ).toEqual({ presentation_json: null });
  });

  test("stages a versioned published Product revision without changing its source row", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    await env.DB.prepare("UPDATE products SET status = 'published' WHERE id = ?")
      .bind(productId)
      .run();
    const originalProduct = await env.DB.prepare(
      "SELECT name, description, version FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    const expectedProductVersion = await productVersion(productId);
    const media = await env.DB.prepare(
      "SELECT id, r2_key, alt_text, width, height FROM product_media WHERE product_id = ?",
    )
      .bind(productId)
      .first<{
        alt_text: string;
        height: number;
        id: string;
        r2_key: string;
        width: number;
      }>();
    expect(media).not.toBeNull();
    const content = {
      description: "A revised, product-specific carry-on description.",
      media: [
        {
          altText: media!.alt_text,
          height: media!.height,
          id: media!.id,
          r2Key: media!.r2_key,
          width: media!.width,
        },
      ],
      name: "Carry-on revision",
      presentation: null,
      seoDescription: validProduct.seoDescription,
      seoTitle: validProduct.seoTitle,
    };
    const draftPath = `/admin/catalog/products/${productId}/revisions/draft`;
    const stage = (expectedDraftVersion: number | null, nextContent = content) =>
      app.fetch(
        request(draftPath, {
          body: JSON.stringify({
            content: nextContent,
            expectedDraftVersion,
            expectedProductVersion,
            expectedPublishedRevisionId: null,
          }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        }),
        env,
      );

    const invalidOptions = await app.fetch(
      request(draftPath, {
        body: JSON.stringify({
          content: {
            ...content,
            optionDefinitions: [
              { name: "color", presentation: "text", values: [{ label: "Charcoal" }] },
            ],
            variantOptions: [
              { id: "wrong-variant", optionValues: { color: "Charcoal" }, title: "Charcoal" },
            ],
          },
          expectedDraftVersion: null,
          expectedProductVersion,
          expectedPublishedRevisionId: null,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(invalidOptions.status).toBe(422);
    expect(await invalidOptions.json()).toMatchObject({
      error: { code: "product_revision_options_invalid" },
    });

    const first = await stage(null);
    expect(first.status, JSON.stringify(await first.clone().json())).toBe(200);
    const firstBody = await first.json<{ data: { id: string } }>();
    expect(firstBody).toMatchObject({
      data: { content, status: "draft", version: 1 },
    });
    expect(
      await env.DB.prepare("SELECT name, description, version FROM products WHERE id = ?")
        .bind(productId)
        .first(),
    ).toEqual(originalProduct);
    expect((await stage(null)).status).toBe(409);
    const second = await stage(1, { ...content, name: "Carry-on second revision" });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      data: { content: { name: "Carry-on second revision" }, version: 2 },
    });
    const stagedRevision = firstBody;
    const preview = await app.fetch(
      request(
        `/admin/catalog/products/${productId}/revisions/preview?revisionId=${stagedRevision.data.id}`,
      ),
      env,
    );
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({
      data: {
        product: { id: productId, name: "Carry-on second revision" },
        revisionId: stagedRevision.data.id,
      },
    });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM product_revisions WHERE product_id = ?")
        .bind(productId)
        .first(),
    ).toEqual({ count: 1 });

    const newMediaId = crypto.randomUUID();
    const newMediaKey = `catalog/products/${productId}/${newMediaId}.webp`;
    const ownUpload = await app.fetch(
      request(`/admin/media/${newMediaKey}`, {
        body: new Uint8Array([82, 73, 70, 70]),
        headers: { "Content-Length": "4", "Content-Type": "image/webp" },
        method: "PUT",
      }),
      env,
    );
    expect(ownUpload.status).toBe(201);
    const ownMedia = {
      altText: "Product-specific detail image",
      height: 1200,
      id: newMediaId,
      r2Key: newMediaKey,
      width: 1200,
    };
    const withOwnMedia = await stage(2, {
      ...content,
      media: [...content.media, ownMedia],
    });
    expect(withOwnMedia.status).toBe(200);
    expect(await withOwnMedia.json()).toMatchObject({ data: { version: 3 } });
    expect(
      await env.DB.prepare("SELECT product_id, r2_key FROM product_media_assets WHERE id = ?")
        .bind(newMediaId)
        .first(),
    ).toEqual({ product_id: productId, r2_key: newMediaKey });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM product_media WHERE product_id = ?")
        .bind(productId)
        .first(),
    ).toEqual({ count: 1 });
    const staleMediaId = crypto.randomUUID();
    const staleMediaKey = `catalog/products/${productId}/${staleMediaId}.webp`;
    const staleUpload = await app.fetch(
      request(`/admin/media/${staleMediaKey}`, {
        body: new Uint8Array([82, 73, 70, 70]),
        headers: { "Content-Length": "4", "Content-Type": "image/webp" },
        method: "PUT",
      }),
      env,
    );
    expect(staleUpload.status).toBe(201);
    const staleWrite = await stage(2, {
      ...content,
      media: [...content.media, { ...ownMedia, id: staleMediaId, r2Key: staleMediaKey }],
    });
    expect(staleWrite.status).toBe(409);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM product_media_assets WHERE id = ?")
        .bind(staleMediaId)
        .first(),
    ).toEqual({ count: 0 });

    const secondUpload = await app.fetch(
      request("/admin/media/catalog/products/duffel.webp", {
        body: new Uint8Array([82, 73, 70, 70]),
        headers: { "Content-Length": "4", "Content-Type": "image/webp" },
        method: "PUT",
      }),
      env,
    );
    expect(secondUpload.status).toBe(201);
    const otherProduct = {
      ...validProduct,
      collections: [{ name: "Duffel collection", slug: "duffel-collection" }],
      media: [{ ...validProduct.media[0]!, r2Key: "catalog/products/duffel.webp" }],
      slug: "duffel",
      variants: [{ ...validProduct.variants[0]!, sku: "DUFFEL-001" }],
    };
    const otherResponse = await app.fetch(productRequest(otherProduct), env);
    expect(otherResponse.status).toBe(201);
    const other = await otherResponse.json<{ data: { id: string } }>();
    const otherMedia = await env.DB.prepare(
      "SELECT id, r2_key FROM product_media WHERE product_id = ?",
    )
      .bind(other.data.id)
      .first<{ id: string; r2_key: string }>();
    const crossProduct = await stage(3, {
      ...content,
      media: [
        {
          ...content.media[0]!,
          id: otherMedia!.id,
          r2Key: otherMedia!.r2_key,
        },
      ],
    });
    expect(crossProduct.status).toBe(422);
    expect(await crossProduct.json()).toMatchObject({ error: { code: "cross_product_media" } });
  });

  test("publishes a staged Product revision and then a review-only release without rewriting history", async () => {
    const { app } = appFor(
      "catalog-user",
      vi.fn(async () => ({ correlationId: crypto.randomUUID() })),
    );
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    const publishInitial = await app.fetch(
      request(`/admin/catalog/products/${productId}/publish`, {
        body: JSON.stringify({ reason: "Initial published Product" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "initial-revision-test-publish",
        },
        method: "POST",
      }),
      env,
    );
    expect(publishInitial.status).toBe(202);
    const initialRelease = await publishInitial.json<{ data: { releaseId: string } }>();
    const initialManifest = await env.DB.prepare(
      "SELECT manifest_json FROM catalog_releases WHERE id = ?",
    )
      .bind(initialRelease.data.releaseId)
      .first<{ manifest_json: string }>();
    const media = await env.DB.prepare(
      "SELECT id, r2_key, alt_text, width, height FROM product_media WHERE product_id = ?",
    )
      .bind(productId)
      .first<{
        alt_text: string;
        height: number;
        id: string;
        r2_key: string;
        width: number;
      }>();
    const productVersionBeforeRevision = await productVersion(productId);
    const variantId = (await env.DB.prepare("SELECT id FROM product_variants WHERE product_id = ?")
      .bind(productId)
      .first<{ id: string }>())!.id;
    const stagedContent = {
      description: "Revision content bound to this Product ID.",
      media: [
        {
          altText: media!.alt_text,
          height: media!.height,
          id: media!.id,
          r2Key: media!.r2_key,
          width: media!.width,
        },
      ],
      name: "Revised carry-on",
      optionDefinitions: [{ name: "color", presentation: "text", values: [{ label: "Charcoal" }] }],
      presentation: null,
      seoDescription: validProduct.seoDescription,
      seoTitle: validProduct.seoTitle,
      variantOptions: [{ id: variantId, optionValues: { color: "Charcoal" }, title: "Charcoal" }],
    };
    const staged = await app.fetch(
      request(`/admin/catalog/products/${productId}/revisions/draft`, {
        body: JSON.stringify({
          content: stagedContent,
          expectedDraftVersion: null,
          expectedProductVersion: productVersionBeforeRevision,
          expectedPublishedRevisionId: null,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(staged.status).toBe(200);
    const stagedRevision = await staged.json<{ data: { id: string; version: number } }>();
    const publishRevision = (revisionId: string | null, publishedId: string | null, key: string) =>
      app.fetch(
        request(`/admin/catalog/products/${productId}/revisions/publish`, {
          body: JSON.stringify({
            expectedDraftVersion: revisionId ? stagedRevision.data.version : null,
            expectedProductVersion: productVersionBeforeRevision,
            expectedPublishedRevisionId: publishedId,
            reason: "Reviewed Product revision",
            revisionId,
          }),
          headers: { "Content-Type": "application/json", "Idempotency-Key": key },
          method: "POST",
        }),
        env,
      );
    const releaseResponse = await publishRevision(
      stagedRevision.data.id,
      null,
      "published-revision-test-1",
    );
    expect(releaseResponse.status, JSON.stringify(await releaseResponse.clone().json())).toBe(202);
    const release = await releaseResponse.json<{ data: { releaseId: string } }>();
    const revisedManifest = await env.DB.prepare(
      "SELECT manifest_json FROM catalog_releases WHERE id = ?",
    )
      .bind(release.data.releaseId)
      .first<{ manifest_json: string }>();
    expect(JSON.parse(revisedManifest!.manifest_json)).toMatchObject({
      products: [
        {
          id: productId,
          name: "Revised carry-on",
          optionDefinitions: stagedContent.optionDefinitions,
          variants: [{ id: variantId, optionValues: { color: "Charcoal" } }],
        },
      ],
    });
    const beforeDeploy = await app.fetch(
      new Request("https://api.example.test/catalog/products/carry-on/live"),
      env,
    );
    expect(await beforeDeploy.json()).toMatchObject({ data: { name: "Carry-on" } });
    expect(
      await env.DB.prepare("SELECT manifest_json FROM catalog_releases WHERE id = ?")
        .bind(initialRelease.data.releaseId)
        .first(),
    ).toEqual(initialManifest);
    const deployed = await app.fetch(
      new Request(
        `https://api.example.test/build/catalog/releases/${release.data.releaseId}/status`,
        {
          body: JSON.stringify({ status: "deployed" }),
          headers: {
            Authorization: "Bearer test-build-manifest-token-at-least-32-bytes",
            "Content-Type": "application/json",
            "Idempotency-Key": "published-revision-test-deployed",
          },
          method: "POST",
        },
      ),
      env,
    );
    expect(deployed.status).toBe(200);
    expect(
      await env.DB.prepare("SELECT status FROM product_revisions WHERE id = ?")
        .bind(stagedRevision.data.id)
        .first(),
    ).toEqual({ status: "published" });
    const afterDeploy = await app.fetch(
      new Request("https://api.example.test/catalog/products/carry-on/live"),
      env,
    );
    expect(await afterDeploy.json()).toMatchObject({
      data: {
        name: "Revised carry-on",
        optionDefinitions: stagedContent.optionDefinitions,
        variants: [{ id: variantId, options: { color: "Charcoal" } }],
      },
    });
    const reviewOnly = await publishRevision(null, stagedRevision.data.id, "review-only-test-1");
    expect(reviewOnly.status, JSON.stringify(await reviewOnly.clone().json())).toBe(202);
    const reviewOnlyRelease = await reviewOnly.json<{ data: { releaseId: string } }>();
    const reviewOnlyManifest = await env.DB.prepare(
      "SELECT manifest_json FROM catalog_releases WHERE id = ?",
    )
      .bind(reviewOnlyRelease.data.releaseId)
      .first<{ manifest_json: string }>();
    expect(JSON.parse(reviewOnlyManifest!.manifest_json).products).toEqual(
      JSON.parse(revisedManifest!.manifest_json).products,
    );
    expect(await productVersion(productId)).toBe(productVersionBeforeRevision);

    const secondDraftResponse = await app.fetch(
      request(`/admin/catalog/products/${productId}/revisions/draft`, {
        body: JSON.stringify({
          content: { ...stagedContent, name: "Unbuilt revision" },
          expectedDraftVersion: null,
          expectedProductVersion: productVersionBeforeRevision,
          expectedPublishedRevisionId: stagedRevision.data.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(secondDraftResponse.status).toBe(200);
    const secondDraft = await secondDraftResponse.json<{ data: { id: string; version: number } }>();
    const failingApp = appFor(
      "catalog-user",
      vi.fn(async () => {
        throw new Error("build hook unavailable");
      }),
    ).app;
    const failedReleaseResponse = await failingApp.fetch(
      request(`/admin/catalog/products/${productId}/revisions/publish`, {
        body: JSON.stringify({
          expectedDraftVersion: secondDraft.data.version,
          expectedProductVersion: productVersionBeforeRevision,
          expectedPublishedRevisionId: stagedRevision.data.id,
          reason: "Try a revised Product build",
          revisionId: secondDraft.data.id,
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "failed-published-revision-test",
        },
        method: "POST",
      }),
      env,
    );
    expect(failedReleaseResponse.status).toBe(500);
    expect(
      await env.DB.prepare("SELECT status FROM product_revisions WHERE id = ?")
        .bind(secondDraft.data.id)
        .first(),
    ).toEqual({ status: "draft" });
    expect(
      await env.DB.prepare("SELECT status FROM product_revisions WHERE id = ?")
        .bind(stagedRevision.data.id)
        .first(),
    ).toEqual({ status: "published" });
    expect(
      await env.DB.prepare("SELECT manifest_json FROM catalog_releases WHERE id = ?")
        .bind(release.data.releaseId)
        .first(),
    ).toEqual(revisedManifest);
  });

  test("builds an approved-only review snapshot in a new release and preserves the old snapshot", async () => {
    const { app } = appFor(
      "catalog-user",
      vi.fn(async () => ({ correlationId: crypto.randomUUID() })),
    );
    await uploadValidMedia(app);
    const createdResponse = await app.fetch(productRequest(validProduct), env);
    const created = await createdResponse.json<{ data: { id: string } }>();
    const productId = created.data.id;
    const initialResponse = await app.fetch(
      request(`/admin/catalog/products/${productId}/publish`, {
        body: JSON.stringify({ reason: "Initial review snapshot" }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "initial-review-snapshot-001",
        },
        method: "POST",
      }),
      env,
    );
    expect(initialResponse.status).toBe(202);
    const initial = await initialResponse.json<{ data: { releaseId: string } }>();
    const initialRow = await env.DB.prepare(
      "SELECT manifest_json FROM catalog_releases WHERE id = ?",
    )
      .bind(initial.data.releaseId)
      .first<{ manifest_json: string }>();
    const initialProduct = JSON.parse(initialRow!.manifest_json).products[0];
    expect(initialProduct.presentation.reviewDisplay).toMatchObject({
      averageRating: 0,
      count: 0,
      entries: [],
      ratingBands: [0, 0, 0, 0, 0],
    });

    const reviews = [
      { id: crypto.randomUUID(), rating: 5, status: "approved", name: "Five star" },
      { id: crypto.randomUUID(), rating: 4, status: "approved", name: "Four star" },
      { id: crypto.randomUUID(), rating: 2, status: "approved", name: "Two star" },
      { id: crypto.randomUUID(), rating: 1, status: "pending", name: "Pending secret" },
      { id: crypto.randomUUID(), rating: 1, status: "rejected", name: "Rejected secret" },
    ];
    for (const [index, review] of reviews.entries()) {
      const submittedAt = new Date(Date.parse(NOW) + index * 1_000).toISOString();
      await env.DB.prepare(
        `INSERT INTO product_reviews
          (id, product_id, rating, display_name, body, consent_accepted_at, status, submitted_at,
           moderated_at, moderated_by, moderation_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          review.id,
          productId,
          review.rating,
          review.name,
          "A product-specific review with enough useful detail.",
          submittedAt,
          review.status,
          submittedAt,
          review.status === "pending" ? null : submittedAt,
          review.status === "pending" ? null : "admin-catalog-user",
          review.status === "pending" ? null : "Reviewed for release",
        )
        .run();
    }

    const nextResponse = await app.fetch(
      request(`/admin/catalog/products/${productId}/revisions/publish`, {
        body: JSON.stringify({
          expectedDraftVersion: null,
          expectedProductVersion: await productVersion(productId),
          expectedPublishedRevisionId: null,
          reason: "Publish approved review display",
          revisionId: null,
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "review-only-snapshot-001",
        },
        method: "POST",
      }),
      env,
    );
    expect(nextResponse.status, JSON.stringify(await nextResponse.clone().json())).toBe(202);
    const next = await nextResponse.json<{ data: { releaseId: string } }>();
    const nextRow = await env.DB.prepare("SELECT manifest_json FROM catalog_releases WHERE id = ?")
      .bind(next.data.releaseId)
      .first<{ manifest_json: string }>();
    const nextProduct = JSON.parse(nextRow!.manifest_json).products[0];
    expect(nextProduct).toMatchObject({
      id: productId,
      name: initialProduct.name,
      slug: initialProduct.slug,
    });
    expect(nextProduct.presentation.reviewDisplay).toMatchObject({
      averageRating: 3.7,
      count: 3,
      ratingBands: [0, 1, 0, 1, 1],
      entries: [
        { id: reviews[2]!.id, rating: 2, author: "Two star" },
        { id: reviews[1]!.id, rating: 4, author: "Four star" },
        { id: reviews[0]!.id, rating: 5, author: "Five star" },
      ],
    });
    expect(nextRow!.manifest_json).not.toContain("Pending secret");
    expect(nextRow!.manifest_json).not.toContain("Rejected secret");
    expect(nextRow!.manifest_json).not.toContain("consentAcceptedAt");
    expect(nextRow!.manifest_json).not.toContain("consent_accepted_at");
    expect(
      await env.DB.prepare("SELECT manifest_json FROM catalog_releases WHERE id = ?")
        .bind(initial.data.releaseId)
        .first(),
    ).toEqual(initialRow);
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
        optionDefinitions: [
          {
            name: "color",
            presentation: "color",
            values: [
              { label: "Black", swatch: "#111111" },
              { label: "Silver", swatch: "#c0c0c0" },
            ],
          },
        ],
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
    await env.DB.prepare(
      "UPDATE collection_versions SET slug = 'identity-collection-renamed', status = 'archived' WHERE collection_id = ?",
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
      env.DB.prepare("DELETE FROM product_media_assets WHERE product_id = ?").bind(
        originalProductId,
      ),
      env.DB.prepare("DELETE FROM collection_memberships WHERE product_id = ?").bind(
        originalProductId,
      ),
      env.DB.prepare("DELETE FROM collection_versions WHERE collection_id = ?").bind(
        originalCollection!.id,
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
    await env.DB.prepare(
      "UPDATE collection_versions SET slug = 'identity-collection-final', status = 'archived' WHERE collection_id = ?",
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
