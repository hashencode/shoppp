import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createApp } from "../../src/http/app";
import { listCollections } from "../../src/catalog/collections";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const NOW = "2026-07-30T00:00:00.000Z";

const validProduct = {
  categories: [{ name: "Travel", slug: "travel" }],
  collections: [],
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
    env.DB.prepare("DELETE FROM catalog_release_media_ledger"),
    env.DB.prepare("DELETE FROM catalog_release_sources"),
    env.DB.prepare("DELETE FROM catalog_releases"),
    env.DB.prepare("DELETE FROM policy_versions"),
    env.DB.prepare("DELETE FROM navigation_collection_references"),
    env.DB.prepare("DELETE FROM navigation_items"),
    env.DB.prepare("DELETE FROM navigation_menu_versions"),
    env.DB.prepare("DELETE FROM collection_route_redirects"),
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
    env.DB.prepare("DELETE FROM settings WHERE key = 'storefront.redirects'"),
    env.DB.prepare("DELETE FROM admin_identities"),
    env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = 'custom_revision_media_identity_reader'",
    ),
    env.DB.prepare("DELETE FROM admin_roles WHERE id = 'custom_revision_media_identity_reader'"),
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

function collectionBody(
  overrides: Partial<{
    description: string;
    expectedVersion: number;
    name: string;
    productIds: string[];
    reason: string;
    redirectFromOldSlug: boolean;
    seoDescription: string;
    seoTitle: string;
    slug: string;
    status: "archived" | "draft" | "published";
  }> = {},
) {
  return {
    description: "Collection description",
    name: "Collection",
    productIds: [],
    reason: "Maintain Collection authority",
    seoDescription: "Collection description",
    seoTitle: "Collection",
    slug: "collection",
    status: "draft" as const,
    ...overrides,
  };
}

