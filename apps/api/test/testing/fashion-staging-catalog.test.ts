import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import { canonicalCatalogReleaseSchema } from "@shoppp/contracts";
import { createApp } from "../../src/http/app";
import { seedServiceAdmin } from "../fixtures/admin-iam";
import {
  applyFashionStagingCatalog,
  FASHION_STAGING_CATALOG_RESET_TARGET,
  fashionStagingCatalogReviewedPayloadDigest,
  fashionStagingIamFingerprint,
  getFashionStagingCatalogResetInventory,
  getFashionStagingCatalogPreflight,
  prepareFashionStagingCatalogActivation,
  resetFashionStagingCatalog,
  verifyFashionStagingCatalog,
} from "../../src/testing/fashion-staging-catalog";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function byteDigest(value: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", Uint8Array.from(value).buffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function input() {
  const productId = (index: number) => `prod_FS8API${String(index).padStart(14, "0")}`;
  const variantId = (productIndex: number, variantIndex: number) =>
    `var_FS8API${String(productIndex).padStart(7, "0")}${String(variantIndex).padStart(7, "0")}`;
  const mediaSha256 = await byteDigest(new Uint8Array([1, 2, 3]));
  const catalog = {
    catalogVersion: "fashion-store-live-api-test-v1",
    collection: {
      id: "col_FS8APICOLLECTION000001",
      name: "Fashion Store",
      slug: "fashion-store-api",
    },
    currency: "USD",
    products: Array.from({ length: 13 }, (_, productIndex) => {
      const variantCount = productIndex === 0 ? 12 : 1;
      const mediaCount = productIndex === 0 ? 6 : 1;
      return {
        badge: null,
        brand: null,
        description: `Product ${productIndex + 1}`,
        id: productId(productIndex + 1),
        media: Array.from({ length: mediaCount }, (_, mediaIndex) => ({
          alt: `Product ${productIndex + 1} view ${mediaIndex + 1}`,
          height: 765,
          id: `media_fs8_api_${productIndex + 1}_${mediaIndex + 1}`,
          mimeType: "image/jpeg",
          order: mediaIndex + 1,
          r2Key: `catalog/fashion-store/api-test/product-${productIndex + 1}-${mediaIndex + 1}.jpg`,
          sha256: mediaSha256,
          sourcePath: "unused-in-api-test.jpg",
          width: 600,
        })),
        name: `Product ${productIndex + 1}`,
        shopCardOrder: productIndex < 12 ? productIndex + 1 : null,
        slug: `fashion-product-${productIndex + 1}`,
        source: { fixtureId: `fixture-${productIndex + 1}`, kind: "shop-card" },
        status: "published",
        taxonomy: {
          categories: ["Shirts"],
          colors: ["Blue"],
          sizes: ["M"],
          tags: ["Cotton"],
        },
        variants: Array.from({ length: variantCount }, (_, variantIndex) => ({
          id: variantId(productIndex + 1, variantIndex + 1),
          inventory: { onHand: 20, oversellLimit: 0 },
          optionValues: { color: `Color ${variantIndex + 1}`, size: "M" },
          price: {
            amount: 1000 + productIndex,
            compareAtAmount: 2000 + productIndex,
            currency: "USD",
          },
          sku: `FS8-API-${productIndex + 1}-${variantIndex + 1}`,
          status: "active",
          title: `Variant ${variantIndex + 1}`,
          weightGrams: null,
        })),
      };
    }),
    r2Prefix: "catalog/fashion-store/api-test",
    schemaVersion: 1,
    warehouse: {
      code: "FASHION-STAGING",
      id: "warehouse_fashion_staging",
      name: "Fashion staging warehouse",
    },
  } as const;
  const releaseProducts = catalog.products.map((product) => ({
    collectionIds: [catalog.collection.id],
    collectionSlugs: [catalog.collection.slug],
    description: product.description,
    id: product.id,
    media: product.media.map((media) => ({
      alt: media.alt,
      height: media.height,
      src: `https://media.example.test/${media.r2Key}`,
      width: media.width,
    })),
    name: product.name,
    seoDescription: product.description,
    seoTitle: `${product.name} | Shoppp`,
    slug: product.slug,
    status: "published" as const,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      optionValues: variant.optionValues,
      prices: [variant.price],
      sku: variant.sku,
      status: "active" as const,
      title: variant.title,
      weightGrams: 0,
    })),
  }));
  const site = {
    defaultCurrency: "USD",
    freshnessHours: 24,
    name: "Shoppp",
    origin: "https://storefront.example.test",
  };
  const policies = [
    {
      description: "Test policy",
      effectiveDate: "2026-09-13",
      sections: [{ body: "Test policy body", heading: "Test" }],
      slug: "terms",
      title: "Terms",
    },
  ];
  const shopperRelease = canonicalCatalogReleaseSchema.parse({
    collections: [
      {
        description: "Fashion",
        id: catalog.collection.id,
        name: catalog.collection.name,
        productIds: releaseProducts.map(({ id }) => id),
        productSlugs: releaseProducts.map(({ slug }) => slug),
        seoDescription: "Fashion",
        seoTitle: "Fashion",
        slug: catalog.collection.slug,
        status: "published",
      },
    ],
    generatedAt: "2026-09-13T00:00:00.000Z",
    policies,
    products: releaseProducts,
    redirects: [],
    releaseId: "fashion-store-live-api-test-v1-shopper-release",
    routes: ["/", ...releaseProducts.map(({ slug }) => `/products/${slug}`)],
    schemaVersion: 2,
    site,
  });
  const acceptanceProduct = {
    id: "prod_FS8APIUNAVAILABLE000001",
    slug: "fashion-api-unavailable",
    sku: "FS8-API-UNAVAILABLE",
    variantId: "var_FS8APIUNAVAILABLE000001",
  };
  const acceptanceRelease = canonicalCatalogReleaseSchema.parse({
    ...shopperRelease,
    collections: [],
    products: [
      {
        collectionIds: [],
        collectionSlugs: [],
        description: "Unavailable",
        id: acceptanceProduct.id,
        media: [releaseProducts[0]!.media[0]!],
        name: "Unavailable",
        seoDescription: "Unavailable",
        seoTitle: "Unavailable",
        slug: acceptanceProduct.slug,
        status: "published",
        variants: [
          {
            id: acceptanceProduct.variantId,
            optionValues: { state: "unavailable" },
            prices: [{ amount: 100, currency: "USD" }],
            sku: acceptanceProduct.sku,
            status: "active",
            title: "Unavailable",
            weightGrams: 0,
          },
        ],
      },
    ],
    releaseId: "fashion-store-live-api-test-v1-acceptance-release",
    routes: [`/products/${acceptanceProduct.slug}`],
  });
  return {
    acceptanceProduct,
    acceptanceRelease,
    catalog,
    environment: "fashion-staging" as const,
    expectedIamFingerprint: await fashionStagingIamFingerprint(env.DB),
    manifestDigest: await digest(catalog),
    shopperRelease,
    target: FASHION_STAGING_CATALOG_RESET_TARGET,
  };
}

