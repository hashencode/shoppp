import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { createApp } from "../../src/http/app";
import { buildCatalogReleaseManifest } from "../../src/publishing/build-manifest";
import {
  assertCatalogReleaseLifecycle,
  validateCatalogCandidateSnapshot,
} from "../../src/publishing/candidate-releases";
import { candidateLedgerChunkCount } from "../../src/publishing/candidate-ledger";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const digest = "a".repeat(64);
const baseSnapshot = {
  environment: "development" as const,
  redirects: [] as Array<{ from: string; to: string }>,
  routes: ["/", "/products/carry-on"],
  sources: [
    {
      currentDigest: digest,
      currentStatus: "published" as const,
      currentVersion: 1,
      digest,
      environment: "development" as const,
      id: "identity.primary",
      kind: "store-identity" as const,
      version: 1,
    },
  ],
};

describe("private Catalog Release candidate boundary", () => {
  test("bounds ledger completion statements for large source freezes", () => {
    expect(candidateLedgerChunkCount(1_001)).toBe(3);
    expect(candidateLedgerChunkCount(20_000)).toBe(40);
  });
  test("rejects source drift before candidate commit", () => {
    expect(() =>
      validateCatalogCandidateSnapshot({
        ...baseSnapshot,
        sources: [{ ...baseSnapshot.sources[0]!, currentVersion: 2 }],
      }),
    ).toThrowError(/catalog_source_drift/);
  });

  test.each(["draft", "archived"] as const)(
    "rejects %s references with a stable diagnostic",
    (currentStatus) => {
      expect(() =>
        validateCatalogCandidateSnapshot({
          ...baseSnapshot,
          sources: [{ ...baseSnapshot.sources[0]!, currentStatus }],
        }),
      ).toThrowError(/catalog_source_unpublished/);
    },
  );

  test("rejects wrong-kind and cross-environment references", () => {
    expect(() =>
      validateCatalogCandidateSnapshot({
        ...baseSnapshot,
        sources: [
          {
            ...baseSnapshot.sources[0]!,
            currentKind: "policy" as const,
            environment: "production" as const,
          },
        ],
      }),
    ).toThrowError(/catalog_source_(kind|environment)_mismatch/);
  });

  test("rejects duplicate routes and unsafe redirects atomically", () => {
    expect(() =>
      validateCatalogCandidateSnapshot({
        ...baseSnapshot,
        redirects: [{ from: "/old", to: "https://attacker.example.test" }],
        routes: ["/", "/products/carry-on", "/products/carry-on"],
      }),
    ).toThrowError(/storefront_(route_conflict|redirect_invalid)/);
  });

  test("allows authorized private inspection and Preview but denies public elevation", () => {
    for (const operation of [
      "candidate-manifest-read",
      "candidate-status",
      "private-preview",
    ] as const) {
      expect(() =>
        assertCatalogReleaseLifecycle(
          {
            candidateStatus: "succeeded",
            environment: "development",
            purpose: "private-preview",
            status: "approved",
          },
          { environment: "development", operation, principalKind: "human" },
        ),
      ).not.toThrow();
    }
    for (const operation of ["public-manifest-read", "public-build", "deploy"] as const) {
      expect(() =>
        assertCatalogReleaseLifecycle(
          {
            candidateStatus: "succeeded",
            environment: "development",
            purpose: "private-preview",
            status: "approved",
          },
          { environment: "development", operation, principalKind: "human" },
        ),
      ).toThrowError(/catalog_candidate_private/);
    }
    expect(() =>
      assertCatalogReleaseLifecycle(
        {
          candidateStatus: "succeeded",
          environment: "development",
          purpose: "private-preview",
          status: "approved",
        },
        {
          environment: "development",
          operation: "candidate-manifest-read",
          principalKind: "service",
        },
      ),
    ).toThrowError(/human_principal_required/);
    expect(() =>
      assertCatalogReleaseLifecycle(
        {
          environment: "development",
          purpose: "private-preview",
          status: "approved",
        },
        {
          environment: "development",
          operation: "private-preview",
          principalKind: "human",
        },
      ),
    ).toThrowError(/catalog_candidate_unavailable/);
  });
});

const product = {
  collections: [{ name: "Travel", slug: "travel" }],
  description: "Candidate product",
  media: [{ altText: "Carry-on", height: 100, r2Key: "catalog/candidate.webp", width: 100 }],
  name: "Carry-on",
  seoDescription: "Candidate product description",
  seoTitle: "Carry-on",
  slug: "carry-on",
  variants: [
    {
      optionValues: {},
      prices: [{ amount: 1000, currency: "USD", priceListCode: "GLOBAL-USD" }],
      sku: "CANDIDATE",
      title: "Default",
      weightGrams: 100,
    },
  ],
};

function adminRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      "X-Test-Admin-Identity": "candidate-admin",
      ...init.headers,
    },
  });
}

async function seedCandidateSources(app: ReturnType<typeof createApp>) {
  await env.MEDIA.put("catalog/candidate.webp", new Uint8Array([1, 2, 3, 4]));
  const created = await app.fetch(
    adminRequest("/admin/catalog/products", { body: JSON.stringify(product), method: "POST" }),
    env,
  );
  expect(created.status).toBe(201);
  const productId = (await created.json<{ data: { id: string } }>()).data.id;
  const version = await env.DB.prepare("SELECT version FROM products WHERE id = ?")
    .bind(productId)
    .first<{ version: number }>();
  const published = await app.fetch(
    adminRequest(`/admin/catalog/products/${productId}/publish`, {
      body: JSON.stringify({ expectedVersion: version!.version, reason: "Candidate source" }),
      method: "POST",
    }),
    env,
  );
  expect(published.status).toBe(202);
  await env.DB.prepare(
    `UPDATE collection_versions SET status = 'published', published_at = ?, updated_at = ?
      WHERE collection_id IN (SELECT collection_id FROM collection_memberships WHERE product_id = ?)`,
  )
    .bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z", productId)
    .run();
  await env.DB.prepare(
    `INSERT INTO store_identity_versions
      (identity_id, version, status, storefront_name, tagline, seo_json,
       created_at, updated_at, published_at)
     VALUES ('identity.primary', 1, 'published', 'Shoppp', '', '{}', ?, ?, ?)`,
  )
    .bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z")
    .run();
  return productId;
}

