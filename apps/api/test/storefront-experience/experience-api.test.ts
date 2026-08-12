import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import {
  canonicalCatalogReleaseSchema,
  storefrontExperienceDraftInputSchema,
  themePackageSchema,
} from "@shoppp/contracts";

import fashionStoreFixture from "../../../storefront/fixtures/experience/fashion-store.json";
import releaseFixture from "../../../storefront/fixtures/release.json";
import { fashionStoreManifest } from "../../../storefront/app/themes/fashion-store/manifest";
import { fashionStorePreset } from "../../../storefront/app/themes/fashion-store/presets/source-parity";
import { createApp } from "../../src/http/app";
import { redactForLog } from "../../src/security/redaction";
import { cleanupExpiredStorefrontPreviews } from "../../src/storefront-experience/cleanup";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

async function seedOperator(role = "admin", subject = "theme-admin"): Promise<void> {
  const roleId = role === "admin" ? ADMIN_ROLE_IDS.admin : ADMIN_ROLE_IDS.support;
  await seedHumanAdmin(env.DB, {
    displayName: subject,
    email: `${subject}@example.test`,
    id: `admin-${subject}`,
    roleId,
    subject,
  });
}

function appFor(subject = "theme-admin") {
  return createApp({
    testIdentityVerifier: async () => ({
      email: `${subject}@example.test`,
      principalKind: "human",
      subject,
    }),
  });
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "X-Test-Admin-Identity": "test-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...init.headers,
    },
  });
}

function writeRequest(
  path: string,
  body: unknown,
  idempotencyKey: string,
  method = "POST",
): Request {
  return request(path, {
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": idempotencyKey },
    method,
  });
}

const draftInput = storefrontExperienceDraftInputSchema.parse({
  bindings: fashionStoreFixture.bindings,
  experienceId: "experience-api-fixture",
  overrides: [],
  presetId: "source-parity",
  themeId: "fashion-store",
  themeVersion: "1.0.0",
});

const productIds = new Map(
  releaseFixture.products.map((product, index) => [
    product.slug,
    `prod_01JPREVIEWPRODUCT${String(index + 1).padStart(8, "0")}`,
  ]),
);
const collectionIds = new Map(
  releaseFixture.collections.map((collection, index) => [
    collection.slug,
    `col_01JPREVIEWCOLLECT${String(index + 1).padStart(8, "0")}`,
  ]),
);
const previewCatalogRelease = canonicalCatalogReleaseSchema.parse({
  ...releaseFixture,
  collections: releaseFixture.collections.map((collection) => ({
    ...collection,
    id: collectionIds.get(collection.slug),
    productIds: collection.productSlugs.map((slug) => productIds.get(slug)),
  })),
  generatedAt: "2026-08-11T00:00:00.000Z",
  products: releaseFixture.products.map((product) => ({
    ...product,
    collectionIds: product.collectionSlugs.map((slug) => collectionIds.get(slug)),
    id: productIds.get(product.slug),
  })),
  redirects: releaseFixture.redirects.map((redirect) => ({ ...redirect, status: 301 })),
  routes: [
    "/",
    ...releaseFixture.collections.map(({ slug }) => `/collections/${slug}`),
    ...releaseFixture.policies.map(({ slug }) => `/policies/${slug}`),
    ...releaseFixture.products.map(({ slug }) => `/products/${slug}`),
  ],
  schemaVersion: 2,
});

async function seedPreviewCatalogRelease(id = previewCatalogRelease.releaseId): Promise<void> {
  const now = "2026-08-11T00:00:00.000Z";
  await env.DB.prepare(
    `INSERT INTO catalog_releases
       (id, status, manifest_json, approved_at, deployed_at, created_at, updated_at)
     VALUES (?, 'deployed', ?, ?, ?, ?, ?)`,
  )
    .bind(id, JSON.stringify({ ...previewCatalogRelease, releaseId: id }), now, now, now, now)
    .run();
}

async function seedLegacyPreviewCatalogRelease(id: string): Promise<void> {
  const now = "2026-08-11T00:00:00.000Z";
  await env.DB.prepare(
    `INSERT INTO catalog_releases
       (id, status, manifest_json, approved_at, created_at, updated_at)
     VALUES (?, 'approved', ?, ?, ?, ?)`,
  )
    .bind(id, JSON.stringify({ ...releaseFixture, releaseId: id }), now, now, now)
    .run();
}

async function createDraft(
  app: ReturnType<typeof appFor>,
  idempotencyKey: string,
  input: typeof draftInput = draftInput,
) {
  const response = await app.fetch(
    writeRequest(
      "/admin/storefront-experiences/drafts",
      { draft: input, reason: "Create a fixture-backed theme draft" },
      idempotencyKey,
    ),
    env,
  );
  const body = await response.json<{
    data: { id: string; validation: unknown; version: number };
  }>();
  return { body, response };
}

async function validateDraft(
  app: ReturnType<typeof appFor>,
  draftId: string,
  version: number,
  key: string,
) {
  return app.fetch(
    writeRequest(
      `/admin/storefront-experiences/drafts/${draftId}/validate`,
      { expectedVersion: version, reason: "Validate the exact draft version" },
      key,
    ),
    env,
  );
}