async function putMedia(value: Awaited<ReturnType<typeof input>>) {
  for (const item of value.catalog.products.flatMap((product) => product.media)) {
    await env.MEDIA.put(item.r2Key, new Uint8Array([1, 2, 3]), {
      customMetadata: { sha256: item.sha256 },
      httpMetadata: { contentType: item.mimeType },
    });
  }
}

describe.sequential("Fashion staging live catalog migration", () => {
  test("keeps the superseded migration mutation route unavailable", async () => {
    const app = createApp();
    const malformed = () =>
      new Request("https://api.example.test/internal/testing/fashion-staging/catalog-migration", {
        body: "not-json",
        headers: { Authorization: `Bearer ${"t".repeat(40)}` },
        method: "POST",
      });
    const ordinary = await app.fetch(malformed(), {
      ...env,
      FASHION_ACCEPTANCE_TOKEN: "t".repeat(40),
      RESOURCE_NAMESPACE: "shoppp-staging",
    });
    expect(ordinary.status).toBe(404);
    const unavailable = await app.fetch(malformed(), {
      ...env,
      FASHION_ACCEPTANCE_TOKEN: "t".repeat(40),
      RESOURCE_NAMESPACE: "shoppp-fashion-staging",
    });
    expect(unavailable.status).toBe(404);
  });

  test("rejects missing media and IAM drift without catalog mutation", async () => {
    const value = await input();
    await expect(
      applyFashionStagingCatalog(env.DB, env.MEDIA, value, "missing-media"),
    ).rejects.toThrow("fashion_catalog_media_missing");
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM products WHERE id LIKE 'prod_FS8API%'",
      ).first<{ count: number }>(),
    ).toEqual({ count: 0 });
    value.expectedIamFingerprint = "f".repeat(64);
    await expect(applyFashionStagingCatalog(env.DB, env.MEDIA, value, "iam-drift")).rejects.toThrow(
      "fashion_catalog_iam_drift",
    );
  });

  test("rejects active release work before applying catalog state", async () => {
    const value = await input();
    await putMedia(value);
    await env.DB.prepare(
      `INSERT INTO catalog_releases
         (id, status, manifest_json, approved_at, created_at, updated_at)
       VALUES ('release_fs8_active_work', 'building', '{}', ?, ?, ?)`,
    )
      .bind("2026-09-13T00:00:00.000Z", "2026-09-13T00:00:00.000Z", "2026-09-13T00:00:00.000Z")
      .run();
    await expect(
      applyFashionStagingCatalog(env.DB, env.MEDIA, value, "active-work"),
    ).rejects.toThrow("fashion_catalog_active_work");
    await env.DB.prepare(
      "UPDATE catalog_releases SET status = 'failed', failure_code = 'test-complete' WHERE id = 'release_fs8_active_work'",
    ).run();
  });

  test("rolls back every catalog statement when the final audited receipt fails", async () => {
    const value = await input();
    await putMedia(value);
    await env.DB.prepare(
      "INSERT INTO audit_events (id, actor_type, actor_id, action, target_type, target_id, result, metadata_json, created_at) VALUES (?, 'machine', NULL, 'test', 'test', NULL, 'succeeded', '{}', ?)",
    )
      .bind("audit_fashion_catalog_atomic-failure", "2026-09-13T00:00:00.000Z")
      .run();
    await expect(
      applyFashionStagingCatalog(env.DB, env.MEDIA, value, "atomic-failure"),
    ).rejects.toThrow();
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM products WHERE id LIKE 'prod_FS8API%'",
      ).first<{ count: number }>(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM fashion_staging_catalog_migrations",
      ).first<{ count: number }>(),
    ).toEqual({ count: 0 });
  });

  test("atomically creates one complete shopper release, a protected unavailable release, and an idempotent receipt", async () => {
    const value = await input();
    await putMedia(value);
    const before = await getFashionStagingCatalogPreflight(env.DB);
    const receipt = await applyFashionStagingCatalog(env.DB, env.MEDIA, value, "successful-apply");
    expect(receipt).toMatchObject({
      mediaCount: 18,
      productCount: 13,
      status: "applied",
      variantCount: 24,
    });
    expect(await fashionStagingIamFingerprint(env.DB)).toBe(before.iamFingerprint);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM products WHERE status = 'published' AND id LIKE 'prod_FS8API%'",
      ).first<{ count: number }>(),
    ).toEqual({ count: 13 });
    expect(
      await env.DB.prepare("SELECT status FROM products WHERE id = ?")
        .bind(value.acceptanceProduct.id)
        .first(),
    ).toEqual({ status: "draft" });
    expect(await env.DB.prepare("PRAGMA foreign_key_check").all()).toMatchObject({ results: [] });
    const retry = await applyFashionStagingCatalog(env.DB, env.MEDIA, value, "retry");
    expect(retry.status).toBe("already_applied");
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM fashion_staging_catalog_migrations",
      ).first<{ count: number }>(),
    ).toEqual({ count: 1 });
    expect(
      await verifyFashionStagingCatalog(env.DB, env.MEDIA, value.catalog.catalogVersion),
    ).toMatchObject({
      dimensionsVerified: 18,
      foreignKeyViolations: 0,
      mediaCount: 18,
      productCount: 13,
      releaseDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      sellableVariantCount: 24,
      variantCount: 24,
    });

    const changed = structuredClone(value);
    changed.catalog.products[0]!.name = "Changed under the same version";
    changed.manifestDigest = await digest(changed.catalog);
    await expect(
      applyFashionStagingCatalog(env.DB, env.MEDIA, changed, "changed-retry"),
    ).rejects.toThrow("fashion_catalog_version_collision");
  });
});

