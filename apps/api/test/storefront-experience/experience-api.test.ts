import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import {
  canonicalCatalogReleaseSchema,
  canonicalStorefrontJson,
  catalogReleaseV3Schema,
  storefrontExperienceDraftInputSchema,
  themePackageSchema,
  type ThemePackage,
  type ThemeOverride,
} from "@shoppp/contracts";

import fashionStoreFixture from "../../../storefront/fixtures/experience/fashion-store.json";
import releaseFixture from "../../../storefront/fixtures/release.json";
import { fashionStoreManifest } from "../../../storefront/app/themes/fashion-store/manifest";
import {
  fashionStoreHistoricalPackages,
  fashionStoreSuccessorPackage,
  fashionStoreV11Package,
} from "../../../storefront/app/themes/fashion-store/package-registry";
import { fashionStoreHomeSections } from "../../../storefront/app/themes/fashion-store/successor/composition";
import { fashionStorePreset } from "../../../storefront/app/themes/fashion-store/presets/source-parity";
import { createApp } from "../../src/http/app";
import { sha256Hex } from "../../src/orders/tokens";
import { redactForLog } from "../../src/security/redaction";
import {
  createFashionStagingOperatorRun,
  getFashionStagingOperatorRun,
} from "../../src/testing/fashion-staging-operator";
import { cleanupExpiredStorefrontPreviews } from "../../src/storefront-experience/cleanup";
import { projectCatalogReleaseForExperience } from "../../src/storefront-experience/catalog-resources";
import { catalogMediaOrigins } from "../../src/storefront-experience/media-origins";
import type { StorefrontExperienceServiceOptions } from "../../src/storefront-experience/service";
import { ADMIN_ROLE_IDS, seedHumanAdmin, seedServiceAdmin } from "../fixtures/admin-iam";

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
  themeVersion: fashionStoreManifest.themeVersion,
});
const forbiddenNotes = ["a\u0007", "a\u202e", "x\ny"];

function fixtureBindingsForPackage(themePackage: ThemePackage) {
  const instanceIds = new Set(
    themePackage.presets.flatMap(({ templates }) =>
      templates.flatMap(({ sections }) =>
        sections.flatMap((section) => [section.id, ...section.blocks.map(({ id }) => id)]),
      ),
    ),
  );
  return storefrontExperienceDraftInputSchema.parse({
    ...draftInput,
    bindings: fashionStoreFixture.bindings.filter(({ instanceId }) => instanceIds.has(instanceId)),
  }).bindings;
}

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
const previewCatalogReleaseWithExternalMedia = canonicalCatalogReleaseSchema.parse({
  ...previewCatalogRelease,
  products: previewCatalogRelease.products.map((product, index) =>
    index === 0
      ? {
          ...product,
          media: [
            ...product.media,
            { ...product.media[0]!, src: "https://media-a.example.test/catalog/atlas.svg" },
            { ...product.media[0]!, src: "https://media-c.example.test/catalog/atlas.svg" },
          ],
        }
      : product,
  ),
});
const previewCatalogReleaseV3 = catalogReleaseV3Schema.parse({
  ...previewCatalogReleaseWithExternalMedia,
  commerce: {
    payment: { brands: ["visa"], enabled: true, provider: "stripe" },
    shippingMethods: [
      {
        amount: 500,
        countryCodes: ["US"],
        currency: "USD",
        id: "ship_01JPREVIEW000000000000001",
        name: "US delivery",
      },
    ],
  },
  content: [],
  environment: "staging",
  identity: {
    faviconAssetId: null,
    id: "identity.primary",
    logoAssets: [],
    seo: {},
    socialShareAssetId: null,
    storefrontName: "Preview store",
    tagline: "",
    version: 1,
  },
  navigation: [],
  purpose: "private-preview",
  routeOutput: previewCatalogRelease.routes,
  schemaVersion: 3,
  sourceVersionVector: [
    { digest: "a".repeat(64), id: "identity.primary", kind: "store-identity", version: 1 },
  ],
});
const previewMediaOrigins = catalogMediaOrigins(previewCatalogReleaseWithExternalMedia);

const catalogReadyDraftInput = storefrontExperienceDraftInputSchema.parse({
  ...draftInput,
  bindings: [
    ...draftInput.bindings,
    {
      id: "catalog-fashion-store-home-featured-collection",
      instanceId: "fashion-store-home",
      kind: "catalog",
      reference: { id: previewCatalogRelease.collections[0]!.id, kind: "collection" },
      settingId: "featured-collection",
    },
    {
      id: "catalog-fashion-store-collection-default-collection",
      instanceId: "fashion-store-collection",
      kind: "catalog",
      reference: { id: previewCatalogRelease.collections[0]!.id, kind: "collection" },
      settingId: "default-collection",
    },
  ],
});

async function seedPreviewCatalogRelease(
  id = previewCatalogRelease.releaseId,
  release: typeof previewCatalogRelease | typeof previewCatalogReleaseV3 = previewCatalogRelease,
): Promise<void> {
  const now = "2026-08-11T00:00:00.000Z";
  if (release.schemaVersion === 3) {
    const manifestDigest = await sha256Hex(`manifest:${id}`);
    const sourceDigest = await sha256Hex(`source:${id}`);
    await env.DB.prepare(
      `INSERT INTO catalog_releases
         (id, status, manifest_json, approved_at, purpose, environment, manifest_digest,
          source_digest, candidate_status, candidate_expires_at, created_at, updated_at)
       VALUES (?, 'approved', ?, ?, 'private-preview', 'staging', ?, ?, 'succeeded',
               '2099-08-11T00:00:00.000Z', ?, ?)`,
    )
      .bind(
        id,
        JSON.stringify({ ...release, releaseId: id }),
        now,
        manifestDigest,
        sourceDigest,
        now,
        now,
      )
      .run();
    return;
  }
  await env.DB.prepare(
    `INSERT INTO catalog_releases
       (id, status, manifest_json, approved_at, deployed_at, created_at, updated_at)
     VALUES (?, 'deployed', ?, ?, ?, ?, ?)`,
  )
    .bind(id, JSON.stringify({ ...release, releaseId: id }), now, now, now, now)
    .run();
}

async function seedPrivatePreviewCatalogRelease(id: string): Promise<void> {
  const now = "2026-08-11T00:00:00.000Z";
  const digest = "a".repeat(64);
  const release = catalogReleaseV3Schema.parse({
    ...previewCatalogRelease,
    content: [],
    environment: env.ENVIRONMENT,
    identity: {
      faviconAssetId: null,
      id: "identity.primary",
      logoAssets: [],
      seo: {},
      socialShareAssetId: null,
      storefrontName: previewCatalogRelease.site.name,
      tagline: "",
      version: 1,
    },
    navigation: [],
    purpose: "private-preview",
    releaseId: id,
    routeOutput: previewCatalogRelease.routes,
    schemaVersion: 3,
    sourceVersionVector: [{ digest, id: "identity.primary", kind: "store-identity", version: 1 }],
  });
  await env.DB.prepare(
    `INSERT INTO catalog_releases
      (id, status, manifest_json, approved_at, purpose, environment, manifest_digest,
       source_digest, candidate_status, candidate_expires_at, created_at, updated_at)
     VALUES (?, 'approved', ?, ?, 'private-preview', ?, ?, ?, 'succeeded',
             '2099-08-11T00:00:00.000Z', ?, ?)`,
  )
    .bind(id, JSON.stringify(release), now, env.ENVIRONMENT, digest, digest, now, now)
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
  catalogReleaseId?: string,
) {
  return app.fetch(
    writeRequest(
      `/admin/storefront-experiences/drafts/${draftId}/validate`,
      { catalogReleaseId, expectedVersion: version, reason: "Validate the exact draft version" },
      key,
    ),
    env,
  );
}

async function captureContactSettingsRows() {
  return (
    await env.DB.prepare(
      "SELECT key, value_json, updated_at FROM settings WHERE key IN ('contact_profile', 'launch_configuration', 'contact_write_guard')",
    ).all<{ key: string; value_json: string; updated_at: string }>()
  ).results;
}

async function restoreContactSettingsRows(
  rows: Awaited<ReturnType<typeof captureContactSettingsRows>>,
) {
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM settings WHERE key IN ('contact_profile', 'launch_configuration', 'contact_write_guard')",
    ),
    ...rows.map((row) =>
      env.DB.prepare("INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)").bind(
        row.key,
        row.value_json,
        row.updated_at,
      ),
    ),
  ]);
}