async function createCollection(
  app: ReturnType<typeof createApp>,
  overrides: Parameters<typeof collectionBody>[0] = {},
) {
  const response = await app.fetch(
    request("/admin/catalog/collections", {
      body: JSON.stringify(collectionBody(overrides)),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
    env,
  );
  expect(response.status, await response.clone().text()).toBe(201);
  return (await response.json<{ data: { id: string; version: number } }>()).data;
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

  test("derives neutral text option presentation and rejects legacy Product membership writes", async () => {
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
    ).toBeNull();
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM collection_products WHERE product_id = ?",
        )
          .bind(created.data.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);
    const membershipWrite = await app.fetch(
      productRequest({
        ...legacyPayload,
        collections: [{ name: "Launch collection", slug: "launch-collection" }],
        slug: "legacy-membership-write",
        variants: [{ ...validProduct.variants[0]!, sku: "LEGACY-MEMBERSHIP-001" }],
      }),
      env,
    );
    expect(membershipWrite.status).toBe(409);
    expect(await membershipWrite.json()).toMatchObject({
      error: { code: "collection_membership_maintenance_required" },
    });
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

  test("creates and differentially reorders a versioned Collection without Product-side writes", async () => {
    const { app } = appFor();
    await uploadValidMedia(app);
    const firstProductResponse = await app.fetch(
      productRequest({ ...validProduct, collections: [] }),
      env,
    );
    const firstProduct = await firstProductResponse.json<{ data: { id: string } }>();
    const secondPayload = {
      ...validProduct,
      collections: [],
      name: "Checked luggage",
      slug: "checked-luggage",
      media: [{ ...validProduct.media[0]!, r2Key: "catalog/products/checked.webp" }],
      variants: [{ ...validProduct.variants[0]!, sku: "CHECKED-001" }],
    };
    await app.fetch(
      request("/admin/media/catalog/products/checked.webp", {
        body: new Uint8Array([82, 73, 70, 70]),
        headers: { "Content-Length": "4", "Content-Type": "image/webp" },
        method: "PUT",
      }),
      env,
    );
    const secondProductResponse = await app.fetch(productRequest(secondPayload), env);
    const secondProduct = await secondProductResponse.json<{ data: { id: string } }>();

    const createResponse = await app.fetch(
      request("/admin/catalog/collections", {
        body: JSON.stringify({
          description: "Travel essentials",
          name: "Travel",
          productIds: [firstProduct.data.id, secondProduct.data.id],
          reason: "Create ordered travel collection",
          seoDescription: "Travel essentials",
          seoTitle: "Travel collection",
          slug: "travel",
          status: "published",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(createResponse.status, await createResponse.clone().text()).toBe(201);
    const created = await createResponse.json<{ data: { id: string; version: number } }>();

    const concurrentUpdate = (productIds: string[], reason: string) =>
      app.fetch(
        request(`/admin/catalog/collections/${created.data.id}`, {
          body: JSON.stringify({
            description: "Travel essentials",
            expectedVersion: created.data.version,
            name: "Travel",
            productIds,
            reason,
            seoDescription: "Travel essentials",
            seoTitle: "Travel collection",
            slug: "travel",
            status: "published",
          }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        }),
        env,
      );
    const contenders = await Promise.all([
      concurrentUpdate([secondProduct.data.id, firstProduct.data.id], "Prioritize checked luggage"),
      concurrentUpdate([firstProduct.data.id], "Prioritize carry-on luggage"),
    ]);
    expect(contenders.map(({ status }) => status).sort()).toEqual([200, 409]);
    const accepted = contenders.find(({ status }) => status === 200)!;
    const rejected = contenders.find(({ status }) => status === 409)!;
    expect(await rejected.json()).toMatchObject({
      error: { code: "stale_collection_version" },
    });
    const reordered = await accepted.json<{ data: { productIds: string[]; version: number } }>();
    expect([[secondProduct.data.id, firstProduct.data.id], [firstProduct.data.id]]).toContainEqual(
      reordered.data.productIds,
    );

    const current = await app.fetch(request(`/admin/catalog/collections/${created.data.id}`), env);
    expect(await current.json()).toMatchObject({
      data: {
        name: "Travel",
        productIds: reordered.data.productIds,
        version: reordered.data.version,
      },
    });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM collection_versions WHERE collection_id = ?",
      )
        .bind(created.data.id)
        .first(),
    ).toEqual({ count: 2 });

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO navigation_menu_versions
          (menu_id, version, placement, status, created_at, updated_at)
         VALUES ('menu.header', 1, 'header', 'draft', ?, ?)`,
      ).bind(NOW, NOW),
      env.DB.prepare(
        `INSERT INTO navigation_items
          (menu_id, menu_version, item_id, parent_item_id, position, label, target_json)
         VALUES ('menu.header', 1, 'nav.travel', NULL, 0, 'Travel', ?)`,
      ).bind(JSON.stringify({ id: created.data.id, kind: "collection" })),
      env.DB.prepare(
        `INSERT INTO navigation_collection_references
          (menu_id, menu_version, item_id, collection_id, collection_version, environment, created_at)
         VALUES ('menu.header', 1, 'nav.travel', ?, ?, ?, ?)`,
      ).bind(created.data.id, reordered.data.version, env.ENVIRONMENT, NOW),
    ]);

    const blockedSlug = await app.fetch(
      request(`/admin/catalog/collections/${created.data.id}`, {
        body: JSON.stringify({
          description: "Travel essentials",
          expectedVersion: reordered.data.version,
          name: "Travel",
          productIds: [secondProduct.data.id, firstProduct.data.id],
          reason: "Rename travel collection",
          seoDescription: "Travel essentials",
          seoTitle: "Travel collection",
          slug: "travel-edit",
          status: "published",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(blockedSlug.status).toBe(409);
    expect(await blockedSlug.json()).toMatchObject({
      error: {
        code: "collection_has_backlinks",
        details: { backlinks: [] },
      },
    });

    const draftRename = await app.fetch(
      request(`/admin/catalog/collections/${created.data.id}`, {
        body: JSON.stringify({
          description: "Travel essentials",
          expectedVersion: reordered.data.version,
          name: "Travel",
          productIds: [secondProduct.data.id, firstProduct.data.id],
          reason: "Rename with validated redirect",
          redirectFromOldSlug: true,
          seoDescription: "Travel essentials",
          seoTitle: "Travel collection",
          slug: "travel-edit",
          status: "draft",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(draftRename.status).toBe(200);
    const renamedDraft = await draftRename.json<{ data: { version: number } }>();
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM collection_route_redirects").first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        "SELECT redirect_from_slug FROM collection_versions WHERE collection_id = ? AND version = ?",
      )
        .bind(created.data.id, renamedDraft.data.version)
        .first(),
    ).toEqual({ redirect_from_slug: "travel" });

    const blockedPublish = await app.fetch(
      request(`/admin/catalog/collections/${created.data.id}`, {
        body: JSON.stringify({
          description: "Travel essentials",
          expectedVersion: renamedDraft.data.version,
          name: "Travel",
          productIds: [secondProduct.data.id, firstProduct.data.id],
          reason: "Publish renamed collection",
          redirectFromOldSlug: true,
          seoDescription: "Travel essentials",
          seoTitle: "Travel collection",
          slug: "travel-edit",
          status: "published",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(blockedPublish.status).toBe(409);
    expect(await blockedPublish.json()).toMatchObject({
      error: { code: "collection_has_backlinks" },
    });

    await env.DB.batch([
      env.DB.prepare("DELETE FROM navigation_collection_references"),
      env.DB.prepare("DELETE FROM navigation_items"),
      env.DB.prepare("DELETE FROM navigation_menu_versions"),
    ]);
    const publishedRename = await app.fetch(
      request(`/admin/catalog/collections/${created.data.id}`, {
        body: JSON.stringify({
          description: "Travel essentials",
          expectedVersion: renamedDraft.data.version,
          name: "Travel",
          productIds: [secondProduct.data.id, firstProduct.data.id],
          reason: "Publish renamed collection after repair",
          redirectFromOldSlug: true,
          seoDescription: "Travel essentials",
          seoTitle: "Travel collection",
          slug: "travel-edit",
          status: "published",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(publishedRename.status, await publishedRename.clone().text()).toBe(200);
    const redirected = await publishedRename.json<{ data: { version: number } }>();
    expect(
      await env.DB.prepare(
        "SELECT from_path, to_path FROM collection_route_redirects WHERE environment = ?",
      )
        .bind(env.ENVIRONMENT)
        .first(),
    ).toEqual({ from_path: "/collections/travel", to_path: "/collections/travel-edit" });

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO navigation_menu_versions
          (menu_id, version, placement, status, created_at, updated_at)
         VALUES ('menu.header', 2, 'header', 'draft', ?, ?)`,
      ).bind(NOW, NOW),
      env.DB.prepare(
        `INSERT INTO navigation_items
          (menu_id, menu_version, item_id, parent_item_id, position, label, target_json)
         VALUES ('menu.header', 2, 'nav.travel', NULL, 0, 'Travel', ?)`,
      ).bind(JSON.stringify({ id: created.data.id, kind: "collection" })),
      env.DB.prepare(
        `INSERT INTO navigation_collection_references
          (menu_id, menu_version, item_id, collection_id, collection_version, environment, created_at)
         VALUES ('menu.header', 2, 'nav.travel', ?, ?, ?, ?)`,
      ).bind(created.data.id, redirected.data.version, env.ENVIRONMENT, NOW),
    ]);
    const blockedArchive = await app.fetch(
      request(`/admin/catalog/collections/${created.data.id}`, {
        body: JSON.stringify({
          description: "Travel essentials",
          expectedVersion: redirected.data.version,
          name: "Travel",
          productIds: [secondProduct.data.id, firstProduct.data.id],
          reason: "Archive referenced collection",
          seoDescription: "Travel essentials",
          seoTitle: "Travel collection",
          slug: "travel-edit",
          status: "archived",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(blockedArchive.status).toBe(409);
  });

  test("rejects an unknown Collection cover asset without creating a version", async () => {
    const { app } = appFor();
    const response = await app.fetch(
      request("/admin/catalog/collections", {
        body: JSON.stringify({
          coverAssetId: "00000000-0000-4000-8000-000000000099",
          description: "Travel essentials",
          name: "Travel",
          productIds: [],
          reason: "Create travel collection",
          seoDescription: "Travel essentials",
          seoTitle: "Travel collection",
          slug: "travel",
          status: "draft",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "collection_cover_asset_invalid" },
    });
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM collection_versions").first<{
          count: number;
        }>()
      )?.count,
    ).toBe(0);
  });

  test("persists the declared 10,000-member Collection boundary with one ordered set write", async () => {
    const { app } = appFor();
    const productIds = Array.from(
      { length: 10_000 },
      (_, index) => `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    await env.DB.prepare(
      `INSERT INTO products
        (id, slug, name, description, status, seo_title, seo_description, created_at, updated_at)
       SELECT CAST(value AS TEXT), 'bulk-' || key, 'Bulk ' || key, '', 'draft', '', '', ?, ?
         FROM json_each(?)`,
    )
      .bind(NOW, NOW, JSON.stringify(productIds))
      .run();
    const response = await app.fetch(
      request("/admin/catalog/collections", {
        body: JSON.stringify(
          collectionBody({
            name: "Bulk",
            productIds,
            reason: "Prove maximum ordered membership",
            seoTitle: "Bulk",
            slug: "bulk",
          }),
        ),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(response.status, await response.clone().text()).toBe(201);
    const created = await response.json<{ data: { id: string; productIds: string[] } }>();
    expect(created.data.productIds).toHaveLength(10_000);
    expect(created.data.productIds[0]).toBe(productIds[0]);
    expect(created.data.productIds.at(-1)).toBe(productIds.at(-1));
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count, MIN(position) AS first_position, MAX(position) AS last_position
           FROM collection_memberships WHERE collection_id = ?`,
      )
        .bind(created.data.id)
        .first(),
    ).toEqual({ count: 10_000, first_position: 0, last_position: 9_999 });
  });

  test("requires catalog.publish separately for Collection publication", async () => {
    const { app } = appFor();
    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = ? AND permission_key = 'catalog.publish'",
    )
      .bind(ADMIN_ROLE_IDS.catalogManager)
      .run();
    try {
      const draftResponse = await app.fetch(
        request("/admin/catalog/collections", {
          body: JSON.stringify({
            description: "Travel essentials",
            name: "Travel",
            productIds: [],
            reason: "Create travel draft",
            seoDescription: "Travel essentials",
            seoTitle: "Travel collection",
            slug: "travel",
            status: "draft",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
        env,
      );
      expect(draftResponse.status).toBe(201);
      const draft = await draftResponse.json<{ data: { id: string; version: number } }>();
      const publishResponse = await app.fetch(
        request(`/admin/catalog/collections/${draft.data.id}`, {
          body: JSON.stringify({
            description: "Travel essentials",
            expectedVersion: draft.data.version,
            name: "Travel",
            productIds: [],
            reason: "Publish travel collection",
            seoDescription: "Travel essentials",
            seoTitle: "Travel collection",
            slug: "travel",
            status: "published",
          }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        }),
        env,
      );
      expect(publishResponse.status).toBe(403);
    } finally {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES (?, 'catalog.publish', ?)`,
      )
        .bind(ADMIN_ROLE_IDS.catalogManager, NOW)
        .run();
    }
  });

  test("allows no-note draft saves but keeps all published or archived Collection writes strict", async () => {
    const { app } = appFor();
    const { reason: _reason, seoTitle: _seoTitle, ...input } = collectionBody();
    const created = await app.fetch(
      request("/admin/catalog/collections", {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(created.status).toBe(201);
    const collection = (await created.json<{ data: { id: string; seo: { title: string } } }>())
      .data;
    expect(collection.seo.title).toBe(input.name);
    const draftSaved = await app.fetch(
      request(`/admin/catalog/collections/${collection.id}`, {
        body: JSON.stringify({ ...input, expectedVersion: 1, reason: "好", seoTitle: "  " }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(draftSaved.status).toBe(200);
    const audit = await env.DB.prepare(
      "SELECT reason FROM audit_events WHERE target_id = ? ORDER BY created_at",
    )
      .bind(collection.id)
      .all();
    expect(audit.results).toEqual([{ reason: null }, { reason: "好" }]);
    for (const status of ["published", "archived"] as const) {
      expect(
        (
          await app.fetch(
            request(`/admin/catalog/collections/${collection.id}`, {
              body: JSON.stringify({ ...input, expectedVersion: 2, reason: " ", status }),
              headers: { "Content-Type": "application/json" },
              method: "PUT",
            }),
            env,
          )
        ).status,
      ).toBe(422);
      const strict = await createCollection(app, { slug: `strict-${status}`, status });
      expect(
        (
          await app.fetch(
            request(`/admin/catalog/collections/${strict.id}`, {
              body: JSON.stringify({
                ...input,
                slug: `strict-${status}`,
                expectedVersion: 1,
                reason: "ok",
              }),
              headers: { "Content-Type": "application/json" },
              method: "PUT",
            }),
            env,
          )
        ).status,
      ).toBe(422);
      expect(
        await env.DB.prepare(
          "SELECT version, status FROM collection_versions WHERE collection_id = ?",
        )
          .bind(strict.id)
          .first(),
      ).toEqual({ version: 1, status });
    }
  });

  test("returns only permission-approved exact-version and environment Collection backlinks", async () => {
    await seedHumanAdmin(env.DB, {
      email: "catalog-admin@example.test",
      id: "admin-catalog-admin",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "catalog-admin",
    });
    const { app } = appFor("catalog-admin");
    const collection = await createCollection(app, { status: "published" });
    const draftResponse = await app.fetch(
      request(`/admin/catalog/collections/${collection.id}`, {
        body: JSON.stringify(
          collectionBody({
            expectedVersion: collection.version,
            name: "Collection draft",
            reason: "Stage successor",
            seoTitle: "Collection draft",
            status: "draft",
          }),
        ),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    const draft = await draftResponse.json<{ data: { version: number } }>();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO navigation_menu_versions
          (menu_id, version, placement, status, created_at, updated_at)
         VALUES ('menu.scope', 1, 'header', 'draft', ?, ?)`,
      ).bind(NOW, NOW),
      ...["current-v1", "other-env-v1", "current-v2"].map((itemId, position) =>
        env.DB.prepare(
          `INSERT INTO navigation_items
            (menu_id, menu_version, item_id, parent_item_id, position, label, target_json)
           VALUES ('menu.scope', 1, ?, NULL, ?, ?, ?)`,
        ).bind(itemId, position, itemId, JSON.stringify({ id: collection.id, kind: "collection" })),
      ),
      env.DB.prepare(
        `INSERT INTO navigation_collection_references
          (menu_id, menu_version, item_id, collection_id, collection_version, environment, created_at)
         VALUES ('menu.scope', 1, 'current-v1', ?, 1, ?, ?)`,
      ).bind(collection.id, env.ENVIRONMENT, NOW),
      env.DB.prepare(
        `INSERT INTO navigation_collection_references
          (menu_id, menu_version, item_id, collection_id, collection_version, environment, created_at)
         VALUES ('menu.scope', 1, 'other-env-v1', ?, 1, 'development', ?)`,
      ).bind(collection.id, NOW),
      env.DB.prepare(
        `INSERT INTO navigation_collection_references
          (menu_id, menu_version, item_id, collection_id, collection_version, environment, created_at)
         VALUES ('menu.scope', 1, 'current-v2', ?, ?, ?, ?)`,
      ).bind(collection.id, draft.data.version, env.ENVIRONMENT, NOW),
    ]);
    const response = await app.fetch(
      request(`/admin/catalog/collections/${collection.id}`, {
        body: JSON.stringify(
          collectionBody({
            expectedVersion: draft.data.version,
            name: "Collection next",
            reason: "Publish exact scoped successor",
            seoTitle: "Collection next",
            status: "published",
          }),
        ),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        code: "collection_has_backlinks",
        details: {
          backlinks: [
            {
              environment: env.ENVIRONMENT,
              fieldPath: "items.current-v1.target",
              id: "menu.scope",
              version: 1,
            },
          ],
        },
      },
    });
  });

  test.each([
    ["page", "0"],
    ["pageSize", "101"],
    ["productId", "not-a-public-id"],
    ["status", "retired"],
  ])("returns the standard validation envelope for invalid Collection %s", async (key, value) => {
    const { app } = appFor();
    const response = await app.fetch(
      request(`/admin/catalog/collections?${key}=${encodeURIComponent(value)}`),
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "validation_failed", details: [{ path: [key] }] },
    });
  });

  test("maps a pending candidate source lock to an atomic retryable Collection conflict", async () => {
    const { app } = appFor();
    const collection = await createCollection(app);
    await env.DB.prepare(
      `INSERT INTO catalog_releases
        (id, status, manifest_json, approved_at, purpose, environment, manifest_digest,
         source_digest, candidate_status, candidate_expires_at, created_at, updated_at)
       VALUES ('collection-lock-candidate', 'building', ?, ?, 'private-preview', ?, ?, ?,
               'pending', '2099-09-30T00:00:00.000Z', ?, ?)`,
    )
      .bind(
        JSON.stringify({
          environment: env.ENVIRONMENT,
          purpose: "private-preview",
          schemaVersion: 3,
        }),
        NOW,
        env.ENVIRONMENT,
        "a".repeat(64),
        "b".repeat(64),
        NOW,
        NOW,
      )
      .run();
    const response = await app.fetch(
      request(`/admin/catalog/collections/${collection.id}`, {
        body: JSON.stringify(
          collectionBody({
            expectedVersion: collection.version,
            name: "Locked update",
            reason: "Attempt during candidate freeze",
          }),
        ),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "catalog_candidate_sources_locked" },
    });
    expect(
      await env.DB.prepare("SELECT version, name FROM collection_versions WHERE collection_id = ?")
        .bind(collection.id)
        .all(),
    ).toMatchObject({ results: [{ name: "Collection", version: 1 }] });
  });

  test("hydrates a Collection list page with a constant four D1 statements", async () => {
    const { app } = appFor();
    await createCollection(app, { name: "First", seoTitle: "First", slug: "first" });
    await createCollection(app, { name: "Second", seoTitle: "Second", slug: "second" });
    let prepares = 0;
    const countingDb = new Proxy(env.DB, {
      get(target, property) {
        if (property === "prepare") {
          return (sql: string) => {
            prepares += 1;
            return target.prepare(sql);
          };
        }
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const response = await listCollections(
      {
        env: { DB: countingDb, ENVIRONMENT: env.ENVIRONMENT },
        get: () => "list-query-count",
      } as unknown as Parameters<typeof listCollections>[0],
      { page: 1, pageSize: 100 },
    );
    expect(response.data).toHaveLength(2);
    expect(prepares).toBe(4);
  });

  test("reports exact candidate/live Collection inclusion and saved-version stale causes", async () => {
    const { app } = appFor();
    const collection = await createCollection(app, { status: "published" });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO catalog_releases
          (id, status, manifest_json, approved_at, purpose, environment, candidate_status, created_at, updated_at)
         VALUES ('collection-candidate-exact', 'approved', '{"schemaVersion":2}',
                 ?, 'private-preview', ?, 'succeeded', ?, ?)`,
      ).bind(NOW, env.ENVIRONMENT, NOW, NOW),
      env.DB.prepare(
        `INSERT INTO catalog_releases
          (id, status, manifest_json, approved_at, purpose, environment, created_at, updated_at)
         VALUES ('collection-live-exact', 'deployed', '{"schemaVersion":2}', ?, 'public', ?, ?, ?)`,
      ).bind(NOW, env.ENVIRONMENT, NOW, NOW),
      env.DB.prepare(
        `INSERT INTO catalog_release_sources
          (release_id, source_kind, source_id, source_version, source_digest, environment, created_at)
         VALUES ('collection-candidate-exact', 'collection', ?, 1, ?, ?, ?)`,
      ).bind(collection.id, "c".repeat(64), env.ENVIRONMENT, NOW),
      env.DB.prepare(
        `INSERT INTO catalog_release_sources
          (release_id, source_kind, source_id, source_version, source_digest, environment, created_at)
         VALUES ('collection-live-exact', 'collection', ?, 1, ?, ?, ?)`,
      ).bind(collection.id, "d".repeat(64), env.ENVIRONMENT, NOW),
    ]);
    const exact = await app.fetch(request(`/admin/catalog/collections/${collection.id}`), env);
    expect(await exact.json()).toMatchObject({
      data: {
        candidate: {
          candidateDigest: "c".repeat(64),
          candidateReleaseId: "collection-candidate-exact",
          candidateStaleCause: null,
          liveDigest: "d".repeat(64),
          liveReleaseId: "collection-live-exact",
          liveStaleCause: null,
        },
      },
    });
    const draft = await app.fetch(
      request(`/admin/catalog/collections/${collection.id}`, {
        body: JSON.stringify(
          collectionBody({
            expectedVersion: collection.version,
            name: "Collection v2",
            reason: "Save newer collection state",
            seoTitle: "Collection v2",
          }),
        ),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(draft.status).toBe(200);
    const stale = await app.fetch(request(`/admin/catalog/collections/${collection.id}`), env);
    expect(await stale.json()).toMatchObject({
      data: {
        candidate: {
          candidateReleaseId: null,
          candidateStaleCause: "saved_version_newer",
          liveReleaseId: null,
          liveStaleCause: "saved_version_newer",
        },
      },
    });
  });

  test("activates concurrent Collection redirects independently and preserves old-route collisions", async () => {
    const { app } = appFor();
    const first = await createCollection(app, {
      name: "First",
      seoTitle: "First",
      slug: "first",
      status: "published",
    });
    const second = await createCollection(app, {
      name: "Second",
      seoTitle: "Second",
      slug: "second",
      status: "published",
    });
    const stageRename = async (id: string, version: number, name: string, slug: string) => {
      const response = await app.fetch(
        request(`/admin/catalog/collections/${id}`, {
          body: JSON.stringify(
            collectionBody({
              expectedVersion: version,
              name,
              reason: `Stage ${name} redirect`,
              redirectFromOldSlug: true,
              seoTitle: name,
              slug,
              status: "draft",
            }),
          ),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        }),
        env,
      );
      expect(response.status).toBe(200);
      return (await response.json<{ data: { version: number } }>()).data.version;
    };
    const [firstDraft, secondDraft] = await Promise.all([
      stageRename(first.id, first.version, "First next", "first-next"),
      stageRename(second.id, second.version, "Second next", "second-next"),
    ]);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM collection_route_redirects").first(),
    ).toEqual({ count: 0 });
    const publishRename = (id: string, version: number, name: string, slug: string) =>
      app.fetch(
        request(`/admin/catalog/collections/${id}`, {
          body: JSON.stringify(
            collectionBody({
              expectedVersion: version,
              name,
              reason: `Publish ${name} redirect`,
              redirectFromOldSlug: true,
              seoTitle: name,
              slug,
              status: "published",
            }),
          ),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        }),
        env,
      );
    const published = await Promise.all([
      publishRename(first.id, firstDraft, "First next", "first-next"),
      publishRename(second.id, secondDraft, "Second next", "second-next"),
    ]);
    expect(published.map(({ status }) => status)).toEqual([200, 200]);
    expect(
      await env.DB.prepare(
        "SELECT from_path, to_path FROM collection_route_redirects ORDER BY from_path",
      ).all(),
    ).toMatchObject({
      results: [
        { from_path: "/collections/first", to_path: "/collections/first-next" },
        { from_path: "/collections/second", to_path: "/collections/second-next" },
      ],
    });

    const collision = await createCollection(app, {
      name: "Collision",
      seoTitle: "Collision",
      slug: "collision",
      status: "published",
    });
    const storedRedirects = [{ from: "/collections/collision", to: "/collections/existing" }];
    await env.DB.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES ('storefront.redirects', ?, ?)",
    )
      .bind(JSON.stringify(storedRedirects), NOW)
      .run();
    const rejected = await app.fetch(
      request(`/admin/catalog/collections/${collision.id}`, {
        body: JSON.stringify(
          collectionBody({
            expectedVersion: collision.version,
            name: "Collision next",
            reason: "Reject colliding old route",
            redirectFromOldSlug: true,
            seoTitle: "Collision next",
            slug: "collision-next",
            status: "draft",
          }),
        ),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({
      error: { code: "collection_redirect_conflict" },
    });
    expect(
      await env.DB.prepare(
        "SELECT value_json FROM settings WHERE key = 'storefront.redirects'",
      ).first(),
    ).toEqual({ value_json: JSON.stringify(storedRedirects) });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM collection_versions WHERE collection_id = ?",
      )
        .bind(collision.id)
        .first(),
    ).toEqual({ count: 1 });
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
    const collectionResponse = await app.fetch(
      request("/admin/catalog/collections", {
        body: JSON.stringify({
          description: "Launch collection",
          name: "Launch collection",
          productIds: [created.data.id],
          reason: "Create launch collection",
          seoDescription: "Launch collection",
          seoTitle: "Launch collection",
          slug: "launch-collection",
          status: "published",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(collectionResponse.status).toBe(201);
    const collection = await collectionResponse.json<{ data: { id: string; version: number } }>();
    const collectionDraft = await app.fetch(
      request(`/admin/catalog/collections/${collection.data.id}`, {
        body: JSON.stringify({
          description: "Unreleased launch collection",
          expectedVersion: collection.data.version,
          name: "Launch collection draft",
          productIds: [created.data.id],
          reason: "Stage collection independently",
          seoDescription: "Unreleased launch collection",
          seoTitle: "Launch collection draft",
          slug: "launch-collection-draft",
          status: "draft",
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      }),
      env,
    );
    expect(collectionDraft.status).toBe(200);

    const updateResponse = await app.fetch(
      request(`/admin/catalog/products/${created.data.id}`, {
        body: JSON.stringify({
          ...validProduct,
          collections: [{ name: "Launch collection draft", slug: "launch-collection-draft" }],
          name: "Carry-on Pro",
          slug: "carry-on-pro",
        }),
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
        "SELECT version, status FROM collection_versions WHERE collection_id = ? ORDER BY version",
      )
        .bind(collection.data.id)
        .all(),
    ).toMatchObject({
      results: [
        { status: "published", version: 1 },
        { status: "draft", version: 2 },
      ],
    });
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
    const revisionMedia = {
      altText: "Approved revision detail image",
      height: 900,
      id: crypto.randomUUID(),
      r2Key: `catalog/products/${productId}/revision-detail.webp`,
      width: 1200,
    };
    expect(
      (
        await app.fetch(
          request(`/admin/media/${revisionMedia.r2Key}`, {
            body: new Uint8Array([82, 73, 70, 70]),
            headers: { "Content-Length": "4", "Content-Type": "image/webp" },
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(201);
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
          altText: "Revised main image",
          height: media!.height,
          id: media!.id,
          r2Key: media!.r2_key,
          width: media!.width,
        },
        revisionMedia,
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
    const beforeDeployMedia = await app.fetch(request("/admin/catalog/collections/media"), env);
    expect(beforeDeployMedia.status).toBe(200);
    expect(await beforeDeployMedia.json()).toMatchObject({
      data: [{ id: media!.id, productName: "Carry-on" }],
      meta: { total: 1 },
    });
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
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM product_media WHERE id = ?")
        .bind(revisionMedia.id)
        .first(),
    ).toEqual({ count: 0 });
    const historicalMedia = {
      ...revisionMedia,
      altText: "Historical published image",
      id: crypto.randomUUID(),
      r2Key: `catalog/products/${productId}/historical.webp`,
    };
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO product_media_assets (id, product_id, r2_key, created_at) VALUES (?, ?, ?, ?)",
      ).bind(historicalMedia.id, productId, historicalMedia.r2Key, NOW),
      env.DB.prepare(
        `INSERT INTO product_revisions
          (id, product_id, base_product_version, version, status, content_json,
           created_by, created_at, updated_at, published_at)
         VALUES (?, ?, ?, 1, 'published', ?, 'admin-catalog-user', ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        productId,
        productVersionBeforeRevision,
        JSON.stringify({ ...stagedContent, media: [historicalMedia], name: "Historical carry-on" }),
        NOW,
        NOW,
        NOW,
      ),
    ]);
    const listedMedia = await app.fetch(request("/admin/catalog/collections/media"), env);
    expect(listedMedia.status).toBe(200);
    const listed = await listedMedia.json<{
      data: Array<{ id: string }>;
      meta: { total: number };
    }>();
    expect(listed.meta.total).toBe(2);
    expect(listed.data).toHaveLength(2);
    expect(new Set(listed.data.map(({ id }) => id)).size).toBe(2);
    expect(listed.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: media!.id,
          alt: "Revised main image",
          productName: "Revised carry-on",
        }),
        expect.objectContaining({
          id: revisionMedia.id,
          alt: revisionMedia.altText,
          height: revisionMedia.height,
          key: revisionMedia.r2Key,
          productName: "Revised carry-on",
          width: revisionMedia.width,
        }),
      ]),
    );
    const searched = await app.fetch(
      request("/admin/catalog/collections/media?query=Approved%20revision"),
      env,
    );
    expect(await searched.json()).toMatchObject({
      data: [{ id: revisionMedia.id }],
      meta: { total: 1 },
    });
    const pages = await Promise.all(
      [1, 2].map(async (page) => {
        const response = await app.fetch(
          request(`/admin/catalog/collections/media?page=${page}&pageSize=1`),
          env,
        );
        expect(response.status).toBe(200);
        return response.json<{ data: Array<{ id: string }>; meta: { total: number } }>();
      }),
    );
    expect(pages.map(({ meta }) => meta.total)).toEqual([2, 2]);
    expect(pages.flatMap(({ data }) => data.map(({ id }) => id)).sort()).toEqual(
      [media!.id, revisionMedia.id].sort(),
    );
    const coverSaved = await app.fetch(
      request("/admin/catalog/collections", {
        body: JSON.stringify({
          ...collectionBody({ slug: "revision-cover" }),
          coverAssetId: revisionMedia.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      env,
    );
    expect(coverSaved.status, await coverSaved.clone().text()).toBe(201);
    expect(await coverSaved.json()).toMatchObject({ data: { coverAssetId: revisionMedia.id } });
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO admin_roles (id, key, name, description, created_at, updated_at) VALUES ('custom_revision_media_identity_reader', 'revision_media_identity_reader', 'Identity media reader', '', ?, ?)",
      ).bind(NOW, NOW),
      env.DB.prepare(
        "INSERT INTO admin_role_permissions (role_id, permission_key, created_at) VALUES ('custom_revision_media_identity_reader', 'identity.read', ?)",
      ).bind(NOW),
    ]);
    await seedHumanAdmin(env.DB, {
      id: "revision-media-identity-reader",
      subject: "revision-media-identity-reader",
      email: "revision-media-identity-reader@example.test",
      roleId: "custom_revision_media_identity_reader",
    });
    const identityReader = appFor("revision-media-identity-reader").app;
    const identityMedia = await identityReader.fetch(
      request("/admin/settings/store-identity/media?query=Approved%20revision"),
      env,
    );
    expect(identityMedia.status).toBe(200);
    expect(await identityMedia.json()).toMatchObject({
      data: [{ id: revisionMedia.id }],
      meta: { total: 1 },
    });
    expect(
      (await identityReader.fetch(request("/admin/catalog/collections/media"), env)).status,
    ).toBe(403);
    expect((await app.fetch(request("/admin/settings/store-identity/media"), env)).status).toBe(
      403,
    );
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

    const draftOnlyMedia = {
      ...revisionMedia,
      altText: "Unapproved draft-only image",
      id: crypto.randomUUID(),
      r2Key: `catalog/products/${productId}/draft-only.webp`,
    };
    expect(
      (
        await app.fetch(
          request(`/admin/media/${draftOnlyMedia.r2Key}`, {
            body: new Uint8Array([82, 73, 70, 70]),
            headers: { "Content-Length": "4", "Content-Type": "image/webp" },
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(201);
    const secondDraftResponse = await app.fetch(
      request(`/admin/catalog/products/${productId}/revisions/draft`, {
        body: JSON.stringify({
          content: {
            ...stagedContent,
            media: [...stagedContent.media, draftOnlyMedia],
            name: "Unbuilt revision",
          },
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
    expect(
      await env.DB.prepare("SELECT id FROM product_media_assets WHERE id = ?")
        .bind(draftOnlyMedia.id)
        .first(),
    ).toEqual({ id: draftOnlyMedia.id });
    for (const [reader, path] of [
      [app, "/admin/catalog/collections/media"],
      [identityReader, "/admin/settings/store-identity/media"],
    ] as const) {
      const response = await reader.fetch(request(path), env);
      expect(response.status).toBe(200);
      const result = await response.json<{
        data: Array<{ id: string }>;
        meta: { total: number };
      }>();
      expect(result.meta.total).toBe(2);
      expect(result.data.map(({ id }) => id).sort()).toEqual([media!.id, revisionMedia.id].sort());
    }
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
    await env.DB.batch([
      env.DB.prepare("DELETE FROM product_media WHERE product_id = ?").bind(originalProductId),
      env.DB.prepare("DELETE FROM product_media_assets WHERE product_id = ?").bind(
        originalProductId,
      ),
      env.DB.prepare("DELETE FROM product_categories WHERE product_id = ?").bind(originalProductId),
      env.DB.prepare(
        "DELETE FROM prices WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)",
      ).bind(originalProductId),
      env.DB.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(originalProductId),
      env.DB.prepare("DELETE FROM products WHERE id = ?").bind(originalProductId),
    ]);
    const recreated = await (
      await app.fetch(
        productRequest({
          ...identityProduct,
          slug: "identity-renamed",
        }),
        env,
      )
    ).json<{ data: { id: string } }>();
    const productId = recreated.data.id;
    expect(productId).not.toBe(originalProductId);
    expect(
      (
        await app.fetch(
          request(`/admin/catalog/products/${productId}`, {
            body: JSON.stringify({
              ...identityProduct,
              slug: "identity-final",
            }),
            headers: { "Content-Type": "application/json" },
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(200);
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
      collectionIds: [],
      id: productId,
    });
    expect(manifest.collections).toEqual([]);
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
