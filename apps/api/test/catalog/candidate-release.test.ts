import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  catalogReleaseV3Schema,
  storefrontExperienceDraftInputSchema,
  type ExperienceSnapshot,
} from "@shoppp/contracts";

import { fashionStoreSuccessorPackage } from "../../../storefront/app/themes/fashion-store/package-registry";

import { createApp } from "../../src/http/app";
import { buildCatalogReleaseManifest } from "../../src/publishing/build-manifest";
import {
  assertCatalogReleaseLifecycle,
  validateCatalogCandidateSnapshot,
} from "../../src/publishing/candidate-releases";
import { candidateLedgerChunkCount } from "../../src/publishing/candidate-ledger";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

declare global {
  interface ImportMeta {
    readonly dir: string;
  }
}

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

function exactByteContentDocument() {
  const body = Array.from({ length: 13 }, (_, index) => ({
    id: `section.bytes${index}`,
    kind: "paragraph" as const,
    text: "x".repeat(5_000),
  }));
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
  body.at(-1)!.text = "x".repeat(5_000 - (bytes(body) - 64_000));
  expect(bytes(body)).toBe(64_000);
  return body;
}

function exactTextContentDocument() {
  return [{ id: "section.text", kind: "paragraph" as const, text: "x".repeat(5_000) }];
}

function exactCardinalityContentDocument(mediaId: string) {
  return [
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `section.link${index}`,
      kind: "link" as const,
      link: {
        label: "Link",
        target: { kind: "external" as const, url: `https://example.test/${index}` },
        targetBehavior: "same-window" as const,
      },
    })),
    ...Array.from({ length: 20 }, (_, index) => ({
      alt: `Media ${index}`,
      assetId: mediaId,
      id: `section.media${index}`,
      kind: "image" as const,
    })),
  ];
}

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
    expect(() =>
      validateCatalogCandidateSnapshot({
        ...baseSnapshot,
        redirects: [
          { from: "/old", to: "/new" },
          { from: "/older", to: "/old" },
        ],
        routes: ["/", "/new"],
      }),
    ).toThrowError(/storefront_redirect_invalid/);
    expect(() =>
      validateCatalogCandidateSnapshot({
        ...baseSnapshot,
        redirects: [{ from: "/", to: "/new" }],
        routes: ["/", "/new"],
      }),
    ).toThrowError(/storefront_route_conflict/);
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
  collections: [],
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

async function seedPublishedPolicies() {
  for (const kind of ["privacy", "returns", "shipping", "terms"] as const) {
    await env.DB.prepare(
      `INSERT INTO policy_versions
        (policy_id, version, kind, slug, title, effective_date, sections_json, status,
         approval_digest, approved_by, approved_at, approval_environment, published_at,
         created_at, updated_at)
       VALUES (?, 1, ?, ?, ?, '2026-09-23', ?, 'published', ?, 'admin-candidate', ?, ?, ?, ?, ?)`,
    )
      .bind(
        `policy.${kind}`,
        kind,
        kind,
        `${kind[0]!.toUpperCase()}${kind.slice(1)} policy`,
        JSON.stringify([{ id: `section.${kind}`, kind: "paragraph", text: `${kind} policy text` }]),
        "a".repeat(64),
        "2026-09-23T00:00:00.000Z",
        env.ENVIRONMENT,
        "2026-09-23T00:00:00.000Z",
        "2026-09-23T00:00:00.000Z",
        "2026-09-23T00:00:00.000Z",
      )
      .run();
  }
}