describe("storefront experience API", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM storefront_preview_sessions"),
      env.DB.prepare("DELETE FROM storefront_preview_grants"),
      env.DB.prepare("DELETE FROM storefront_preview_builds"),
      env.DB.prepare("DELETE FROM idempotency_claims"),
      env.DB.prepare("DELETE FROM audit_events"),
    ]);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at)
       VALUES ('role_admin', 'catalog.read', '2026-08-04T00:00:00.000Z')`,
    ).run();
    await seedOperator();
  });

  test("lists the source-controlled theme catalog for authorized operators", async () => {
    const response = await appFor().fetch(request("/admin/storefront-experiences/themes"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [
        {
          fixtureBindings: expect.any(Array),
          id: "decor",
          presetDefinitions: expect.any(Array),
          themeVersion: "1.0.0",
        },
        {
          fixtureBindings: expect.any(Array),
          id: "fashion",
          presetDefinitions: expect.any(Array),
          themeVersion: "1.0.0",
        },
        {
          fixtureBindings: expect.any(Array),
          id: "fashion-store",
          presetDefinitions: expect.any(Array),
          themeVersion: "1.0.0",
        },
      ],
    });
  });

  test("discovers only deployed canonical catalog inputs and approved media", async () => {
    const releaseId = "release-editor-canonical";
    await seedPreviewCatalogRelease(releaseId);
    await env.DB.prepare(
      "UPDATE catalog_releases SET status = 'deployed', deployed_at = ? WHERE id = ?",
    )
      .bind("2026-08-11T01:00:00.000Z", releaseId)
      .run();
    await seedLegacyPreviewCatalogRelease("release-editor-legacy");
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO products
           (id, slug, name, description, status, seo_title, seo_description,
            published_at, created_at, updated_at)
         VALUES ('product-editor-media', 'editor-media', 'Editor media', '', 'published', '', '',
                 '2026-08-11T00:00:00.000Z', '2026-08-11T00:00:00.000Z',
                 '2026-08-11T00:00:00.000Z')
         ON CONFLICT(id) DO NOTHING`,
      ),
      env.DB.prepare(
        `INSERT INTO product_media
           (id, product_id, variant_id, r2_key, alt_text, width, height, position, created_at)
         VALUES ('media-editor', 'product-editor-media', NULL, 'catalog/editor.webp',
                 'Editor approved image', 800, 600, 0, '2026-08-11T00:00:00.000Z')
         ON CONFLICT(id) DO NOTHING`,
      ),
    ]);

    const app = appFor();
    const releases = await app.fetch(
      request("/admin/storefront-experiences/catalog-releases"),
      env,
    );
    expect(releases.status).toBe(200);
    expect(await releases.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          environment: "staging",
          id: releaseId,
          products: expect.arrayContaining([
            expect.objectContaining({ id: expect.stringMatching(/^prod_/) }),
          ]),
          status: "deployed",
        }),
      ]),
    });

    const media = await app.fetch(
      request("/admin/storefront-experiences/media?query=approved"),
      env,
    );
    expect(media.status).toBe(200);
    expect(await media.json()).toMatchObject({
      data: [
        {
          alt: "Editor approved image",
          height: 600,
          key: "catalog/editor.webp",
          kind: "catalog",
          productName: "Editor media",
          width: 800,
        },
      ],
    });
  });

  test("requires catalog read permission for release discovery, direct preview, and grants", async () => {
    await seedPreviewCatalogRelease("release-permission-parity");
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async () => ({ correlationId: "permission-parity-preview" }),
    });
    const created = await createDraft(app, "theme-permission-create-0001");
    await validateDraft(app, created.body.data.id, 1, "theme-permission-validate-0001");
    const initialPreview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
        {
          catalogReleaseId: "release-permission-parity",
          expectedVersion: 1,
          reason: "Create an authorized preview before narrowing the role",
        },
        "theme-permission-preview-authorized-1",
      ),
      env,
    );
    expect(initialPreview.status).toBe(202);
    const preview = await initialPreview.json<{ data: { snapshot: { id: string } } }>();

    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = 'role_admin' AND permission_key = 'catalog.read'",
    ).run();
    try {
      expect(
        (await app.fetch(request("/admin/storefront-experiences/catalog-releases"), env)).status,
      ).toBe(403);

      const directPreview = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
          {
            catalogReleaseId: "release-permission-parity",
            expectedVersion: 1,
            reason: "Reject direct release input without Catalog access",
          },
          "theme-permission-preview-denied-0001",
        ),
        env,
      );
      expect(directPreview.status).toBe(403);

      const grant = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/snapshots/${preview.data.snapshot.id}/grants`,
          {
            catalogReleaseId: "release-permission-parity",
            origin: env.PREVIEW_ORIGIN,
            reason: "Reject grant release input without Catalog access",
          },
          "theme-permission-grant-denied-0001",
        ),
        env,
      );
      expect(grant.status).toBe(403);
    } finally {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_admin', 'catalog.read', '2026-08-04T00:00:00.000Z')`,
      ).run();
    }
  });

  test("persists catalog references as stable identifiers and validates declared fields", async () => {
    const collectionId = previewCatalogRelease.collections[0]!.id;
    const productId = previewCatalogRelease.products[0]!.id;
    const bindings = [
      ...draftInput.bindings,
      {
        id: "catalog-fashion-store-home-featured-collection",
        instanceId: "fashion-store-home",
        kind: "catalog" as const,
        reference: { id: collectionId, kind: "collection" as const },
        settingId: "featured-collection",
      },
      {
        id: "catalog-fashion-store-collection-featured-collection",
        instanceId: "fashion-store-collection",
        kind: "catalog" as const,
        reference: { id: collectionId, kind: "collection" as const },
        settingId: "featured-collection",
      },
      {
        id: "catalog-fashion-store-product-featured-product",
        instanceId: "fashion-store-product",
        kind: "catalog" as const,
        reference: { id: productId, kind: "product" as const },
        settingId: "featured-product",
      },
    ];
    const app = appFor();
    const created = await createDraft(app, "theme-catalog-reference-create-0001", {
      ...draftInput,
      bindings,
    });
    expect(created.response.status).toBe(201);
    const validation = await validateDraft(
      app,
      created.body.data.id,
      1,
      "theme-catalog-reference-validate-0001",
    );
    expect(await validation.json()).toMatchObject({
      data: { issues: [], status: "valid" },
    });
    const persisted = await (
      await app.fetch(request(`/admin/storefront-experiences/drafts/${created.body.data.id}`), env)
    ).json<{ data: { bindings: unknown[] } }>();
    expect(persisted.data.bindings).toContainEqual({
      id: "catalog-fashion-store-product-featured-product",
      instanceId: "fashion-store-product",
      kind: "catalog",
      reference: { id: productId, kind: "product" },
      settingId: "featured-product",
    });
    expect(JSON.stringify(persisted.data.bindings)).not.toContain("price");
    expect(JSON.stringify(persisted.data.bindings)).not.toContain("sku");
  });

  test("creates, reads, updates, validates, and idempotently replays an optimistic draft", async () => {
    const app = appFor();
    const created = await createDraft(app, "theme-draft-create-0001");
    expect(created.response.status).toBe(201);
    expect(created.body.data).toMatchObject({ validation: null, version: 1 });

    const replay = await createDraft(app, "theme-draft-create-0001");
    expect(replay.response.status).toBe(201);
    expect(replay.body.data.id).toBe(created.body.data.id);

    const draftId = created.body.data.id;
    expect(
      await (await app.fetch(request("/admin/storefront-experiences/drafts"), env)).json(),
    ).toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: draftId })]),
    });
    const override = {
      operations: [{ instanceId: "fashion-store-home", kind: "set-visibility", visible: true }],
      presetId: "source-parity",
      schemaVersion: 1,
      templateId: "fashion-store-home",
    };
    const updateBody = {
      bindings: fashionStoreFixture.bindings,
      expectedVersion: 1,
      overrides: [override],
      reason: "Hide one optional section and retain preset reset intent",
    };
    const updated = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        updateBody,
        "theme-draft-update-0001",
        "PUT",
      ),
      env,
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      data: { id: draftId, overrides: [override], version: 2 },
    });
    const updateReplay = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        updateBody,
        "theme-draft-update-0001",
        "PUT",
      ),
      env,
    );
    expect(updateReplay.status).toBe(200);
    expect(await updateReplay.json()).toMatchObject({ data: { version: 2 } });

    const stale = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        { ...updateBody, reason: "Attempt a stale conflicting update" },
        "theme-draft-update-stale-0001",
        "PUT",
      ),
      env,
    );
    expect(stale.status).toBe(409);

    const validation = await validateDraft(app, draftId, 2, "theme-draft-validate-0001");
    expect(validation.status).toBe(200);
    expect(await validation.json()).toMatchObject({
      data: { draftVersion: 2, issues: [], status: "valid" },
    });
    const read = await app.fetch(request(`/admin/storefront-experiences/drafts/${draftId}`), env);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      data: { id: draftId, validation: { draftVersion: 2, status: "valid" }, version: 2 },
    });
  });

  test("rejects unauthorized access, unavailable packages, unsafe settings, and missing capabilities", async () => {
    await seedOperator("support", "theme-support");
    expect(
      (await appFor("theme-support").fetch(request("/admin/storefront-experiences/themes"), env))
        .status,
    ).toBe(403);
    expect(
      (
        await appFor("theme-support").fetch(
          writeRequest(
            "/admin/storefront-experiences/drafts",
            {
              draft: draftInput,
              reason: "Attempt an unauthorized draft write",
            },
            "theme-unauthorized-write-0001",
          ),
          env,
        )
      ).status,
    ).toBe(403);

    const app = appFor();
    const unavailable = await app.fetch(
      writeRequest(
        "/admin/storefront-experiences/drafts",
        {
          draft: { ...draftInput, themeVersion: "9.0.0" },
          reason: "Attempt an unavailable theme package",
        },
        "theme-invalid-package-0001",
      ),
      env,
    );
    expect(unavailable.status).toBe(422);

    const unsafe = await app.fetch(
      writeRequest(
        "/admin/storefront-experiences/drafts",
        {
          draft: {
            ...draftInput,
            overrides: [
              {
                operations: [
                  {
                    instanceId: "fashion-store-home",
                    kind: "set-setting",
                    settingId: "heading",
                    value: "<script>alert(1)</script>",
                  },
                ],
                presetId: "source-parity",
                schemaVersion: 1,
                templateId: "fashion-store-home",
              },
            ],
          },
          reason: "Attempt unsafe arbitrary markup",
        },
        "theme-unsafe-schema-0001",
      ),
      env,
    );
    expect(unsafe.status).toBe(422);

    const wrongSettingType = await createDraft(app, "theme-setting-type-create-0001", {
      ...draftInput,
      overrides: [
        {
          operations: [
            {
              instanceId: "fashion-store-home",
              kind: "set-setting",
              settingId: "heading",
              value: 42,
            },
          ],
          presetId: "source-parity",
          schemaVersion: 1,
          templateId: "fashion-store-home",
        },
      ],
    });
    expect(wrongSettingType.response.status).toBe(201);
    const wrongSettingValidation = await validateDraft(
      app,
      wrongSettingType.body.data.id,
      1,
      "theme-setting-type-validate-0001",
    );
    expect(await wrongSettingValidation.json()).toMatchObject({
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "resolved_template_invalid" }),
        ]),
        status: "invalid",
      },
    });

    const invalid = await createDraft(app, "theme-required-create-0001", {
      ...draftInput,
      overrides: [
        {
          operations: [{ instanceId: "product-main", kind: "set-visibility", visible: false }],
          presetId: "source-parity",
          schemaVersion: 1,
          templateId: "fashion-product",
        },
      ],
    });
    expect(invalid.response.status).toBe(201);
    const validation = await validateDraft(
      app,
      invalid.body.data.id,
      1,
      "theme-required-validate-0001",
    );
    expect(await validation.json()).toMatchObject({
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "unknown_template_override" }),
        ]),
        status: "invalid",
      },
    });
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${invalid.body.data.id}/preview`,
        { expectedVersion: 1, reason: "Attempt to preview an invalid draft" },
        "theme-required-preview-0001",
      ),
      env,
    );
    expect(preview.status).toBe(409);
    expect(
      (
        await appFor("theme-support").fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${invalid.body.data.id}/approve`,
            {
              confirm: true,
              expectedVersion: 1,
              reason: "Attempt an unauthorized approval",
            },
            "theme-unauthorized-approval-0001",
          ),
          env,
        )
      ).status,
    ).toBe(403);
  });

  test("binds validation to one version and resolves preview without approving production", async () => {
    const triggerCalls: unknown[] = [];
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async (input) => {
        triggerCalls.push(input);
        return { correlationId: "preview-build-correlation-1" };
      },
    });
    const created = await createDraft(app, "theme-preview-create-0001");
    const draftId = created.body.data.id;
    expect((await validateDraft(app, draftId, 1, "theme-preview-validate-0001")).status).toBe(200);
    const updated = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        {
          bindings: fashionStoreFixture.bindings,
          expectedVersion: 1,
          overrides: [],
          reason: "Advance the draft after its first validation",
        },
        "theme-preview-update-0001",
        "PUT",
      ),
      env,
    );
    expect(updated.status).toBe(200);
    expect(
      (
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${draftId}/preview`,
            { expectedVersion: 2, reason: "Reject stale validation" },
            "theme-preview-stale-0001",
          ),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${draftId}/approve`,
            {
              confirm: true,
              expectedVersion: 2,
              reason: "Reject approval against stale validation",
            },
            "theme-approval-stale-0001",
          ),
          env,
        )
      ).status,
    ).toBe(409);
    await validateDraft(app, draftId, 2, "theme-preview-validate-0002");
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/preview`,
        { expectedVersion: 2, reason: "Resolve an isolated fixture preview" },
        "theme-preview-resolve-0001",
      ),
      env,
    );
    expect(preview.status).toBe(202);
    const value = await preview.json<{
      data: {
        build: { status: string };
        snapshot: { approvedAt: string | null; id: string; kind: string };
      };
    }>();
    expect(value.data).toMatchObject({
      build: { status: "building" },
      snapshot: { approvedAt: null, kind: "preview" },
    });
    expect(triggerCalls).toHaveLength(1);
    expect(
      await env.DB.prepare(
        "SELECT approved_at, kind FROM storefront_experience_snapshots WHERE id = ?",
      )
        .bind(value.data.snapshot.id)
        .first(),
    ).toEqual({ approved_at: null, kind: "preview" });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM catalog_releases WHERE id = ?")
        .bind(value.data.snapshot.id)
        .first(),
    ).toEqual({ count: 0 });
  });

  test("reconciles concurrent identical approvals into one immutable snapshot and audit", async () => {
    const app = appFor();
    const created = await createDraft(app, "theme-approval-create-0001");
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-approval-validate-0001");
    const approve = (key: string) =>
      app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/approve`,
          { confirm: true, expectedVersion: 1, reason: "Approve a reproducible experience" },
          key,
        ),
        env,
      );
    const responses = await Promise.all([
      approve("theme-approval-concurrent-0001"),
      approve("theme-approval-concurrent-0002"),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    const snapshots = await Promise.all(
      responses.map((response) => response.json<{ data: { id: string; kind: string } }>()),
    );
    expect(new Set(snapshots.map(({ data }) => data.id)).size).toBe(1);
    const snapshotId = snapshots[0]!.data.id;
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM storefront_experience_snapshots WHERE source_draft_id = ? AND kind = 'approved'",
        )
          .bind(draftId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'themes.experience.approve' AND target_id = ?",
        )
          .bind(snapshotId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    await expect(
      env.DB.prepare("UPDATE storefront_experience_snapshots SET snapshot_json = '{}' WHERE id = ?")
        .bind(snapshotId)
        .run(),
    ).rejects.toThrow("immutable_storefront_experience_snapshot");
  });

  test("dry-runs an explicit schema migration, reports stable-ID conflicts, and preserves older snapshots", async () => {
    const sourcePackage = themePackageSchema.parse({
      manifest: fashionStoreManifest,
      presets: [fashionStorePreset],
    });
    const targetPackage = themePackageSchema.parse({
      manifest: {
        ...fashionStoreManifest,
        configurationSchemaVersion: 2,
        themeVersion: "1.1.0",
      },
      presets: [fashionStorePreset],
    });
    const conflictingPackage = themePackageSchema.parse({
      manifest: {
        ...fashionStoreManifest,
        configurationSchemaVersion: 2,
        themeVersion: "1.2.0",
      },
      presets: [
        {
          ...fashionStorePreset,
          templates: fashionStorePreset.templates.map((template) =>
            template.id === "fashion-store-home"
              ? {
                  ...template,
                  sections: template.sections.filter(({ id }) => id !== "fashion-store-home"),
                }
              : template,
          ),
        },
      ],
    });
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      storefrontExperienceServiceOptions: {
        migrations: [
          {
            fromConfigurationSchemaVersion: 1,
            migrate: (overrides) =>
              overrides.map((override) => ({ ...override, schemaVersion: 2 })),
            themeId: "fashion-store",
            toConfigurationSchemaVersion: 2,
          },
        ],
        packages: [sourcePackage, targetPackage, conflictingPackage],
      },
    });
    const created = await createDraft(app, "theme-migration-create-0001", {
      ...draftInput,
      overrides: [
        {
          operations: [
            {
              instanceId: "fashion-store-home",
              kind: "set-visibility",
              visible: true,
            },
          ],
          presetId: "source-parity",
          schemaVersion: 1,
          templateId: "fashion-store-home",
        },
      ],
    });
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-migration-validate-0001");
    const originalApproval = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Preserve the original version" },
        "theme-migration-original-approval-0001",
      ),
      env,
    );
    const original = await originalApproval.json<{ data: { id: string } }>();

    const dryRun = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "Dry-run the compatible configuration migration",
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: "1.1.0",
        },
        "theme-migration-dry-run-0001",
      ),
      env,
    );
    expect(dryRun.status).toBe(200);
    const migration = await dryRun.json<{
      data: { conflicts: unknown[]; id: string; status: string };
    }>();
    expect(migration.data).toMatchObject({ conflicts: [], status: "dry_run" });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM storefront_experience_snapshots WHERE migration_id = ?",
        )
          .bind(migration.data.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);

    const migratedApproval = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          migrationId: migration.data.id,
          reason: "Explicitly approve the compatible migration",
        },
        "theme-migration-approve-0001",
      ),
      env,
    );
    expect(migratedApproval.status).toBe(200);
    expect(await migratedApproval.json()).toMatchObject({
      data: {
        configurationSchemaVersion: 2,
        snapshot: {
          configurationSchemaVersion: 2,
          themeVersion: "1.1.0",
        },
        themeVersion: "1.1.0",
      },
    });
    expect(
      await env.DB.prepare(
        "SELECT id, theme_version FROM storefront_experience_snapshots WHERE id = ?",
      )
        .bind(original.data.id)
        .first(),
    ).toEqual({ id: original.data.id, theme_version: "1.0.0" });

    const conflict = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "Detect a removed stable instance",
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: "1.2.0",
        },
        "theme-migration-conflict-0001",
      ),
      env,
    );
    expect(await conflict.json()).toMatchObject({
      data: {
        conflicts: expect.arrayContaining([
          expect.objectContaining({ code: "instance-removed", instanceId: "fashion-store-home" }),
        ]),
      },
    });
  });

  test("authenticates idempotent build callbacks, exposes retries, and retains the first valid artifact", async () => {
    const triggerCalls: Array<{ buildId: string; snapshotId: string }> = [];
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async (input) => {
        triggerCalls.push({ buildId: input.buildId, snapshotId: input.snapshotId });
        return { correlationId: `correlation-${triggerCalls.length}` };
      },
    });
    const created = await createDraft(app, "theme-build-create-0001");
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-build-validate-0001");
    const previewRequest = (key: string) =>
      app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/preview`,
          { expectedVersion: 1, reason: "Build the immutable fixture preview" },
          key,
        ),
        env,
      );
    const firstPreview = await previewRequest("theme-build-preview-0001");
    const first = await firstPreview.json<{
      data: { build: { id: string }; snapshot: { id: string } };
    }>();
    expect(triggerCalls).toHaveLength(1);

    expect(
      (
        await app.fetch(
          request(`/build/storefront-experiences/snapshots/${first.data.snapshot.id}`),
          env,
        )
      ).status,
    ).toBe(401);
    const manifest = await app.fetch(
      request(`/build/storefront-experiences/snapshots/${first.data.snapshot.id}`, {
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
        },
      }),
      env,
    );
    expect(manifest.status).toBe(200);
    expect(await manifest.json()).toMatchObject({
      environment: "preview",
      snapshot: {
        approvedAt: null,
        approvedBy: null,
        id: first.data.snapshot.id,
        kind: "preview",
      },
      themeId: "fashion-store",
    });

    const failed = await app.fetch(
      request(`/build/storefront-experiences/builds/${first.data.build.id}/status`, {
        body: JSON.stringify({ failureCode: "preview.build-failed", status: "failed" }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "theme-build-result-failed-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(failed.status).toBe(200);
    expect(await failed.json()).toMatchObject({ data: { status: "failed" } });
    expect(
      await (
        await app.fetch(request(`/admin/storefront-experiences/builds/${first.data.build.id}`), env)
      ).json(),
    ).toMatchObject({
      data: {
        failureCode: "preview.build-failed",
        status: "failed",
      },
    });

    const retryPreview = await previewRequest("theme-build-preview-0002");
    const retry = await retryPreview.json<{
      data: { build: { attempt: number; id: string }; snapshot: { id: string } };
    }>();
    expect(retry.data.snapshot.id).toBe(first.data.snapshot.id);
    expect(retry.data.build.attempt).toBe(2);
    expect(triggerCalls).toHaveLength(2);

    const digest = "a".repeat(64);
    const deployedPayload = {
      artifactDigest: digest,
      artifactPrefix: `snapshots/${retry.data.snapshot.id}/${digest}`,
      expiresAt: "2099-07-30T00:00:00.000Z",
      status: "deployed",
    };
    const deployedRequest = () =>
      app.fetch(
        request(`/build/storefront-experiences/builds/${retry.data.build.id}/status`, {
          body: JSON.stringify(deployedPayload),
          headers: {
            Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
            "Content-Type": "application/json",
            "Idempotency-Key": "theme-build-result-deployed-0001",
          },
          method: "POST",
        }),
        env,
      );
    expect((await deployedRequest()).status).toBe(200);
    expect((await deployedRequest()).status).toBe(200);
    const conflictingResult = await app.fetch(
      request(`/build/storefront-experiences/builds/${retry.data.build.id}/status`, {
        body: JSON.stringify({
          ...deployedPayload,
          artifactDigest: "c".repeat(64),
          artifactPrefix: `snapshots/${retry.data.snapshot.id}/${"c".repeat(64)}`,
        }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "theme-build-result-conflict-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(conflictingResult.status).toBe(409);
    expect(await conflictingResult.json()).toMatchObject({
      error: { code: "storefront_preview_build_result_conflict" },
    });
    const stable = await previewRequest("theme-build-preview-0003");
    expect(await stable.json()).toMatchObject({
      data: {
        build: {
          artifactDigest: digest,
          artifactPrefix: deployedPayload.artifactPrefix,
          status: "deployed",
        },
      },
    });
    expect(triggerCalls).toHaveLength(2);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
           FROM audit_events
          WHERE action = 'themes.preview.build.start' AND result = 'succeeded'`,
      ).first(),
    ).toEqual({ count: 2 });
  });

  test("rejects unavailable or non-canonical releases before creating a live preview build", async () => {
    const legacyReleaseId = "release-preview-legacy-v1";
    await seedLegacyPreviewCatalogRelease(legacyReleaseId);
    await seedPreviewCatalogRelease("release-preview-building");
    await env.DB.prepare(
      "UPDATE catalog_releases SET status = 'building' WHERE id = 'release-preview-building'",
    ).run();
    await seedPreviewCatalogRelease("release-preview-malformed");
    await env.DB.prepare(
      "UPDATE catalog_releases SET manifest_json = ? WHERE id = 'release-preview-malformed'",
    )
      .bind('{"schemaVersion":2}')
      .run();
    await seedPreviewCatalogRelease("release-preview-identity-mismatch");
    await env.DB.prepare(
      "UPDATE catalog_releases SET manifest_json = ? WHERE id = 'release-preview-identity-mismatch'",
    )
      .bind(JSON.stringify(previewCatalogRelease))
      .run();
    const app = appFor();
    const created = await createDraft(app, "theme-legacy-preview-create-0001");
    await validateDraft(app, created.body.data.id, 1, "theme-legacy-preview-validate-0001");

    for (const [releaseId, code] of [
      [legacyReleaseId, "catalog_release_unavailable"],
      ["release-preview-building", "catalog_release_unavailable"],
      ["release-preview-missing", "catalog_release_unavailable"],
      ["release-preview-malformed", "catalog_release_invalid"],
      ["release-preview-identity-mismatch", "catalog_release_invalid"],
    ] as const) {
      const preview = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
          {
            catalogReleaseId: releaseId,
            expectedVersion: 1,
            reason: `Reject invalid Catalog Release ${releaseId}`,
          },
          `theme-invalid-release-${releaseId}`,
        ),
        env,
      );
      expect(preview.status).toBe(422);
      expect(await preview.json()).toMatchObject({ error: { code } });
    }
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM storefront_preview_builds").first(),
    ).toEqual({ count: 0 });
  });

  test("allocates concurrent build attempts per exact Catalog tuple with a bounded collision failure", async () => {
    const releaseA = "release-concurrent-build-a";
    const releaseB = "release-concurrent-build-b";
    const releaseC = "release-concurrent-build-c";
    const releaseBlocked = "release-concurrent-build-blocked";
    await Promise.all(
      [releaseA, releaseB, releaseC, releaseBlocked].map((releaseId) =>
        seedPreviewCatalogRelease(releaseId),
      ),
    );
    const triggerCalls: string[] = [];
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async ({ buildId }) => {
        triggerCalls.push(buildId);
        return { correlationId: `correlation-${buildId}` };
      },
    });
    const created = await createDraft(app, "theme-concurrent-build-create-0001");
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-concurrent-build-validate-0001");
    const preview = (releaseId: string, key: string, bindings: typeof env = env) =>
      app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/preview`,
          {
            catalogReleaseId: releaseId,
            expectedVersion: 1,
            reason: `Build concurrent Catalog tuple ${releaseId}`,
          },
          key,
        ),
        bindings,
      );

    const identical = await Promise.all([
      preview(releaseA, "theme-concurrent-identical-0001"),
      preview(releaseA, "theme-concurrent-identical-0002"),
    ]);
    expect(identical.map(({ status }) => status)).toEqual([202, 202]);
    const identicalBodies = await Promise.all(
      identical.map((response) =>
        response.json<{
          data: { build: { attempt: number; id: string }; snapshot: { id: string } };
        }>(),
      ),
    );
    expect(new Set(identicalBodies.map(({ data }) => data.build.id)).size).toBe(1);
    expect(triggerCalls).toHaveLength(1);

    const distinct = await Promise.all([
      preview(releaseB, "theme-concurrent-distinct-0001"),
      preview(releaseC, "theme-concurrent-distinct-0002"),
    ]);
    expect(distinct.map(({ status }) => status)).toEqual([202, 202]);
    const distinctBodies = await Promise.all(
      distinct.map((response) =>
        response.json<{
          data: { build: { attempt: number; id: string }; snapshot: { id: string } };
        }>(),
      ),
    );
    expect(new Set(distinctBodies.map(({ data }) => data.build.id)).size).toBe(2);
    expect(new Set(distinctBodies.map(({ data }) => data.build.attempt)).size).toBe(2);
    expect(triggerCalls).toHaveLength(3);

    const collisionDb = new Proxy(env.DB, {
      get(target, property) {
        if (property === "prepare") {
          return (query: string) => {
            const statement = target.prepare(query);
            if (!query.includes("INSERT OR IGNORE INTO storefront_preview_builds")) {
              return statement;
            }
            return {
              bind: (...values: unknown[]) => {
                statement.bind(...values);
                return {
                  run: async () => ({ meta: { changes: 0 } }),
                } as unknown as D1PreparedStatement;
              },
            } as unknown as D1PreparedStatement;
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const collisionEnv = new Proxy(env, {
      get(target, property) {
        if (property === "DB") return collisionDb;
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const blocked = await preview(releaseBlocked, "theme-concurrent-blocked-0001", collisionEnv);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({
      error: { code: "storefront_preview_build_allocation_conflict" },
    });
    expect(triggerCalls).toHaveLength(3);
  });

  test("binds a live preview build and manifest to the exact Catalog and Experience inputs", async () => {
    await seedPreviewCatalogRelease();
    const triggerCalls: Array<Record<string, string>> = [];
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async (input) => {
        triggerCalls.push(input);
        return { correlationId: "live-preview-correlation" };
      },
    });
    const created = await createDraft(app, "theme-live-preview-create-0001");
    await validateDraft(app, created.body.data.id, 1, "theme-live-preview-validate-0001");
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
        {
          catalogReleaseId: previewCatalogRelease.releaseId,
          expectedVersion: 1,
          reason: "Compose the exact live preview tuple",
        },
        "theme-live-preview-build-0001",
      ),
      env,
    );
    expect(preview.status).toBe(202);
    const value = await preview.json<{
      data: {
        build: { id: string; inputIdentity: Record<string, unknown> };
        snapshot: { id: string };
      };
    }>();
    expect(value.data.build.inputIdentity).toMatchObject({
      catalogReleaseId: previewCatalogRelease.releaseId,
      experienceSnapshotId: value.data.snapshot.id,
      experienceVersion: 1,
      platformContractVersion: "1.0.0",
      themeId: "fashion-store",
      themeVersion: "1.0.0",
    });
    expect(triggerCalls).toEqual([
      expect.objectContaining({
        catalogReleaseId: previewCatalogRelease.releaseId,
        manifestUrl: expect.stringContaining(`/build/storefront-experiences/builds/`),
        snapshotId: value.data.snapshot.id,
      }),
    ]);

    const manifest = await app.fetch(
      request(`/build/storefront-experiences/builds/${value.data.build.id}`, {
        headers: { Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}` },
      }),
      env,
    );
    expect(manifest.status).toBe(200);
    expect(await manifest.json()).toMatchObject({
      catalogRelease: { releaseId: previewCatalogRelease.releaseId, schemaVersion: 2 },
      inputIdentity: value.data.build.inputIdentity,
      snapshot: { id: value.data.snapshot.id, version: 1 },
    });

    await env.DB.prepare("UPDATE catalog_releases SET manifest_json = ? WHERE id = ?")
      .bind('{"schemaVersion":2}', previewCatalogRelease.releaseId)
      .run();
    const corruptManifest = await app.fetch(
      request(`/build/storefront-experiences/builds/${value.data.build.id}`, {
        headers: { Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}` },
      }),
      env,
    );
    expect(corruptManifest.status).toBe(422);
    expect(await corruptManifest.json()).toMatchObject({
      error: {
        code: "catalog_release_invalid",
        message: "The deployed Catalog Release is not canonical.",
      },
    });
    await env.DB.prepare("UPDATE catalog_releases SET manifest_json = ? WHERE id = ?")
      .bind(JSON.stringify(previewCatalogRelease), previewCatalogRelease.releaseId)
      .run();

    const digest = "d".repeat(64);
    const substituted = await app.fetch(
      request(`/build/storefront-experiences/builds/${value.data.build.id}/status`, {
        body: JSON.stringify({
          artifactDigest: digest,
          artifactPrefix: `snapshots/${value.data.snapshot.id}/different-release/${digest}`,
          expiresAt: "2099-08-11T00:00:00.000Z",
          status: "deployed",
        }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "theme-live-preview-substitute-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(substituted.status).toBe(422);

    const deployed = await app.fetch(
      request(`/build/storefront-experiences/builds/${value.data.build.id}/status`, {
        body: JSON.stringify({
          artifactDigest: digest,
          artifactPrefix: `snapshots/${value.data.snapshot.id}/${previewCatalogRelease.releaseId}/${digest}`,
          expiresAt: "2099-08-11T00:00:00.000Z",
          status: "deployed",
        }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "theme-live-preview-deploy-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(deployed.status).toBe(200);

    const omittedCatalogGrant = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${value.data.snapshot.id}/grants`,
        { origin: env.PREVIEW_ORIGIN, reason: "Omit the live Catalog identity" },
        "theme-live-preview-grant-omit-0001",
      ),
      env,
    );
    expect(omittedCatalogGrant.status).toBe(409);

    await seedPreviewCatalogRelease("different-release");
    const substitutedGrant = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${value.data.snapshot.id}/grants`,
        {
          catalogReleaseId: "different-release",
          origin: env.PREVIEW_ORIGIN,
          reason: "Attempt to substitute the bound release",
        },
        "theme-live-preview-grant-substitute-0001",
      ),
      env,
    );
    expect(substitutedGrant.status).toBe(409);

    const grantResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${value.data.snapshot.id}/grants`,
        {
          catalogReleaseId: previewCatalogRelease.releaseId,
          origin: env.PREVIEW_ORIGIN,
          reason: "Open the exact live preview",
        },
        "theme-live-preview-grant-0001",
      ),
      env,
    );
    const grantValue = await grantResponse.json<{
      data: { grant: string; inputIdentity: Record<string, unknown> };
    }>();
    expect(grantValue.data.inputIdentity).toEqual(value.data.build.inputIdentity);
    const grantAudit = await env.DB.prepare(
      `SELECT metadata_json
         FROM audit_events
        WHERE action = 'themes.preview.grant.create'
        ORDER BY created_at DESC
        LIMIT 1`,
    ).first<{ metadata_json: string }>();
    expect(JSON.parse(grantAudit!.metadata_json)).toMatchObject({
      catalogReleaseId: previewCatalogRelease.releaseId,
      snapshotId: redactForLog(value.data.snapshot.id),
    });
    const redeem = await app.fetch(
      request("/internal/preview/redeem", {
        body: JSON.stringify({ grant: grantValue.data.grant, origin: env.PREVIEW_ORIGIN }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
      env,
    );
    const sessionValue = await redeem.json<{
      data: { inputIdentity: Record<string, unknown>; session: string };
    }>();
    expect(sessionValue.data.inputIdentity).toEqual(value.data.build.inputIdentity);
    expect(
      (
        await app.fetch(
          request("/internal/preview/redeem", {
            body: JSON.stringify({ grant: grantValue.data.grant, origin: env.PREVIEW_ORIGIN }),
            headers: {
              Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);
    const authorization = await app.fetch(
      request("/internal/preview/authorize", {
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          Cookie: `__Host-shoppp-preview=${sessionValue.data.session}`,
          "X-Preview-Origin": env.PREVIEW_ORIGIN,
          "X-Preview-Catalog-Release": "different-release",
        },
        method: "POST",
      }),
      env,
    );
    expect(await authorization.json()).toMatchObject({
      artifactPrefix: `snapshots/${value.data.snapshot.id}/${previewCatalogRelease.releaseId}/${digest}`,
      inputIdentity: value.data.build.inputIdentity,
    });
  });

  test("stores only grant and session digests, rejects replay and wrong origin, and cleans expired artifacts", async () => {
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async () => ({ correlationId: "grant-build-correlation" }),
    });
    const created = await createDraft(app, "theme-grant-create-0001");
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-grant-validate-0001");
    const approval = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          reason: "Retain approval while preview artifacts expire",
        },
        "theme-grant-approval-0001",
      ),
      env,
    );
    const approved = await approval.json<{ data: { id: string } }>();
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/preview`,
        { expectedVersion: 1, reason: "Prepare private grant fixture" },
        "theme-grant-preview-0001",
      ),
      env,
    );
    const previewValue = await preview.json<{
      data: { build: { id: string }; snapshot: { id: string } };
    }>();
    const digest = "b".repeat(64);
    const prefix = `snapshots/${previewValue.data.snapshot.id}/${digest}`;
    await app.fetch(
      request(`/build/storefront-experiences/builds/${previewValue.data.build.id}/status`, {
        body: JSON.stringify({
          artifactDigest: digest,
          artifactPrefix: prefix,
          expiresAt: "2099-07-30T00:00:00.000Z",
          status: "deployed",
        }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "theme-grant-build-result-0001",
        },
        method: "POST",
      }),
      env,
    );
    const grantResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${previewValue.data.snapshot.id}/grants`,
        {
          origin: env.PREVIEW_ORIGIN,
          reason: "Open one private operator preview",
        },
        "theme-preview-grant-create-0001",
      ),
      env,
    );
    expect(grantResponse.status).toBe(201);
    const grantValue = await grantResponse.json<{
      data: { grant: string; redeemUrl: string };
    }>();
    expect(grantValue.data.redeemUrl).toBe(`${env.PREVIEW_ORIGIN}/__preview/session`);
    const persistedGrant = await env.DB.prepare(
      "SELECT grant_digest FROM storefront_preview_grants WHERE snapshot_id = ?",
    )
      .bind(previewValue.data.snapshot.id)
      .first<{ grant_digest: string }>();
    expect(persistedGrant?.grant_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(persistedGrant?.grant_digest).not.toContain(grantValue.data.grant);
    expect(
      (
        await env.DB.prepare(
          `SELECT
             (SELECT COUNT(*) FROM idempotency_claims WHERE response_body_json LIKE ?) +
             (SELECT COUNT(*) FROM audit_events WHERE metadata_json LIKE ? OR reason LIKE ?)
             AS count`,
        )
          .bind(
            `%${grantValue.data.grant}%`,
            `%${grantValue.data.grant}%`,
            `%${grantValue.data.grant}%`,
          )
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);

    const redeem = (grant: string, origin: string) =>
      app.fetch(
        request("/internal/preview/redeem", {
          body: JSON.stringify({ grant, origin }),
          headers: {
            Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
        env,
      );
    expect((await redeem(grantValue.data.grant, "https://wrong-preview.example.test")).status).toBe(
      403,
    );
    const redeemed = await redeem(grantValue.data.grant, env.PREVIEW_ORIGIN);
    expect(redeemed.status).toBe(200);
    const sessionValue = await redeemed.json<{
      data: { expiresAt: string; session: string };
    }>();
    expect((await redeem(grantValue.data.grant, env.PREVIEW_ORIGIN)).status).toBe(403);
    const expiringGrantResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${previewValue.data.snapshot.id}/grants`,
        {
          origin: env.PREVIEW_ORIGIN,
          reason: "Prove expired grant rejection",
        },
        "theme-preview-grant-expiry-0001",
      ),
      env,
    );
    const expiringGrant = await expiringGrantResponse.json<{
      data: { grant: string };
    }>();
    await env.DB.prepare(
      "UPDATE storefront_preview_grants SET expires_at = ? WHERE redeemed_at IS NULL",
    )
      .bind("2026-07-29T00:00:00.000Z")
      .run();
    expect((await redeem(expiringGrant.data.grant, env.PREVIEW_ORIGIN)).status).toBe(403);
    const persistedSession = await env.DB.prepare(
      "SELECT session_digest FROM storefront_preview_sessions WHERE snapshot_id = ?",
    )
      .bind(previewValue.data.snapshot.id)
      .first<{ session_digest: string }>();
    expect(persistedSession?.session_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(persistedSession?.session_digest).not.toContain(sessionValue.data.session);

    const authorized = await app.fetch(
      request("/internal/preview/authorize", {
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          Cookie: `__Host-shoppp-preview=${sessionValue.data.session}`,
          "X-Preview-Origin": env.PREVIEW_ORIGIN,
        },
        method: "POST",
      }),
      env,
    );
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toMatchObject({
      artifactPrefix: prefix,
      authorized: true,
      origin: env.PREVIEW_ORIGIN,
    });
    expect(
      (
        await app.fetch(
          request("/internal/preview/authorize", {
            headers: {
              Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
              Cookie: `__Host-shoppp-preview=${sessionValue.data.session}`,
              "X-Preview-Origin": "https://wrong-preview.example.test",
            },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect((await app.fetch(request("/preview/grants"), env)).status).toBe(404);

    await env.PREVIEW_ARTIFACTS.put(`${prefix}/index.html`, "fixture preview");
    await env.DB.prepare("UPDATE storefront_preview_builds SET expires_at = ? WHERE id = ?")
      .bind("2026-07-29T00:00:00.000Z", previewValue.data.build.id)
      .run();
    const cleanup = await cleanupExpiredStorefrontPreviews(
      env,
      new Date("2026-07-30T00:00:00.000Z"),
    );
    expect(cleanup).toMatchObject({ artifacts: 1, grants: 2, objects: 1, sessions: 1 });
    expect(await env.PREVIEW_ARTIFACTS.get(`${prefix}/index.html`)).toBeNull();
    expect(
      await env.DB.prepare("SELECT id FROM storefront_experience_snapshots WHERE id = ?")
        .bind(previewValue.data.snapshot.id)
        .first(),
    ).toEqual({ id: previewValue.data.snapshot.id });
    expect(
      await env.DB.prepare("SELECT id FROM storefront_experience_snapshots WHERE id = ?")
        .bind(approved.data.id)
        .first(),
    ).toEqual({ id: approved.data.id });
    expect(
      await env.DB.prepare("SELECT id FROM storefront_experience_drafts WHERE id = ?")
        .bind(draftId)
        .first(),
    ).toEqual({ id: draftId });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'themes.experience.approve' AND target_id = ?",
        )
          .bind(approved.data.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });

  test("keeps catalog releases and commerce records untouched", async () => {
    const before = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM catalog_releases) AS catalog_releases,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM carts) AS carts,
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM payment_events) AS payment_events`,
    ).first();
    const app = appFor();
    const created = await createDraft(app, "theme-boundary-create-0001");
    await validateDraft(app, created.body.data.id, 1, "theme-boundary-validate-0001");
    await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Approve presentation only" },
        "theme-boundary-approve-0001",
      ),
      env,
    );
    const after = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM catalog_releases) AS catalog_releases,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM carts) AS carts,
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM payment_events) AS payment_events`,
    ).first();
    expect(after).toEqual(before);
  });
});