describe.sequential("Fashion staging one-time catalog reset", () => {
  test("review digest binds every reset-relevant payload section but not the live IAM fingerprint", async () => {
    const value = await input();
    const reviewedDigest = await fashionStagingCatalogReviewedPayloadDigest(value);
    const mutations: Array<[string, (changed: Awaited<ReturnType<typeof input>>) => void]> = [
      ["catalog", (changed) => void (changed.catalog.products[0]!.name = "Changed")],
      ["shopperRelease", (changed) => void (changed.shopperRelease.site.name = "Changed")],
      ["acceptanceRelease", (changed) => void (changed.acceptanceRelease.site.name = "Changed")],
      ["acceptanceProduct", (changed) => void (changed.acceptanceProduct.sku = "CHANGED")],
      [
        "target",
        (changed) => void ((changed.target as { workerName: string }).workerName = "changed"),
      ],
      [
        "environment",
        (changed) => void ((changed as { environment: string }).environment = "changed"),
      ],
      ["manifestDigest", (changed) => void (changed.manifestDigest = "f".repeat(64))],
    ];

    for (const [label, mutate] of mutations) {
      const changed = structuredClone(value);
      mutate(changed);
      expect(await fashionStagingCatalogReviewedPayloadDigest(changed), label).not.toBe(
        reviewedDigest,
      );
    }
    const changedIam = structuredClone(value);
    changedIam.expectedIamFingerprint = "f".repeat(64);
    expect(await fashionStagingCatalogReviewedPayloadDigest(changedIam)).toBe(reviewedDigest);
  });

  test("classifies the complete schema into preserved, boot-critical, and disposable tables", async () => {
    const inventory = await getFashionStagingCatalogResetInventory(env.DB);

    expect(inventory.preserved).toEqual([
      "admin_identities",
      "admin_invitations",
      "admin_login_throttles",
      "admin_password_credentials",
      "admin_password_reset_tokens",
      "admin_permission_definitions",
      "admin_role_permissions",
      "admin_roles",
      "admin_service_credentials",
      "admin_sessions",
      "settings",
    ]);
    expect(inventory.bootCritical).toEqual([
      "d1_migrations",
      "fashion_staging_catalog_reset_locks",
    ]);
    expect(inventory.unknown).toEqual([]);
    expect(inventory.disposable).toEqual(
      expect.arrayContaining([
        "audit_events",
        "carts",
        "catalog_releases",
        "fashion_staging_acceptance_runs",
        "fashion_staging_catalog_migrations",
        "orders",
        "products",
        "storefront_experience_snapshots",
      ]),
    );
  });

  test("rejects arbitrary target identity before destructive work", async () => {
    const value = await input();
    await putMedia(value);
    const iamBefore = await fashionStagingIamFingerprint(env.DB);

    await expect(
      resetFashionStagingCatalog(
        env.DB,
        env.MEDIA,
        { ...value, target: { ...value.target, d1DatabaseId: "wrong-database" } },
        "wrong-target",
        new Date(),
        await fashionStagingCatalogReviewedPayloadDigest(value),
      ),
    ).rejects.toThrow("fashion_catalog_reset_target_mismatch");
    expect(await fashionStagingIamFingerprint(env.DB)).toBe(iamBefore);

    const changed = structuredClone(value);
    changed.catalog.products[0]!.name = "Unreviewed replacement";
    changed.manifestDigest = await digest(changed.catalog);
    await expect(
      resetFashionStagingCatalog(
        env.DB,
        env.MEDIA,
        changed,
        "wrong-manifest",
        new Date(),
        await fashionStagingCatalogReviewedPayloadDigest(value),
      ),
    ).rejects.toThrow("fashion_catalog_reset_manifest_not_reviewed");
  });

  test("deletes the old business baseline, preserves IAM, and loads only the reviewed catalog", async () => {
    const value = await input();
    await putMedia(value);
    await env.MEDIA.put("catalog/fashion-store/retired-v0/old.jpg", new Uint8Array([9]));
    await env.MEDIA.put("themes/fashion-store/hero.jpg", new Uint8Array([8]));
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO products
             (id, slug, name, description, status, seo_title, seo_description, published_at, created_at, updated_at)
           VALUES ('prod_old_reset', 'old-reset', 'Old reset product', '', 'draft', '', '', NULL, ?, ?)`,
      ).bind("2026-09-14T00:00:00.000Z", "2026-09-14T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO audit_events
             (id, actor_type, actor_id, action, target_type, target_id, result, metadata_json, created_at)
           VALUES ('audit_old_reset', 'machine', NULL, 'old.reset', 'product', 'prod_old_reset', 'succeeded', '{}', ?)`,
      ).bind("2026-09-14T00:00:00.000Z"),
    ]);
    const iamBefore = await fashionStagingIamFingerprint(env.DB);

    const receipt = await resetFashionStagingCatalog(
      env.DB,
      env.MEDIA,
      value,
      "destructive-reset",
      new Date(),
      await fashionStagingCatalogReviewedPayloadDigest(value),
    );

    expect(receipt).toMatchObject({
      deletedMediaCount: 1,
      mediaCount: 18,
      productCount: 13,
      status: "applied",
      variantCount: 24,
    });
    expect(await fashionStagingIamFingerprint(env.DB)).toBe(iamBefore);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM products WHERE id = 'prod_old_reset'",
      ).first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE id = 'audit_old_reset'",
      ).first(),
    ).toEqual({ count: 0 });
    expect(await env.MEDIA.get("catalog/fashion-store/retired-v0/old.jpg")).toBeNull();
    expect(await env.MEDIA.get("themes/fashion-store/hero.jpg")).not.toBeNull();
    expect(await env.DB.prepare("PRAGMA foreign_key_check").all()).toMatchObject({ results: [] });
  });

  test("admits only one reset and blocks new protected work while its atomic lock is held", async () => {
    const value = await input();
    await putMedia(value);
    await env.DB.prepare(
      "DELETE FROM audit_events WHERE action = 'catalog.fashion-staging.reset'",
    ).run();
    const reviewedDigest = await fashionStagingCatalogReviewedPayloadDigest(value);

    const outcomes = await Promise.allSettled([
      resetFashionStagingCatalog(
        env.DB,
        env.MEDIA,
        value,
        "concurrent-a",
        new Date(),
        reviewedDigest,
      ),
      resetFashionStagingCatalog(
        env.DB,
        env.MEDIA,
        value,
        "concurrent-b",
        new Date(),
        reviewedDigest,
      ),
    ]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'catalog.fashion-staging.reset' AND result = 'succeeded'",
      ).first(),
    ).toEqual({ count: 1 });

    await env.DB.prepare(
      "DELETE FROM audit_events WHERE action = 'catalog.fashion-staging.reset'",
    ).run();
    await env.DB.prepare(
      "INSERT INTO fashion_staging_catalog_reset_locks (id, owner_request_id, created_at) VALUES ('fashion-staging-catalog-reset', 'trigger-test', ?)",
    )
      .bind("2026-09-14T00:00:00.000Z")
      .run();
    await expect(
      env.DB.prepare(
        `INSERT INTO catalog_releases
           (id, status, manifest_json, approved_at, created_at, updated_at)
         VALUES ('release_blocked_by_reset', 'building', '{}', ?, ?, ?)`,
      )
        .bind("2026-09-14T00:00:00.000Z", "2026-09-14T00:00:00.000Z", "2026-09-14T00:00:00.000Z")
        .run(),
    ).rejects.toThrow("fashion_catalog_reset_in_progress");
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type = 'trigger' AND name LIKE 'fashion_catalog_reset_blocks_%'",
      ).first(),
    ).toEqual({ count: 8 });
    await env.DB.prepare("DELETE FROM fashion_staging_catalog_reset_locks").run();
  });

  test("requires dual credentials before upload and keeps reset repair-forward open until activation", async () => {
    const value = await input();
    const app = createApp({
      fashionCatalogResetReviewedPayloadDigest:
        await fashionStagingCatalogReviewedPayloadDigest(value),
    });
    await putMedia(value);
    await env.DB.prepare(
      "DELETE FROM audit_events WHERE action = 'catalog.fashion-staging.reset'",
    ).run();
    const bindings = {
      ...env,
      CLOUDFLARE_ACCOUNT_ID: FASHION_STAGING_CATALOG_RESET_TARGET.cloudflareAccountId,
      D1_DATABASE_ID: FASHION_STAGING_CATALOG_RESET_TARGET.d1DatabaseId,
      D1_DATABASE_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.d1DatabaseName,
      FASHION_ACCEPTANCE_TOKEN: "a".repeat(40),
      FASHION_CATALOG_RESET_ENABLED: "true",
      FASHION_CATALOG_RESET_TOKEN: "r".repeat(40),
      MEDIA_BUCKET_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.r2BucketName,
      MEDIA_PUBLIC_ORIGIN: FASHION_STAGING_CATALOG_RESET_TARGET.mediaOrigin,
      RESOURCE_NAMESPACE: "shoppp-fashion-staging",
      WORKER_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.workerName,
    };
    const request = (resetToken: string) =>
      new Request("https://api.example.test/internal/testing/fashion-staging/catalog-reset", {
        body: JSON.stringify(value),
        headers: {
          Authorization: `Bearer ${bindings.FASHION_ACCEPTANCE_TOKEN}`,
          "Content-Type": "application/json",
          "X-Fashion-Catalog-Reset-Token": resetToken,
        },
        method: "POST",
      });

    const resetPreflight = (resetToken: string) =>
      new Request(
        "https://api.example.test/internal/testing/fashion-staging/catalog-reset/preflight",
        {
          headers: {
            Authorization: `Bearer ${bindings.FASHION_ACCEPTANCE_TOKEN}`,
            "X-Fashion-Catalog-Reset-Token": resetToken,
          },
        },
      );
    expect((await app.fetch(resetPreflight("x".repeat(40)), bindings)).status).toBe(401);
    const ready = await app.fetch(resetPreflight(bindings.FASHION_CATALOG_RESET_TOKEN), bindings);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({
      data: { activeWorkCount: 0, resetClosed: false },
    });

    const unavailableCases: Array<[string, Record<string, string | undefined>]> = [
      ["reset disabled", { FASHION_CATALOG_RESET_ENABLED: "false" }],
      ["account", { CLOUDFLARE_ACCOUNT_ID: "wrong" }],
      ["worker", { WORKER_NAME: "wrong" }],
      ["database id", { D1_DATABASE_ID: "wrong" }],
      ["database name", { D1_DATABASE_NAME: "wrong" }],
      ["bucket", { MEDIA_BUCKET_NAME: "wrong" }],
      ["media origin", { MEDIA_PUBLIC_ORIGIN: "https://wrong.example.test" }],
      ["resource namespace", { RESOURCE_NAMESPACE: "wrong-staging" }],
      ["missing reset token", { FASHION_CATALOG_RESET_TOKEN: undefined }],
      ["short reset token", { FASHION_CATALOG_RESET_TOKEN: "short" }],
    ];
    for (const [label, override] of unavailableCases) {
      const response = await app.fetch(request(bindings.FASHION_CATALOG_RESET_TOKEN), {
        ...bindings,
        ...override,
      });
      expect(response.status, label).toBe(404);
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'catalog.fashion-staging.reset'",
        ).first(),
        label,
      ).toEqual({ count: 0 });
    }
    expect((await app.fetch(request("x".repeat(40)), bindings)).status).toBe(401);
    expect((await app.fetch(request(bindings.FASHION_CATALOG_RESET_TOKEN), bindings)).status).toBe(
      201,
    );
    expect((await app.fetch(request(bindings.FASHION_CATALOG_RESET_TOKEN), bindings)).status).toBe(
      201,
    );
    const sharedCredentialStillWorks = await app.fetch(
      new Request(
        "https://api.example.test/internal/testing/fashion-staging/catalog-migration/preflight",
        { headers: { Authorization: `Bearer ${bindings.FASHION_ACCEPTANCE_TOKEN}` } },
      ),
      bindings,
    );
    expect(sharedCredentialStillWorks.status).toBe(200);
  });

  test("returns only missing reviewed media and rejects unexpected or conflicting prefix objects", async () => {
    const value = await input();
    const existing = await env.MEDIA.list({ prefix: `${value.catalog.r2Prefix}/` });
    if (existing.objects.length > 0) {
      await env.MEDIA.delete(existing.objects.map(({ key }) => key));
    }
    const app = createApp({
      fashionCatalogResetReviewedPayloadDigest:
        await fashionStagingCatalogReviewedPayloadDigest(value),
    });
    const bindings = {
      ...env,
      CLOUDFLARE_ACCOUNT_ID: FASHION_STAGING_CATALOG_RESET_TARGET.cloudflareAccountId,
      D1_DATABASE_ID: FASHION_STAGING_CATALOG_RESET_TARGET.d1DatabaseId,
      D1_DATABASE_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.d1DatabaseName,
      FASHION_ACCEPTANCE_TOKEN: "a".repeat(40),
      FASHION_CATALOG_RESET_ENABLED: "true",
      FASHION_CATALOG_RESET_TOKEN: "r".repeat(40),
      MEDIA_BUCKET_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.r2BucketName,
      MEDIA_PUBLIC_ORIGIN: FASHION_STAGING_CATALOG_RESET_TARGET.mediaOrigin,
      RESOURCE_NAMESPACE: "shoppp-fashion-staging",
      WORKER_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.workerName,
    };
    const request = () =>
      new Request(
        "https://api.example.test/internal/testing/fashion-staging/catalog-reset/media-preflight",
        {
          body: JSON.stringify(value),
          headers: {
            Authorization: `Bearer ${bindings.FASHION_ACCEPTANCE_TOKEN}`,
            "Content-Type": "application/json",
            "X-Fashion-Catalog-Reset-Token": bindings.FASHION_CATALOG_RESET_TOKEN,
          },
          method: "POST",
        },
      );
    const media = value.catalog.products.flatMap((product) => product.media);
    const empty = await app.fetch(request(), bindings);
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({
      data: { missingKeys: media.map(({ r2Key }) => r2Key).sort(), presentKeys: [] },
    });

    const first = media[0]!;
    await env.MEDIA.put(first.r2Key, new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: first.mimeType },
    });
    const repairForward = await app.fetch(request(), bindings);
    expect(repairForward.status).toBe(200);
    expect(await repairForward.json()).toMatchObject({
      data: {
        missingKeys: media
          .slice(1)
          .map(({ r2Key }) => r2Key)
          .sort(),
        presentKeys: [first.r2Key],
      },
    });

    await env.MEDIA.put(`${value.catalog.r2Prefix}/unexpected.jpg`, new Uint8Array([1]));
    expect((await app.fetch(request(), bindings)).status).toBe(500);
    await env.MEDIA.delete(`${value.catalog.r2Prefix}/unexpected.jpg`);
    await env.MEDIA.put(first.r2Key, new Uint8Array([9]), {
      customMetadata: { sha256: first.sha256 },
      httpMetadata: { contentType: first.mimeType },
    });
    expect((await app.fetch(request(), bindings)).status).toBe(500);
    await env.MEDIA.put(first.r2Key, new Uint8Array([1, 2, 3]), {
      customMetadata: { sha256: "f".repeat(64) },
      httpMetadata: { contentType: first.mimeType },
    });
    expect((await app.fetch(request(), bindings)).status).toBe(500);
  });

  test("blocks ordinary shopper and admin routes for the entire enabled reset window", async () => {
    const app = createApp();
    const bindings = {
      ...env,
      FASHION_CATALOG_RESET_ENABLED: "true",
    };
    const cart = await app.fetch(
      new Request("https://api.example.test/cart", { method: "POST" }),
      bindings,
    );
    const admin = await app.fetch(
      new Request("https://api.example.test/admin/catalog/products", { method: "POST" }),
      bindings,
    );
    expect(cart.status).toBe(503);
    expect(admin.status).toBe(503);
    expect((await app.fetch(new Request("https://api.example.test/health"), bindings)).status).toBe(
      200,
    );
  });

  test("prepares and completes one exact private shopper artifact after the reset", async () => {
    await seedServiceAdmin(env.DB, { id: "identity-fashion-catalog-activation" });
    const value = await input();
    await putMedia(value);
    await env.DB.prepare(
      "DELETE FROM audit_events WHERE action = 'catalog.fashion-staging.reset'",
    ).run();
    await resetFashionStagingCatalog(
      env.DB,
      env.MEDIA,
      value,
      "activation-reset",
      new Date("2026-09-14T00:00:00.000Z"),
      await fashionStagingCatalogReviewedPayloadDigest(value),
    );
    const prepared = await prepareFashionStagingCatalogActivation(
      env.DB,
      "activation-prepare",
      new Date("2026-09-14T00:01:00.000Z"),
    );
    expect(prepared).toMatchObject({
      buildInput: {
        catalogRelease: { releaseId: value.shopperRelease.releaseId },
        environment: "preview",
        expectedOrigin: "https://shoppp-storefront-fashion-preview.hashencode.workers.dev",
        inputIdentity: {
          catalogReleaseId: value.shopperRelease.releaseId,
          experienceSnapshotId: prepared.snapshotId,
          themeId: "fashion-store",
        },
        presentationMode: "live",
        themeId: "fashion-store",
      },
      shopperReleaseId: value.shopperRelease.releaseId,
    });
    expect(
      await env.DB.prepare("SELECT status FROM catalog_releases WHERE id = ?")
        .bind(value.shopperRelease.releaseId)
        .first(),
    ).toEqual({ status: "deployed" });
    expect(
      await env.DB.prepare("SELECT status FROM storefront_preview_builds WHERE id = ?")
        .bind(prepared.buildId)
        .first(),
    ).toEqual({ status: "building" });

    const bindings = {
      ...env,
      CLOUDFLARE_ACCOUNT_ID: FASHION_STAGING_CATALOG_RESET_TARGET.cloudflareAccountId,
      D1_DATABASE_ID: FASHION_STAGING_CATALOG_RESET_TARGET.d1DatabaseId,
      D1_DATABASE_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.d1DatabaseName,
      FASHION_ACCEPTANCE_TOKEN: "a".repeat(40),
      FASHION_CATALOG_RESET_ENABLED: "true",
      FASHION_CATALOG_RESET_TOKEN: "r".repeat(40),
      MEDIA_BUCKET_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.r2BucketName,
      MEDIA_PUBLIC_ORIGIN: FASHION_STAGING_CATALOG_RESET_TARGET.mediaOrigin,
      RESOURCE_NAMESPACE: "shoppp-fashion-staging",
      WORKER_NAME: FASHION_STAGING_CATALOG_RESET_TARGET.workerName,
    };
    const app = createApp();
    const resetHeaders = {
      Authorization: `Bearer ${bindings.FASHION_ACCEPTANCE_TOKEN}`,
      "X-Fashion-Catalog-Reset-Token": bindings.FASHION_CATALOG_RESET_TOKEN,
    };
    const conservativePreflight = await app.fetch(
      new Request(
        "https://api.example.test/internal/testing/fashion-staging/catalog-migration/preflight",
        { headers: { Authorization: resetHeaders.Authorization } },
      ),
      bindings,
    );
    expect(await conservativePreflight.json()).toMatchObject({ data: { activeWorkCount: 1 } });
    const resumablePreflight = await app.fetch(
      new Request(
        "https://api.example.test/internal/testing/fashion-staging/catalog-reset/preflight",
        { headers: resetHeaders },
      ),
      bindings,
    );
    expect(resumablePreflight.status).toBe(200);
    expect(await resumablePreflight.json()).toMatchObject({
      data: {
        activeWorkCount: 0,
        resetClosed: false,
        resumableActivation: {
          activeBuildId: prepared.buildId,
          catalogVersion: value.catalog.catalogVersion,
          manifestDigest: value.manifestDigest,
          shopperReleaseId: value.shopperRelease.releaseId,
        },
      },
    });
    const resumedPreparation = await app.fetch(
      new Request(
        "https://api.example.test/internal/testing/fashion-staging/catalog-activation/prepare",
        { headers: resetHeaders, method: "POST" },
      ),
      bindings,
    );
    expect(resumedPreparation.status).toBe(201);
    expect(await resumedPreparation.json()).toMatchObject({ data: prepared });
    const artifactDigest = "d".repeat(64);
    const artifactPrefix = `snapshots/${prepared.snapshotId}/${prepared.shopperReleaseId}/${artifactDigest}`;
    const completionRequest = (resetToken: string) =>
      new Request(
        `https://api.example.test/internal/testing/fashion-staging/catalog-activation/${prepared.buildId}/complete`,
        {
          body: JSON.stringify({
            artifactDigest,
            artifactPrefix,
            expiresAt: "2030-09-15T00:00:00.000Z",
            status: "deployed",
          }),
          headers: {
            Authorization: `Bearer ${bindings.FASHION_ACCEPTANCE_TOKEN}`,
            "Content-Type": "application/json",
            "X-Fashion-Catalog-Reset-Token": resetToken,
          },
          method: "POST",
        },
      );
    expect((await app.fetch(completionRequest("x".repeat(40)), bindings)).status).toBe(401);
    const completed = await app.fetch(
      completionRequest(bindings.FASHION_CATALOG_RESET_TOKEN),
      bindings,
    );
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({
      data: { artifactDigest, artifactPrefix, id: prepared.buildId, status: "deployed" },
    });
    const retry = await app.fetch(
      completionRequest(bindings.FASHION_CATALOG_RESET_TOKEN),
      bindings,
    );
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({
      data: { artifactDigest, artifactPrefix, id: prepared.buildId, status: "deployed" },
    });
    const terminalPreflight = await app.fetch(
      new Request(
        "https://api.example.test/internal/testing/fashion-staging/catalog-reset/preflight",
        {
          headers: {
            Authorization: `Bearer ${bindings.FASHION_ACCEPTANCE_TOKEN}`,
            "X-Fashion-Catalog-Reset-Token": bindings.FASHION_CATALOG_RESET_TOKEN,
          },
        },
      ),
      bindings,
    );
    expect(terminalPreflight.status).toBe(200);
    expect(await terminalPreflight.json()).toMatchObject({
      data: {
        resetClosed: true,
        terminalActivation: {
          activeArtifactDigest: artifactDigest,
          activeArtifactPrefix: artifactPrefix,
          activeBuildId: prepared.buildId,
          catalogVersion: value.catalog.catalogVersion,
          manifestDigest: value.manifestDigest,
          shopperReleaseId: value.shopperRelease.releaseId,
        },
      },
    });
    expect(
      await verifyFashionStagingCatalog(env.DB, env.MEDIA, value.catalog.catalogVersion),
    ).toMatchObject({
      activeArtifactDigest: artifactDigest,
      activeArtifactPrefix: artifactPrefix,
      activeBuildId: prepared.buildId,
    });
    expect(
      await app.fetch(completionRequest(bindings.FASHION_CATALOG_RESET_TOKEN), bindings),
    ).toHaveProperty("status", 200);
    const resetAfterActivation = await app.fetch(
      new Request("https://api.example.test/internal/testing/fashion-staging/catalog-reset", {
        body: JSON.stringify(value),
        headers: {
          Authorization: `Bearer ${bindings.FASHION_ACCEPTANCE_TOKEN}`,
          "Content-Type": "application/json",
          "X-Fashion-Catalog-Reset-Token": bindings.FASHION_CATALOG_RESET_TOKEN,
        },
        method: "POST",
      }),
      bindings,
    );
    expect(resetAfterActivation.status).toBe(410);
  });
});