async function seedCandidateSources(app: ReturnType<typeof createApp>) {
  await env.MEDIA.put("catalog/candidate.webp", new Uint8Array([1, 2, 3, 4]));
  await seedPublishedPolicies();
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
  expect(published.status, await published.clone().text()).toBe(202);
  const collection = await app.fetch(
    adminRequest("/admin/catalog/collections", {
      body: JSON.stringify({
        description: "Travel essentials",
        name: "Travel",
        productIds: [productId],
        reason: "Candidate source",
        seoDescription: "Travel essentials",
        seoTitle: "Travel",
        slug: "travel",
        status: "published",
      }),
      method: "POST",
    }),
    env,
  );
  expect(collection.status, await collection.clone().text()).toBe(201);
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
  let preserveExactTupleReceipt = false;
  beforeAll(async () => {
    await env.DB.batch([
      env.DB.prepare("PRAGMA defer_foreign_keys = ON"),
      env.DB.prepare("DELETE FROM catalog_release_media_ledger"),
      env.DB.prepare("DELETE FROM catalog_release_sources"),
      env.DB.prepare("DELETE FROM catalog_releases"),
      env.DB.prepare("DELETE FROM navigation_policy_references"),
      env.DB.prepare("DELETE FROM navigation_page_references"),
      env.DB.prepare("DELETE FROM navigation_article_references"),
      env.DB.prepare("DELETE FROM navigation_collection_references"),
      env.DB.prepare("DELETE FROM navigation_product_references"),
      env.DB.prepare("DELETE FROM navigation_items"),
      env.DB.prepare("DELETE FROM navigation_menu_versions"),
      env.DB.prepare("DELETE FROM settings WHERE key = 'launch_configuration'"),
      env.DB.prepare("DELETE FROM collection_route_redirects"),
      env.DB.prepare("DELETE FROM policy_versions"),
      env.DB.prepare("DELETE FROM content_route_redirects"),
      env.DB.prepare("DELETE FROM content_page_versions"),
      env.DB.prepare("DELETE FROM content_article_versions"),
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
    if (preserveExactTupleReceipt) return;
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM catalog_release_media_ledger WHERE release_id IN (SELECT id FROM catalog_releases WHERE purpose = 'private-preview')",
      ),
      env.DB.prepare(
        "DELETE FROM catalog_release_sources WHERE release_id IN (SELECT id FROM catalog_releases WHERE purpose = 'private-preview')",
      ),
      env.DB.prepare("DELETE FROM catalog_releases WHERE purpose = 'private-preview'"),
      env.DB.prepare("DELETE FROM navigation_policy_references"),
      env.DB.prepare("DELETE FROM navigation_page_references"),
      env.DB.prepare("DELETE FROM navigation_article_references"),
      env.DB.prepare("DELETE FROM navigation_collection_references"),
      env.DB.prepare("DELETE FROM navigation_product_references"),
      env.DB.prepare("DELETE FROM navigation_items"),
      env.DB.prepare("DELETE FROM navigation_menu_versions"),
      env.DB.prepare("DELETE FROM policy_versions"),
      env.DB.prepare("DELETE FROM settings WHERE key = 'launch_configuration'"),
      env.DB.prepare("DELETE FROM content_route_redirects"),
      env.DB.prepare("DELETE FROM content_page_versions"),
      env.DB.prepare("DELETE FROM content_article_versions"),
      env.DB.prepare("DELETE FROM store_identity_logo_assets"),
      env.DB.prepare(
        "UPDATE store_identity_versions SET status = 'published', favicon_asset_id = NULL WHERE identity_id = 'identity.primary'",
      ),
    ]);
    await seedPublishedPolicies();
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

  test("requires Settings read authority before starting a private candidate build", async () => {
    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = 'role_admin' AND permission_key = 'settings.read'",
    ).run();
    try {
      const response = await appFor().fetch(
        adminRequest("/admin/catalog/releases/preview-candidates", {
          body: JSON.stringify({ reason: "Least-privilege candidate build proof" }),
          method: "POST",
        }),
        env,
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: { code: "authorization_state_invalid" },
      });
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM catalog_releases WHERE purpose = 'private-preview'",
        ).first(),
      ).toEqual({ count: 0 });
    } finally {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_admin', 'settings.read', '2026-08-04T00:00:00.000Z')`,
      ).run();
    }
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
      await expect(
        env.DB.prepare(
          "INSERT INTO shipping_methods (id, zone_id, name, calculation_type, price_amount, currency, status, created_at, updated_at) VALUES ('ship_lock_probe', 'zone_lock_probe', 'Probe', 'flat', 0, 'USD', 'active', ?, ?)",
        )
          .bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z")
          .run(),
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

  test("locks every Shipping authority through the terminal candidate CAS", async () => {
    const phases: string[] = [];
    const app = appFor(undefined, async ({ phase }) => {
      if (phase !== "after-pending" && phase !== "before-success") return;
      phases.push(phase);
      await expect(
        env.DB.prepare(
          "INSERT INTO shipping_zones (id, name, status, created_at, updated_at) VALUES ('zone_lock_probe', 'Probe', 'active', ?, ?)",
        )
          .bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z")
          .run(),
      ).rejects.toThrow(/catalog_candidate_sources_locked/);
      await expect(
        env.DB.prepare(
          "INSERT INTO shipping_zone_countries (zone_id, country_code) VALUES ('zone_lock_probe', 'US')",
        ).run(),
      ).rejects.toThrow(/catalog_candidate_sources_locked/);
      await expect(
        env.DB.prepare(
          "INSERT INTO shipping_methods (id, zone_id, name, calculation_type, price_amount, currency, status, created_at, updated_at) VALUES ('ship_lock_probe', 'zone_lock_probe', 'Probe', 'flat', 0, 'USD', 'active', ?, ?)",
        )
          .bind("2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z")
          .run(),
      ).rejects.toThrow(/catalog_candidate_sources_locked/);
    });
    const response = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Shipping freeze race proof" }),
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(201);
    expect(phases).toEqual(["after-pending", "before-success"]);
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
        body: JSON.stringify({}),
        method: "POST",
      }),
      env,
    );
    const candidate = await first.json<{ data: { id: string } }>();
    const abandoned = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${candidate.data.id}/abandon`, {
        body: JSON.stringify({ reason: " " }),
        method: "POST",
      }),
      env,
    );
    expect(abandoned.status).toBe(200);
    expect(await abandoned.json()).toMatchObject({ data: { status: "abandoned" } });
    expect(
      (
        await env.DB.prepare(
          "SELECT action, reason FROM audit_events WHERE target_id = ? AND action IN ('catalog.candidate.build', 'catalog.candidate.abandon') ORDER BY action",
        )
          .bind(candidate.data.id)
          .all()
      ).results,
    ).toEqual([
      { action: "catalog.candidate.abandon", reason: null },
      { action: "catalog.candidate.build", reason: null },
    ]);
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

  test.each(["build", "abandon"] as const)(
    "rejects forbidden notes before candidate %s mutates releases, artifacts, or expiry",
    async (action) => {
      const app = appFor();
      const created = await app.fetch(
        adminRequest("/admin/catalog/releases/preview-candidates", {
          body: JSON.stringify({}),
          method: "POST",
        }),
        env,
      );
      expect(created.status).toBe(201);
      const { id } = (await created.json<{ data: { id: string } }>()).data;
      if (action === "build") {
        await env.DB.prepare(
          "UPDATE catalog_releases SET candidate_expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
        )
          .bind(id)
          .run();
        const frozen = await env.MEDIA.list({ prefix: "catalog-release-media/sha256/" });
        await Promise.all(frozen.objects.map(({ key }) => env.MEDIA.delete(key)));
      } else {
        await env.DB.prepare(
          `INSERT INTO catalog_releases
          (id, status, manifest_json, approved_at, created_at, updated_at, purpose, environment, manifest_digest, source_digest, candidate_status, candidate_expires_at)
          SELECT 'candidate.invalid-note-expiry', status, manifest_json, approved_at, created_at, updated_at, purpose, environment, manifest_digest, ?, 'succeeded', '2000-01-01T00:00:00.000Z'
          FROM catalog_releases WHERE id = ?`,
        )
          .bind("f".repeat(64), id)
          .run();
      }
      const releasesBefore = await env.DB.prepare(
        "SELECT * FROM catalog_releases WHERE purpose = 'private-preview' ORDER BY id",
      ).all();
      const sourcesBefore = await env.DB.prepare(
        "SELECT * FROM catalog_release_sources ORDER BY release_id, source_kind, source_id",
      ).all();
      const ledgerBefore = await env.DB.prepare(
        "SELECT * FROM catalog_release_media_ledger ORDER BY release_id, frozen_key",
      ).all();
      const objectsBefore = (
        await env.MEDIA.list({ prefix: "catalog-release-media/sha256/" })
      ).objects.map(({ key, etag }) => ({ key, etag }));
      const auditBefore = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE result = 'succeeded'",
      ).first();
      for (const [index, reason] of ["a\u0007", "a\u202e", "x\ny"].entries()) {
        const path = `/admin/catalog/releases/preview-candidates${action === "abandon" ? `/${id}/abandon` : ""}`;
        const rejected = await app.fetch(
          adminRequest(path, {
            body: JSON.stringify({ reason }),
            headers: { "Idempotency-Key": `candidate-invalid-note-${action}-${index}` },
            method: "POST",
          }),
          env,
        );
        expect(rejected.status).toBe(422);
        expect(await rejected.json()).toMatchObject({ error: { code: "invalid_audit_reason" } });
        expect(
          (
            await env.DB.prepare(
              "SELECT * FROM catalog_releases WHERE purpose = 'private-preview' ORDER BY id",
            ).all()
          ).results,
        ).toEqual(releasesBefore.results);
        expect(
          (
            await env.DB.prepare(
              "SELECT * FROM catalog_release_sources ORDER BY release_id, source_kind, source_id",
            ).all()
          ).results,
        ).toEqual(sourcesBefore.results);
        expect(
          (
            await env.DB.prepare(
              "SELECT * FROM catalog_release_media_ledger ORDER BY release_id, frozen_key",
            ).all()
          ).results,
        ).toEqual(ledgerBefore.results);
        expect(
          (await env.MEDIA.list({ prefix: "catalog-release-media/sha256/" })).objects.map(
            ({ key, etag }) => ({ key, etag }),
          ),
        ).toEqual(objectsBefore);
        expect(
          await env.DB.prepare(
            "SELECT COUNT(*) AS count FROM audit_events WHERE result = 'succeeded'",
          ).first(),
        ).toEqual(auditBefore);
      }
    },
  );

  test("a published Navigation relation to a draft target fails with its backlink", async () => {
    const app = appFor();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO policy_versions
          (policy_id, version, kind, slug, title, effective_date, sections_json, status,
           created_at, updated_at)
         VALUES ('policy.shipping-draft', 1, 'shipping', 'shipping-draft', 'Shipping draft', '2026-09-23',
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
                 '{"kind":"internal","reference":{"kind":"policy","id":"policy.shipping-draft"}}')`,
      ),
      env.DB.prepare(
        `INSERT INTO navigation_policy_references
          (menu_id, menu_version, item_id, policy_id, policy_version, environment, created_at)
         VALUES ('menu.header', 1, 'item.shipping', 'policy.shipping-draft', 1, ?, ?)`,
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
         VALUES ('menu.header', 1, 'item.shipping', 'policy.shipping-draft', 1, ?, ?)`,
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
    await env.DB.prepare("DELETE FROM settings WHERE key = 'launch_configuration'").run();
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
          commerce: {
            payment: { brands: string[]; enabled: boolean; provider: string };
            shippingMethods: unknown[];
          };
          products: Array<{ media: Array<{ src: string }> }>;
          purpose: string;
          schemaVersion: number;
        };
      };
    }>();
    expect(detail.data.manifest).toMatchObject({ purpose: "private-preview", schemaVersion: 3 });
    expect(detail.data.manifest.commerce).toEqual({
      payment: { brands: [], enabled: false, provider: "stripe" },
      shippingMethods: [],
    });
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

  test("freezes the Store Identity favicon from published Product media", async () => {
    const asset = await env.DB.prepare("SELECT id FROM product_media_assets LIMIT 1").first<{
      id: string;
    }>();
    expect(asset?.id).toBeTruthy();
    await env.DB.prepare(
      "UPDATE store_identity_versions SET favicon_asset_id = ? WHERE identity_id = 'identity.primary'",
    )
      .bind(asset!.id)
      .run();
    await env.DB.prepare(
      "INSERT INTO store_identity_logo_assets (identity_id, identity_version, asset_id, variant) VALUES ('identity.primary', 1, ?, 'primary')",
    )
      .bind(asset!.id)
      .run();
    const app = appFor();
    const built = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Freeze storefront favicon" }),
        method: "POST",
      }),
      env,
    );
    expect(built.status, await built.clone().text()).toBe(201);
    const candidate = await built.json<{ data: { id: string } }>();
    const inspected = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${candidate.data.id}`),
      env,
    );
    const detail = await inspected.json<{
      data: {
        manifest: {
          identity: {
            faviconAssetId: string;
            faviconMedia: { src: string };
            logoAssets: Array<{ media: { src: string } }>;
          };
        };
      };
    }>();
    expect(detail.data.manifest.identity.faviconAssetId).toBe(asset!.id);
    expect(detail.data.manifest.identity.faviconMedia.src).toContain(
      "/catalog-release-media/sha256/",
    );
    expect(detail.data.manifest.identity.logoAssets[0]?.media.src).toBe(
      detail.data.manifest.identity.faviconMedia.src,
    );
  });

  test("rejects a favicon absent from the frozen Product media", async () => {
    await env.DB.prepare(
      "UPDATE store_identity_versions SET favicon_asset_id = ? WHERE identity_id = 'identity.primary'",
    )
      .bind("asset.favicon.unpublished")
      .run();
    const response = await appFor().fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Reject missing favicon media" }),
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "catalog_identity_favicon_media_missing" },
    });
  });

  async function exerciseExactSparseTuple() {
    preserveExactTupleReceipt = true;
    const buildInputs: Array<{ catalogReleaseId?: string; snapshotId: string }> = [];
    const app = createApp({
      buildManifestToken: "candidate-build-token-at-least-32-bytes",
      buildTrigger: vi.fn(async () => ({ correlationId: "u9-candidate-build" })),
      experienceBuildTrigger: async (input) => {
        buildInputs.push(input);
        return { correlationId: `u9-experience-build-${buildInputs.length}` };
      },
      testIdentityVerifier: async () => ({
        email: "candidate@example.test",
        principalKind: "human",
        subject: "candidate-admin",
      }),
    });

    const currentContact = await app.fetch(adminRequest("/admin/settings/contact"), env);
    expect(currentContact.status).toBe(200);
    const contact = await currentContact.json<{
      data: {
        launchVersion: string | null;
        privacyContactEmail: string;
        profile: Record<string, unknown>;
        profileVersion: string | null;
      };
    }>();
    const supportEmail = "u9-sparse@example.test";
    const savedContact = await app.fetch(
      adminRequest("/admin/settings/contact", {
        body: JSON.stringify({
          expectedLaunchVersion: contact.data.launchVersion,
          expectedProfileVersion: contact.data.profileVersion,
          privacyContactEmail: contact.data.privacyContactEmail,
          profile: { ...contact.data.profile, publishSupportEmail: true },
          reason: "Save the deterministic U9 sparse tuple",
          supportEmail,
        }),
        method: "PUT",
      }),
      env,
    );
    expect(savedContact.status, await savedContact.clone().text()).toBe(200);

    const built = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Freeze the deterministic U9 sparse tuple" }),
        method: "POST",
      }),
      env,
    );
    expect(built.status, await built.clone().text()).toBe(201);
    const candidateId = (await built.json<{ data: { id: string } }>()).data.id;
    const inspected = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${candidateId}`),
      env,
    );
    expect(inspected.status).toBe(200);
    const candidate = catalogReleaseV3Schema.parse(
      (await inspected.json<{ data: { manifest: unknown } }>()).data.manifest,
    );
    expect(candidate).toMatchObject({
      purpose: "private-preview",
      releaseId: candidateId,
      schemaVersion: 3,
    });
    expect(candidate.products).toHaveLength(1);
    expect(candidate.collections).toHaveLength(1);
    expect(candidate.content).toHaveLength(4);
    expect(candidate.content.every(({ kind }) => kind === "policy")).toBe(true);
    expect(candidate.navigation).toEqual([]);

    const manifest = fashionStoreSuccessorPackage.manifest;
    const bindings = [
      {
        id: "u9-home-collection",
        instanceId: "fashion-store-home",
        kind: "catalog" as const,
        reference: { id: candidate.collections[0]!.id, kind: "collection" as const },
        settingId: "featured-collection",
      },
      {
        id: "u9-collection-default",
        instanceId: "fashion-store-collection",
        kind: "catalog" as const,
        reference: { id: candidate.collections[0]!.id, kind: "collection" as const },
        settingId: "default-collection",
      },
    ];
    const draft = storefrontExperienceDraftInputSchema.parse({
      bindings,
      experienceId: "experience-u9-sparse-tuple",
      overrides: [],
      presetId: "source-parity",
      themeId: manifest.id,
      themeVersion: manifest.themeVersion,
    });
    const sourceResponse = await app.fetch(
      adminRequest("/admin/storefront-experiences/drafts", {
        body: JSON.stringify({ draft, reason: "Start the U9 sparse Fashion draft" }),
        method: "POST",
      }),
      env,
    );
    expect(sourceResponse.status, await sourceResponse.clone().text()).toBe(201);
    const source = await sourceResponse.json<{ data: { id: string; version: number } }>();
    const successorResponse = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${source.data.id}/successors`, {
        body: JSON.stringify({
          bindings,
          overrides: [],
          reason: "Carry the exact U9 tuple into a successor draft",
          sourceVersion: source.data.version,
        }),
        method: "POST",
      }),
      env,
    );
    expect(successorResponse.status, await successorResponse.clone().text()).toBe(201);
    const successor = await successorResponse.json<{ data: { id: string; version: number } }>();
    expect(successor.data.id).not.toBe(source.data.id);

    const validate = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${successor.data.id}/validate`, {
        body: JSON.stringify({
          catalogReleaseId: candidateId,
          expectedVersion: successor.data.version,
          reason: "Validate the exact U9 tuple",
        }),
        method: "POST",
      }),
      env,
    );
    expect(validate.status, await validate.clone().text()).toBe(200);
    expect(await validate.json()).toMatchObject({ data: { issues: [], status: "valid" } });

    const preview = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${successor.data.id}/preview`, {
        body: JSON.stringify({
          catalogReleaseId: candidateId,
          expectedVersion: successor.data.version,
          reason: "Privately Preview the exact U9 tuple",
        }),
        method: "POST",
      }),
      env,
    );
    expect(preview.status, await preview.clone().text()).toBe(202);
    const previewBody = await preview.json<{
      data: {
        build: {
          id: string;
          inputIdentity: { catalogReleaseId: string; experienceSnapshotId: string };
        };
        snapshot: { id: string; snapshot: ExperienceSnapshot; sourceDraftId: string };
      };
    }>();
    expect(previewBody.data.build.inputIdentity).toMatchObject({
      catalogReleaseId: candidateId,
      experienceSnapshotId: previewBody.data.snapshot.id,
    });
    expect(previewBody.data.snapshot).toMatchObject({
      sourceDraftId: successor.data.id,
      snapshot: {
        contact: { publicContact: { supportEmail } },
        themeId: manifest.id,
        themeVersion: manifest.themeVersion,
      },
    });

    const pendingApproval = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${successor.data.id}/approve`, {
        body: JSON.stringify({
          catalogReleaseId: candidateId,
          confirm: true,
          expectedVersion: successor.data.version,
          reason: "Reject approval while the exact Preview build is pending",
        }),
        method: "POST",
      }),
      env,
    );
    expect(pendingApproval.status).toBe(409);
    expect(await pendingApproval.json()).toMatchObject({
      error: { code: "storefront_preview_build_not_deployed" },
    });

    const failedBuild = await app.fetch(
      new Request(
        `https://api.example.test/build/storefront-experiences/builds/${previewBody.data.build.id}/status`,
        {
          body: JSON.stringify({ failureCode: "u9_exact_tuple_build_failed", status: "failed" }),
          headers: {
            Authorization: "Bearer candidate-build-token-at-least-32-bytes",
            "Content-Type": "application/json",
            "Idempotency-Key": "u9-exact-tuple-build-failed",
          },
          method: "POST",
        },
      ),
      env,
    );
    expect(failedBuild.status, await failedBuild.clone().text()).toBe(200);
    const failedApproval = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${successor.data.id}/approve`, {
        body: JSON.stringify({
          catalogReleaseId: candidateId,
          confirm: true,
          expectedVersion: successor.data.version,
          reason: "Reject approval after the exact Preview build failed",
        }),
        method: "POST",
      }),
      env,
    );
    expect(failedApproval.status).toBe(409);
    expect(await failedApproval.json()).toMatchObject({
      error: { code: "storefront_preview_build_not_deployed" },
    });

    const retryPreview = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${successor.data.id}/preview`, {
        body: JSON.stringify({
          catalogReleaseId: candidateId,
          expectedVersion: successor.data.version,
          reason: "Retry the exact U9 Preview build",
        }),
        method: "POST",
      }),
      env,
    );
    expect(retryPreview.status, await retryPreview.clone().text()).toBe(202);
    const retryPreviewBody = await retryPreview.json<{
      data: { build: { id: string }; snapshot: { id: string } };
    }>();
    expect(retryPreviewBody.data.build.id).not.toBe(previewBody.data.build.id);
    const exactBuildManifest = await app.fetch(
      new Request(
        `https://api.example.test/build/storefront-experiences/builds/${retryPreviewBody.data.build.id}`,
        { headers: { Authorization: "Bearer candidate-build-token-at-least-32-bytes" } },
      ),
      env,
    );
    expect(exactBuildManifest.status, await exactBuildManifest.clone().text()).toBe(200);
    const exactBuildInput = await exactBuildManifest.json<Record<string, unknown>>();
    expect(exactBuildInput).toMatchObject({
      catalogRelease: { releaseId: candidateId },
      inputIdentity: {
        catalogReleaseId: candidateId,
        experienceSnapshotId: retryPreviewBody.data.snapshot.id,
      },
      snapshot: {
        contact: { publicContact: { supportEmail } },
        id: retryPreviewBody.data.snapshot.id,
      },
    });
    const handshakeUrl = (env as unknown as { U9_EXACT_HANDSHAKE_URL?: string })
      .U9_EXACT_HANDSHAKE_URL;
    if (!handshakeUrl) throw new Error("U9 exact tuple requires the acceptance build handshake");
    console.log(`U9_EXACT_BUILD_INPUT=${JSON.stringify(exactBuildInput)}`);
    const measuredArtifact = await fetch(`${handshakeUrl}/phase-a`, {
      body: JSON.stringify({
        buildId: retryPreviewBody.data.build.id,
        buildInput: exactBuildInput,
        candidateReleaseId: candidateId,
        previewSnapshotId: retryPreviewBody.data.snapshot.id,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(measuredArtifact.status, await measuredArtifact.clone().text()).toBe(200);
    const { artifactDigest } = await measuredArtifact.json<{ artifactDigest: string }>();
    expect(artifactDigest).toMatch(/^[a-f0-9]{64}$/);
    const deployedBuild = await app.fetch(
      new Request(
        `https://api.example.test/build/storefront-experiences/builds/${retryPreviewBody.data.build.id}/status`,
        {
          body: JSON.stringify({
            artifactDigest,
            artifactPrefix: `snapshots/${retryPreviewBody.data.snapshot.id}/${candidateId}/${artifactDigest}`,
            expiresAt: "2099-09-24T00:00:00.000Z",
            status: "deployed",
          }),
          headers: {
            Authorization: "Bearer candidate-build-token-at-least-32-bytes",
            "Content-Type": "application/json",
            "Idempotency-Key": "u9-exact-tuple-build-deployed",
          },
          method: "POST",
        },
      ),
      env,
    );
    expect(deployedBuild.status, await deployedBuild.clone().text()).toBe(200);

    const frozenLaunch = await env.DB.prepare(
      "SELECT value_json, updated_at FROM settings WHERE key = 'launch_configuration'",
    ).first<{ updated_at: string; value_json: string }>();
    const driftedLaunch = JSON.parse(frozenLaunch!.value_json) as Record<string, unknown>;
    driftedLaunch.supportEmail = "u9-drifted@example.test";
    await env.DB.prepare(
      "UPDATE settings SET value_json = ?, updated_at = ? WHERE key = 'launch_configuration'",
    )
      .bind(JSON.stringify(driftedLaunch), "2026-09-24T01:55:00.000Z")
      .run();
    const driftedApproval = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${successor.data.id}/approve`, {
        body: JSON.stringify({
          catalogReleaseId: candidateId,
          confirm: true,
          expectedVersion: successor.data.version,
          reason: "Reject approval after Contact drift",
        }),
        method: "POST",
      }),
      env,
    );
    expect(driftedApproval.status).toBe(409);
    expect(await driftedApproval.json()).toMatchObject({
      error: { code: "storefront_preview_contact_changed" },
    });
    await env.DB.prepare(
      "UPDATE settings SET value_json = ?, updated_at = ? WHERE key = 'launch_configuration'",
    )
      .bind(frozenLaunch!.value_json, frozenLaunch!.updated_at)
      .run();

    const approvedResponse = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${successor.data.id}/approve`, {
        body: JSON.stringify({
          catalogReleaseId: candidateId,
          confirm: true,
          expectedVersion: successor.data.version,
          reason: "Approve the exact U9 tuple",
        }),
        method: "POST",
      }),
      env,
    );
    expect(approvedResponse.status, await approvedResponse.clone().text()).toBe(200);
    const approved = await approvedResponse.json<{
      data: { id: string; kind: string; snapshot: ExperienceSnapshot; sourceDraftId: string };
    }>();
    expect(approved.data).toMatchObject({
      kind: "approved",
      snapshot: { contact: { publicContact: { supportEmail } } },
      sourceDraftId: successor.data.id,
    });
    const approvalRetry = await app.fetch(
      adminRequest(`/admin/storefront-experiences/drafts/${successor.data.id}/approve`, {
        body: JSON.stringify({
          catalogReleaseId: candidateId,
          confirm: true,
          expectedVersion: successor.data.version,
          reason: "Approve the exact U9 tuple",
        }),
        method: "POST",
      }),
      env,
    );
    expect(approvalRetry.status, await approvalRetry.clone().text()).toBe(200);
    expect(await approvalRetry.json()).toMatchObject({ data: { id: approved.data.id } });
    const approvalAudit = await env.DB.prepare(
      "SELECT metadata_json FROM audit_events WHERE id = ?",
    )
      .bind(`audit-${approved.data.id}`)
      .first<{ metadata_json: string }>();
    const approvalAuditMetadata = JSON.parse(approvalAudit!.metadata_json) as Record<
      string,
      unknown
    >;
    expect(approvalAuditMetadata).toMatchObject({
      catalogReleaseId: expect.any(String),
      previewArtifactDigest: artifactDigest,
      previewBuildId: retryPreviewBody.data.build.id,
      previewSnapshotId: retryPreviewBody.data.snapshot.id,
    });
    const exactTupleReceipt = {
      artifactDigest,
      approvalAuditArtifactDigest: approvalAuditMetadata.previewArtifactDigest,
      callbackArtifactDigest: artifactDigest,
      buildId: retryPreviewBody.data.build.id,
      candidateReleaseId: candidateId,
      contactVersion: previewBody.data.snapshot.snapshot.contact?.version,
      environment: exactBuildInput.environment,
      exactValues: {
        collectionId: candidate.collections[0]!.id,
        collectionName: candidate.collections[0]!.name,
        collectionSlug: candidate.collections[0]!.slug,
        productId: candidate.products[0]!.id,
        productName: candidate.products[0]!.name,
        productSlug: candidate.products[0]!.slug,
        supportEmail,
      },
      previewSnapshotId: retryPreviewBody.data.snapshot.id,
      successorDraftId: successor.data.id,
      successorDraftVersion: successor.data.version,
      approvedSnapshotId: approved.data.id,
      themeId: manifest.id,
      themeVersion: manifest.themeVersion,
    };
    console.log(`U9_EXACT_TUPLE_RECEIPT=${JSON.stringify(exactTupleReceipt)}`);
    expect(buildInputs).toHaveLength(2);
    expect(buildInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          catalogReleaseId: candidateId,
          snapshotId: previewBody.data.snapshot.id,
        }),
      ]),
    );
  }

  test("freezes only verified payment brands and Shipping methods eligible for launch countries", async () => {
    const now = "2026-09-23T00:00:00.000Z";
    const eligibleMethod = "ship_01JELIGIBLE000000000000001";
    const ineligibleMethod = "ship_01JINELIGIBLE000000000001";
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR REPLACE INTO shipping_zones (id, name, status, created_at, updated_at) VALUES ('zone_u8_us', 'US', 'active', ?, ?)",
      ).bind(now, now),
      env.DB.prepare(
        "INSERT OR REPLACE INTO shipping_zones (id, name, status, created_at, updated_at) VALUES ('zone_u8_ca', 'CA', 'active', ?, ?)",
      ).bind(now, now),
      env.DB.prepare(
        "INSERT OR REPLACE INTO shipping_zone_countries (zone_id, country_code) VALUES ('zone_u8_us', 'US')",
      ),
      env.DB.prepare(
        "INSERT OR REPLACE INTO shipping_zone_countries (zone_id, country_code) VALUES ('zone_u8_ca', 'CA')",
      ),
      env.DB.prepare(
        `INSERT OR REPLACE INTO shipping_methods
          (id, zone_id, name, calculation_type, price_amount, currency, status, created_at, updated_at)
         VALUES (?, 'zone_u8_us', 'Eligible delivery', 'flat', 500, 'USD', 'active', ?, ?)`,
      ).bind(eligibleMethod, now, now),
      env.DB.prepare(
        `INSERT OR REPLACE INTO shipping_methods
          (id, zone_id, name, calculation_type, price_amount, currency, status, created_at, updated_at)
         VALUES (?, 'zone_u8_ca', 'Ineligible delivery', 'flat', 700, 'USD', 'active', ?, ?)`,
      ).bind(ineligibleMethod, now, now),
      env.DB.prepare(
        `INSERT INTO settings (key, value_json, updated_at) VALUES ('launch_configuration', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      ).bind(
        JSON.stringify({
          defaultCurrency: "USD",
          legalApproved: true,
          orderNumberPrefix: "SHOP",
          oversellPolicy: "deny",
          paymentMode: "test",
          paymentProvider: "stripe",
          policies: {
            contact: "https://shop.example.test/contact",
            cookies: "https://shop.example.test/cookies",
            privacy: "https://shop.example.test/privacy",
            returns: "https://shop.example.test/returns",
            shipping: "https://shop.example.test/shipping",
            terms: "https://shop.example.test/terms",
          },
          privacyContactEmail: "privacy@example.test",
          providerConfigured: true,
          reservationTtlMinutes: 15,
          sellableCurrencies: ["USD"],
          shippingCountries: ["US"],
          shippingMethodIds: [eligibleMethod, ineligibleMethod],
          supportEmail: "support@example.test",
          taxMode: "zero",
          webhookConfigured: true,
        }),
        now,
      ),
    ]);
    const candidateEnvironment = {
      ...env,
      STRIPE_PUBLIC_CAPABILITIES_JSON: JSON.stringify({
        brands: ["visa", "mastercard"],
        enabled: true,
        provider: "stripe",
      }),
    };
    const app = appFor();
    const built = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Freeze verified Commerce capability subset" }),
        method: "POST",
      }),
      candidateEnvironment,
    );
    expect(built.status).toBe(201);
    const candidate = await built.json<{ data: { id: string } }>();
    const detail = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${candidate.data.id}`),
      candidateEnvironment,
    );
    const detailBody = await detail.json();
    expect(detailBody as unknown).toMatchObject({
      data: {
        manifest: {
          commerce: {
            payment: { brands: ["visa", "mastercard"], enabled: true, provider: "stripe" },
            shippingMethods: [
              expect.objectContaining({ countryCodes: ["US"], id: eligibleMethod }),
            ],
          },
        },
      },
    });
    expect(JSON.stringify(detailBody)).not.toContain(ineligibleMethod);
  });

  test("freezes the exact published Navigation version and item order in each candidate", async () => {
    const app = appFor();
    const write = async (items: unknown[], expectedVersion?: number) => {
      const response = await app.fetch(
        adminRequest("/admin/storefront/navigation/header", {
          body: JSON.stringify({
            ...(expectedVersion ? { expectedVersion } : {}),
            items,
            reason: "Freeze Navigation version",
          }),
          method: "PUT",
        }),
        env,
      );
      expect(response.status).toBe(200);
      return response.json<{ data: { items: Array<Record<string, unknown>>; version: number } }>();
    };
    const publish = async (version: number) => {
      const response = await app.fetch(
        adminRequest("/admin/storefront/navigation/header/publish", {
          body: JSON.stringify({
            confirm: true,
            expectedVersion: version,
            reason: "Publish Navigation version",
          }),
          method: "POST",
        }),
        env,
      );
      expect(response.status).toBe(200);
    };
    const build = async () => {
      const response = await app.fetch(
        adminRequest("/admin/catalog/releases/preview-candidates", {
          body: JSON.stringify({ reason: "Freeze exact Navigation" }),
          method: "POST",
        }),
        env,
      );
      expect(response.status).toBe(201);
      return (await response.json<{ data: { id: string } }>()).data.id;
    };
    const inspect = async (id: string) => {
      const response = await app.fetch(
        adminRequest(`/admin/catalog/releases/preview-candidates/${id}`),
        env,
      );
      expect(response.status).toBe(200);
      return (
        await response.json<{
          data: {
            manifest: { navigation: Array<{ items: Array<{ label: string }>; version: number }> };
          };
        }>()
      ).data.manifest.navigation[0];
    };

    const v1 = await write([
      {
        id: "draft.first",
        label: "First",
        parentId: null,
        position: 0,
        target: { kind: "route", path: "/cart" },
      },
      {
        id: "draft.second",
        label: "Second",
        parentId: null,
        position: 1,
        target: { kind: "route", path: "/checkout" },
      },
    ]);
    await publish(v1.data.version);
    const firstCandidate = await build();
    const v2 = await write(
      [
        { ...v1.data.items[1], position: 0 },
        { ...v1.data.items[0], position: 1 },
      ],
      v1.data.version,
    );
    await publish(v2.data.version);
    const secondCandidate = await build();

    expect(await inspect(firstCandidate)).toMatchObject({
      items: [{ label: "First" }, { label: "Second" }],
      version: 1,
    });
    expect(await inspect(secondCandidate)).toMatchObject({
      items: [{ label: "Second" }, { label: "First" }],
      version: 2,
    });
  });

  test("rejects a Navigation route absent from the exact candidate route output", async () => {
    const now = "2026-09-23T00:00:00.000Z";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO navigation_menu_versions
          (menu_id, version, placement, status, created_at, updated_at, published_at)
         VALUES ('menu.header', 1, 'header', 'published', ?, ?, ?)`,
      ).bind(now, now, now),
      env.DB.prepare(
        `INSERT INTO navigation_items
          (menu_id, menu_version, item_id, parent_item_id, position, label, target_json)
         VALUES ('menu.header', 1, 'item.missing', NULL, 0, 'Missing', ?)`,
      ).bind(JSON.stringify({ kind: "route", path: "/missing" })),
    ]);

    const response = await appFor().fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Reject unavailable Navigation route" }),
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "catalog_navigation_route_unavailable" },
    });
  });

  test("freezes exact Content versions across real successor candidates and rejects unpublished references", async () => {
    const app = appFor();
    const exactBoundaryBody = exactByteContentDocument();
    const pageInput = {
      body: exactBoundaryBody,
      reason: "Create candidate Content",
      seo: { description: "Candidate page", title: "Candidate page" },
      slug: "candidate-page",
      summary: "Candidate page",
      title: "Candidate page v1",
    };
    const created = await app.fetch(
      adminRequest("/admin/content/pages", { body: JSON.stringify(pageInput), method: "POST" }),
      env,
    );
    expect(created.status).toBe(201);
    const page = await created.json<{ data: { id: string } }>();
    expect(
      (
        await app.fetch(
          adminRequest(`/admin/content/pages/${page.data.id}/publish`, {
            body: JSON.stringify({
              confirm: true,
              expectedVersion: 1,
              reason: "Publish candidate Content v1",
            }),
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    const firstResponse = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Freeze Content v1" }),
        method: "POST",
      }),
      env,
    );
    expect(firstResponse.status).toBe(201);
    const first = await firstResponse.json<{ data: { id: string } }>();

    expect(
      (
        await app.fetch(
          adminRequest(`/admin/content/pages/${page.data.id}`, {
            body: JSON.stringify({
              ...pageInput,
              body: [{ id: "section.intro", kind: "paragraph", text: "Immutable successor body" }],
              expectedVersion: 1,
              reason: "Create candidate Content v2",
              title: "Candidate page v2",
            }),
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    const publishedV2 = await app.fetch(
      adminRequest(`/admin/content/pages/${page.data.id}/publish`, {
        body: JSON.stringify({
          confirm: true,
          expectedVersion: 2,
          reason: "Publish candidate Content v2",
        }),
        method: "POST",
      }),
      env,
    );
    expect(publishedV2.status, await publishedV2.clone().text()).toBe(200);
    const secondResponse = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Freeze Content v2" }),
        method: "POST",
      }),
      env,
    );
    expect(secondResponse.status).toBe(201);
    const second = await secondResponse.json<{ data: { id: string } }>();
    expect(second.data.id).not.toBe(first.data.id);

    const readManifest = async (id: string) => {
      const response = await app.fetch(
        adminRequest(`/admin/catalog/releases/preview-candidates/${id}`),
        env,
      );
      expect(response.status).toBe(200);
      return (
        await response.json<{
          data: {
            manifest: {
              content: Array<{
                kind: "article" | "page" | "policy";
                payload: { sections: unknown };
                title: string;
                version: number;
              }>;
            };
          };
        }>()
      ).data.manifest;
    };
    const firstManifest = await readManifest(first.data.id);
    const secondManifest = await readManifest(second.data.id);
    const firstArticles = firstManifest.content.filter(({ kind }) => kind === "article");
    const firstPages = firstManifest.content.filter(({ kind }) => kind === "page");
    const secondPages = secondManifest.content.filter(({ kind }) => kind === "page");
    expect(firstArticles).toEqual([]);
    expect(firstPages).toMatchObject([{ title: "Candidate page v1", version: 1 }]);
    expect(
      new TextEncoder().encode(JSON.stringify(firstPages[0]!.payload.sections)).byteLength,
    ).toBe(64_000);
    expect(secondPages).toMatchObject([{ title: "Candidate page v2", version: 2 }]);
    expect(
      (await readManifest(first.data.id)).content.filter(({ kind }) => kind === "page"),
    ).toEqual(firstPages);
    expect(
      (
        await env.DB.prepare(
          `SELECT release_id, source_version FROM catalog_release_sources
            WHERE source_kind = 'page' AND source_id = ? ORDER BY source_version`,
        )
          .bind(page.data.id)
          .all()
      ).results,
    ).toEqual([
      { release_id: first.data.id, source_version: 1 },
      { release_id: second.data.id, source_version: 2 },
    ]);

    const draftTarget = await app.fetch(
      adminRequest("/admin/content/pages", {
        body: JSON.stringify({ ...pageInput, reason: "Create draft target", slug: "draft-target" }),
        method: "POST",
      }),
      env,
    );
    const target = await draftTarget.json<{ data: { id: string } }>();
    const source = await app.fetch(
      adminRequest("/admin/content/pages", {
        body: JSON.stringify({
          ...pageInput,
          body: [
            {
              id: "section.link",
              kind: "link",
              link: {
                label: "Draft target",
                target: { kind: "internal", reference: { id: target.data.id, kind: "page" } },
                targetBehavior: "same-window",
              },
            },
          ],
          reason: "Create invalid published reference",
          slug: "invalid-reference-source",
        }),
        method: "POST",
      }),
      env,
    );
    const sourcePage = await source.json<{ data: { id: string } }>();
    await app.fetch(
      adminRequest(`/admin/content/pages/${sourcePage.data.id}/publish`, {
        body: JSON.stringify({
          confirm: true,
          expectedVersion: 1,
          reason: "Publish invalid reference source",
        }),
        method: "POST",
      }),
      env,
    );
    const rejected = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Reject unpublished Content reference" }),
        method: "POST",
      }),
      env,
    );
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({
      error: { code: "catalog_content_reference_unpublished" },
    });
  });

  test("carries exact text, section, link, and media ceilings from save into a real candidate", async () => {
    const app = appFor();
    const media = await env.DB.prepare(
      `SELECT media.id FROM product_media media
        JOIN products product ON product.id = media.product_id
       WHERE product.status = 'published' LIMIT 1`,
    ).first<{ id: string }>();
    expect(media).toBeTruthy();

    const textBody = exactTextContentDocument();
    const cardinalityBody = exactCardinalityContentDocument(media!.id);
    const baseInput = {
      reason: "Prove exact Content ceilings",
      seo: { description: "Boundary proof", title: "Boundary proof" },
      summary: "Boundary proof",
      title: "Boundary proof",
    };
    const overflowBodies = [
      [{ ...textBody[0]!, text: `${textBody[0]!.text}x` }],
      Array.from({ length: 41 }, (_, index) => ({
        id: `section.p${index}`,
        kind: "paragraph" as const,
        text: "x",
      })),
      Array.from({ length: 21 }, (_, index) => ({
        id: `section.link${index}`,
        kind: "link" as const,
        link: {
          label: "Link",
          target: { kind: "external" as const, url: `https://example.test/${index}` },
          targetBehavior: "same-window" as const,
        },
      })),
      Array.from({ length: 21 }, (_, index) => ({
        alt: "Media",
        assetId: media!.id,
        id: `section.media${index}`,
        kind: "image" as const,
      })),
    ];
    for (const [index, body] of overflowBodies.entries()) {
      const rejected = await app.fetch(
        adminRequest("/admin/content/pages", {
          body: JSON.stringify({
            ...baseInput,
            body,
            reason: `Reject Content max-plus-one ${index}`,
            slug: `boundary-overflow-${index}`,
          }),
          method: "POST",
        }),
        env,
      );
      expect(rejected.status).toBe(422);
    }

    const exactInputs = [
      { body: textBody, slug: "exact-text" },
      { body: cardinalityBody, slug: "exact-cardinality" },
    ];
    const pageIds: string[] = [];
    for (const input of exactInputs) {
      const created = await app.fetch(
        adminRequest("/admin/content/pages", {
          body: JSON.stringify({ ...baseInput, ...input }),
          method: "POST",
        }),
        env,
      );
      expect(created.status, await created.clone().text()).toBe(201);
      const page = await created.json<{ data: { id: string } }>();
      pageIds.push(page.data.id);
      const published = await app.fetch(
        adminRequest(`/admin/content/pages/${page.data.id}/publish`, {
          body: JSON.stringify({
            confirm: true,
            expectedVersion: 1,
            reason: "Publish exact Content ceiling",
          }),
          method: "POST",
        }),
        env,
      );
      expect(published.status, await published.clone().text()).toBe(200);
    }

    const response = await app.fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Freeze exact Content ceilings" }),
        method: "POST",
      }),
      env,
    );
    expect(response.status, await response.clone().text()).toBe(201);
    const candidate = await response.json<{ data: { id: string } }>();
    const detail = await app.fetch(
      adminRequest(`/admin/catalog/releases/preview-candidates/${candidate.data.id}`),
      env,
    );
    expect(detail.status).toBe(200);
    const manifest = await detail.json<{
      data: {
        manifest: {
          content: Array<{ id: string; payload: { sections: Array<{ kind: string }> } }>;
        };
      };
    }>();
    const exactText = manifest.data.manifest.content.find(({ id }) => id === pageIds[0]);
    const exactCardinality = manifest.data.manifest.content.find(({ id }) => id === pageIds[1]);
    expect(exactText?.payload.sections).toEqual(textBody);
    expect(exactCardinality?.payload.sections).toHaveLength(40);
    expect(exactCardinality?.payload.sections.filter(({ kind }) => kind === "link")).toHaveLength(
      20,
    );
    expect(exactCardinality?.payload.sections.filter(({ kind }) => kind === "image")).toHaveLength(
      20,
    );
  });

  test("uses one published-Product media eligibility rule for picker, save, and publish", async () => {
    const app = appFor();
    const media = await env.DB.prepare(
      `SELECT media.id, media.product_id FROM product_media media
        JOIN products product ON product.id = media.product_id
       WHERE product.status = 'published' LIMIT 1`,
    ).first<{ id: string; product_id: string }>();
    expect(media).toBeTruthy();
    const input = {
      body: [{ alt: "Candidate media", assetId: media!.id, id: "section.image", kind: "image" }],
      reason: "Create media-backed Content",
      seo: { description: "Media page", title: "Media page" },
      slug: "media-page",
      summary: "Media page",
      title: "Media page",
    };
    const created = await app.fetch(
      adminRequest("/admin/content/pages", { body: JSON.stringify(input), method: "POST" }),
      env,
    );
    expect(created.status).toBe(201);
    const page = await created.json<{ data: { id: string } }>();
    await env.DB.prepare("UPDATE products SET status = 'archived' WHERE id = ?")
      .bind(media!.product_id)
      .run();
    try {
      const picker = await app.fetch(adminRequest("/admin/content/media"), env);
      expect(picker.status).toBe(200);
      const pickerBody = await picker.json<{ data: Array<{ id: string }> }>();
      expect(pickerBody.data.some(({ id }) => id === media!.id)).toBe(false);
      const save = await app.fetch(
        adminRequest("/admin/content/pages", {
          body: JSON.stringify({
            ...input,
            reason: "Reject archived media",
            slug: "archived-media",
          }),
          method: "POST",
        }),
        env,
      );
      expect(save.status).toBe(422);
      const publish = await app.fetch(
        adminRequest(`/admin/content/pages/${page.data.id}/publish`, {
          body: JSON.stringify({
            confirm: true,
            expectedVersion: 1,
            reason: "Reject media archived after save",
          }),
          method: "POST",
        }),
        env,
      );
      expect(publish.status).toBe(422);
    } finally {
      await env.DB.prepare("UPDATE products SET status = 'published' WHERE id = ?")
        .bind(media!.product_id)
        .run();
    }
  });

  test("fails closed when a required approved Policy is missing instead of inserting defaults", async () => {
    await env.DB.prepare("DELETE FROM policy_versions WHERE kind = 'terms'").run();
    const response = await appFor().fetch(
      adminRequest("/admin/catalog/releases/preview-candidates", {
        body: JSON.stringify({ reason: "Required Policy proof" }),
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "catalog_required_policies_unpublished" },
    });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM policy_versions WHERE kind = 'terms'",
      ).first(),
    ).toEqual({ count: 0 });
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
        environment: env.ENVIRONMENT,
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
        environment: env.ENVIRONMENT,
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

  test.skipIf(!(env as unknown as { U9_EXACT_HANDSHAKE_URL?: string }).U9_EXACT_HANDSHAKE_URL)(
    "propagates one sparse Admin tuple through candidate, successor, private Preview, approval, and generated Fashion output",
    exerciseExactSparseTuple,
    180_000,
  );
});