function revokePreviewAccessAfterGrantClaim(database: D1Database, snapshotId: string): D1Database {
  const rawStatements = new WeakMap<object, D1PreparedStatement>();
  const claimStatements = new WeakSet<object>();
  let revoked = false;
  const revoke = async () => {
    if (revoked) return;
    revoked = true;
    const revokedAt = "2026-08-11T00:01:00.000Z";
    await database.batch([
      database
        .prepare(
          "UPDATE storefront_preview_grants SET revoked_at = ? WHERE snapshot_id = ? AND revoked_at IS NULL",
        )
        .bind(revokedAt, snapshotId),
      database
        .prepare(
          "UPDATE storefront_preview_sessions SET revoked_at = ? WHERE snapshot_id = ? AND revoked_at IS NULL",
        )
        .bind(revokedAt, snapshotId),
    ]);
  };
  const wrapStatement = (statement: D1PreparedStatement, isClaim: boolean): D1PreparedStatement => {
    const wrapped = new Proxy(statement, {
      get(target, property) {
        if (property === "bind") {
          return (...values: unknown[]) => wrapStatement(target.bind(...values), isClaim);
        }
        if (property === "run") {
          return async () => {
            const result = await target.run();
            if (isClaim) await revoke();
            return result;
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    rawStatements.set(wrapped, statement);
    if (isClaim) claimStatements.add(wrapped);
    return wrapped;
  };

  return new Proxy(database, {
    get(target, property) {
      if (property === "prepare") {
        return (query: string) =>
          wrapStatement(
            target.prepare(query),
            query.includes("UPDATE storefront_preview_grants") && query.includes("SET redeemed_at"),
          );
      }
      if (property === "batch") {
        return async (statements: D1PreparedStatement[]) => {
          const includesClaim = statements.some((statement) => claimStatements.has(statement));
          const result = await target.batch(
            statements.map((statement) => rawStatements.get(statement) ?? statement),
          );
          if (includesClaim) await revoke();
          return result;
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("storefront experience API", () => {
  test("preserves canonical v3 readers and projects only exact legacy tuples", () => {
    expect(
      projectCatalogReleaseForExperience(previewCatalogReleaseV3, {
        configurationSchemaVersion: 3,
        themeId: "fashion-store",
        themeVersion: "1.2.0",
      }),
    ).toBe(previewCatalogReleaseV3);
    const legacy = projectCatalogReleaseForExperience(previewCatalogReleaseV3, {
      configurationSchemaVersion: 2,
      themeId: "fashion-store",
      themeVersion: "1.1.0",
    });
    expect(legacy).toMatchObject({ schemaVersion: 2 });
    expect("commerce" in legacy).toBe(false);
    expect(() =>
      projectCatalogReleaseForExperience(previewCatalogRelease, {
        configurationSchemaVersion: 3,
        themeId: "fashion-store",
        themeVersion: "1.2.0",
      }),
    ).toThrow("do not have a supported reader");
  });
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM fashion_staging_operator_runs"),
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

  test("applies strict server-owned Block commands with optimistic concurrency", async () => {
    const app = appFor();
    const created = await createDraft(app, "theme-block-command-create");
    expect(created.response.status).toBe(201);
    const draftId = created.body.data.id;
    const duplicate = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
        {
          command: {
            blockId: "hero-slide-1",
            kind: "duplicate",
            templateId: "fashion-store-home",
          },
          expectedVersion: 1,
        },
        "theme-block-command-duplicate",
      ),
      env,
    );
    expect(duplicate.status).toBe(200);
    const duplicateBody = await duplicate.json<{
      data: { overrides: ThemeOverride[]; version: number };
    }>();
    expect(duplicateBody.data.version).toBe(2);
    expect(
      await env.DB.prepare(
        "SELECT reason FROM audit_events WHERE target_id = ? AND action = 'themes.block.duplicate'",
      )
        .bind(draftId)
        .first(),
    ).toEqual({ reason: null });
    const added = duplicateBody.data.overrides
      .flatMap(({ operations }) => operations)
      .find((operation) => operation.kind === "add-block");
    expect(added).toMatchObject({ block: { type: "fashion-store.hero-slide" }, kind: "add-block" });
    if (!added || added.kind !== "add-block") throw new Error("Expected a server-created Block.");
    expect(added.block.id).toMatch(/^block-[a-f0-9-]+$/);
    expect(added.block.id).not.toBe("hero-slide-1");

    const unknown = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
        {
          command: {
            blockType: "fashion-store.unknown",
            kind: "add",
            sectionId: "fashion-store-home",
            settings: {},
            templateId: "fashion-store-home",
          },
          expectedVersion: 2,
          reason: "Reject an unknown Block type",
        },
        "theme-block-command-unknown",
      ),
      env,
    );
    expect(unknown.status).toBe(422);

    const invalidSetting = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
        {
          command: {
            blockId: "hero-slide-1",
            kind: "set-setting",
            settingId: "unknown",
            templateId: "fashion-store-home",
            value: "invalid",
          },
          expectedVersion: 2,
          reason: "Reject an unknown Block setting",
        },
        "theme-block-command-invalid-setting",
      ),
      env,
    );
    expect(invalidSetting.status).toBe(422);

    const disallowedSection = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
        {
          command: {
            blockType: "fashion-store.service",
            kind: "add",
            sectionId: "fashion-store-home",
            settings: { description: "Not a Hero", title: "Service", variant: "package" },
            templateId: "fashion-store-home",
          },
          expectedVersion: 2,
          reason: "Reject a service in the Hero",
        },
        "theme-block-command-disallowed-section",
      ),
      env,
    );
    expect(disallowedSection.status).toBe(422);

    const fifth = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
        {
          command: { blockId: "hero-slide-1", kind: "duplicate", templateId: "fashion-store-home" },
          expectedVersion: 2,
          reason: "Fill the bounded Hero capacity",
        },
        "theme-block-command-fifth",
      ),
      env,
    );
    expect(fifth.status).toBe(200);
    const excessive = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
        {
          command: { blockId: "hero-slide-1", kind: "duplicate", templateId: "fashion-store-home" },
          expectedVersion: 3,
          reason: "Reject a sixth Hero slide",
        },
        "theme-block-command-excessive",
      ),
      env,
    );
    expect(excessive.status).toBe(422);

    const stale = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
        {
          command: { blockId: added.block.id, kind: "remove", templateId: "fashion-store-home" },
          expectedVersion: 1,
          reason: "Attempt stale removal",
        },
        "theme-block-command-stale",
      ),
      env,
    );
    expect(stale.status).toBe(409);
  });

  test("rolls back the Block CAS update when the coupled audit insert fails", async () => {
    const auditId = "audit-block-command-collision";
    await env.DB.prepare(
      `INSERT INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result, reason,
          request_id, metadata_json, created_at)
       VALUES (?, 'admin', 'seed', 'seed', 'seed', 'seed', 'succeeded', NULL,
               'seed', '{}', '2026-09-23T00:00:00.000Z')`,
    )
      .bind(auditId)
      .run();
    const app = createApp({
      storefrontExperienceServiceOptions: { blockCommandAuditId: auditId },
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
    });
    const created = await createDraft(app, "theme-block-atomic-create");
    const draftId = created.body.data.id;
    const response = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
        {
          command: {
            blockId: "hero-slide-1",
            kind: "duplicate",
            templateId: "fashion-store-home",
          },
          expectedVersion: 1,
          reason: "Prove audit and Block CAS rollback together",
        },
        "theme-block-atomic-command",
      ),
      env,
    );
    expect(response.status).toBe(500);
    const persisted = await app.fetch(
      request(`/admin/storefront-experiences/drafts/${draftId}`),
      env,
    );
    expect(await persisted.json()).toMatchObject({ data: { overrides: [], version: 1 } });
  });

  test("audits only the batch that wins a same-millisecond Block CAS race", async () => {
    const fixedNow = "2026-09-23T12:34:56.789Z";
    const app = createApp({
      storefrontExperienceServiceOptions: { blockCommandNow: () => fixedNow },
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
    });
    const created = await createDraft(app, "theme-block-concurrent-create");
    const draftId = created.body.data.id;
    const send = (requestId: string) =>
      app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
          {
            command: {
              blockId: "hero-slide-1",
              kind: "duplicate",
              templateId: "fashion-store-home",
            },
            expectedVersion: 1,
            reason: "Race the same Block version",
          },
          requestId,
        ),
        env,
      );

    const responses = await Promise.all([
      send("theme-block-concurrent-a"),
      send("theme-block-concurrent-b"),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);

    const persisted = await app.fetch(
      request(`/admin/storefront-experiences/drafts/${draftId}`),
      env,
    );
    const persistedBody = await persisted.json<{
      data: { overrides: ThemeOverride[]; updatedAt: string; version: number };
    }>();
    expect(persistedBody.data).toMatchObject({ updatedAt: fixedNow, version: 2 });
    expect(
      persistedBody.data.overrides
        .flatMap(({ operations }) => operations)
        .filter(({ kind }) => kind === "add-block"),
    ).toHaveLength(1);

    const audits = await env.DB.prepare(
      `SELECT request_id FROM audit_events
       WHERE action = 'themes.block.duplicate' AND target_id = ?
       ORDER BY request_id`,
    )
      .bind(draftId)
      .all<{ request_id: string }>();
    expect(audits.results).toHaveLength(1);
    expect(audits.results[0]?.request_id).toMatch(/^[a-f0-9-]{36}$/);
  });

  test("accepts every Block command and rejects Catalog media for Theme marketing settings", async () => {
    const app = appFor();
    const created = await createDraft(app, "theme-block-all-commands-create");
    const draftId = created.body.data.id;
    const endpoint = `/admin/storefront-experiences/drafts/${draftId}/block-commands`;
    const rejectedMedia = await app.fetch(
      writeRequest(
        endpoint,
        {
          command: {
            blockId: "category-1",
            kind: "set-setting",
            settingId: "image",
            templateId: "fashion-store-home",
            value: {
              alt: "Catalog",
              height: 900,
              key: "catalog/marketing.webp",
              kind: "catalog",
              width: 900,
            },
          },
          expectedVersion: 1,
          reason: "Reject Catalog media in a Theme marketing Block",
        },
        "theme-block-reject-catalog-media",
      ),
      env,
    );
    expect(rejectedMedia.status).toBe(422);
    expect(await rejectedMedia.json()).toMatchObject({
      error: { code: "storefront_experience_block_asset_invalid" },
    });

    const categoryDefinition = fashionStoreSuccessorPackage.manifest.componentRegistry.blocks.find(
      ({ type }) => type === "fashion-store.category",
    )!;
    const settings = Object.fromEntries(
      categoryDefinition.settings.flatMap((setting) =>
        "default" in setting && setting.default !== undefined
          ? [[setting.id, structuredClone(setting.default)]]
          : [],
      ),
    );
    const send = async (command: Record<string, unknown>, version: number, key: string) => {
      const response = await app.fetch(
        writeRequest(
          endpoint,
          {
            command: { ...command, templateId: "fashion-store-home" },
            expectedVersion: version,
            reason: `Exercise ${key} Block command`,
          },
          `theme-block-all-${key}`,
        ),
        env,
      );
      expect(response.status).toBe(200);
      return response.json<{ data: { overrides: ThemeOverride[]; version: number } }>();
    };
    const added = await send(
      {
        blockType: "fashion-store.category",
        kind: "add",
        sectionId: "fashion-store-home-categories",
        settings,
      },
      1,
      "add",
    );
    const addedOperation = added.data.overrides
      .flatMap(({ operations }) => operations)
      .find(
        (operation) =>
          operation.kind === "add-block" && operation.block.type === "fashion-store.category",
      );
    if (!addedOperation || addedOperation.kind !== "add-block")
      throw new Error("Missing added Block");
    const addedId = addedOperation.block.id;
    const duplicated = await send({ blockId: "category-1", kind: "duplicate" }, 2, "duplicate");
    const duplicateId = duplicated.data.overrides
      .flatMap(({ operations }) => operations)
      .filter((operation) => operation.kind === "add-block")
      .map((operation) => operation.block.id)
      .find((id) => id !== addedId)!;
    await send({ blockId: addedId, kind: "set-visibility", visible: false }, 3, "visibility");
    await send(
      { blockId: addedId, kind: "set-setting", settingId: "name", value: "Edited category" },
      4,
      "setting",
    );
    await send(
      {
        blockIds: [duplicateId, "category-4", "category-3", "category-2", "category-1", addedId],
        kind: "reorder",
        sectionId: "fashion-store-home-categories",
      },
      5,
      "reorder",
    );
    const removed = await send({ blockId: addedId, kind: "remove" }, 6, "remove");
    expect(removed.data.version).toBe(7);
  });

  test("normalizes more than 120 sequential Block commands into a bounded draft", async () => {
    const app = appFor();
    const created = await createDraft(app, "theme-block-normalize-create");
    const draftId = created.body.data.id;
    let version = 1;
    for (let index = 0; index < 121; index += 1) {
      const response = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/block-commands`,
          {
            command: {
              blockId: "marquee-1",
              kind: "set-visibility",
              templateId: "fashion-store-home",
              visible: index % 2 === 0 ? false : true,
            },
            expectedVersion: version,
            reason: "Normalize repeated Block visibility commands",
          },
          `theme-block-normalize-${index}`,
        ),
        env,
      );
      expect(response.status).toBe(200);
      version += 1;
    }
    const persisted = await app.fetch(
      request(`/admin/storefront-experiences/drafts/${draftId}`),
      env,
    );
    const body = await persisted.json<{ data: { overrides: ThemeOverride[]; version: number } }>();
    expect(body.data.version).toBe(122);
    expect(body.data.overrides.flatMap(({ operations }) => operations)).toHaveLength(1);
  });

  test("rejects Block references outside the exact candidate Release", async () => {
    const app = appFor();
    const releaseId = "release-block-reference";
    await seedPreviewCatalogRelease(releaseId);
    const created = await createDraft(app, "theme-block-reference-create", catalogReadyDraftInput);
    expect(created.response.status).toBe(201);
    const response = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/block-commands`,
        {
          catalogReleaseId: releaseId,
          command: {
            blockId: "category-1",
            kind: "set-setting",
            settingId: "collection",
            templateId: "fashion-store-home",
            value: { id: "col_01JPREVIEWCOLLECT99999999", kind: "collection" },
          },
          expectedVersion: 1,
          reason: "Bind the category to the exact candidate collection",
        },
        "theme-block-reference-missing",
      ),
      env,
    );
    expect(response.status).toBe(422);
    const body = await response.json<{
      error: { details?: { issues?: Array<{ code: string }> } };
    }>();
    expect(body.error.details?.issues).toContainEqual(
      expect.objectContaining({ code: "content_reference_missing" }),
    );
  });

  test("freezes public contacts in previews and gives changed contacts a new snapshot identity", async () => {
    const originalSettings = await captureContactSettingsRows();
    try {
      const app = createApp({
        experienceBuildTrigger: async () => ({ correlationId: crypto.randomUUID() }),
        testIdentityVerifier: async () => ({
          email: "theme-admin@example.test",
          principalKind: "human",
          subject: "theme-admin",
        }),
      });
      const readContact = async () => {
        const response = await app.fetch(request("/admin/settings/contact"), env);
        expect(response.status).toBe(200);
        return (await response.json()) as {
          data: {
            launchVersion: string | null;
            privacyContactEmail: string;
            profile: Record<string, unknown>;
            profileVersion: string | null;
          };
        };
      };
      const saveContact = async (email: string, key: string) => {
        const current = (await readContact()).data;
        const response = await app.fetch(
          writeRequest(
            "/admin/settings/contact",
            {
              expectedLaunchVersion: current.launchVersion,
              expectedProfileVersion: current.profileVersion,
              privacyContactEmail: current.privacyContactEmail,
              profile: {
                ...current.profile,
                publishSupportEmail: true,
                socials: [
                  {
                    id: "09b4b33b-4522-45ab-8541-3f25b7fffc1b",
                    label: "Instagram",
                    platform: "instagram",
                    url: "https://instagram.com/shoppp",
                    visible: true,
                  },
                ],
              },
              reason: "Confirm public contact for snapshot",
              supportEmail: email,
            },
            key,
            "PUT",
          ),
          env,
        );
        expect(response.status).toBe(200);
      };
      await saveContact("first@example.test", "contact-snapshot-first-save");
      const created = await createDraft(app, "contact-snapshot-create");
      const draftId = created.body.data.id;
      expect((await validateDraft(app, draftId, 1, "contact-snapshot-validate")).status).toBe(200);
      const preview = async (key: string) => {
        const response = await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${draftId}/preview`,
            { expectedVersion: 1, reason: "Preview frozen public contact" },
            key,
          ),
          env,
        );
        expect(response.status).toBe(202);
        return (await response.json()) as {
          data: {
            snapshot: {
              contentDigest: string;
              id: string;
              snapshot: {
                contact: {
                  publicContact: {
                    supportEmail: string | null;
                    socials: Array<{ label: string }>;
                  };
                  version: string;
                };
              };
            };
          };
        };
      };
      const first = (await preview("contact-snapshot-preview-first")).data.snapshot;
      expect(first.snapshot.contact.publicContact).toMatchObject({
        supportEmail: "first@example.test",
        socials: [{ label: "Instagram" }],
      });
      const approve = async (key: string) => {
        const response = await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${draftId}/approve`,
            { confirm: true, expectedVersion: 1, reason: "Approve frozen public contact" },
            key,
          ),
          env,
        );
        expect(response.status).toBe(200);
        return (await response.json()) as {
          data: {
            contentDigest: string;
            id: string;
            snapshot: { contact: { publicContact: { supportEmail: string | null } } };
          };
        };
      };
      const firstApproved = (await approve("contact-snapshot-approve-first")).data;
      await saveContact("second@example.test", "contact-snapshot-second-save");
      const second = (await preview("contact-snapshot-preview-second")).data.snapshot;
      expect(second.id).not.toBe(first.id);
      expect(second.snapshot.contact.version).not.toBe(first.snapshot.contact.version);
      expect(second.snapshot.contact.publicContact.supportEmail).toBe("second@example.test");
      const secondApproved = (await approve("contact-snapshot-approve-second")).data;
      expect(secondApproved.id).not.toBe(firstApproved.id);
      expect(secondApproved.snapshot.contact.publicContact.supportEmail).toBe(
        "second@example.test",
      );
      const old = await app.fetch(
        request(`/admin/storefront-experiences/snapshots/${first.id}`),
        env,
      );
      expect(old.status).toBe(200);
      expect(await old.json()).toMatchObject({
        data: {
          contentDigest: first.contentDigest,
          snapshot: { contact: { publicContact: { supportEmail: "first@example.test" } } },
        },
      });
      const oldApproved = await app.fetch(
        request(`/admin/storefront-experiences/snapshots/${firstApproved.id}`),
        env,
      );
      expect(await oldApproved.json()).toMatchObject({
        data: {
          contentDigest: firstApproved.contentDigest,
          snapshot: { contact: { publicContact: { supportEmail: "first@example.test" } } },
        },
      });
    } finally {
      await restoreContactSettingsRows(originalSettings);
    }
  });

  test("blocks a new preview when persisted public contact data is invalid", async () => {
    const originalSettings = await captureContactSettingsRows();
    try {
      const app = createApp({
        experienceBuildTrigger: async () => ({ correlationId: crypto.randomUUID() }),
        testIdentityVerifier: async () => ({
          email: "theme-admin@example.test",
          principalKind: "human",
          subject: "theme-admin",
        }),
      });
      const created = await createDraft(app, "invalid-contact-snapshot-create");
      const draftId = created.body.data.id;
      expect(
        (await validateDraft(app, draftId, 1, "invalid-contact-snapshot-validate")).status,
      ).toBe(200);
      await env.DB.prepare("DELETE FROM settings WHERE key = 'contact_profile'").run();
      const empty = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/preview`,
          { expectedVersion: 1, reason: "Preview absent contact profile" },
          "absent-contact-snapshot-preview",
        ),
        env,
      );
      expect(empty.status).toBe(202);
      expect(await empty.json()).toMatchObject({
        data: {
          snapshot: {
            snapshot: {
              contact: {
                publicContact: {
                  supportEmail: null,
                  privacyEmail: null,
                  locations: [],
                  socials: [],
                },
              },
            },
          },
        },
      });
      await env.DB.prepare(
        "INSERT INTO settings (key, value_json, updated_at) VALUES ('contact_profile', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
      )
        .bind(
          JSON.stringify({ version: crypto.randomUUID(), profile: {} }),
          new Date().toISOString(),
        )
        .run();
      const response = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/preview`,
          { expectedVersion: 1, reason: "Reject invalid contact profile" },
          "invalid-contact-snapshot-preview",
        ),
        env,
      );
      expect(response.status).toBe(500);
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM storefront_experience_snapshots WHERE source_draft_id = ?",
        )
          .bind(draftId)
          .first<{ count: number }>(),
      ).toEqual({ count: 1 });
    } finally {
      await restoreContactSettingsRows(originalSettings);
    }
  });

  test("lists only the writable Fashion package for authorized operators", async () => {
    const response = await appFor().fetch(request("/admin/storefront-experiences/themes"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [
        {
          fixtureBindings: expect.any(Array),
          id: "fashion-store",
          presetDefinitions: [
            expect.objectContaining({ id: "source-parity" }),
            expect.objectContaining({ id: "unified-store", label: "Unified store" }),
          ],
          themeVersion: "1.2.0",
        },
      ],
    });
  });

  test("freezes every lifecycle write for both exact Decor identities while retaining reads", async () => {
    const app = createApp({
      experienceBuildTrigger: async () => ({ correlationId: "retired-theme-must-not-build" }),
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
    });
    const now = "2026-09-07T12:00:00.000Z";
    const retiredPackages = [
      {
        bindings: [],
        manifest: {
          ...fashionStoreManifest,
          configurationSchemaVersion: 1,
          id: "decor",
          themeVersion: "1.0.0",
        },
        preset: { ...fashionStorePreset, id: "layered", label: "Retired Decor fixture" },
      },
      {
        bindings: [],
        manifest: {
          ...fashionStoreManifest,
          configurationSchemaVersion: 1,
          id: "decor-store",
          themeVersion: "1.0.0",
        },
        preset: {
          ...fashionStorePreset,
          id: "source-parity",
          label: "Retired Decor Store fixture",
        },
      },
    ] as const;

    const expectRetired = async (response: Response) => {
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        error: { code: "storefront_theme_package_retired" },
      });
    };
    const readRetiredLifecycleState = async (
      draftId: string,
      snapshotId: string,
      buildId: string,
    ) => {
      const [build, draft, grants, migrations, sessions, snapshots, validations] =
        await env.DB.batch([
          env.DB.prepare(
            "SELECT status, updated_at FROM storefront_preview_builds WHERE id = ?",
          ).bind(buildId),
          env.DB.prepare(
            "SELECT version, updated_at FROM storefront_experience_drafts WHERE id = ?",
          ).bind(draftId),
          env.DB.prepare(
            "SELECT COUNT(*) AS count FROM storefront_preview_grants WHERE snapshot_id = ?",
          ).bind(snapshotId),
          env.DB.prepare(
            "SELECT COUNT(*) AS count FROM storefront_experience_migrations WHERE draft_id = ?",
          ).bind(draftId),
          env.DB.prepare(
            "SELECT COUNT(*) AS count FROM storefront_preview_sessions WHERE snapshot_id = ?",
          ).bind(snapshotId),
          env.DB.prepare(
            "SELECT COUNT(*) AS count FROM storefront_experience_snapshots WHERE source_draft_id = ?",
          ).bind(draftId),
          env.DB.prepare(
            "SELECT COUNT(*) AS count FROM storefront_experience_validations WHERE draft_id = ?",
          ).bind(draftId),
        ]);
      return {
        build: build!.results[0],
        draft: draft!.results[0],
        grants: grants!.results[0],
        migrations: migrations!.results[0],
        sessions: sessions!.results[0],
        snapshots: snapshots!.results[0],
        validations: validations!.results[0],
      };
    };

    for (const { bindings, manifest, preset } of retiredPackages) {
      const themeId = manifest.id;
      const draftId = `draft-retired-${themeId}`;
      const validationId = `validation-retired-${themeId}`;
      const migrationId = `migration-retired-${themeId}`;
      const snapshotId = `snapshot-retired-${themeId}`;
      const buildId = `build-retired-${themeId}`;
      const grantId = `grant-retired-${themeId}`;
      const sessionId = `session-retired-${themeId}`;
      const grant = `retired_grant_${themeId}_ABCDEFGHIJKLMNOPQRSTUVWXYZ`;
      const session = `retired_session_${themeId}_ABCDEFGHIJKLMNOPQRSTUVWXYZ`;
      const snapshot = {
        approvedAt: now,
        approvedBy: "admin-theme-admin",
        bindings,
        configurationSchemaVersion: manifest.configurationSchemaVersion,
        experienceId: `experience-retired-${themeId}`,
        id: snapshotId,
        kind: "approved",
        overrides: [],
        platformContractVersion: manifest.platformContractVersion,
        provenance: manifest.provenance,
        resolvedTemplates: preset.templates,
        themeId,
        themeVersion: manifest.themeVersion,
        version: 1,
      } as const;
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO storefront_experience_drafts
             (id, experience_id, theme_id, theme_version, configuration_schema_version,
              preset_id, bindings_json, overrides_json, version, created_by, updated_by,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 1, 'admin-theme-admin', 'admin-theme-admin', ?, ?)`,
        ).bind(
          draftId,
          snapshot.experienceId,
          themeId,
          manifest.themeVersion,
          manifest.configurationSchemaVersion,
          preset.id,
          JSON.stringify(bindings),
          now,
          now,
        ),
        env.DB.prepare(
          `INSERT INTO storefront_experience_validations
             (id, draft_id, draft_version, catalog_release_id, status, issues_json,
              resolved_templates_json, validated_by, created_at)
           VALUES (?, ?, 1, NULL, 'valid', '[]', ?, 'admin-theme-admin', ?)`,
        ).bind(validationId, draftId, JSON.stringify(preset.templates), now),
        env.DB.prepare(
          `INSERT INTO storefront_experience_migrations
             (id, draft_id, draft_version, source_theme_version,
              source_configuration_schema_version, target_theme_version,
              target_configuration_schema_version, migrated_overrides_json, conflicts_json,
              status, created_by, created_at)
           VALUES (?, ?, 1, ?, ?, ?, ?, '[]', '[]', 'dry_run', 'admin-theme-admin', ?)`,
        ).bind(
          migrationId,
          draftId,
          manifest.themeVersion,
          manifest.configurationSchemaVersion,
          manifest.themeVersion,
          manifest.configurationSchemaVersion,
          now,
        ),
        env.DB.prepare(
          `INSERT INTO storefront_experience_snapshots
             (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
              source_validation_id, migration_id, kind, theme_id, theme_version,
              configuration_schema_version, snapshot_json, content_digest, created_by, approved_by,
              approved_at, created_at)
           VALUES (?, ?, ?, ?, 1, ?, NULL, 'approved', ?, ?, ?, ?, ?,
                   'admin-theme-admin', 'admin-theme-admin', ?, ?)`,
        ).bind(
          snapshotId,
          `retired-${themeId}-approved`,
          snapshot.experienceId,
          draftId,
          validationId,
          themeId,
          manifest.themeVersion,
          manifest.configurationSchemaVersion,
          JSON.stringify(snapshot),
          themeId === "decor" ? "a".repeat(64) : "b".repeat(64),
          now,
          now,
        ),
        env.DB.prepare(
          `INSERT INTO storefront_preview_builds
             (id, snapshot_id, catalog_release_id, experience_version, theme_id, theme_version,
              platform_contract_version, media_origins_json, attempt, status, artifact_digest,
              artifact_prefix, expires_at, completed_at, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, '[]', 1, 'deployed', ?, ?,
                   '2099-09-07T00:00:00.000Z', ?, ?, ?)`,
        ).bind(
          buildId,
          snapshotId,
          themeId === "decor" ? "c".repeat(64) : "d".repeat(64),
          `snapshots/${snapshotId}/${themeId === "decor" ? "c".repeat(64) : "d".repeat(64)}`,
          now,
          now,
          now,
        ),
        env.DB.prepare(
          `INSERT INTO storefront_preview_grants
             (id, snapshot_id, build_id, grant_digest, origin, expires_at, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, '2099-09-07T00:00:00.000Z', 'admin-theme-admin', ?)`,
        ).bind(grantId, snapshotId, buildId, await sha256Hex(grant), env.PREVIEW_ORIGIN, now),
        env.DB.prepare(
          `INSERT INTO storefront_preview_sessions
             (id, snapshot_id, build_id, session_digest, origin, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, '2099-09-07T00:00:00.000Z', ?)`,
        ).bind(sessionId, snapshotId, buildId, await sha256Hex(session), env.PREVIEW_ORIGIN, now),
      ]);

      const before = await readRetiredLifecycleState(draftId, snapshotId, buildId);

      await expectRetired(
        await app.fetch(
          writeRequest(
            "/admin/storefront-experiences/drafts",
            {
              draft: {
                bindings,
                experienceId: `new-retired-${themeId}`,
                overrides: [],
                presetId: preset.id,
                themeId,
                themeVersion: manifest.themeVersion,
              },
              reason: "Retired packages cannot create drafts",
            },
            `retired-${themeId}-create`,
          ),
          env,
        ),
      );
      const draftMutations = [
        [
          `/admin/storefront-experiences/drafts/${draftId}`,
          { bindings, expectedVersion: 1, overrides: [], reason: "Retired update" },
          "PUT",
        ],
        [
          `/admin/storefront-experiences/drafts/${draftId}/successors`,
          { bindings, overrides: [], reason: "Retired successor", sourceVersion: 1 },
          "POST",
        ],
        [
          `/admin/storefront-experiences/drafts/${draftId}/validate`,
          { expectedVersion: 1, reason: "Retired validation" },
          "POST",
        ],
        [
          `/admin/storefront-experiences/drafts/${draftId}/preview`,
          { expectedVersion: 1, reason: "Retired preview" },
          "POST",
        ],
        [
          `/admin/storefront-experiences/drafts/${draftId}/approve`,
          { confirm: true, expectedVersion: 1, reason: "Retired approval" },
          "POST",
        ],
        [
          `/admin/storefront-experiences/drafts/${draftId}/migrations/dry-run`,
          {
            expectedVersion: 1,
            reason: "Retired migration dry run",
            targetConfigurationSchemaVersion: manifest.configurationSchemaVersion,
            targetThemeVersion: manifest.themeVersion,
          },
          "POST",
        ],
        [
          `/admin/storefront-experiences/drafts/${draftId}/migrations/approve`,
          {
            confirm: true,
            expectedVersion: 1,
            migrationId,
            reason: "Retired migration approval",
          },
          "POST",
        ],
      ] as const;
      for (const [path, body, method] of draftMutations) {
        await expectRetired(
          await app.fetch(
            writeRequest(path, body, `retired-${themeId}-${path.split("/").at(-1)}`, method),
            env,
          ),
        );
      }
      await expectRetired(
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${draftId}`,
            { bindings, expectedVersion: 999, overrides: [], reason: "Retired stale update" },
            `retired-${themeId}-stale-update`,
            "PUT",
          ),
          env,
        ),
      );
      await expectRetired(
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${draftId}/migrations/approve`,
            {
              confirm: true,
              expectedVersion: 999,
              migrationId,
              reason: "Retired stale migration approval",
            },
            `retired-${themeId}-stale-migration-approval`,
          ),
          env,
        ),
      );
      await expectRetired(
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/snapshots/${snapshotId}/build`,
            { catalogReleaseId: previewCatalogRelease.releaseId },
            `retired-${themeId}-build`,
          ),
          env,
        ),
      );
      await expectRetired(
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/snapshots/${snapshotId}/grants`,
            { origin: env.PREVIEW_ORIGIN, reason: "Retired grant" },
            `retired-${themeId}-grant`,
          ),
          env,
        ),
      );
      await expectRetired(
        await app.fetch(
          request("/internal/preview/redeem", {
            body: JSON.stringify({ grant, origin: env.PREVIEW_ORIGIN }),
            headers: { Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}` },
            method: "POST",
          }),
          env,
        ),
      );
      await expectRetired(
        await app.fetch(
          request("/internal/preview/authorize", {
            headers: {
              Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
              Cookie: `__Host-shoppp-preview=${session}`,
              "X-Preview-Origin": env.PREVIEW_ORIGIN,
            },
            method: "POST",
          }),
          env,
        ),
      );
      await expectRetired(
        await app.fetch(
          request(`/build/storefront-experiences/builds/${buildId}/status`, {
            body: JSON.stringify({ failureCode: "retired", status: "failed" }),
            headers: {
              Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
              "Idempotency-Key": `retired-${themeId}-build-result`,
            },
            method: "POST",
          }),
          env,
        ),
      );
      await expectRetired(
        await app.fetch(
          request(`/build/storefront-experiences/builds/${buildId}`, {
            headers: { Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}` },
          }),
          env,
        ),
      );

      expect(
        (await app.fetch(request(`/admin/storefront-experiences/drafts/${draftId}`), env)).status,
      ).toBe(200);
      expect(
        (await app.fetch(request(`/admin/storefront-experiences/snapshots/${snapshotId}`), env))
          .status,
      ).toBe(200);
      expect(
        (await app.fetch(request(`/admin/storefront-experiences/builds/${buildId}`), env)).status,
      ).toBe(200);
      const retiredArtifactKey = `snapshots/${snapshotId}/${
        themeId === "decor" ? "c".repeat(64) : "d".repeat(64)
      }/index.html`;
      await env.PREVIEW_ARTIFACTS.put(retiredArtifactKey, "retained retired preview");
      expect(
        await cleanupExpiredStorefrontPreviews(env, new Date("2100-01-01T00:00:00.000Z")),
      ).toEqual({ artifacts: 0, grants: 0, objects: 0, sessions: 0 });
      expect(await env.PREVIEW_ARTIFACTS.get(retiredArtifactKey)).not.toBeNull();
      expect(await readRetiredLifecycleState(draftId, snapshotId, buildId)).toEqual(before);
    }
  });

  test("creates and previews unified Fashion defaults after resetting saved overrides", async () => {
    const app = createApp({
      experienceBuildTrigger: async () => ({ correlationId: "unified-default-preview" }),
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
    });
    const created = await createDraft(app, "theme-unified-create-0001", {
      ...draftInput,
      presetId: "unified-store",
    });
    expect(created.response.status).toBe(201);
    const draftId = created.body.data.id;
    const customized = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        {
          bindings: draftInput.bindings,
          expectedVersion: 1,
          overrides: [
            {
              operations: [
                {
                  instanceId: "fashion-store-home-categories",
                  kind: "set-setting",
                  settingId: "categories-presentation",
                  value: "source",
                },
              ],
              presetId: "unified-store",
              schemaVersion: 2,
              templateId: "fashion-store-home",
            },
          ],
          reason: "Temporarily customize the unified presentation",
        },
        "theme-unified-customize-0001",
        "PUT",
      ),
      env,
    );
    expect(customized.status).toBe(200);
    const reset = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        {
          bindings: draftInput.bindings,
          expectedVersion: 2,
          overrides: [],
          reason: "Reset to the exact unified preset defaults",
        },
        "theme-unified-reset-0001",
        "PUT",
      ),
      env,
    );
    expect(reset.status).toBe(200);
    expect(await reset.json()).toMatchObject({
      data: { overrides: [], presetId: "unified-store" },
    });
    expect((await validateDraft(app, draftId, 3, "theme-unified-validate-0001")).status).toBe(200);
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/preview`,
        { expectedVersion: 3, reason: "Preview the saved unified defaults" },
        "theme-unified-preview-0001",
      ),
      env,
    );
    expect(preview.status).toBe(202);
    const previewBody = await preview.json<{
      data: {
        snapshot: {
          snapshot: {
            overrides: unknown[];
            resolvedTemplates: Array<{
              pageType: string;
              sections: Array<{ id: string; settings: Record<string, unknown> }>;
            }>;
          };
          sourceDraftVersion: number;
        };
      };
    }>();
    expect(previewBody).toMatchObject({
      data: {
        snapshot: {
          snapshot: { overrides: [] },
          sourceDraftVersion: 3,
        },
      },
    });
    const previewHome = previewBody.data.snapshot.snapshot.resolvedTemplates.find(
      ({ pageType }) => pageType === "home",
    );
    expect(
      previewHome?.sections.find(({ id }) => id === "fashion-store-home-categories")?.settings,
    ).toMatchObject({ "categories-presentation": "source" });
  });

  test("keeps historical Fashion packages readable and validatable but rejects creation and activation", async () => {
    const historical = fashionStoreHistoricalPackages[0]!;
    const historicalFixtureBindings = fixtureBindingsForPackage(historical);
    const historicalBindings = [
      ...historicalFixtureBindings,
      ...catalogReadyDraftInput.bindings.filter(
        ({ instanceId, kind }) =>
          kind === "catalog" &&
          (instanceId === "fashion-store-home" || instanceId === "fashion-store-collection"),
      ),
    ];
    const historicalDraftId = "draft-fashion-store-historical-v1";
    const historicalReleaseId = "release-fashion-store-historical-v1";
    const now = "2026-09-07T00:00:00.000Z";
    const historicalOverrides = [
      {
        operations: [
          { instanceIds: ["fashion-store-home"], kind: "reorder-sections" },
          { instanceId: "fashion-store-home", kind: "set-visibility", visible: true },
          {
            instanceId: "fashion-store-home",
            kind: "set-setting",
            settingId: "announcement-text",
            value: "Migrated announcement",
          },
          {
            instanceId: "fashion-store-home",
            kind: "set-setting",
            settingId: "merchandising-order",
            value: 2,
          },
          {
            instanceId: "fashion-store-home",
            kind: "set-setting",
            settingId: "merchandising-visible",
            value: false,
          },
        ],
        presetId: "source-parity",
        schemaVersion: 1,
        templateId: "fashion-store-home",
      },
    ] as const;
    await env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
         (id, experience_id, theme_id, theme_version, configuration_schema_version,
          preset_id, bindings_json, overrides_json, version, created_by, updated_by,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
      .bind(
        historicalDraftId,
        "experience-fashion-store-historical-v1",
        historical.manifest.id,
        historical.manifest.themeVersion,
        historical.manifest.configurationSchemaVersion,
        historical.presets[0]!.id,
        JSON.stringify(historicalBindings),
        JSON.stringify(historicalOverrides),
        "admin-theme-admin",
        "admin-theme-admin",
        now,
        now,
      )
      .run();

    const read = await appFor().fetch(
      request(`/admin/storefront-experiences/drafts/${historicalDraftId}`),
      env,
    );
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      data: { id: historicalDraftId, themeVersion: "1.0.0" },
    });

    const historicalDraftBeforeMutation = await env.DB.prepare(
      "SELECT * FROM storefront_experience_drafts WHERE id = ?",
    )
      .bind(historicalDraftId)
      .first();
    const mutation = await appFor().fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${historicalDraftId}`,
        {
          bindings: [],
          expectedVersion: 1,
          overrides: [],
          reason: "Historical package drafts are immutable",
        },
        "theme-historical-mutation-rejected-0001",
        "PUT",
      ),
      env,
    );
    expect(mutation.status).toBe(422);
    expect(await mutation.json()).toMatchObject({
      error: { code: "storefront_theme_package_not_creatable" },
    });
    expect(
      await env.DB.prepare("SELECT * FROM storefront_experience_drafts WHERE id = ?")
        .bind(historicalDraftId)
        .first(),
    ).toEqual(historicalDraftBeforeMutation);

    await seedPreviewCatalogRelease(historicalReleaseId);
    const validation = await validateDraft(
      appFor(),
      historicalDraftId,
      1,
      "theme-historical-validation-0001",
      historicalReleaseId,
    );
    expect(validation.status).toBe(200);
    const catalogValidationBody = await validation.json<{
      data: { id: string; issues: unknown[]; status: string };
    }>();
    expect(catalogValidationBody).toMatchObject({ data: { issues: [], status: "valid" } });
    const migrationValidation = await validateDraft(
      appFor(),
      historicalDraftId,
      1,
      "theme-historical-fixture-validation-0001",
    );
    expect(migrationValidation.status).toBe(200);
    const validationBody = await migrationValidation.json<{
      data: { id: string; issues: unknown[]; status: string };
    }>();
    expect(validationBody).toMatchObject({ data: { issues: [], status: "valid" } });

    const historicalSnapshotId = "snapshot-fashion-store-historical-v1";
    const historicalSnapshot = {
      approvedAt: now,
      approvedBy: "admin-theme-admin",
      bindings: historicalBindings,
      configurationSchemaVersion: historical.manifest.configurationSchemaVersion,
      experienceId: "experience-fashion-store-historical-v1",
      id: historicalSnapshotId,
      kind: "approved",
      overrides: historicalOverrides,
      platformContractVersion: historical.manifest.platformContractVersion,
      provenance: historical.manifest.provenance,
      resolvedTemplates: historical.presets[0]!.templates,
      themeId: historical.manifest.id,
      themeVersion: historical.manifest.themeVersion,
      version: 1,
    };
    await env.DB.prepare(
      `INSERT INTO storefront_experience_snapshots
         (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
          source_validation_id, migration_id, kind, theme_id, theme_version,
          configuration_schema_version, snapshot_json, content_digest, created_by, approved_by,
          approved_at, created_at)
       VALUES (?, ?, ?, ?, 1, ?, NULL, 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        historicalSnapshotId,
        "fashion-store-historical-v1-approved",
        historicalSnapshot.experienceId,
        historicalDraftId,
        validationBody.data.id,
        historical.manifest.id,
        historical.manifest.themeVersion,
        historical.manifest.configurationSchemaVersion,
        JSON.stringify(historicalSnapshot),
        "0".repeat(64),
        "admin-theme-admin",
        "admin-theme-admin",
        now,
        now,
      )
      .run();
    const immutableSnapshot = await appFor().fetch(
      request(`/admin/storefront-experiences/snapshots/${historicalSnapshotId}`),
      env,
    );
    expect(immutableSnapshot.status).toBe(200);
    expect(await immutableSnapshot.json()).toMatchObject({
      data: {
        id: historicalSnapshotId,
        snapshot: { configurationSchemaVersion: 1, themeVersion: "1.0.0" },
      },
    });

    const historicalBuild = await appFor().fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${historicalSnapshotId}/build`,
        { catalogReleaseId: historicalReleaseId },
        "theme-historical-build-rejected-0001",
      ),
      env,
    );
    expect(historicalBuild.status).toBe(422);
    expect(await historicalBuild.json()).toMatchObject({
      error: { code: "storefront_theme_package_not_creatable" },
    });

    const historicalPreviewBuildId = "build-fashion-store-historical-v1";
    const historicalGrant = "historical_preview_grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const historicalSession = "historical_preview_session_ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO storefront_preview_builds
           (id, snapshot_id, catalog_release_id, experience_version, theme_id, theme_version,
            platform_contract_version, media_origins_json, attempt, status, artifact_digest,
            artifact_prefix, expires_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, '[]', 1, 'deployed', ?, ?,
                 '2099-09-07T00:00:00.000Z', ?, ?, ?)`,
      ).bind(
        historicalPreviewBuildId,
        historicalSnapshotId,
        historicalReleaseId,
        historical.manifest.id,
        historical.manifest.themeVersion,
        historical.manifest.platformContractVersion,
        "1".repeat(64),
        `snapshots/${historicalSnapshotId}/${historicalReleaseId}/${"1".repeat(64)}`,
        now,
        now,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO storefront_preview_grants
           (id, snapshot_id, build_id, grant_digest, origin, expires_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, '2099-09-07T00:00:00.000Z', 'admin-theme-admin', ?)`,
      ).bind(
        "grant-fashion-store-historical-v1",
        historicalSnapshotId,
        historicalPreviewBuildId,
        await sha256Hex(historicalGrant),
        env.PREVIEW_ORIGIN,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO storefront_preview_sessions
           (id, snapshot_id, build_id, session_digest, origin, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, '2099-09-07T00:00:00.000Z', ?)`,
      ).bind(
        "session-fashion-store-historical-v1",
        historicalSnapshotId,
        historicalPreviewBuildId,
        await sha256Hex(historicalSession),
        env.PREVIEW_ORIGIN,
        now,
      ),
    ]);
    const previewGrant = await appFor().fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${historicalSnapshotId}/grants`,
        {
          catalogReleaseId: historicalReleaseId,
          origin: env.PREVIEW_ORIGIN,
          reason: "Historical preview artifacts cannot issue new access",
        },
        "theme-historical-preview-grant-rejected-0001",
      ),
      env,
    );
    expect(previewGrant.status).toBe(422);
    expect(await previewGrant.json()).toMatchObject({
      error: { code: "storefront_theme_package_not_creatable" },
    });
    const previewSessionCountBeforeRedeem = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM storefront_preview_sessions",
    ).first<{ count: number }>();
    const previewRedeem = await appFor().fetch(
      request("/internal/preview/redeem", {
        body: JSON.stringify({ grant: historicalGrant, origin: env.PREVIEW_ORIGIN }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
      env,
    );
    expect(previewRedeem.status).toBe(422);
    expect(await previewRedeem.json()).toMatchObject({
      error: { code: "storefront_theme_package_not_creatable" },
    });
    expect(
      await env.DB.prepare(
        "SELECT redeemed_at FROM storefront_preview_grants WHERE id = 'grant-fashion-store-historical-v1'",
      ).first(),
    ).toEqual({ redeemed_at: null });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM storefront_preview_sessions").first(),
    ).toEqual(previewSessionCountBeforeRedeem);
    const previewAuthorization = await appFor().fetch(
      request("/internal/preview/authorize", {
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          Cookie: `__Host-shoppp-preview=${historicalSession}`,
          "X-Preview-Origin": env.PREVIEW_ORIGIN,
        },
        method: "POST",
      }),
      env,
    );
    expect(previewAuthorization.status).toBe(422);
    expect(await previewAuthorization.json()).toMatchObject({
      error: { code: "storefront_theme_package_not_creatable" },
    });

    const migrationSource = await appFor().fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${historicalDraftId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "Migrate the frozen source through the production registry",
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: "1.1.0",
        },
        "theme-historical-migration-source-0001",
      ),
      env,
    );
    expect(migrationSource.status).toBe(200);
    const migrationBody = await migrationSource.json<{
      data: { conflicts: unknown[]; id: string; status: string };
    }>();
    expect(migrationBody).toMatchObject({
      data: { conflicts: [], status: "dry_run" },
    });
    const noOverrideDraftId = `${historicalDraftId}-no-overrides`;
    await env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
         (id, experience_id, theme_id, theme_version, configuration_schema_version,
          preset_id, bindings_json, overrides_json, version, created_by, updated_by,
          created_at, updated_at)
       SELECT ?, experience_id || '-no-overrides', theme_id, theme_version,
              configuration_schema_version, preset_id, bindings_json, '[]', version,
              created_by, updated_by, created_at, updated_at
         FROM storefront_experience_drafts
        WHERE id = ?`,
    )
      .bind(noOverrideDraftId, historicalDraftId)
      .run();
    const noOverrideMigration = await appFor().fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${noOverrideDraftId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "Migrate an unchanged historical draft through the production registry",
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: "1.1.0",
        },
        "theme-historical-no-overrides-migration-0001",
      ),
      env,
    );
    expect(noOverrideMigration.status).toBe(200);
    const noOverrideMigrationBody = await noOverrideMigration.json<{
      data: { id: string };
    }>();
    expect(noOverrideMigrationBody).toMatchObject({
      data: { conflicts: [], status: "dry_run" },
    });
    expect(
      await env.DB.prepare(
        "SELECT migrated_overrides_json FROM storefront_experience_migrations WHERE id = ?",
      )
        .bind(noOverrideMigrationBody.data.id)
        .first(),
    ).toEqual({ migrated_overrides_json: "[]" });
    const migratedOverrides = await env.DB.prepare(
      "SELECT migrated_overrides_json FROM storefront_experience_migrations WHERE id = ?",
    )
      .bind(migrationBody.data.id)
      .first<{ migrated_overrides_json: string }>();
    const parsedMigratedOverrides = JSON.parse(migratedOverrides!.migrated_overrides_json);
    const migratedHomeOrder: string[] = fashionStoreHomeSections
      .map(({ id }) => id)
      .filter(
        (id) =>
          id !== "fashion-store-home-best-sellers" &&
          id !== "fashion-store-home-product-merchandising",
      );
    migratedHomeOrder.splice(1, 0, "fashion-store-home-best-sellers");
    migratedHomeOrder.push("fashion-store-home-product-merchandising");
    expect(parsedMigratedOverrides).toEqual([
      expect.objectContaining({
        operations: expect.arrayContaining([
          {
            instanceIds: migratedHomeOrder,
            kind: "reorder-sections",
          },
          expect.objectContaining({
            kind: "set-setting",
            settingId: "announcement-text",
            value: "Migrated announcement",
          }),
          {
            instanceId: "fashion-store-home-best-sellers",
            kind: "set-visibility",
            visible: false,
          },
        ]),
        presetId: "source-parity",
        schemaVersion: 2,
      }),
    ]);
    const migratedSuccessor = await appFor().fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${historicalDraftId}/migrations/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          migrationId: migrationBody.data.id,
          reason: "Create the reviewable production-wired migration successor",
        },
        "theme-historical-migration-approve-0001",
      ),
      env,
    );
    const migratedSuccessorBody = await migratedSuccessor.json<{
      data: { id: string };
    }>();
    expect(migratedSuccessor.status, JSON.stringify(migratedSuccessorBody)).toBe(201);
    expect(migratedSuccessorBody).toMatchObject({
      data: {
        bindings: historicalBindings,
        configurationSchemaVersion: 2,
        overrides: parsedMigratedOverrides,
        presetId: "source-parity",
        themeVersion: "1.1.0",
      },
    });
    const successorId = migratedSuccessorBody.data.id;
    const successorValidation = await validateDraft(
      appFor(),
      successorId,
      1,
      "theme-historical-successor-validation-0001",
      historicalReleaseId,
    );
    expect(successorValidation.status).toBe(200);
    expect(await successorValidation.json()).toMatchObject({
      data: { issues: [], status: "valid" },
    });
    const previewApp = createApp({
      experienceBuildTrigger: async () => ({ correlationId: "historical-successor-preview" }),
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
    });
    const successorPreview = await previewApp.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${successorId}/preview`,
        {
          catalogReleaseId: historicalReleaseId,
          expectedVersion: 1,
          reason: "Preview the migrated successor with unchanged bindings",
        },
        "theme-historical-successor-preview-0001",
      ),
      env,
    );
    expect(successorPreview.status).toBe(202);
    const successorPreviewBody = await successorPreview.json<{
      data: {
        snapshot: {
          snapshot: {
            resolvedTemplates: Array<{
              pageType: string;
              sections: Array<{ id: string; visible: boolean }>;
            }>;
          };
        };
      };
    }>();
    expect(successorPreviewBody).toMatchObject({
      data: {
        snapshot: {
          configurationSchemaVersion: 2,
          kind: "preview",
          sourceDraftId: successorId,
          themeVersion: "1.1.0",
        },
      },
    });
    const migratedPreviewHome = successorPreviewBody.data.snapshot.snapshot.resolvedTemplates.find(
      ({ pageType }) => pageType === "home",
    );
    expect(migratedPreviewHome?.sections.map(({ id }) => id)).toEqual(migratedHomeOrder);
    expect(
      migratedPreviewHome?.sections.find(({ id }) => id === "fashion-store-home-best-sellers")
        ?.visible,
    ).toBe(false);
    expect(
      await env.DB.prepare("SELECT * FROM storefront_experience_drafts WHERE id = ?")
        .bind(historicalDraftId)
        .first(),
    ).toEqual(historicalDraftBeforeMutation);

    const creation = await appFor().fetch(
      writeRequest(
        "/admin/storefront-experiences/drafts",
        {
          draft: { ...draftInput, themeVersion: "1.0.0" },
          reason: "Historical packages cannot seed new drafts",
        },
        "theme-historical-create-rejected-0001",
      ),
      env,
    );
    expect(creation.status).toBe(422);
    expect(await creation.json()).toMatchObject({
      error: { code: "storefront_theme_package_not_creatable" },
    });

    const copiedCreation = await appFor().fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${historicalDraftId}/successors`,
        {
          bindings: fashionStoreFixture.bindings,
          overrides: [],
          reason: "Historical packages cannot be copied into a new draft",
          sourceVersion: 1,
        },
        "theme-historical-successor-rejected-0001",
      ),
      env,
    );
    expect(copiedCreation.status).toBe(422);
    expect(await copiedCreation.json()).toMatchObject({
      error: { code: "storefront_theme_package_not_creatable" },
    });

    const activation = await appFor().fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${historicalDraftId}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Historical packages cannot activate" },
        "theme-historical-activation-rejected-0001",
      ),
      env,
    );
    expect(activation.status).toBe(422);
    expect(await activation.json()).toMatchObject({
      error: { code: "storefront_theme_package_not_creatable" },
    });
  });

  test("reconciles matching canonical claims and blocks contradictory migration successors", async () => {
    const releaseId = "release-fashion-canonical-migration";
    await seedPreviewCatalogRelease(releaseId, previewCatalogReleaseV3);
    const app = appFor();
    const inputFor = (brand: "visa" | "mastercard") => ({
      ...catalogReadyDraftInput,
      experienceId: `experience-canonical-${brand}`,
      overrides: [
        {
          operations: [
            {
              instanceId: "fashion-store-product",
              kind: "set-setting" as const,
              settingId: `payment-brand-${brand}`,
              value: true,
            },
            {
              instanceId: "fashion-store-product",
              kind: "reset-setting" as const,
              settingId: `payment-brand-${brand}`,
            },
          ],
          presetId: "source-parity",
          schemaVersion: 2,
          templateId: "fashion-store-product",
        },
      ],
    });
    const matching = await createDraft(app, "canonical-claim-match-create", inputFor("visa"));
    await validateDraft(app, matching.body.data.id, 1, "canonical-claim-match-validate", releaseId);
    expect(
      await env.DB.prepare(
        "SELECT status, issues_json FROM storefront_experience_validations WHERE draft_id = ? AND catalog_release_id = ?",
      )
        .bind(matching.body.data.id, releaseId)
        .first(),
    ).toEqual({ issues_json: "[]", status: "valid" });
    const before = await env.DB.prepare("SELECT * FROM storefront_experience_drafts WHERE id = ?")
      .bind(matching.body.data.id)
      .first();
    const matchingRun = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${matching.body.data.id}/migrations/dry-run`,
        {
          catalogReleaseId: releaseId,
          expectedVersion: 1,
          reason: "Reconcile matching released payment capability",
          targetConfigurationSchemaVersion: 3,
          targetThemeVersion: "1.2.0",
        },
        "canonical-claim-match-dry-run",
      ),
      env,
    );
    expect(matchingRun.status).toBe(200);
    const matchingBody = await matchingRun.json<{
      data: { conflicts: unknown[]; id: string };
    }>();
    expect(matchingBody.data.conflicts).toEqual([]);
    const migrated = await env.DB.prepare(
      "SELECT migrated_overrides_json FROM storefront_experience_migrations WHERE id = ?",
    )
      .bind(matchingBody.data.id)
      .first<{ migrated_overrides_json: string }>();
    expect(
      (JSON.parse(migrated!.migrated_overrides_json) as ThemeOverride[])[0]!.operations,
    ).toEqual([]);
    expect(
      await env.DB.prepare("SELECT * FROM storefront_experience_drafts WHERE id = ?")
        .bind(matching.body.data.id)
        .first(),
    ).toEqual(before);
    const approved = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${matching.body.data.id}/migrations/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          migrationId: matchingBody.data.id,
          reason: "Create reviewed canonical successor",
        },
        "canonical-claim-match-approve",
      ),
      env,
    );
    expect(approved.status).toBe(201);

    const conflicting = await createDraft(
      app,
      "canonical-claim-conflict-create",
      inputFor("mastercard"),
    );
    await validateDraft(
      app,
      conflicting.body.data.id,
      1,
      "canonical-claim-conflict-validate",
      releaseId,
    );
    const conflictRun = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${conflicting.body.data.id}/migrations/dry-run`,
        {
          catalogReleaseId: releaseId,
          expectedVersion: 1,
          reason: "Expose contradictory released payment capability",
          targetConfigurationSchemaVersion: 3,
          targetThemeVersion: "1.2.0",
        },
        "canonical-claim-conflict-dry-run",
      ),
      env,
    );
    const conflictBody = await conflictRun.json<{
      data: { conflicts: unknown[]; id: string };
    }>();
    expect(conflictBody.data.conflicts).toContainEqual(
      expect.objectContaining({
        code: "canonical-claim-conflict",
        settingId: "payment-brand-mastercard",
      }),
    );
    const blocked = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${conflicting.body.data.id}/migrations/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          migrationId: conflictBody.data.id,
          reason: "Must not create a contradictory successor",
        },
        "canonical-claim-conflict-approve",
      ),
      env,
    );
    expect(blocked.status).toBe(422);
  });

  test("uses the injected exact-package registry when copying a draft", async () => {
    const injectedPackage = themePackageSchema.parse({
      ...fashionStoreSuccessorPackage,
      manifest: {
        ...fashionStoreSuccessorPackage.manifest,
        themeVersion: "9.9.9",
      },
    });
    const app = createApp({
      storefrontExperienceServiceOptions: { packages: [injectedPackage] },
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
    });
    const created = await createDraft(
      app,
      "theme-injected-package-create-0001",
      storefrontExperienceDraftInputSchema.parse({
        ...draftInput,
        themeVersion: injectedPackage.manifest.themeVersion,
      }),
    );

    const successor = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/successors`,
        {
          bindings: fashionStoreFixture.bindings,
          overrides: [],
          reason: "Copy a draft resolved from the injected exact-package registry",
          sourceVersion: 1,
        },
        "theme-injected-package-successor-0001",
      ),
      env,
    );

    expect(successor.status).toBe(201);
    expect(await successor.json()).toMatchObject({
      data: { themeVersion: injectedPackage.manifest.themeVersion },
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
          destinations: expect.arrayContaining([
            expect.objectContaining({ id: "page.about", kind: "page", path: "/about" }),
            expect.objectContaining({
              id: "article.marketing-tips-and-tricks",
              kind: "article",
              path: "/magazine/marketing-tips-and-tricks",
            }),
            expect.objectContaining({
              id: "policy.privacy",
              kind: "policy",
              path: "/policies/privacy",
            }),
          ]),
          environment: "staging",
          id: releaseId,
          products: expect.arrayContaining([
            expect.objectContaining({ id: expect.stringMatching(/^prod_/) }),
          ]),
          status: "deployed",
        }),
      ]),
    });
    const resources = await app.fetch(
      request(
        `/admin/storefront-experiences/catalog-releases/${releaseId}/resources?kind=policy&page=1&pageSize=1&query=privacy`,
      ),
      env,
    );
    expect(resources.status).toBe(200);
    expect(await resources.json()).toMatchObject({
      data: [{ id: "policy.privacy", kind: "policy", path: "/policies/privacy" }],
      page: 1,
      pageSize: 1,
      total: 1,
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
    const created = await createDraft(app, "theme-permission-create-0001", catalogReadyDraftInput);
    await validateDraft(
      app,
      created.body.data.id,
      1,
      "theme-permission-validate-0001",
      "release-permission-parity",
    );
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
      expect(
        (
          await app.fetch(
            request(
              `/admin/storefront-experiences/drafts/${created.body.data.id}/preview-context?draftVersion=1&catalogReleaseId=release-permission-parity`,
            ),
            env,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await app.fetch(
            request(
              "/admin/storefront-experiences/catalog-releases/release-permission-parity/resources?kind=product",
            ),
            env,
          )
        ).status,
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

      const blockCommand = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${created.body.data.id}/block-commands`,
          {
            catalogReleaseId: "release-permission-parity",
            command: {
              blockId: "category-1",
              kind: "set-setting",
              settingId: "name",
              templateId: "fashion-store-home",
              value: "Permission-safe category",
            },
            expectedVersion: 1,
            reason: "Reject candidate-bound Block edits without Catalog access",
          },
          "theme-permission-block-command-denied-0001",
        ),
        env,
      );
      expect(blockCommand.status).toBe(403);

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

  test("requires every source-domain read permission when a route consumes a private candidate", async () => {
    await seedPrivatePreviewCatalogRelease("release-private-permission-candidate");
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async () => ({ correlationId: "private-permission-preview" }),
    });
    const created = await createDraft(
      app,
      "theme-private-permission-create",
      catalogReadyDraftInput,
    );
    const privateValidation = await validateDraft(
      app,
      created.body.data.id,
      1,
      "theme-private-permission-authorized-validate",
      "release-private-permission-candidate",
    );
    expect(privateValidation.status).toBe(200);
    const privatePreview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
        {
          catalogReleaseId: "release-private-permission-candidate",
          expectedVersion: 1,
          reason: "Create a public-release snapshot for grant permission proof",
        },
        "theme-private-permission-authorized-preview",
      ),
      env,
    );
    expect(privatePreview.status).toBe(202);
    const snapshot = await privatePreview.json<{
      data: { build: { id: string }; snapshot: { id: string } };
    }>();
    const workerManifest = await app.fetch(
      request(`/build/storefront-experiences/builds/${snapshot.data.build.id}`, {
        headers: { Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}` },
      }),
      env,
    );
    expect(workerManifest.status).toBe(200);
    expect(await workerManifest.json()).toMatchObject({
      catalogRelease: { releaseId: "release-private-permission-candidate" },
      presentationMode: "live",
    });
    const resources = await app.fetch(
      request(
        "/admin/storefront-experiences/catalog-releases/release-private-permission-candidate/resources?kind=product",
      ),
      env,
    );
    expect(resources.status).toBe(200);

    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = 'role_admin' AND permission_key = 'identity.read'",
    ).run();
    try {
      const validate = await validateDraft(
        app,
        created.body.data.id,
        1,
        "theme-private-permission-validate",
        "release-private-permission-candidate",
      );
      expect(validate.status).toBe(403);

      const preview = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
          {
            catalogReleaseId: "release-private-permission-candidate",
            expectedVersion: 1,
            reason: "Reject private Preview without Identity read access",
          },
          "theme-private-permission-preview",
        ),
        env,
      );
      expect(preview.status).toBe(403);

      const grant = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/snapshots/${snapshot.data.snapshot.id}/grants`,
          {
            catalogReleaseId: "release-private-permission-candidate",
            origin: env.PREVIEW_ORIGIN,
            reason: "Reject private grant without Identity read access",
          },
          "theme-private-permission-grant",
        ),
        env,
      );
      expect(grant.status).toBe(403);

      const resources = await app.fetch(
        request(
          "/admin/storefront-experiences/catalog-releases/release-private-permission-candidate/resources?kind=product",
        ),
        env,
      );
      expect(resources.status).toBe(403);
    } finally {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_admin', 'identity.read', '2026-08-04T00:00:00.000Z')`,
      ).run();
    }
    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = 'role_admin' AND permission_key = 'settings.read'",
    ).run();
    try {
      const migration = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${created.body.data.id}/migrations/dry-run`,
          {
            catalogReleaseId: "release-private-permission-candidate",
            expectedVersion: 1,
            reason: "Reject canonical migration without Settings read access",
            targetConfigurationSchemaVersion: 3,
            targetThemeVersion: "1.2.0",
          },
          "theme-private-permission-migration-settings-read",
        ),
        env,
      );
      expect(migration.status).toBe(403);

      const preview = await app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
          {
            catalogReleaseId: "release-private-permission-candidate",
            expectedVersion: 1,
            reason: "Reject private build without Settings read access",
          },
          "theme-private-permission-preview-settings-read",
        ),
        env,
      );
      expect(preview.status).toBe(403);
      expect(
        (
          await app.fetch(
            request(
              "/admin/storefront-experiences/catalog-releases/release-private-permission-candidate/resources?kind=product",
            ),
            env,
          )
        ).status,
      ).toBe(403);
    } finally {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_admin', 'settings.read', '2026-08-04T00:00:00.000Z')`,
      ).run();
    }
    for (const permission of [
      "identity.read",
      "policies.read",
      "content.read",
      "navigation.read",
      "settings.read",
    ] as const) {
      await env.DB.prepare(
        "DELETE FROM admin_role_permissions WHERE role_id = 'role_admin' AND permission_key = ?",
      )
        .bind(permission)
        .run();
      const denied = await app.fetch(
        request(
          "/admin/storefront-experiences/catalog-releases/release-private-permission-candidate/resources?kind=product",
        ),
        env,
      );
      expect(denied.status).toBe(403);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_admin', ?, '2026-08-04T00:00:00.000Z')`,
      )
        .bind(permission)
        .run();
    }
    await seedServiceAdmin(env.DB, {
      id: "private-candidate-service",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "private-candidate-service",
    });
    const serviceApp = createApp({
      testIdentityVerifier: async () => ({
        principalKind: "service",
        serviceName: "Private candidate service",
        subject: "private-candidate-service",
      }),
    });
    const serviceDenied = await serviceApp.fetch(
      request(
        "/admin/storefront-experiences/catalog-releases/release-private-permission-candidate/resources?kind=product",
      ),
      env,
    );
    expect(serviceDenied.status).toBe(403);
  });

  test("persists catalog references as stable identifiers and validates declared fields", async () => {
    const referenceReleaseId = "release-reference-validation";
    await seedPreviewCatalogRelease(referenceReleaseId);
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
        id: "catalog-fashion-store-collection-default-collection",
        instanceId: "fashion-store-collection",
        kind: "catalog" as const,
        reference: { id: collectionId, kind: "collection" as const },
        settingId: "default-collection",
      },
      {
        id: "catalog-fashion-store-home-featured-product",
        instanceId: "fashion-store-home",
        kind: "catalog" as const,
        reference: { id: productId, kind: "product" as const },
        settingId: "featured-product",
      },
      {
        id: "catalog-fashion-store-product-related-collection",
        instanceId: "fashion-store-product",
        kind: "catalog" as const,
        reference: { id: collectionId, kind: "collection" as const },
        settingId: "related-collection",
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
      referenceReleaseId,
    );
    expect(await validation.json()).toMatchObject({
      data: { issues: [], status: "valid" },
    });
    const persisted = await (
      await app.fetch(request(`/admin/storefront-experiences/drafts/${created.body.data.id}`), env)
    ).json<{ data: { bindings: unknown[] } }>();
    expect(persisted.data.bindings).toContainEqual({
      id: "catalog-fashion-store-home-featured-product",
      instanceId: "fashion-store-home",
      kind: "catalog",
      reference: { id: productId, kind: "product" },
      settingId: "featured-product",
    });
    expect(JSON.stringify(persisted.data.bindings)).not.toContain("price");
    expect(JSON.stringify(persisted.data.bindings)).not.toContain("sku");

    const missingProductBindings = bindings.map((binding) =>
      binding.id === "catalog-fashion-store-home-featured-product"
        ? {
            ...binding,
            reference: { id: "prod_01JPREVIEWPRODUCT99999999", kind: "product" as const },
          }
        : binding,
    );
    const missing = await createDraft(app, "theme-catalog-reference-missing-create-0001", {
      ...draftInput,
      bindings: missingProductBindings,
      overrides: [
        {
          operations: [
            {
              instanceId: "fashion-store-content",
              kind: "set-setting",
              settingId: "policy.document",
              value: { id: "policy.not-in-release", kind: "policy" },
            },
          ],
          presetId: "source-parity",
          schemaVersion: fashionStoreManifest.configurationSchemaVersion,
          templateId: "fashion-store-content",
        },
      ],
    });
    const missingValidation = await validateDraft(
      app,
      missing.body.data.id,
      1,
      "theme-catalog-reference-missing-validate-0001",
      referenceReleaseId,
    );
    expect(await missingValidation.json()).toMatchObject({
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "catalog_reference_missing",
            path: "fashion-store-home.featured-product",
          }),
          expect.objectContaining({
            code: "content_reference_missing",
            path: "fashion-store-content.policy.document",
          }),
        ]),
        status: "invalid",
      },
    });

    const missingPrimary = await createDraft(app, "theme-catalog-required-references-create-0001", {
      ...draftInput,
      bindings: bindings.filter(
        (binding) =>
          !("settingId" in binding) ||
          (binding.settingId !== "featured-collection" &&
            binding.settingId !== "default-collection"),
      ),
    });
    const missingPrimaryValidation = await validateDraft(
      app,
      missingPrimary.body.data.id,
      1,
      "theme-catalog-required-references-validate-0001",
      referenceReleaseId,
    );
    expect(await missingPrimaryValidation.json()).toMatchObject({
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "catalog_binding_missing",
            path: "fashion-store-home.featured-collection",
          }),
          expect.objectContaining({
            code: "catalog_binding_missing",
            path: "fashion-store-collection.default-collection",
          }),
        ]),
        status: "invalid",
      },
    });

    const fixtureOnly = await createDraft(
      app,
      "theme-catalog-fixture-only-create-0001",
      draftInput,
    );
    const fixtureOnlyReleaseValidation = await validateDraft(
      app,
      fixtureOnly.body.data.id,
      1,
      "theme-catalog-fixture-only-validate-0001",
      referenceReleaseId,
    );
    expect(await fixtureOnlyReleaseValidation.json()).toMatchObject({
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: "fashion-store-home.featured-collection" }),
          expect.objectContaining({ path: "fashion-store-collection.default-collection" }),
        ]),
        status: "invalid",
      },
    });
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
      schemaVersion: fashionStoreManifest.configurationSchemaVersion,
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

    const successor = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/successors`,
        {
          bindings: fashionStoreFixture.bindings,
          overrides: [override],
          reason: "Preserve local edits in a successor after the optimistic conflict",
          sourceVersion: 1,
        },
        "theme-draft-successor-0001",
      ),
      env,
    );
    expect(successor.status).toBe(201);
    expect(await successor.json()).toMatchObject({
      data: {
        id: expect.not.stringMatching(new RegExp(`^${draftId}$`)),
        overrides: [override],
        validation: null,
        version: 1,
      },
    });
    expect(
      await env.DB.prepare("SELECT version FROM storefront_experience_drafts WHERE id = ?")
        .bind(draftId)
        .first(),
    ).toEqual({ version: 2 });

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

  test("persists automatic audit facts for draft actions without handwritten notes", async () => {
    const app = appFor();
    const created = await app.fetch(
      writeRequest(
        "/admin/storefront-experiences/drafts",
        {
          draft: draftInput,
        },
        "theme-optional-note-create-0001",
      ),
      env,
    );
    expect(created.status).toBe(201);
    const { id } = (await created.json<{ data: { id: string } }>()).data;
    const updated = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${id}`,
        {
          bindings: draftInput.bindings,
          overrides: [],
          expectedVersion: 1,
          reason: "  ",
        },
        "theme-optional-note-update-0001",
        "PUT",
      ),
      env,
    );
    expect(updated.status).toBe(200);
    const rejectedNote = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${id}/validate`,
        { expectedVersion: 2, reason: "invalid\u202enote" },
        "theme-optional-note-invalid-validate",
      ),
      env,
    );
    expect(rejectedNote.status).toBe(422);
    expect(await rejectedNote.json()).toMatchObject({ error: { code: "invalid_audit_reason" } });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM storefront_experience_validations WHERE draft_id = ?",
      )
        .bind(id)
        .first(),
    ).toEqual({ count: 0 });
    const validated = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${id}/validate`,
        {
          expectedVersion: 2,
        },
        "theme-optional-note-validate-0001",
      ),
      env,
    );
    expect(validated.status).toBe(200);
    const audit = await env.DB.prepare(
      "SELECT actor_id, action, target_id, reason, metadata_json FROM audit_events WHERE target_id = ? ORDER BY created_at",
    )
      .bind(id)
      .all();
    expect(audit.results).toHaveLength(3);
    for (const row of audit.results)
      expect(row).toMatchObject({ actor_id: "admin-theme-admin", target_id: id, reason: null });
    expect(audit.results.map(({ action }) => action)).toEqual([
      "themes.draft.create",
      "themes.draft.update",
      "themes.draft.validate",
    ]);
    expect(audit.results[1]).toMatchObject({
      metadata_json: expect.stringContaining('"toVersion":2'),
    });
    expect(
      (
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${id}/approve`,
            {
              confirm: true,
              expectedVersion: 2,
              reason: "ok",
            },
            "theme-optional-note-approve-0001",
          ),
          env,
        )
      ).status,
    ).toBe(422);
  });

  test.each(["create", "update", "successor"] as const)(
    "rejects forbidden notes before Theme draft %s changes state",
    async (action) => {
      const app = appFor();
      const created = await createDraft(app, `theme-note-${action}-source`);
      expect(created.response.status).toBe(201);
      const id = created.body.data.id;
      const before = await env.DB.prepare(
        "SELECT * FROM storefront_experience_drafts ORDER BY id",
      ).all();
      const auditBefore = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE result = 'succeeded'",
      ).first();
      for (const [index, reason] of forbiddenNotes.entries()) {
        const path =
          action === "create"
            ? "/admin/storefront-experiences/drafts"
            : `/admin/storefront-experiences/drafts/${id}${action === "successor" ? "/successors" : ""}`;
        const input =
          action === "create"
            ? { draft: draftInput, reason }
            : {
                bindings: draftInput.bindings,
                overrides: [],
                reason,
                ...(action === "update" ? { expectedVersion: 1 } : { sourceVersion: 1 }),
              };
        const response = await app.fetch(
          writeRequest(
            path,
            input,
            `theme-note-${action}-${index}`,
            action === "update" ? "PUT" : "POST",
          ),
          env,
        );
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({ error: { code: "invalid_audit_reason" } });
        expect(
          (await env.DB.prepare("SELECT * FROM storefront_experience_drafts ORDER BY id").all())
            .results,
        ).toEqual(before.results);
        expect(
          await env.DB.prepare(
            "SELECT COUNT(*) AS count FROM audit_events WHERE result = 'succeeded'",
          ).first(),
        ).toEqual(auditBefore);
      }
    },
  );

  test("lists current validations for more drafts than one D1 binding batch", async () => {
    const catalogReleaseId = "release-draft-list-batch";
    await seedPreviewCatalogRelease(catalogReleaseId);
    const draftIds = Array.from(
      { length: 51 },
      (_, index) => `draft-list-batch-${String(index).padStart(2, "0")}`,
    );
    await env.DB.batch(
      draftIds.map((id, index) => {
        const timestamp = `2099-08-17T00:00:${String(index).padStart(2, "0")}.000Z`;
        return env.DB.prepare(
          `INSERT INTO storefront_experience_drafts
               (id, experience_id, theme_id, theme_version, configuration_schema_version,
                preset_id, bindings_json, overrides_json, version, created_by, updated_by,
                created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        ).bind(
          id,
          `experience-list-batch-${index}`,
          draftInput.themeId,
          draftInput.themeVersion,
          fashionStoreManifest.configurationSchemaVersion,
          draftInput.presetId,
          JSON.stringify(draftInput.bindings),
          JSON.stringify(draftInput.overrides),
          "admin-theme-admin",
          "admin-theme-admin",
          timestamp,
          timestamp,
        );
      }),
    );
    await env.DB.batch(
      draftIds.map((draftId) =>
        env.DB.prepare(
          `INSERT INTO storefront_experience_validations
               (id, draft_id, draft_version, catalog_release_id, status, issues_json,
                resolved_templates_json, validated_by, created_at)
             VALUES (?, ?, 1, NULL, 'valid', '[]', '[]', ?, ?)`,
        ).bind(
          `validation-list-batch-${draftId}`,
          draftId,
          "admin-theme-admin",
          "2099-08-17T00:01:00.000Z",
        ),
      ),
    );
    await env.DB.prepare(
      `INSERT INTO storefront_experience_validations
         (id, draft_id, draft_version, catalog_release_id, status, issues_json,
          resolved_templates_json, validated_by, created_at)
       VALUES (?, ?, 1, ?, 'valid', '[]', '[]', ?, ?)`,
    )
      .bind(
        "validation-list-batch-release",
        draftIds[0],
        catalogReleaseId,
        "admin-theme-admin",
        "2099-08-17T00:02:00.000Z",
      )
      .run();

    const response = await appFor().fetch(request("/admin/storefront-experiences/drafts"), env);
    expect(response.status).toBe(200);
    const body = await response.json<{
      data: Array<{
        id: string;
        validation: { catalogReleaseId: string | null; id: string } | null;
        validations: Array<{ catalogReleaseId: string | null; id: string }>;
      }>;
    }>();
    expect(draftIds.every((id) => body.data.some((draft) => draft.id === id))).toBe(true);
    expect(body.data.find(({ id }) => id === draftIds[0])).toMatchObject({
      validation: {
        catalogReleaseId: null,
        id: `validation-list-batch-${draftIds[0]}`,
      },
      validations: [
        { catalogReleaseId, id: "validation-list-batch-release" },
        { catalogReleaseId: null, id: `validation-list-batch-${draftIds[0]}` },
      ],
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
                schemaVersion: fashionStoreManifest.configurationSchemaVersion,
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
          schemaVersion: fashionStoreManifest.configurationSchemaVersion,
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
          schemaVersion: fashionStoreManifest.configurationSchemaVersion,
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
        { expectedVersion: 2, reason: "  " },
        "theme-preview-resolve-0001",
      ),
      env,
    );
    expect(preview.status).toBe(202);
    const value = await preview.json<{
      data: {
        build: { status: string };
        snapshot: {
          approvedAt: string | null;
          contentDigest: string;
          id: string;
          kind: string;
        };
      };
    }>();
    expect(value.data).toMatchObject({
      build: { status: "building" },
      snapshot: { approvedAt: null, kind: "preview" },
    });
    expect(triggerCalls).toHaveLength(1);
    expect(
      await env.DB.prepare(
        "SELECT reason FROM audit_events WHERE target_id = ? AND action = 'themes.preview.snapshot.create'",
      )
        .bind(value.data.snapshot.id)
        .first(),
    ).toEqual({ reason: null });
    expect(value.data.snapshot.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    const immutableDigest = value.data.snapshot.contentDigest;
    const advanced = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        {
          bindings: fashionStoreFixture.bindings,
          expectedVersion: 2,
          overrides: [],
          reason: "Advance the mutable draft after preview creation",
        },
        "theme-preview-update-0002",
        "PUT",
      ),
      env,
    );
    expect(advanced.status).toBe(200);
    const immutableSnapshot = await app.fetch(
      request(`/admin/storefront-experiences/snapshots/${value.data.snapshot.id}`),
      env,
    );
    expect(await immutableSnapshot.json()).toMatchObject({
      data: {
        contentDigest: immutableDigest,
        id: value.data.snapshot.id,
        sourceDraftVersion: 2,
      },
    });
    expect(
      await env.DB.prepare(
        "SELECT approved_at, content_digest, kind FROM storefront_experience_snapshots WHERE id = ?",
      )
        .bind(value.data.snapshot.id)
        .first(),
    ).toEqual({ approved_at: null, content_digest: immutableDigest, kind: "preview" });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM catalog_releases WHERE id = ?")
        .bind(value.data.snapshot.id)
        .first(),
    ).toEqual({ count: 0 });
  });

  test("binds validation and approval readiness to the selected Catalog Release", async () => {
    const firstReleaseId = "release-validation-first";
    const secondReleaseId = "release-validation-second";
    await seedPreviewCatalogRelease(firstReleaseId);
    await seedPreviewCatalogRelease(secondReleaseId);
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async () => ({ correlationId: "release-bound-preview" }),
    });
    const created = await createDraft(
      app,
      "theme-release-bound-create-0001",
      catalogReadyDraftInput,
    );
    const draftId = created.body.data.id;

    expect(
      (
        await validateDraft(
          app,
          draftId,
          1,
          "theme-release-bound-validate-first-0001",
          firstReleaseId,
        )
      ).status,
    ).toBe(200);
    const mismatchedPreview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/preview`,
        {
          catalogReleaseId: secondReleaseId,
          expectedVersion: 1,
          reason: "Reject validation from another Catalog Release",
        },
        "theme-release-bound-preview-mismatch-0001",
      ),
      env,
    );
    expect(mismatchedPreview.status).toBe(409);
    expect(await mismatchedPreview.json()).toMatchObject({
      error: { code: "storefront_experience_validation_stale" },
    });

    expect(
      (
        await validateDraft(
          app,
          draftId,
          1,
          "theme-release-bound-validate-second-0001",
          secondReleaseId,
        )
      ).status,
    ).toBe(200);
    const reloaded = await app.fetch(
      request(`/admin/storefront-experiences/drafts/${draftId}`),
      env,
    );
    expect(reloaded.status).toBe(200);
    expect(await reloaded.json()).toMatchObject({
      data: {
        validation: null,
        validations: expect.arrayContaining([
          expect.objectContaining({ catalogReleaseId: firstReleaseId, status: "valid" }),
          expect.objectContaining({ catalogReleaseId: secondReleaseId, status: "valid" }),
        ]),
      },
    });
    const matchingPreview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/preview`,
        {
          catalogReleaseId: secondReleaseId,
          expectedVersion: 1,
          reason: "Preview the release that passed validation",
        },
        "theme-release-bound-preview-match-0001",
      ),
      env,
    );
    expect(matchingPreview.status).toBe(202);
    const matching = await matchingPreview.json<{
      data: { build: { id: string }; snapshot: { id: string } };
    }>();
    const previewDigest = "d".repeat(64);
    expect(
      (
        await app.fetch(
          request(`/build/storefront-experiences/builds/${matching.data.build.id}/status`, {
            body: JSON.stringify({
              artifactDigest: previewDigest,
              artifactPrefix: `snapshots/${matching.data.snapshot.id}/${secondReleaseId}/${previewDigest}`,
              expiresAt: "2099-07-30T00:00:00.000Z",
              status: "deployed",
            }),
            headers: {
              Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
              "Content-Type": "application/json",
              "Idempotency-Key": "theme-release-bound-build-deployed-0001",
            },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    const hydrated = await app.fetch(
      request(
        `/admin/storefront-experiences/drafts/${draftId}/preview-context?draftVersion=1&catalogReleaseId=${secondReleaseId}`,
      ),
      env,
    );
    expect(hydrated.status).toBe(200);
    expect(await hydrated.json()).toMatchObject({
      data: {
        build: {
          inputIdentity: { catalogReleaseId: secondReleaseId, experienceVersion: 1 },
          status: "deployed",
        },
        snapshot: {
          id: matching.data.snapshot.id,
          sourceDraftId: draftId,
          sourceDraftVersion: 1,
        },
      },
    });
    for (const query of [
      `draftVersion=1&catalogReleaseId=${firstReleaseId}`,
      `draftVersion=2&catalogReleaseId=${secondReleaseId}`,
    ]) {
      const mismatched = await app.fetch(
        request(`/admin/storefront-experiences/drafts/${draftId}/preview-context?${query}`),
        env,
      );
      expect(mismatched.status).toBe(200);
      expect(await mismatched.json()).toMatchObject({ data: null });
    }

    const approval = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/approve`,
        {
          catalogReleaseId: secondReleaseId,
          confirm: true,
          expectedVersion: 1,
          reason: "Approve only after validating this Catalog Release",
        },
        "theme-release-bound-approve-0001",
      ),
      env,
    );
    expect(approval.status).toBe(200);
    const approved = await approval.json<{ data: { sourceValidationId: string } }>();
    expect(
      await env.DB.prepare(
        "SELECT catalog_release_id FROM storefront_experience_validations WHERE id = ?",
      )
        .bind(approved.data.sourceValidationId)
        .first(),
    ).toEqual({ catalog_release_id: secondReleaseId });
  });

  test("starts an idempotent build only from an approved immutable Catalog-bound snapshot", async () => {
    const catalogReleaseId = "release-approved-build";
    await seedPreviewCatalogRelease(catalogReleaseId);
    const triggerCalls: Array<{ catalogReleaseId?: string; snapshotId: string }> = [];
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async (input) => {
        triggerCalls.push(input);
        return { correlationId: "approved-build-correlation" };
      },
    });
    const created = await createDraft(
      app,
      "theme-approved-build-create-0001",
      catalogReadyDraftInput,
    );
    await validateDraft(
      app,
      created.body.data.id,
      1,
      "theme-approved-build-validate-0001",
      catalogReleaseId,
    );
    const approvedResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/approve`,
        {
          catalogReleaseId,
          confirm: true,
          expectedVersion: 1,
          reason: "Freeze one approved Catalog-bound Fashion input",
        },
        "theme-approved-build-approve-0001",
      ),
      env,
    );
    expect(approvedResponse.status).toBe(200);
    const approved = await approvedResponse.json<{ data: { id: string; kind: string } }>();
    expect(approved.data.kind).toBe("approved");

    const buildRequest = () =>
      app.fetch(
        writeRequest(
          `/admin/storefront-experiences/snapshots/${approved.data.id}/build`,
          { catalogReleaseId },
          "theme-approved-build-trigger-0001",
        ),
        env,
      );
    const started = await buildRequest();
    expect(started.status).toBe(202);
    expect(await started.json()).toMatchObject({
      data: {
        inputIdentity: { catalogReleaseId },
        snapshotId: approved.data.id,
        status: "building",
      },
    });
    const replay = await buildRequest();
    expect(replay.status).toBe(202);
    expect(triggerCalls).toHaveLength(1);
    expect(triggerCalls[0]).toMatchObject({ catalogReleaseId, snapshotId: approved.data.id });

    const previewResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
        {
          catalogReleaseId,
          expectedVersion: 1,
          reason: "Create a preview-kind snapshot that cannot be used as approval proof",
        },
        "theme-approved-build-preview-0001",
      ),
      env,
    );
    const preview = await previewResponse.json<{ data: { snapshot: { id: string } } }>();
    const rejected = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${preview.data.snapshot.id}/build`,
        { catalogReleaseId },
        "theme-preview-build-trigger-rejected-0001",
      ),
      env,
    );
    expect(rejected.status).toBe(409);
  });

  test("defers external build dispatch only for the exact Fashion staging namespace", async () => {
    const catalogReleaseId = "fashion-manual-build-release";
    await seedPreviewCatalogRelease(catalogReleaseId);
    const app = appFor();
    const created = await createDraft(
      app,
      "fashion-manual-build-create-0001",
      catalogReadyDraftInput,
    );
    await validateDraft(
      app,
      created.body.data.id,
      1,
      "fashion-manual-build-validate-0001",
      catalogReleaseId,
    );
    const approvedResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/approve`,
        {
          catalogReleaseId,
          confirm: true,
          expectedVersion: 1,
          reason: "Freeze one manually dispatched Fashion build input",
        },
        "fashion-manual-build-approve-0001",
      ),
      env,
    );
    const approved = await approvedResponse.json<{ data: { id: string } }>();

    const rejected = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${approved.data.id}/build`,
        { catalogReleaseId, manualDispatch: true },
        "fashion-manual-build-rejected-0001",
      ),
      env,
    );
    expect(rejected.status).toBe(403);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM storefront_preview_builds WHERE snapshot_id = ?",
      )
        .bind(approved.data.id)
        .first(),
    ).toEqual({ count: 0 });

    const started = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${approved.data.id}/build`,
        { catalogReleaseId, manualDispatch: true },
        "fashion-manual-build-started-0001",
      ),
      { ...env, RESOURCE_NAMESPACE: "shoppp-fashion-staging" },
    );
    expect(started.status).toBe(202);
    expect(await started.json()).toMatchObject({
      data: {
        correlationId: expect.stringContaining("manual-fashion-preparation-"),
        snapshotId: approved.data.id,
        status: "building",
      },
    });
  });

  test("requires theme approval permission independently from draft write permission", async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO admin_roles
           (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('role_theme_writer', 'theme_writer', 'Theme writer', 0, 0, 1, 1, ?, ?)`,
      ).bind("2026-08-04T00:00:00.000Z", "2026-08-04T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_theme_writer', 'themes.write', '2026-08-04T00:00:00.000Z')`,
      ),
    ]);
    await seedHumanAdmin(env.DB, {
      displayName: "theme-writer",
      email: "theme-writer@example.test",
      id: "admin-theme-writer",
      roleId: "role_theme_writer",
      subject: "theme-writer",
    });
    const app = appFor("theme-writer");
    const created = await createDraft(app, "theme-approval-permission-create-0001");
    await validateDraft(app, created.body.data.id, 1, "theme-approval-permission-validate-0001");
    const denied = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          reason: "A writer must not approve immutable Experience content",
        },
        "theme-approval-permission-denied-0001",
      ),
      env,
    );
    expect(denied.status).toBe(403);
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

  test("reconciles a retried run-bound Fashion approval without replacing its evidence", async () => {
    const app = appFor();
    const catalogReleaseId = "fashion-run-bound-release";
    const operatorNow = new Date();
    await seedPreviewCatalogRelease(catalogReleaseId);
    const created = await createDraft(
      app,
      "theme-run-bound-approval-create-0001",
      catalogReadyDraftInput,
    );
    const settingsResponse = await app.fetch(request("/admin/settings/contact"), env);
    const { data: contact } = await settingsResponse.json<{
      data: { profileVersion: string | null; publicContact: unknown };
    }>();
    const contactVersion = await sha256Hex(
      canonicalStorefrontJson({
        profileVersion: contact.profileVersion,
        publicContact: contact.publicContact,
      }),
    );
    let draftId = "";
    for (let index = 0; index < 500; index += 1) {
      const candidate = `draft-run-bound-retry-${index}`;
      const key = `${candidate}:1:${catalogReleaseId}:approved:${fashionStoreManifest.themeVersion}:${fashionStoreManifest.configurationSchemaVersion}:contact:${contactVersion}`;
      const snapshotId = `snapshot-approved-${(await sha256Hex(key)).slice(0, 32)}`;
      if (redactForLog(snapshotId) !== snapshotId) {
        draftId = candidate;
        break;
      }
    }
    expect(draftId).not.toBe("");
    // Exercise an opaque ID that the generic payment-data heuristic would redact.
    await env.DB.prepare("UPDATE storefront_experience_drafts SET id = ? WHERE id = ?")
      .bind(draftId, created.body.data.id)
      .run();
    await validateDraft(
      app,
      draftId,
      1,
      "theme-run-bound-approval-validate-0001",
      catalogReleaseId,
    );
    const validation = await env.DB.prepare(
      `SELECT id FROM storefront_experience_validations
        WHERE draft_id = ? AND draft_version = 1 AND catalog_release_id = ?`,
    )
      .bind(draftId, catalogReleaseId)
      .first<{ id: string }>();
    await env.DB.prepare(
      `INSERT INTO storefront_experience_snapshots
         (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
          source_validation_id, migration_id, kind, theme_id, theme_version,
          configuration_schema_version, snapshot_json, content_digest, created_by, approved_by,
          approved_at, created_at)
       VALUES ('snapshot-fashion-u12-retry', 'fashion-u12-retry-approved', 'fashion-u12', ?, 1,
               ?, NULL, 'approved', 'fashion-store', '1.0.0', 1, '{}', ?,
               'admin-theme-admin', 'admin-theme-admin', ?, ?)`,
    )
      .bind(
        draftId,
        validation!.id,
        "0".repeat(64),
        operatorNow.toISOString(),
        operatorNow.toISOString(),
      )
      .run();
    await createFashionStagingOperatorRun(
      env.DB,
      {
        candidateSha: "1".repeat(40),
        catalogReleaseId,
        contractTestDigest: "2".repeat(64),
        environment: "fashion-staging",
        expiresAt: new Date(operatorNow.getTime() + 60 * 60_000).toISOString(),
        harnessManifestDigest: "3".repeat(64),
        harnessSha: "4".repeat(40),
        repository: "hashencode/shoppp",
        runId: "fashion-u8-retry-reconciliation",
        runManifestDigest: "5".repeat(64),
        sourceDraftId: draftId,
        u12ReadinessDigest: "6".repeat(64),
        u12SnapshotId: "snapshot-fashion-u12-retry",
        workflowRunAttempt: 1,
        workflowRunId: "40000000004",
      },
      operatorNow,
    );
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/preview`,
        {
          catalogReleaseId,
          expectedVersion: 1,
          reason: "Build the exact run-bound private preview on the hosted executor",
        },
        "theme-run-bound-preview-create-0001",
      ),
      { ...env, RESOURCE_NAMESPACE: "shoppp-fashion-staging" },
    );
    expect(preview.status).toBe(202);
    expect(await preview.json()).toMatchObject({
      data: {
        build: {
          correlationId: expect.stringMatching(/^manual-fashion-preparation-/),
          status: "building",
        },
        snapshot: { kind: "preview", sourceDraftId: draftId, sourceDraftVersion: 1 },
      },
    });
    const mismatched = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Reject an unbound Catalog Release" },
        "theme-run-bound-approval-mismatch-0001",
      ),
      env,
    );
    expect(mismatched.status).toBe(409);
    const approve = (key: string) =>
      app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/approve`,
          {
            catalogReleaseId,
            confirm: true,
            expectedVersion: 1,
            reason: "Approve the exact run-bound draft",
          },
          key,
        ),
        env,
      );

    const first = await approve("theme-run-bound-approval-first-0001");
    const retry = await approve("theme-run-bound-approval-retry-0001");
    expect([first.status, retry.status], JSON.stringify(await retry.clone().json())).toEqual([
      200, 200,
    ]);
    const [firstBody, retryBody] = await Promise.all([
      first.json<{ data: { contentDigest: string; id: string } }>(),
      retry.json<{ data: { contentDigest: string; id: string } }>(),
    ]);
    expect(retryBody.data).toMatchObject(firstBody.data);
    expect(redactForLog(firstBody.data.id)).not.toBe(firstBody.data.id);
    const operatorRun = await getFashionStagingOperatorRun(
      env.DB,
      "fashion-u8-retry-reconciliation",
    );
    expect(operatorRun).toMatchObject({
      operatorIdentityId: "admin-theme-admin",
      status: "approved",
      successorContentDigest: firstBody.data.contentDigest,
      successorSnapshotId: firstBody.data.id,
    });
    expect(operatorRun.approvalAuditId).toMatch(/^audit-fashion-u8-[a-f0-9]{32}$/);
    const audit = await env.DB.prepare(
      `SELECT actor_id, action, target_id, metadata_json FROM audit_events WHERE id = ?`,
    )
      .bind(operatorRun.approvalAuditId)
      .first<{ actor_id: string; action: string; target_id: string; metadata_json: string }>();
    expect(audit).toMatchObject({
      action: "themes.fashion-staging.operator.approve",
      actor_id: "admin-theme-admin",
      target_id: "fashion-u8-retry-reconciliation",
    });
    expect(JSON.parse(audit!.metadata_json)).toEqual({
      catalogReleaseId,
      draftId,
      draftVersion: 1,
      snapshotContentDigest: firstBody.data.contentDigest,
      snapshotId: firstBody.data.id,
    });
  });

  test("dry-runs an explicit schema migration, reports stable-ID conflicts, and preserves older snapshots", async () => {
    const sourcePackage = fashionStoreHistoricalPackages[0]!;
    const sourceBindings = fixtureBindingsForPackage(sourcePackage);
    const targetPackage = fashionStoreV11Package;
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
    const undeclaredTargetPackage = themePackageSchema.parse({
      ...targetPackage,
      manifest: { ...targetPackage.manifest, themeVersion: "1.3.0" },
    });
    const storefrontExperienceServiceOptions: StorefrontExperienceServiceOptions = {
      migrationBoundaries: [
        {
          source: { configurationSchemaVersion: 1, themeVersion: "1.0.0" },
          target: { configurationSchemaVersion: 2, themeVersion: "1.1.0" },
          themeId: "fashion-store",
        },
        {
          source: { configurationSchemaVersion: 1, themeVersion: "1.0.0" },
          target: { configurationSchemaVersion: 2, themeVersion: "1.2.0" },
          themeId: "fashion-store",
        },
      ],
      migrations: [
        {
          fromConfigurationSchemaVersion: 1,
          migrate: (overrides) => overrides.map((override) => ({ ...override, schemaVersion: 2 })),
          themeId: "fashion-store",
          toConfigurationSchemaVersion: 2,
        },
      ],
      packages: [
        sourcePackage,
        targetPackage,
        fashionStoreSuccessorPackage,
        conflictingPackage,
        undeclaredTargetPackage,
      ],
    };
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      storefrontExperienceServiceOptions,
    });
    const created = await createDraft(app, "theme-migration-create-0001", {
      ...draftInput,
      bindings: sourceBindings,
      themeVersion: "1.0.0",
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
    const mismatchedSourceId = `${draftId}-mismatched-schema`;
    await env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
         (id, experience_id, theme_id, theme_version, configuration_schema_version,
          preset_id, bindings_json, overrides_json, version, created_by, updated_by,
          created_at, updated_at)
       SELECT ?, experience_id || '-mismatched-schema', theme_id, theme_version, 2,
              preset_id, bindings_json, overrides_json, version, created_by, updated_by,
              created_at, updated_at
         FROM storefront_experience_drafts
        WHERE id = ?`,
    )
      .bind(mismatchedSourceId, draftId)
      .run();
    const migrationsBeforeMismatch = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM storefront_experience_migrations",
    ).first<{ count: number }>();
    const mismatchedSource = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${mismatchedSourceId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "Reject a source tuple not present in the exact package registry",
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: "1.1.0",
        },
        "theme-migration-source-schema-mismatch-0001",
      ),
      env,
    );
    expect(mismatchedSource.status).toBe(422);
    expect(await mismatchedSource.json()).toMatchObject({
      error: { code: "storefront_theme_version_invalid" },
    });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM storefront_experience_migrations",
      ).first(),
    ).toEqual(migrationsBeforeMismatch);
    const undeclaredBoundary = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "Reject a target tuple outside the declared direct boundary registry",
          targetConfigurationSchemaVersion: 3,
          targetThemeVersion: "1.2.0",
        },
        "theme-migration-boundary-undeclared-0001",
      ),
      env,
    );
    expect(undeclaredBoundary.status).toBe(422);
    expect(await undeclaredBoundary.json()).toMatchObject({
      error: { code: "storefront_experience_migration_boundary_invalid" },
    });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM storefront_experience_migrations",
      ).first(),
    ).toEqual(migrationsBeforeMismatch);
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

    const rejectedMigrationNote = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "invalid\u202enote",
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: "1.1.0",
        },
        "theme-migration-invalid-note",
      ),
      env,
    );
    expect(rejectedMigrationNote.status).toBe(422);
    expect(await rejectedMigrationNote.json()).toMatchObject({
      error: { code: "invalid_audit_reason" },
    });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM storefront_experience_migrations",
      ).first(),
    ).toEqual(migrationsBeforeMismatch);

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

    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO admin_roles
           (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('role_migration_writer', 'migration_writer', 'Migration writer', 0, 0, 1, 1, ?, ?)`,
      ).bind("2026-08-04T00:00:00.000Z", "2026-08-04T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT OR IGNORE INTO admin_roles
           (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('role_migration_approver', 'migration_approver', 'Migration approver', 0, 0, 1, 1, ?, ?)`,
      ).bind("2026-08-04T00:00:00.000Z", "2026-08-04T00:00:00.000Z"),
      env.DB.prepare("DELETE FROM admin_role_permissions WHERE role_id = 'role_migration_writer'"),
      env.DB.prepare(
        "DELETE FROM admin_role_permissions WHERE role_id = 'role_migration_approver'",
      ),
      env.DB.prepare(
        `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_migration_writer', 'themes.write', '2026-08-04T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_migration_approver', 'themes.approve', '2026-08-04T00:00:00.000Z')`,
      ),
    ]);
    await seedHumanAdmin(env.DB, {
      displayName: "migration-writer",
      email: "migration-writer@example.test",
      id: "admin-migration-writer",
      roleId: "role_migration_writer",
      subject: "migration-writer",
    });
    await seedHumanAdmin(env.DB, {
      displayName: "migration-approver",
      email: "migration-approver@example.test",
      id: "admin-migration-approver",
      roleId: "role_migration_approver",
      subject: "migration-approver",
    });
    const appForMigrationRole = (subject: "migration-writer" | "migration-approver") =>
      createApp({
        testIdentityVerifier: async () => ({
          email: `${subject}@example.test`,
          principalKind: "human",
          subject,
        }),
        storefrontExperienceServiceOptions,
      });
    const writerDenied = await appForMigrationRole("migration-writer").fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          migrationId: migration.data.id,
          reason: "A theme writer must not create a migration successor",
        },
        "theme-migration-writer-denied-0001",
      ),
      env,
    );
    expect(writerDenied.status).toBe(403);
    expect(await writerDenied.json()).toMatchObject({ error: { code: "permission_denied" } });

    const draftsBeforeInvalidApproval = await env.DB.prepare(
      "SELECT * FROM storefront_experience_drafts ORDER BY id",
    ).all();
    const migrationBeforeInvalidApproval = await env.DB.prepare(
      "SELECT * FROM storefront_experience_migrations WHERE id = ?",
    )
      .bind(migration.data.id)
      .first();
    const auditsBeforeInvalidApproval = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE result = 'succeeded'",
    ).first();
    for (const [index, reason] of ["valid\u0007note", "valid\u202enote", "x\ny"].entries()) {
      const rejected = await appForMigrationRole("migration-approver").fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/migrations/approve`,
          { confirm: true, expectedVersion: 1, migrationId: migration.data.id, reason },
          `theme-migration-invalid-approval-${index}`,
        ),
        env,
      );
      expect(rejected.status).toBe(422);
      expect(await rejected.json()).toMatchObject({ error: { code: "invalid_audit_reason" } });
      expect(
        (await env.DB.prepare("SELECT * FROM storefront_experience_drafts ORDER BY id").all())
          .results,
      ).toEqual(draftsBeforeInvalidApproval.results);
      expect(
        await env.DB.prepare("SELECT * FROM storefront_experience_migrations WHERE id = ?")
          .bind(migration.data.id)
          .first(),
      ).toEqual(migrationBeforeInvalidApproval);
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE result = 'succeeded'",
        ).first(),
      ).toEqual(auditsBeforeInvalidApproval);
    }

    const migratedSuccessor = await appForMigrationRole("migration-approver").fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          migrationId: migration.data.id,
          reason: "Create a reviewable successor for the compatible migration",
        },
        "theme-migration-approve-0001",
      ),
      env,
    );
    expect(migratedSuccessor.status).toBe(201);
    const successor = await migratedSuccessor.json<{
      data: {
        configurationSchemaVersion: number;
        id: string;
        themeVersion: string;
        version: number;
      };
    }>();
    expect(successor).toMatchObject({
      data: {
        configurationSchemaVersion: 2,
        id: expect.stringMatching(/^draft-/),
        themeVersion: "1.1.0",
        validation: null,
        version: 1,
      },
    });
    expect(successor.data.id).not.toBe(draftId);
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM storefront_experience_snapshots WHERE migration_id = ?",
        )
          .bind(migration.data.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);
    const successorValidation = await validateDraft(
      app,
      successor.data.id,
      1,
      "theme-migration-successor-validate-0001",
    );
    expect(successorValidation.status).toBe(200);
    const successorApproval = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${successor.data.id}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Approve the reviewed migration successor" },
        "theme-migration-successor-approval-0001",
      ),
      env,
    );
    expect(await successorApproval.json()).toMatchObject({
      data: { configurationSchemaVersion: 2, themeVersion: "1.1.0" },
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
    for (const [releaseId, code] of [
      [legacyReleaseId, "catalog_release_unavailable"],
      ["release-preview-building", "catalog_release_unavailable"],
      ["release-preview-missing", "catalog_release_unavailable"],
      ["release-preview-malformed", "catalog_release_invalid"],
      ["release-preview-identity-mismatch", "catalog_release_invalid"],
    ] as const) {
      const validation = await validateDraft(
        app,
        created.body.data.id,
        1,
        `theme-invalid-release-validation-${releaseId}`,
        releaseId,
      );
      expect(validation.status).toBe(422);
      expect(await validation.json()).toMatchObject({ error: { code } });
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
      expect(preview.status).toBe(409);
      expect(await preview.json()).toMatchObject({
        error: { code: "storefront_experience_validation_stale" },
      });
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
    const created = await createDraft(
      app,
      "theme-concurrent-build-create-0001",
      catalogReadyDraftInput,
    );
    const draftId = created.body.data.id;
    await Promise.all(
      [releaseA, releaseB, releaseC, releaseBlocked].map((releaseId, index) =>
        validateDraft(app, draftId, 1, `theme-concurrent-build-validate-${index + 1}`, releaseId),
      ),
    );
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
    expect(distinctBodies.map(({ data }) => data.build.attempt)).toEqual([1, 1]);
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
    await seedPreviewCatalogRelease(previewCatalogRelease.releaseId, previewCatalogReleaseV3);
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
    const created = await createDraft(app, "theme-live-preview-create-0001", {
      ...catalogReadyDraftInput,
      themeVersion: fashionStoreSuccessorPackage.manifest.themeVersion,
    });
    await validateDraft(
      app,
      created.body.data.id,
      1,
      "theme-live-preview-validate-0001",
      previewCatalogRelease.releaseId,
    );
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
        build: {
          id: string;
          inputIdentity: Record<string, unknown>;
          mediaOrigins: string[];
        };
        snapshot: { id: string };
      };
    }>();
    expect(value.data.build.inputIdentity).toMatchObject({
      catalogReleaseId: previewCatalogRelease.releaseId,
      experienceSnapshotId: value.data.snapshot.id,
      experienceVersion: 1,
      platformContractVersion: "1.0.0",
      themeId: "fashion-store",
      themeVersion: fashionStoreSuccessorPackage.manifest.themeVersion,
    });
    expect(value.data.build.mediaOrigins).toEqual(previewMediaOrigins);
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
      catalogRelease: {
        commerce: {
          payment: { brands: ["visa"], enabled: true },
          shippingMethods: [expect.objectContaining({ countryCodes: ["US"] })],
        },
        releaseId: previewCatalogRelease.releaseId,
        schemaVersion: 3,
      },
      inputIdentity: value.data.build.inputIdentity,
      mediaOrigins: previewMediaOrigins,
      snapshot: { id: value.data.snapshot.id, version: 1 },
    });

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
    const rotatedMediaEnvironment = new Proxy(env, {
      get(target, property) {
        if (property === "MEDIA_PUBLIC_ORIGIN") return "https://media-b.example.test";
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
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
      rotatedMediaEnvironment,
    );
    expect(await authorization.json()).toMatchObject({
      artifactPrefix: `snapshots/${value.data.snapshot.id}/${previewCatalogRelease.releaseId}/${digest}`,
      inputIdentity: value.data.build.inputIdentity,
      mediaOrigins: previewMediaOrigins,
    });

    const legacySession = "legacy_preview_session_ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const legacyBuildId = `legacy-${value.data.build.id}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO storefront_preview_builds
             (id, snapshot_id, catalog_release_id, experience_version, theme_id, theme_version,
              platform_contract_version, media_origins_json, attempt, status, artifact_digest,
              artifact_prefix, expires_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 1, 'fashion-store', '1.0.0', '1.0.0', NULL, 2, 'deployed',
                   ?, ?, '2099-08-11T00:00:00.000Z', '2026-08-11T00:00:00.000Z',
                   '2026-08-11T00:00:00.000Z', '2026-08-11T00:00:00.000Z')`,
      ).bind(
        legacyBuildId,
        value.data.snapshot.id,
        previewCatalogRelease.releaseId,
        "e".repeat(64),
        `snapshots/${value.data.snapshot.id}/${previewCatalogRelease.releaseId}/${"e".repeat(64)}`,
      ),
      env.DB.prepare(
        `INSERT INTO storefront_preview_sessions
             (id, snapshot_id, build_id, session_digest, origin, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, '2099-08-11T00:00:00.000Z',
                   '2026-08-11T00:00:00.000Z')`,
      ).bind(
        `session-${legacyBuildId}`,
        value.data.snapshot.id,
        legacyBuildId,
        await sha256Hex(legacySession),
        env.PREVIEW_ORIGIN,
      ),
    ]);
    const legacyAuthorization = await app.fetch(
      request("/internal/preview/authorize", {
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          Cookie: `__Host-shoppp-preview=${legacySession}`,
          "X-Preview-Origin": env.PREVIEW_ORIGIN,
        },
        method: "POST",
      }),
      rotatedMediaEnvironment,
    );
    expect(legacyAuthorization.status).toBe(403);

    const pendingGrantResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${value.data.snapshot.id}/grants`,
        {
          catalogReleaseId: previewCatalogRelease.releaseId,
          origin: env.PREVIEW_ORIGIN,
          reason: "Verify abandonment revokes unused grants",
        },
        "theme-live-preview-grant-abandon-0001",
      ),
      env,
    );
    expect(pendingGrantResponse.status).toBe(201);
    const pendingGrant = await pendingGrantResponse.json<{ data: { grant: string } }>();
    const abandoned = await app.fetch(
      writeRequest(
        `/admin/catalog/releases/preview-candidates/${previewCatalogRelease.releaseId}/abandon`,
        { reason: "Abandon exact private candidate" },
        "theme-live-preview-abandon-0001",
      ),
      env,
    );
    expect(abandoned.status).toBe(200);
    const redeemAfterAbandon = await app.fetch(
      request("/internal/preview/redeem", {
        body: JSON.stringify({ grant: pendingGrant.data.grant, origin: env.PREVIEW_ORIGIN }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
      env,
    );
    expect(redeemAfterAbandon.status).toBe(403);
    const authorizeAfterAbandon = await app.fetch(
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
    expect(authorizeAfterAbandon.status).toBe(403);
  });

  test("validates the selected Theme Logo variant against frozen Store Identity", async () => {
    const releaseId = "release-only-dark-logo";
    await seedPreviewCatalogRelease(
      releaseId,
      catalogReleaseV3Schema.parse({
        ...previewCatalogReleaseV3,
        releaseId,
        identity: {
          ...previewCatalogReleaseV3.identity,
          logoAssets: [
            {
              assetId: "asset.logo.dark",
              variant: "dark",
              media: { alt: "Dark Logo", height: 64, src: "/media/dark-logo.webp", width: 180 },
            },
          ],
        },
      }),
    );
    const app = appFor();
    const defaultDraft = await createDraft(app, "logo-default-draft", {
      ...catalogReadyDraftInput,
      themeVersion: fashionStoreSuccessorPackage.manifest.themeVersion,
    });
    expect(defaultDraft.response.status).toBe(201);
    const defaultValidation = await validateDraft(
      app,
      defaultDraft.body.data.id,
      1,
      "logo-default-validate",
      releaseId,
    );
    expect(await defaultValidation.json()).toMatchObject({
      data: {
        status: "invalid",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "identity_logo_variant_missing" }),
        ]),
      },
    });
    const invalidPreview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${defaultDraft.body.data.id}/preview`,
        { catalogReleaseId: releaseId, expectedVersion: 1, reason: "Reject missing selected Logo" },
        "logo-default-preview-0001",
      ),
      env,
    );
    expect(invalidPreview.status).toBe(409);
    const darkDraft = await createDraft(app, "logo-dark-draft-0001", {
      ...catalogReadyDraftInput,
      experienceId: "experience-dark-logo",
      themeVersion: fashionStoreSuccessorPackage.manifest.themeVersion,
      overrides: [
        {
          operations: [
            {
              instanceId: "fashion-store-home",
              kind: "set-setting",
              settingId: "identity-logo-variant",
              value: "dark",
            },
          ],
          presetId: "source-parity",
          schemaVersion: 3,
          templateId: "fashion-store-home",
        },
      ],
    });
    expect(darkDraft.response.status).toBe(201);
    const darkValidation = await validateDraft(
      app,
      darkDraft.body.data.id,
      1,
      "logo-dark-validate",
      releaseId,
    );
    expect(await darkValidation.json()).toMatchObject({ data: { status: "valid", issues: [] } });
  });

  test("rejects a Catalog Release whose preview media exceeds the bounded origin set", async () => {
    const releaseId = "release-preview-too-many-media-origins";
    const release = canonicalCatalogReleaseSchema.parse({
      ...previewCatalogRelease,
      products: previewCatalogRelease.products.map((product, index) =>
        index === 0
          ? {
              ...product,
              media: Array.from({ length: 9 }, (_, mediaIndex) => ({
                ...product.media[0]!,
                src: `https://media-${mediaIndex}.example.test/catalog/atlas.svg`,
              })),
            }
          : product,
      ),
      releaseId,
    });
    await seedPreviewCatalogRelease(releaseId, release);
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async () => ({ correlationId: "must-not-start" }),
    });
    const created = await createDraft(
      app,
      "theme-media-origin-limit-create-0001",
      catalogReadyDraftInput,
    );
    await validateDraft(
      app,
      created.body.data.id,
      1,
      "theme-media-origin-limit-validate-0001",
      releaseId,
    );
    const response = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/preview`,
        {
          catalogReleaseId: releaseId,
          expectedVersion: 1,
          reason: "Reject an over-broad private preview CSP",
        },
        "theme-media-origin-limit-preview-0001",
      ),
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "catalog_release_media_origins_invalid" },
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
      mediaOrigins: [],
      origin: env.PREVIEW_ORIGIN,
      previewContext: {
        environment: "private-preview",
        expiresAt: sessionValue.data.expiresAt,
        returnUrl: `${env.ADMIN_ORIGIN}/storefront/themes/${draftId}?preview-return=1`,
        snapshotId: previewValue.data.snapshot.id,
      },
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

    const unredeemedGrantResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${previewValue.data.snapshot.id}/grants`,
        { origin: env.PREVIEW_ORIGIN, reason: "Create a grant that revocation must invalidate" },
        "theme-preview-grant-revoke-target-0001",
      ),
      env,
    );
    const unredeemedGrant = await unredeemedGrantResponse.json<{ data: { grant: string } }>();

    const grantsBeforeInvalidNote = await env.DB.prepare(
      "SELECT * FROM storefront_preview_grants ORDER BY id",
    ).all();
    const sessionsBeforeInvalidNote = await env.DB.prepare(
      "SELECT * FROM storefront_preview_sessions ORDER BY id",
    ).all();
    const auditsBeforeInvalidNote = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE result = 'succeeded'",
    ).first();
    for (const [index, reason] of forbiddenNotes.entries()) {
      for (const action of ["grants", "revoke"] as const) {
        const rejected = await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/snapshots/${previewValue.data.snapshot.id}/${action}`,
            action === "grants" ? { origin: env.PREVIEW_ORIGIN, reason } : { reason },
            `theme-preview-invalid-${action}-${index}`,
          ),
          env,
        );
        expect(rejected.status).toBe(422);
        expect(await rejected.json()).toMatchObject({ error: { code: "invalid_audit_reason" } });
      }
    }
    expect(
      (await env.DB.prepare("SELECT * FROM storefront_preview_grants ORDER BY id").all()).results,
    ).toEqual(grantsBeforeInvalidNote.results);
    expect(
      (await env.DB.prepare("SELECT * FROM storefront_preview_sessions ORDER BY id").all()).results,
    ).toEqual(sessionsBeforeInvalidNote.results);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE result = 'succeeded'",
      ).first(),
    ).toEqual(auditsBeforeInvalidNote);
    const revoke = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${previewValue.data.snapshot.id}/revoke`,
        { reason: "Stop access after review is complete" },
        "theme-preview-revoke-0001",
      ),
      env,
    );
    expect(revoke.status).toBe(200);
    expect(await revoke.json()).toMatchObject({
      data: { grantsRevoked: 3, sessionsRevoked: 1, snapshotId: previewValue.data.snapshot.id },
    });
    expect((await redeem(unredeemedGrant.data.grant, env.PREVIEW_ORIGIN)).status).toBe(403);
    expect(
      (
        await app.fetch(
          request("/internal/preview/authorize", {
            headers: {
              Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
              Cookie: `__Host-shoppp-preview=${sessionValue.data.session}`,
              "X-Preview-Origin": env.PREVIEW_ORIGIN,
            },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'themes.preview.access.revoke' AND target_id = ?",
      )
        .bind(previewValue.data.snapshot.id)
        .first(),
    ).toEqual({ count: 1 });
    expect((await app.fetch(request("/preview/grants"), env)).status).toBe(404);

    const racingGrantResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${previewValue.data.snapshot.id}/grants`,
        { origin: env.PREVIEW_ORIGIN, reason: "Reopen access and race revocation with redemption" },
        "theme-preview-grant-race-0001",
      ),
      env,
    );
    const racingGrant = await racingGrantResponse.json<{ data: { grant: string } }>();
    const racingEnvironment = {
      ...env,
      DB: revokePreviewAccessAfterGrantClaim(env.DB, previewValue.data.snapshot.id),
    };
    const racingRedemption = await app.fetch(
      request("/internal/preview/redeem", {
        body: JSON.stringify({ grant: racingGrant.data.grant, origin: env.PREVIEW_ORIGIN }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
      racingEnvironment,
    );
    expect(racingRedemption.status).toBe(200);
    const racingSession = await racingRedemption.json<{ data: { session: string } }>();
    expect(
      (
        await app.fetch(
          request("/internal/preview/authorize", {
            headers: {
              Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
              Cookie: `__Host-shoppp-preview=${racingSession.data.session}`,
              "X-Preview-Origin": env.PREVIEW_ORIGIN,
            },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);

    const approvedArtifactPrefix = `snapshots/${approved.data.id}/${"c".repeat(64)}`;
    await env.DB.prepare(
      `INSERT INTO storefront_preview_builds
         (id, snapshot_id, attempt, status, artifact_digest, artifact_prefix, expires_at,
          completed_at, created_at, updated_at)
       VALUES ('build-approved-retention', ?, 1, 'deployed', ?, ?,
               '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z',
               '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z')`,
    )
      .bind(approved.data.id, "c".repeat(64), approvedArtifactPrefix)
      .run();
    await env.PREVIEW_ARTIFACTS.put(
      `${approvedArtifactPrefix}/index.html`,
      "retained approved build",
    );
    await env.PREVIEW_ARTIFACTS.put(`${prefix}/index.html`, "fixture preview");
    await env.DB.prepare("UPDATE storefront_preview_builds SET expires_at = ? WHERE id = ?")
      .bind("2026-07-29T00:00:00.000Z", previewValue.data.build.id)
      .run();
    const cleanup = await cleanupExpiredStorefrontPreviews(
      env,
      new Date("2026-07-30T00:00:00.000Z"),
    );
    expect(cleanup).toMatchObject({ artifacts: 1, grants: 4, objects: 1, sessions: 2 });
    expect(await env.PREVIEW_ARTIFACTS.get(`${prefix}/index.html`)).toBeNull();
    expect(await env.PREVIEW_ARTIFACTS.get(`${approvedArtifactPrefix}/index.html`)).not.toBeNull();
    expect(
      await env.DB.prepare(
        "SELECT status, cleaned_at FROM storefront_preview_builds WHERE id = 'build-approved-retention'",
      ).first(),
    ).toEqual({ cleaned_at: null, status: "deployed" });
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