describe("private candidate builder integration", () => {
  beforeAll(async () => {
    await env.DB.batch([
      env.DB.prepare("PRAGMA defer_foreign_keys = ON"),
      env.DB.prepare("DELETE FROM catalog_release_media_ledger"),
      env.DB.prepare("DELETE FROM catalog_release_sources"),
      env.DB.prepare("DELETE FROM catalog_releases"),
      env.DB.prepare("DELETE FROM navigation_policy_references"),
      env.DB.prepare("DELETE FROM navigation_items"),
      env.DB.prepare("DELETE FROM navigation_menu_versions"),
      env.DB.prepare("DELETE FROM policy_versions"),
      env.DB.prepare("DELETE FROM store_identity_versions"),
      env.DB.prepare("DELETE FROM collection_memberships"),
      env.DB.prepare("DELETE FROM collection_versions"),
      env.DB.prepare("DELETE FROM collections"),
      env.DB.prepare("DELETE FROM product_media"),
      env.DB.prepare("DELETE FROM prices"),
      env.DB.prepare("DELETE FROM price_lists"),
      env.DB.prepare("DELETE FROM product_variants"),
      env.DB.prepare("DELETE FROM products"),
      env.DB.prepare("DELETE FROM idempotency_claims"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM admin_identities"),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "candidate@example.test",
      id: "admin-candidate",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "candidate-admin",
    });
    await seedCandidateSources(appFor());
  });

  afterEach(async () => {
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM catalog_release_media_ledger WHERE release_id IN (SELECT id FROM catalog_releases WHERE purpose = 'private-preview')",
      ),
      env.DB.prepare(
        "DELETE FROM catalog_release_sources WHERE release_id IN (SELECT id FROM catalog_releases WHERE purpose = 'private-preview')",
      ),
      env.DB.prepare("DELETE FROM catalog_releases WHERE purpose = 'private-preview'"),
      env.DB.prepare("DELETE FROM navigation_policy_references"),
      env.DB.prepare("DELETE FROM navigation_items"),
      env.DB.prepare("DELETE FROM navigation_menu_versions"),
      env.DB.prepare("DELETE FROM policy_versions"),
      env.DB.prepare(
        "UPDATE store_identity_versions SET status = 'published' WHERE identity_id = 'identity.primary'",
      ),
    ]);
    await env.MEDIA.put("catalog/candidate.webp", new Uint8Array([1, 2, 3, 4]));
    const frozen = await env.MEDIA.list({ prefix: "catalog-release-media/sha256/" });
    await Promise.all(frozen.objects.map(({ key }) => env.MEDIA.delete(key)));
  });

  const appFor = (
    beforeCommit?: () => Promise<void>,
    freezeHook?: (event: {
      candidateId: string;
      frozenKey?: string;
      phase:
        | "before-pending"
        | "after-pending"
        | "before-media-copy"
        | "after-media-copy"
        | "before-success";
      sourceKey?: string;
    }) => Promise<void>,
  ) =>
    createApp({
      buildTrigger: vi.fn(async () => ({ correlationId: crypto.randomUUID() })),
      buildManifestToken: "candidate-build-token-at-least-32-bytes",
      ...(beforeCommit ? { catalogCandidateBeforeCommit: beforeCommit } : {}),
      ...(freezeHook ? { catalogCandidateFreezeHook: freezeHook } : {}),
      testIdentityVerifier: async () => ({
        email: "candidate@example.test",
        principalKind: "human",
        subject: "candidate-admin",
      }),
    });

  test("commit-time source mutation creates no selectable candidate or ledger", async () => {
    const app = appFor(undefined, async ({ phase }) => {
      if (phase === "before-pending") {
        await env.DB.prepare(
          "UPDATE products SET name = 'Changed without version bump' WHERE status = 'published'",
        ).run();
      }
    });
    const response = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Race proof" }),
        method: "POST",
      }),
      env,
    );
    const body = await response.json();
    expect({ body, status: response.status }).toMatchObject({
      body: { error: { code: "catalog_source_drift" } },
      status: 409,
    });
    expect(
      await env.DB.prepare(
        "SELECT candidate_status FROM catalog_releases WHERE purpose = 'private-preview'",
      ).first(),
    ).toEqual({ candidate_status: "failed" });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM catalog_release_sources").first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM catalog_release_media_ledger").first(),
    ).toEqual({ count: 0 });
  });

  test("persists pending before copy and CAS-transitions the same candidate to succeeded", async () => {
    let pendingId = "";
    const app = appFor(undefined, async ({ candidateId, phase }) => {
      if (phase !== "after-pending") return;
      pendingId = candidateId;
      expect(
        await env.DB.prepare("SELECT candidate_status FROM catalog_releases WHERE id = ?")
          .bind(candidateId)
          .first(),
      ).toEqual({ candidate_status: "pending" });
      await expect(
        env.DB.prepare("UPDATE products SET name = name WHERE status = 'published'").run(),
      ).rejects.toThrow(/catalog_candidate_sources_locked/);
    });
    const response = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Persisted lifecycle proof" }),
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(201);
    const body = await response.json<{ data: { id: string; status: string } }>();
    expect(body.data).toMatchObject({ id: pendingId, status: "succeeded" });
    expect(
      await env.DB.prepare("SELECT candidate_status FROM catalog_releases WHERE id = ?")
        .bind(pendingId)
        .first(),
    ).toEqual({ candidate_status: "succeeded" });
  });

  test("freezes bytes read before a source overwrite and a retry creates a new tuple", async () => {
    let overwritten = false;
    const first = appFor(undefined, async ({ phase }) => {
      if (phase === "before-media-copy" && !overwritten) {
        overwritten = true;
        await env.MEDIA.put("catalog/candidate.webp", new Uint8Array([9, 9, 9, 9]));
      }
    });
    const firstResponse = await first.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Source overwrite boundary" }),
        method: "POST",
      }),
      env,
    );
    expect(firstResponse.status).toBe(201);
    const firstCandidate = await firstResponse.json<{ data: { id: string } }>();
    const firstLedger = await env.DB.prepare(
      "SELECT frozen_key FROM catalog_release_media_ledger WHERE release_id = ?",
    )
      .bind(firstCandidate.data.id)
      .first<{ frozen_key: string }>();
    expect(
      new Uint8Array(await (await env.MEDIA.get(firstLedger!.frozen_key))!.arrayBuffer()),
    ).toEqual(new Uint8Array([1, 2, 3, 4]));

    const retryResponse = await appFor().fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Changed source bytes" }),
        method: "POST",
      }),
      env,
    );
    expect(retryResponse.status).toBe(201);
    const retryCandidate = await retryResponse.json<{ data: { id: string } }>();
    expect(retryCandidate.data.id).not.toBe(firstCandidate.data.id);
  });

  test("marks a post-copy digest race failed and excludes it from the media ledger", async () => {
    const app = appFor(undefined, async ({ frozenKey, phase }) => {
      if (phase === "after-media-copy") {
        await env.MEDIA.put(frozenKey!, new Uint8Array([7, 7, 7]));
      }
    });
    const response = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Frozen object race" }),
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "catalog_media_digest_collision" },
    });
    expect(
      await env.DB.prepare(
        "SELECT candidate_status FROM catalog_releases WHERE purpose = 'private-preview'",
      ).first(),
    ).toEqual({ candidate_status: "failed" });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM catalog_release_media_ledger").first(),
    ).toEqual({ count: 0 });
  });

  test("rejects a conflicting object that appears immediately before immutable copy", async () => {
    const app = appFor(undefined, async ({ frozenKey, phase }) => {
      if (phase === "before-media-copy") {
        await env.MEDIA.put(frozenKey!, new Uint8Array([6, 6, 6]));
      }
    });
    const response = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Pre-copy collision" }),
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "catalog_media_digest_collision" },
    });
    expect(
      await env.DB.prepare(
        "SELECT candidate_status FROM catalog_releases WHERE purpose = 'private-preview'",
      ).first(),
    ).toEqual({ candidate_status: "failed" });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM catalog_release_media_ledger").first(),
    ).toEqual({ count: 0 });
  });

  test("retries a failed tuple on the same candidate id", async () => {
    let failedId = "";
    const failed = appFor(undefined, async ({ candidateId, phase }) => {
      if (phase === "before-success") {
        failedId = candidateId;
        throw new Error("simulated crash before terminal CAS");
      }
    });
    const failedResponse = await failed.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Retryable freeze" }),
        method: "POST",
      }),
      env,
    );
    expect(failedResponse.status).toBe(500);
    expect(
      await env.DB.prepare("SELECT candidate_status FROM catalog_releases WHERE id = ?")
        .bind(failedId)
        .first(),
    ).toEqual({ candidate_status: "failed" });

    const retryResponse = await appFor().fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Retryable freeze" }),
        method: "POST",
      }),
      env,
    );
    expect(retryResponse.status).toBe(201);
    expect(await retryResponse.json()).toMatchObject({
      data: { id: failedId, status: "succeeded" },
    });
  });

  test("expires a crashed pending lease and allows an idempotent replacement", async () => {
    let staleId = "";
    const failed = appFor(undefined, async ({ candidateId, phase }) => {
      if (phase === "before-success") {
        staleId = candidateId;
        throw new Error("simulated worker stop");
      }
    });
    await failed.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Crash lease proof" }),
        method: "POST",
      }),
      env,
    );
    await env.DB.prepare(
      `UPDATE catalog_releases
          SET candidate_status = 'pending', candidate_expires_at = '2020-01-01T00:00:00.000Z'
        WHERE id = ?`,
    )
      .bind(staleId)
      .run();
    const replacementResponse = await appFor().fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Crash lease proof" }),
        method: "POST",
      }),
      env,
    );
    expect(replacementResponse.status).toBe(201);
    const replacement = await replacementResponse.json<{ data: { id: string } }>();
    expect(replacement.data.id).not.toBe(staleId);
    expect(
      await env.DB.prepare("SELECT candidate_status FROM catalog_releases WHERE id = ?")
        .bind(staleId)
        .first(),
    ).toEqual({ candidate_status: "expired" });
  });

  test("abandons and expires candidates without allowing later selection", async () => {
    const app = appFor();
    const first = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Abandon lifecycle" }),
        method: "POST",
      }),
      env,
    );
    const candidate = await first.json<{ data: { id: string } }>();
    const abandoned = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${candidate.data.id}/abandon`, {
        body: JSON.stringify({ reason: "No longer needed" }),
        method: "POST",
      }),
      env,
    );
    expect(abandoned.status).toBe(200);
    expect(await abandoned.json()).toMatchObject({ data: { status: "abandoned" } });
    const unavailable = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${candidate.data.id}`),
      env,
    );
    expect(unavailable.status).toBe(409);

    const second = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Expiry lifecycle" }),
        method: "POST",
      }),
      env,
    );
    const expiring = await second.json<{ data: { id: string } }>();
    await env.DB.prepare(
      "UPDATE catalog_releases SET candidate_expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?",
    )
      .bind(expiring.data.id)
      .run();
    const status = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${expiring.data.id}/status`),
      env,
    );
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ data: { status: "expired" } });
  });

  test("a published Navigation relation to a draft target fails with its backlink", async () => {
    const app = appFor();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO policy_versions
          (policy_id, version, kind, slug, title, effective_date, sections_json, status,
           created_at, updated_at)
         VALUES ('policy.shipping', 1, 'shipping', 'shipping', 'Shipping', '2026-09-23',
                 '[]', 'draft', ?, ?)`,
      ).bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO navigation_menu_versions
          (menu_id, version, placement, status, created_at, updated_at, published_at)
         VALUES ('menu.header', 1, 'header', 'published', ?, ?, ?)`,
      ).bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO navigation_items
          (menu_id, menu_version, item_id, parent_item_id, position, label, target_json)
         VALUES ('menu.header', 1, 'item.shipping', NULL, 0, 'Shipping',
                 '{"kind":"internal","reference":{"kind":"policy","id":"policy.shipping"}}')`,
      ),
      env.DB.prepare(
        `INSERT INTO navigation_policy_references
          (menu_id, menu_version, item_id, policy_id, policy_version, environment, created_at)
         VALUES ('menu.header', 1, 'item.shipping', 'policy.shipping', 1, ?, ?)`,
      ).bind(
        env.ENVIRONMENT === "production" ? "staging" : "production",
        "2026-09-23T00:00:00.000Z",
      ),
    ]);
    const crossEnvironment = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Reference proof" }),
        method: "POST",
      }),
      env,
    );
    expect(crossEnvironment.status).toBe(409);
    expect(await crossEnvironment.json()).toMatchObject({
      error: { code: "catalog_source_environment_mismatch" },
    });
    await env.DB.batch([
      env.DB.prepare(
        `DELETE FROM navigation_policy_references
          WHERE menu_id = 'menu.header' AND menu_version = 1 AND item_id = 'item.shipping'`,
      ),
      env.DB.prepare(
        `INSERT INTO navigation_policy_references
          (menu_id, menu_version, item_id, policy_id, policy_version, environment, created_at)
         VALUES ('menu.header', 1, 'item.shipping', 'policy.shipping', 1, ?, ?)`,
      ).bind(env.ENVIRONMENT, "2026-09-23T00:00:00.000Z"),
    ]);
    const response = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Reference proof after environment repair" }),
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(409);
    const body = await response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("catalog_source_unpublished");
    expect(body.error.message).toContain("menu.header@1/item.shipping");
  });

  test("freezes one inspectable private candidate without exposing it to public build routes", async () => {
    const app = appFor();
    const built = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Theme Preview review" }),
        method: "POST",
      }),
      env,
    );
    expect(built.status).toBe(201);
    const candidate = await built.json<{ data: { id: string; sources: unknown[] } }>();
    expect(candidate.data.sources.length).toBeGreaterThanOrEqual(3);

    const inspected = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${candidate.data.id}`),
      env,
    );
    expect(inspected.status).toBe(200);
    const detail = await inspected.json<{
      data: {
        manifest: {
          products: Array<{ media: Array<{ src: string }> }>;
          purpose: string;
          schemaVersion: number;
        };
      };
    }>();
    expect(detail.data.manifest).toMatchObject({ purpose: "private-preview", schemaVersion: 3 });
    expect(detail.data.manifest.products[0]!.media[0]!.src).toContain(
      "/catalog-release-media/sha256/",
    );

    const publicManifest = await app.fetch(
      new Request(`https://api.example.test/build/catalog/releases/${candidate.data.id}`, {
        headers: { Authorization: "Bearer candidate-build-token-at-least-32-bytes" },
      }),
      env,
    );
    expect(publicManifest.status).toBe(409);
    expect(await publicManifest.json()).toMatchObject({
      error: { code: "catalog_candidate_private" },
    });
    const publicStatus = await app.fetch(
      new Request(`https://api.example.test/build/catalog/releases/${candidate.data.id}/status`, {
        body: JSON.stringify({ status: "deployed" }),
        headers: {
          Authorization: "Bearer candidate-build-token-at-least-32-bytes",
          "Content-Type": "application/json",
          "Idempotency-Key": `candidate-public-status-${candidate.data.id}`,
        },
        method: "POST",
      }),
      env,
    );
    expect(publicStatus.status).toBe(409);
    expect(await publicStatus.json()).toMatchObject({
      error: { code: "catalog_candidate_private" },
    });
    expect(
      await env.DB.prepare("SELECT status, candidate_status FROM catalog_releases WHERE id = ?")
        .bind(candidate.data.id)
        .first(),
    ).toEqual({ candidate_status: "succeeded", status: "approved" });
  });

  test("uses the exact published Collection version when a newer draft exists", async () => {
    const published = await env.DB.prepare(
      `SELECT collection_id, version, slug, name, description, cover_asset_id, seo_json
         FROM collection_versions WHERE status = 'published' LIMIT 1`,
    ).first<{
      collection_id: string;
      cover_asset_id: string | null;
      description: string;
      name: string;
      seo_json: string;
      slug: string;
      version: number;
    }>();
    expect(published).toBeTruthy();
    const draftVersion = published!.version + 1;
    await env.DB.prepare(
      `INSERT INTO collection_versions
        (collection_id, version, slug, name, description, cover_asset_id, seo_json, status,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    )
      .bind(
        published!.collection_id,
        draftVersion,
        `${published!.slug}-draft`,
        `${published!.name} draft`,
        published!.description,
        published!.cover_asset_id,
        published!.seo_json,
        "2026-09-23T00:00:00.000Z",
        "2026-09-23T00:00:00.000Z",
      )
      .run();
    try {
      const product = await env.DB.prepare(
        "SELECT id FROM products WHERE status = 'published' LIMIT 1",
      ).first<{ id: string }>();
      const manifest = await buildCatalogReleaseManifest(env.DB, {
        aggregatePublishedCatalog: true,
        candidateProductId: product!.id,
        mediaOrigin: "https://media.example.test",
        releaseId: "published-collection-probe",
        storefrontOrigin: env.STOREFRONT_ORIGIN,
      });
      expect(manifest.collections).toContainEqual(
        expect.objectContaining({ id: published!.collection_id, slug: published!.slug }),
      );
      expect(manifest.collections).not.toContainEqual(
        expect.objectContaining({ slug: `${published!.slug}-draft` }),
      );
    } finally {
      await env.DB.prepare(
        "DELETE FROM collection_versions WHERE collection_id = ? AND version = ?",
      )
        .bind(published!.collection_id, draftVersion)
        .run();
    }
  });

  test("builds one candidate with 100 published products without expanded D1 binds", async () => {
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 99)
       INSERT INTO products
         (id, slug, name, description, status, seo_title, seo_description, published_at,
          created_at, updated_at)
       SELECT '00000000-0000-4000-8000-' || printf('%012d', n),
              'bulk-product-' || printf('%03d', n), 'Bulk product ' || n, '', 'published',
              'Bulk product ' || n, 'Bulk product description ' || n, ?, ?, ? FROM seq`,
    )
      .bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z")
      .run();
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 99)
       INSERT INTO product_variants
         (id, product_id, sku, title, option_values_json, weight_grams, status, created_at, updated_at)
       SELECT '10000000-0000-4000-8000-' || printf('%012d', n),
              '00000000-0000-4000-8000-' || printf('%012d', n),
              'BULK-' || printf('%03d', n), 'Default', '{}', 0, 'active', ?, ? FROM seq`,
    )
      .bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z")
      .run();
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 99)
       INSERT INTO prices (id, price_list_id, variant_id, amount, created_at, updated_at)
       SELECT '20000000-0000-4000-8000-' || printf('%012d', n),
              (SELECT id FROM price_lists WHERE status = 'active' LIMIT 1),
              '10000000-0000-4000-8000-' || printf('%012d', n), 1000, ?, ? FROM seq`,
    )
      .bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z")
      .run();
    try {
      const manifest = await buildCatalogReleaseManifest(env.DB, {
        aggregatePublishedCatalog: true,
        candidateProductId: "00000000-0000-4000-8000-000000000001",
        mediaOrigin: "https://media.example.test",
        releaseId: "bind-probe",
        storefrontOrigin: env.STOREFRONT_ORIGIN,
      });
      const app = appFor();
      const built = await app.fetch(
        adminRequest("/admin/catalog/releases/preview-candidates", {
          body: JSON.stringify({ reason: "D1 bind ceiling proof" }),
          method: "POST",
        }),
        env,
      );
      const candidate = await built.json<{
        data: { manifest: { products: unknown[] } };
        error?: { message: string };
      }>();
      expect(built.status, JSON.stringify(candidate)).toBe(201);
      expect(manifest.products).toHaveLength(100);
    } finally {
      await env.DB.prepare("DELETE FROM prices WHERE id LIKE '20000000-0000-4000-8000-%'").run();
      await env.DB.prepare(
        "DELETE FROM product_variants WHERE id LIKE '10000000-0000-4000-8000-%'",
      ).run();
      await env.DB.prepare("DELETE FROM products WHERE id LIKE '00000000-0000-4000-8000-%'").run();
    }
  });
});
