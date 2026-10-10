import { env } from "cloudflare:workers";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  canonicalStorefrontJson,
  catalogReleaseV3Schema,
  experienceSnapshotSchema,
  type Cart,
  type StorefrontPublication,
  type StorefrontPublicationContext,
  type StorefrontPublicationIdentity,
  type StorefrontPublicationReceipt,
} from "@shoppp/contracts";
import releaseFixture from "../../../storefront/fixtures/release.json";
import { fashionStoreSuccessorPackage } from "../../../storefront/app/themes/fashion-store/package-registry";
import storefrontWorker from "../../../storefront/worker";
import { createApp } from "../../src/http/app";
import { sha256Hex } from "../../src/orders/tokens";
import { getCanonicalDeployedCatalogRelease } from "../../src/storefront-experience/catalog-resources";
import type { BuildTrigger } from "../../src/publishing/releases";
import type { PaymentProvider } from "../../src/payments/port";
import { ADMIN_ROLE_IDS, seedHumanAdmin, seedServiceAdmin } from "../fixtures/admin-iam";

const token = "storefront-publication-build-token-00000001";
function request(path: string, body?: unknown, subject = "publication-admin") {
  return new Request(`https://api.example.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      "X-Test-Admin-Identity": subject,
      "Idempotency-Key": crypto.randomUUID(),
    },
  });
}
function app(
  trigger: BuildTrigger = vi.fn(async () => ({ correlationId: "publication-run" })),
  paymentProvider?: PaymentProvider,
) {
  return createApp({
    buildManifestToken: token,
    buildTrigger: trigger,
    ...(paymentProvider ? { paymentProvider } : {}),
    testIdentityVerifier: async (identity) =>
      identity === "publication-service"
        ? {
            principalKind: "service",
            serviceName: identity,
            subject: identity,
          }
        : {
            email: `${identity}@example.test`,
            principalKind: "human",
            subject: identity,
          },
  });
}
type App = ReturnType<typeof app>;
const run = { runId: "1001", runAttempt: 1, sourceCommit: "a".repeat(40) };
async function data<T>(response: Response) {
  const body = await response.json<{ data: T; error?: unknown }>();
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body.data;
}
async function seedApproval(api: App, environment = "staging") {
  const suffix = crypto.randomUUID();
  const draftId = `draft-${suffix}`;
  const validationId = `validation-${suffix}`;
  const snapshotId = `snapshot-${suffix}`;
  const releaseId = `catalog-${suffix}`;
  const time = new Date().toISOString();
  const settings = await data<{ profileVersion: string | null; publicContact: unknown }>(
    await api.fetch(request("/admin/settings/contact"), env),
  );
  const contactVersion = await sha256Hex(
    canonicalStorefrontJson({
      profileVersion: settings.profileVersion,
      publicContact: settings.publicContact,
    }),
  );
  const release = catalogReleaseV3Schema.parse({
    ...releaseFixture,
    releaseId,
    generatedAt: time,
    site: { ...releaseFixture.site, origin: env.STOREFRONT_ORIGIN },
    products: [releaseFixture.products[0]],
    collections: [],
    policies: releaseFixture.policies,
    redirects: [],
    routes: [
      "/",
      "/products/atlas-carry-on",
      ...releaseFixture.policies.map(({ slug }) => `/policies/${slug}`),
    ],
    routeOutput: [
      "/",
      "/products/atlas-carry-on",
      ...releaseFixture.policies.map(({ slug }) => `/policies/${slug}`),
    ],
    schemaVersion: 3,
    purpose: "private-preview",
    environment,
    content: [],
    navigation: [],
    identity: {
      id: "identity.primary",
      version: 1,
      storefrontName: "Publication store",
      tagline: "",
      seo: {},
      faviconAssetId: null,
      logoAssets: [],
      socialShareAssetId: null,
    },
    sourceVersionVector: [
      { id: "identity.primary", kind: "store-identity", version: 1, digest: "d".repeat(64) },
    ],
  });
  const manifestJson = JSON.stringify(release);
  const manifestDigest = await sha256Hex(manifestJson);
  const sourceDigest = await sha256Hex(`source:${releaseId}`);
  const theme = fashionStoreSuccessorPackage;
  const snapshot = experienceSnapshotSchema.parse({
    approvedAt: time,
    approvedBy: "publication-admin",
    kind: "approved",
    id: snapshotId,
    experienceId: `experience-${suffix}`,
    version: 1,
    bindings: [],
    overrides: [],
    contact: { version: contactVersion, publicContact: settings.publicContact },
    themeId: theme.manifest.id,
    themeVersion: theme.manifest.themeVersion,
    configurationSchemaVersion: theme.manifest.configurationSchemaVersion,
    platformContractVersion: theme.manifest.platformContractVersion,
    provenance: theme.manifest.provenance,
    resolvedTemplates: theme.presets[0]!.templates,
  });
  const snapshotDigest = await sha256Hex(canonicalStorefrontJson(snapshot));
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO catalog_releases
      (id, status, manifest_json, approved_at, purpose, environment, manifest_digest, source_digest,
       candidate_status, candidate_expires_at, created_at, updated_at)
      VALUES (?, 'approved', ?, ?, 'private-preview', ?, ?, ?, 'succeeded', '2099-01-01T00:00:00.000Z', ?, ?)`,
    ).bind(releaseId, manifestJson, time, environment, manifestDigest, sourceDigest, time, time),
    env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
      (id, experience_id, theme_id, theme_version, configuration_schema_version, preset_id,
       bindings_json, overrides_json, version, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, '[]', '[]', 1, 'publication-admin', 'publication-admin', ?, ?)`,
    ).bind(
      draftId,
      snapshot.experienceId,
      snapshot.themeId,
      snapshot.themeVersion,
      snapshot.configurationSchemaVersion,
      theme.presets[0]!.id,
      time,
      time,
    ),
    env.DB.prepare(
      `INSERT INTO storefront_experience_validations
      (id, draft_id, draft_version, catalog_release_id, status, issues_json, resolved_templates_json, validated_by, created_at)
      VALUES (?, ?, 1, ?, 'valid', '[]', ?, 'publication-admin', ?)`,
    ).bind(validationId, draftId, releaseId, JSON.stringify(snapshot.resolvedTemplates), time),
    env.DB.prepare(
      `INSERT INTO storefront_experience_snapshots
      (id, deduplication_key, experience_id, source_draft_id, source_draft_version, source_validation_id,
       kind, theme_id, theme_version, configuration_schema_version, snapshot_json, created_by, approved_by,
       approved_at, created_at, content_digest)
      VALUES (?, ?, ?, ?, 1, ?, 'approved', ?, ?, ?, ?, 'publication-admin', 'publication-admin', ?, ?, ?)`,
    ).bind(
      snapshotId,
      snapshotId,
      snapshot.experienceId,
      draftId,
      validationId,
      snapshot.themeId,
      snapshot.themeVersion,
      snapshot.configurationSchemaVersion,
      JSON.stringify(snapshot),
      time,
      time,
      snapshotDigest,
    ),
  ]);
  const identity: StorefrontPublicationIdentity = {
    catalogReleaseId: releaseId,
    catalogManifestDigest: manifestDigest,
    catalogSourceDigest: sourceDigest,
    experienceSnapshotId: snapshotId,
    snapshotDigest,
    contactVersion,
    experienceVersion: 1,
    themeId: snapshot.themeId,
    themeVersion: snapshot.themeVersion,
    platformContractVersion: snapshot.platformContractVersion,
  };
  return {
    draftId,
    expectedVersion: 1,
    identity,
    expectedActivePublicationId: null,
    reason: "Publish approved store",
    manifestJson,
  };
}
async function publish(
  api: App,
  input: Awaited<ReturnType<typeof seedApproval>>,
  active: string | null = null,
) {
  const { manifestJson: _manifest, ...body } = input;
  return data<StorefrontPublication>(
    await api.fetch(
      request("/admin/storefront-publications", { ...body, expectedActivePublicationId: active }),
      env,
    ),
  );
}
async function callback(api: App, publication: StorefrontPublication, body: unknown) {
  return api.fetch(
    new Request(`https://api.example.test/build/storefront-publications/${publication.id}/status`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    }),
    env,
  );
}
function receipt(
  publication: StorefrontPublication,
  version = "worker-v1",
): StorefrontPublicationReceipt {
  return {
    environment: "staging",
    identity: publication.identity,
    workerVersionId: version,
    deploymentId: `deployment-${version}`,
    artifactDigest: "b".repeat(64),
    reportDigest: "c".repeat(64),
    observedAt: new Date().toISOString(),
  };
}
function observation(publication: StorefrontPublication, version = "worker-v1") {
  return {
    schemaVersion: 1,
    sourceEnvironment: "staging",
    identity: publication.identity,
    workerVersionId: version,
  };
}
function serveMarker(marker: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    expect(String(url)).toBe(`${env.STOREFRONT_ORIGIN}/.well-known/shoppp-release`);
    return Response.json(marker);
  });
}
function beforePublicationCommit(database: D1Database, mutate: () => Promise<void>): D1Database {
  const raw = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const intents = new WeakSet<D1PreparedStatement>();
  let mutated = false;
  const wrap = (statement: D1PreparedStatement, intent: boolean): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, key) {
        if (key === "bind") return (...values: unknown[]) => wrap(target.bind(...values), intent);
        const value = Reflect.get(target, key, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    raw.set(proxy, statement);
    if (intent) intents.add(proxy);
    return proxy;
  };
  return new Proxy(database, {
    get(target, key) {
      if (key === "prepare")
        return (query: string) =>
          wrap(target.prepare(query), query.includes("INSERT INTO storefront_publications"));
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          if (!mutated && statements.some((statement) => intents.has(statement))) {
            mutated = true;
            await mutate();
          }
          return target.batch(statements.map((statement) => raw.get(statement) ?? statement));
        };
      const value = Reflect.get(target, key, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
async function activate(api: App, publication: StorefrontPublication, version = "worker-v1") {
  expect((await callback(api, publication, { ...run, status: "building" })).status).toBe(200);
  serveMarker(observation(publication, version));
  return data<StorefrontPublication>(
    await callback(api, publication, {
      ...run,
      status: "activated",
      receipt: receipt(publication, version),
    }),
  );
}

async function seedPublicCommerce() {
  const now = new Date().toISOString();
  const product = releaseFixture.products[0]!;
  const variant = product.variants[0]!;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO products (id, slug, name, description, status, seo_title, seo_description, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`,
    ).bind(
      product.id,
      product.slug,
      product.name,
      product.description,
      product.seoTitle,
      product.seoDescription,
      now,
      now,
      now,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO product_variants (id, product_id, sku, title, option_values_json, weight_grams, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).bind(
      variant.id,
      product.id,
      variant.sku,
      variant.title,
      JSON.stringify(variant.optionValues),
      variant.weightGrams,
      now,
      now,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO price_lists (id, code, currency, status, created_at, updated_at)
      VALUES ('publication-usd', 'PUBLICATION-USD', 'USD', 'active', ?, ?)`,
    ).bind(now, now),
    env.DB.prepare(
      `INSERT OR IGNORE INTO prices (id, price_list_id, variant_id, amount, created_at, updated_at)
      VALUES ('publication-price', 'publication-usd', ?, 12900, ?, ?)`,
    ).bind(variant.id, now, now),
    env.DB.prepare(
      "INSERT OR IGNORE INTO warehouses (id, code, name, created_at) VALUES ('publication-wh', 'PUBLICATION', 'Publication warehouse', ?)",
    ).bind(now),
    env.DB.prepare(
      `INSERT OR IGNORE INTO inventory_items (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, oversell_limit, version, updated_at)
      VALUES (?, 'publication-wh', 10, 0, 0, 0, ?)`,
    ).bind(variant.id, now),
  ]);
  return { product, variant };
}

describe("formal storefront publication", () => {
  beforeAll(async () => {
    await seedHumanAdmin(env.DB, {
      id: "publication-admin",
      subject: "publication-admin",
      email: "publication-admin@example.test",
    });
  });
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM storefront_active_publications"),
      env.DB.prepare(
        "UPDATE storefront_publications SET status = 'failed', failure_code = 'test_reset' WHERE status IN ('queued', 'building', 'unresolved')",
      ),
    ]);
  });
  afterEach(() => vi.restoreAllMocks());

  test("reports no active publication before a verified activation", async () => {
    const response = await app().fetch(request("/admin/storefront-publications/active"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { publication: null, verification: "none" },
    });
  });
  test("persists exact approval, deduplicates dispatch and grants no live status while queued", async () => {
    const trigger = vi.fn(async (_input: Parameters<BuildTrigger>[0]) => ({
      correlationId: "run-queued",
    }));
    const api = app(trigger);
    const input = await seedApproval(api);
    const first = await publish(api, input);
    expect(first.status).toBe("queued");
    expect((await publish(api, input)).id).toBe(first.id);
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger.mock.calls[0]?.[0]).toMatchObject({
      publicationId: first.id,
      operation: "publish",
      sourceEnvironment: "staging",
      releaseId: input.identity.catalogReleaseId,
    });
    const active = await data<{ verification: string }>(
      await api.fetch(request("/admin/storefront-publications/active"), env),
    );
    expect(active.verification).toBe("none");
    const manifest = await api.fetch(
      new Request(`https://api.example.test/build/storefront-publications/${first.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
    );
    expect(await manifest.json()).toMatchObject({
      input: {
        environment: "public",
        catalogManifestJson: input.manifestJson,
        inputIdentity: input.identity,
        snapshot: { kind: "approved" },
      },
      publication: { id: first.id },
      baselineReceipt: null,
    });
    expect(
      (
        await api.fetch(
          new Request(
            `https://api.example.test/build/catalog/releases/${input.identity.catalogReleaseId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
          env,
        )
      ).status,
    ).toBe(409);
    await expect(
      getCanonicalDeployedCatalogRelease(env.DB, input.identity.catalogReleaseId, {
        environment: "staging",
      }),
    ).rejects.toThrow(/Select a deployed/);
    const context = await data<{ approval: unknown }>(
      await api.fetch(
        request(`/admin/storefront-experiences/drafts/${input.draftId}/publication-context`),
        env,
      ),
    );
    expect(context.approval).toMatchObject({ identity: input.identity, sourceDraftVersion: 1 });
  });
  test("restores environment publication history and pending work across drafts", async () => {
    const api = app();
    const previousInput = await seedApproval(api);
    const previous = await activate(api, await publish(api, previousInput));
    const pendingInput = await seedApproval(api);
    const pending = await publish(api, pendingInput, previous.id);
    const currentInput = await seedApproval(api);
    const otherEnvironmentInput = await seedApproval(api, "production");
    const { manifestJson: _manifest, ...otherEnvironmentBody } = otherEnvironmentInput;
    const otherEnvironment = await data<StorefrontPublication>(
      await api.fetch(request("/admin/storefront-publications", otherEnvironmentBody), {
        ...env,
        ENVIRONMENT: "production",
        RESOURCE_NAMESPACE: "shoppp-production",
      }),
    );

    const context = await data<StorefrontPublicationContext>(
      await api.fetch(
        request(`/admin/storefront-experiences/drafts/${currentInput.draftId}/publication-context`),
        env,
      ),
    );
    expect(context).toMatchObject({
      environment: "staging",
      approval: { sourceDraftId: currentInput.draftId, identity: currentInput.identity },
      active: { publication: { id: previous.id }, verification: "verified" },
    });
    expect(context.publications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pending.id, status: "queued", receipt: null }),
        expect.objectContaining({
          id: previous.id,
          status: "succeeded",
          receipt: previous.receipt,
        }),
      ]),
    );
    expect(context.publications.every((publication) => publication.environment === "staging")).toBe(
      true,
    );
    expect(context.publications.map(({ id }) => id)).not.toContain(otherEnvironment.id);
  });
  test("rejects approval identity, draft, Contact and source environment drift", async () => {
    const api = app();
    const input = await seedApproval(api);
    const { manifestJson: _manifest, ...body } = input;
    expect(
      (
        await api.fetch(
          request("/admin/storefront-publications", {
            ...body,
            identity: { ...body.identity, snapshotDigest: "f".repeat(64) },
          }),
          env,
        )
      ).status,
    ).toBe(409);
    await env.DB.prepare("UPDATE storefront_experience_drafts SET version = 2 WHERE id = ?")
      .bind(input.draftId)
      .run();
    expect((await api.fetch(request("/admin/storefront-publications", body), env)).status).toBe(
      409,
    );
    const cross = await seedApproval(api, "production");
    const { manifestJson: _crossManifest, ...crossBody } = cross;
    expect(
      (await api.fetch(request("/admin/storefront-publications", crossBody), env)).status,
    ).toBe(409);
    const contact = await seedApproval(api);
    const { manifestJson: _contactManifest, ...contactBody } = contact;
    await env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at) VALUES ('contact_profile', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    )
      .bind(
        JSON.stringify({
          version: crypto.randomUUID(),
          profile: {
            publishSupportEmail: false,
            publishPrivacyEmail: false,
            publicPhone: null,
            serviceHours: null,
            timeZone: null,
            locations: [],
            socials: [],
          },
        }),
        new Date().toISOString(),
      )
      .run();
    expect(
      (await api.fetch(request("/admin/storefront-publications", contactBody), env)).status,
    ).toBe(409);
  });
  test("requires human publication permission independently of approval and build credentials", async () => {
    const api = app();
    const input = await seedApproval(api);
    const { manifestJson: _manifest, ...body } = input;
    await seedHumanAdmin(env.DB, {
      id: "publication-catalog",
      subject: "publication-catalog",
      email: "publication-catalog@example.test",
      roleId: ADMIN_ROLE_IDS.catalogManager,
    });
    await env.DB.prepare(
      "INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at) VALUES (?, 'themes.approve', ?)",
    )
      .bind(ADMIN_ROLE_IDS.catalogManager, new Date().toISOString())
      .run();
    expect(
      (await api.fetch(request("/admin/storefront-publications", body, "publication-catalog"), env))
        .status,
    ).toBe(403);
    await seedServiceAdmin(env.DB, {
      id: "publication-service",
      subject: "publication-service",
      roleId: ADMIN_ROLE_IDS.admin,
    });
    expect(
      (await api.fetch(request("/admin/storefront-publications", body, "publication-service"), env))
        .status,
    ).toBe(403);
    expect(
      (
        await api.fetch(
          new Request("https://api.example.test/admin/storefront-publications", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          }),
          env,
        )
      ).status,
    ).toBe(401);
    const publication = await publish(api, input);
    expect(
      (
        await api.fetch(
          new Request(`https://api.example.test/build/storefront-publications/${publication.id}`, {
            headers: { Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}` },
          }),
          env,
        )
      ).status,
    ).toBe(401);
  });
  test.each(["draft", "candidate", "contact"])(
    "rejects concurrent %s changes before authorization commits",
    async (source) => {
      const trigger = vi.fn(async () => ({ correlationId: "must-not-dispatch" }));
      const api = app(trigger);
      const input = await seedApproval(api);
      const database = beforePublicationCommit(env.DB, async () => {
        if (source === "draft")
          await env.DB.prepare("UPDATE storefront_experience_drafts SET version = 2 WHERE id = ?")
            .bind(input.draftId)
            .run();
        if (source === "candidate")
          await env.DB.prepare(
            "UPDATE catalog_releases SET candidate_status = 'expired', candidate_expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
          )
            .bind(input.identity.catalogReleaseId)
            .run();
        if (source === "contact")
          await env.DB.prepare(
            "UPDATE settings SET value_json = json_set(value_json, '$.version', ?) WHERE key = 'contact_profile'",
          )
            .bind(crypto.randomUUID())
            .run();
      });
      if (source === "contact")
        await env.DB.prepare(
          `INSERT INTO settings (key, value_json, updated_at)
      VALUES ('contact_profile', ?, ?) ON CONFLICT(key) DO NOTHING`,
        )
          .bind(
            JSON.stringify({
              version: crypto.randomUUID(),
              profile: {
                publishSupportEmail: false,
                publishPrivacyEmail: false,
                publicPhone: null,
                serviceHours: null,
                timeZone: null,
                locations: [],
                socials: [],
              },
            }),
            new Date().toISOString(),
          )
          .run();
      const current = source === "contact" ? await seedApproval(api) : input;
      // The Contact race mutates the shared profile; the approved tuple itself stays immutable.
      const { manifestJson: _manifest, ...body } = current;
      expect(
        (await api.fetch(request("/admin/storefront-publications", body), { ...env, DB: database }))
          .status,
      ).toBe(409);
      expect(trigger).not.toHaveBeenCalled();
      expect(
        await env.DB.prepare("SELECT id FROM storefront_publications WHERE snapshot_id = ?")
          .bind(current.identity.experienceSnapshotId)
          .first(),
      ).toBeNull();
    },
  );
  test("does not move the active pointer when a delivery uses a stale baseline", async () => {
    const api = app();
    const first = await activate(api, await publish(api, await seedApproval(api)));
    vi.restoreAllMocks();
    const second = await activate(
      api,
      await publish(api, await seedApproval(api), first.id),
      "worker-v2",
    );
    vi.restoreAllMocks();
    const third = await publish(api, await seedApproval(api), second.id);
    await callback(api, third, { ...run, status: "building" });
    await env.DB.prepare(
      "UPDATE storefront_active_publications SET publication_id = ? WHERE environment = 'staging'",
    )
      .bind(first.id)
      .run();
    serveMarker(observation(third, "worker-v3"));
    expect(
      (
        await callback(api, third, {
          ...run,
          status: "activated",
          receipt: receipt(third, "worker-v3"),
        })
      ).status,
    ).toBe(409);
    expect(
      await env.DB.prepare(
        "SELECT publication_id FROM storefront_active_publications WHERE environment = 'staging'",
      ).first(),
    ).toMatchObject({ publication_id: first.id });
    expect(
      (
        await data<StorefrontPublication>(
          await api.fetch(request(`/admin/storefront-publications/${third.id}`), env),
        )
      ).status,
    ).toBe("building");
    expect(
      (
        await data<{ verification: string }>(
          await api.fetch(request("/admin/storefront-publications/active"), env),
        )
      ).verification,
    ).toBe("mismatch");
  });
  test("binds a run and actual public version before activation and retains private identity", async () => {
    const api = app();
    const input = await seedApproval(api);
    const publication = await publish(api, input);
    expect(
      (
        await callback(api, publication, {
          ...run,
          status: "activated",
          receipt: receipt(publication),
        })
      ).status,
    ).toBe(409);
    expect((await callback(api, publication, { ...run, status: "building" })).status).toBe(200);
    expect(
      (await callback(api, publication, { ...run, runAttempt: 2, status: "building" })).status,
    ).toBe(409);
    expect(
      (
        await callback(api, publication, {
          ...run,
          status: "activated",
          receipt: { ...receipt(publication), environment: "production" },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await callback(api, publication, {
          ...run,
          status: "activated",
          receipt: {
            ...receipt(publication),
            identity: { ...publication.identity, snapshotDigest: "f".repeat(64) },
          },
        })
      ).status,
    ).toBe(409);
    serveMarker(observation(publication, "wrong-worker"));
    expect(
      (
        await callback(api, publication, {
          ...run,
          status: "activated",
          receipt: receipt(publication),
        })
      ).status,
    ).toBe(409);
    vi.restoreAllMocks();
    serveMarker(observation(publication));
    const result = await data<StorefrontPublication>(
      await callback(api, publication, {
        ...run,
        status: "activated",
        receipt: receipt(publication),
      }),
    );
    expect(result.status).toBe("succeeded");
    expect(
      (
        await data<{ verification: string }>(
          await api.fetch(request("/admin/storefront-publications/active"), env),
        )
      ).verification,
    ).toBe("verified");
    const retained = await env.DB.prepare(
      "SELECT purpose, manifest_json, manifest_digest FROM catalog_releases WHERE id = ?",
    )
      .bind(input.identity.catalogReleaseId)
      .first();
    expect(retained).toMatchObject({
      purpose: "private-preview",
      manifest_json: input.manifestJson,
      manifest_digest: input.identity.catalogManifestDigest,
    });
    const duplicate = { ...run, status: "activated", receipt: result.receipt };
    expect((await callback(api, publication, duplicate)).status).toBe(200);
    expect(
      (
        await api.fetch(
          new Request(`https://api.example.test/build/storefront-publications/${publication.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await api.fetch(
          request(
            `/admin/catalog/releases/preview-candidates/${input.identity.catalogReleaseId}/abandon`,
            { reason: "Abandon candidate" },
          ),
          env,
        )
      ).status,
    ).toBe(409);
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(
      (
        await data<{ verification: string }>(
          await api.fetch(request("/admin/storefront-publications/active"), env),
        )
      ).verification,
    ).toBe("unavailable");
  });
  test("allows retained activated catalogs after the preview lease expires, but never across environments", async () => {
    const api = app();
    const input = await seedApproval(api);
    const publication = await publish(api, input);
    const { product, variant } = await seedPublicCommerce();
    const cart = await data<{ token: string }>(
      await api.fetch(
        new Request("https://api.example.test/cart", {
          method: "POST",
          body: JSON.stringify({ currency: "USD" }),
          headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        }),
        env,
      ),
    );
    const add = () =>
      api.fetch(
        new Request("https://api.example.test/cart/lines", {
          method: "POST",
          body: JSON.stringify({
            quantity: 1,
            releaseId: input.identity.catalogReleaseId,
            variantId: variant.id,
          }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
            Authorization: `CartToken ${cart.token}`,
          },
        }),
        env,
      );
    expect((await add()).status).toBe(422);
    const stagedManifest = JSON.stringify({
      ...JSON.parse(input.manifestJson),
      releaseId: `production-${input.identity.catalogReleaseId}`,
      environment: "production",
    });
    const stagedDigest = await sha256Hex(stagedManifest);
    const stagedIdentity = {
      ...publication.identity,
      catalogReleaseId: `production-${input.identity.catalogReleaseId}`,
      catalogManifestDigest: stagedDigest,
    };
    const stagedObservation = {
      schemaVersion: 1,
      sourceEnvironment: "production",
      identity: stagedIdentity,
      workerVersionId: "installed-staging-version",
      catalogManifestJson: stagedManifest,
    };
    const stageFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      expect(String(url)).toBe(`${env.STOREFRONT_ORIGIN}/.well-known/shoppp-release/catalog`);
      expect(init).toMatchObject({ redirect: "error", headers: { "Cache-Control": "no-cache" } });
      return Response.json(stagedObservation);
    });
    const proofCart = await data<{ token: string }>(
      await api.fetch(
        new Request("https://api.example.test/cart", {
          method: "POST",
          body: JSON.stringify({ currency: "USD" }),
          headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        }),
        env,
      ),
    );
    const proofRequest = (manifestDigest = stagedDigest) =>
      new Request("https://api.example.test/cart/lines", {
        method: "POST",
        body: JSON.stringify({
          quantity: 1,
          releaseId: stagedIdentity.catalogReleaseId,
          variantId: variant.id,
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          Authorization: `CartToken ${proofCart.token}`,
          "X-Storefront-Catalog-Manifest-Digest": manifestDigest,
        },
      });
    expect((await api.fetch(proofRequest(), env)).status).toBe(200);
    expect(
      await env.DB.prepare("SELECT id FROM catalog_releases WHERE id = ?")
        .bind(stagedIdentity.catalogReleaseId)
        .first(),
    ).toBeNull();
    expect((await api.fetch(proofRequest("f".repeat(64)), env)).status).toBe(422);
    stageFetch.mockResolvedValue(
      Response.json({ ...stagedObservation, workerVersionId: undefined }),
    );
    expect((await api.fetch(proofRequest(), env)).status).toBe(422);
    stageFetch.mockResolvedValue(new Response("not installed", { status: 404 }));
    expect((await api.fetch(proofRequest(), env)).status).toBe(422);
    const callsBeforeProduction = stageFetch.mock.calls.length;
    expect(
      (
        await api.fetch(proofRequest(), {
          ...env,
          ENVIRONMENT: "production",
          RESOURCE_NAMESPACE: "shoppp-production",
          PUBLIC_ORIGIN: "https://api.example.test",
        })
      ).status,
    ).toBe(422);
    expect(stageFetch.mock.calls).toHaveLength(callsBeforeProduction);
    vi.restoreAllMocks();
    await env.DB.prepare(
      "UPDATE catalog_releases SET candidate_expires_at = '2000-01-01T00:00:00.000Z', candidate_status = 'expired' WHERE id = ?",
    )
      .bind(input.identity.catalogReleaseId)
      .run();
    await activate(api, publication);
    expect(
      (
        await getCanonicalDeployedCatalogRelease(env.DB, input.identity.catalogReleaseId, {
          environment: "staging",
        })
      ).releaseId,
    ).toBe(input.identity.catalogReleaseId);
    await expect(
      getCanonicalDeployedCatalogRelease(env.DB, input.identity.catalogReleaseId, {
        environment: "production",
      }),
    ).rejects.toThrow(/Select a deployed/);
    expect((await add()).status).toBe(200);
    const lookup = await api.fetch(
      new Request(
        `https://api.example.test/catalog/products/by-id/${product.id}/live?currency=USD`,
        {
          headers: { "X-Preview-Catalog-Release": input.identity.catalogReleaseId },
        },
      ),
      env,
    );
    expect(lookup.status).toBe(200);
    expect(
      (
        await api.fetch(
          new Request(
            `https://api.example.test/catalog/products/by-id/${product.id}/live?currency=USD`,
            {
              headers: { "X-Preview-Catalog-Release": input.identity.catalogReleaseId },
            },
          ),
          {
            ...env,
            ENVIRONMENT: "production",
            RESOURCE_NAMESPACE: "shoppp-production",
            PUBLIC_ORIGIN: "https://api.example.test",
          },
        )
      ).status,
    ).toBe(422);
  }, 20_000);
  test("keeps public carts usable through a new activation and rollback while isolating private preview", async () => {
    const createHostedSession = vi.fn<PaymentProvider["createHostedSession"]>(async (input) => ({
      id: `cs_test_${input.attemptId}`,
      attemptId: input.attemptId,
      amountTotal: input.snapshot.totals.grandTotal,
      currency: input.snapshot.currency,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
      paymentState: "pending",
      url: `https://checkout.stripe.test/${input.attemptId}`,
    }));
    const unusedProviderCall = async (): Promise<never> => {
      throw new Error("Only hosted session creation is expected.");
    };
    const api = app(undefined, {
      name: "stripe",
      createHostedSession,
      createRefund: unusedProviderCall,
      retrieveRefund: unusedProviderCall,
      retrieveSession: unusedProviderCall,
      verifyWebhook: unusedProviderCall,
    });
    const { product, variant } = await seedPublicCommerce();
    const shippingMethodId = `ship_${"S".repeat(26)}`;
    const zoneId = `zone_${"Z".repeat(26)}`;
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO shipping_zones (id, name, status, created_at, updated_at) VALUES (?, 'Publication US', 'active', ?, ?)",
      ).bind(zoneId, now, now),
      env.DB.prepare(
        "INSERT INTO shipping_zone_countries (zone_id, country_code) VALUES (?, 'US')",
      ).bind(zoneId),
      env.DB.prepare(
        `INSERT INTO shipping_methods (id, zone_id, name, calculation_type, price_amount, currency,
         status, created_at, updated_at) VALUES (?, ?, 'Ground', 'flat', 700, 'USD', 'active', ?, ?)`,
      ).bind(shippingMethodId, zoneId, now, now),
    ]);
    const shippingAddress = {
      city: "Portland",
      countryCode: "US",
      line1: "100 Market Street",
      name: "Example Shopper",
      postalCode: "97205",
      region: "OR",
    };
    const firstInput = await seedApproval(api);
    const first = await activate(api, await publish(api, firstInput), "worker-cart-a");
    let installed = first;
    const publicRequest = (
      path: string,
      cartToken?: string,
      body?: unknown,
      method = body === undefined ? "GET" : "POST",
      idempotencyKey = crypto.randomUUID(),
    ) =>
      storefrontWorker.fetch(
        new Request(`${env.STOREFRONT_ORIGIN}/api${path}`, {
          method,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "X-Preview-Catalog-Release": "browser-spoofed-private-release",
            "X-Storefront-Catalog-Release": "browser-spoofed-public-release",
            "X-Storefront-Catalog-Manifest-Digest": "f".repeat(64),
            ...(cartToken ? { Authorization: `CartToken ${cartToken}` } : {}),
          },
        }),
        {
          API: { fetch: async (request) => api.fetch(request, env) },
          ASSETS: {
            fetch: async () =>
              Response.json({
                schemaVersion: 1,
                sourceEnvironment: installed.environment,
                identity: installed.identity,
              }),
          },
          CF_VERSION_METADATA: { id: installed.receipt!.workerVersionId },
        },
      );
    const createReleaseCart = async () => {
      const created = await data<{ cart: Cart; token: string }>(
        await publicRequest("/cart", undefined, { currency: "USD" }),
      );
      const added = await publicRequest("/cart/lines", created.token, {
        quantity: 1,
        releaseId: "browser-spoofed-body-release",
        variantId: variant.id,
      });
      expect(added.status).toBe(200);
      expect(
        await env.DB.prepare("SELECT pricing_context_json FROM carts WHERE id = ?")
          .bind(created.cart.id)
          .first<{ pricing_context_json: string }>(),
      ).toEqual({
        pricing_context_json: expect.stringContaining(installed.identity.catalogReleaseId),
      });
      return created;
    };
    const checkout = async (cart: { cart: Cart; token: string }) => {
      expect(
        (
          await publicRequest(
            "/cart/shipping",
            cart.token,
            { shippingAddress, shippingMethodId },
            "PUT",
          )
        ).status,
      ).toBe(200);
      const idempotencyKey = crypto.randomUUID();
      const body = {
        acceptTerms: true,
        cartId: cart.cart.id,
        countryCode: "US",
        currency: "USD",
        email: "shopper@example.test",
        idempotencyKey,
        shippingAddress,
        shippingMethodId,
      };
      return publicRequest("/checkout/sessions", cart.token, body, "POST", idempotencyKey);
    };
    const cartA = await createReleaseCart();
    const retainedCartA = await createReleaseCart();
    vi.restoreAllMocks();
    const second = await activate(
      api,
      await publish(api, await seedApproval(api), first.id),
      "worker-cart-b",
    );
    installed = second;
    expect((await publicRequest(`/catalog/products/by-id/${product.id}/live`)).status).toBe(200);
    expect((await publicRequest("/cart", cartA.token)).status).toBe(200);
    expect(
      (await publicRequest(`/cart/lines/${variant.id}`, cartA.token, { quantity: 2 }, "PATCH"))
        .status,
    ).toBe(200);
    const foreignNewLine = await publicRequest("/cart/lines", cartA.token, {
      quantity: 1,
      variantId: variant.id,
    });
    expect(foreignNewLine.status).toBe(409);
    expect(await foreignNewLine.json()).toMatchObject({ error: { code: "cart_release_conflict" } });
    for (const path of ["/cart", "/checkout/sessions"]) {
      const privateMismatch = await api.fetch(
        new Request(`https://api.example.test${path}`, {
          ...(path === "/checkout/sessions" ? { method: "POST", body: "{}" } : {}),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
            Authorization: `CartToken ${retainedCartA.token}`,
            "X-Preview-Catalog-Release": second.identity.catalogReleaseId,
            "X-Storefront-Catalog-Release": first.identity.catalogReleaseId,
          },
        }),
        env,
      );
      expect(privateMismatch.status).toBe(409);
      expect(await privateMismatch.json()).toMatchObject({
        error: { code: "cart_release_conflict" },
      });
    }
    expect(createHostedSession).not.toHaveBeenCalled();
    expect((await checkout(cartA)).status).toBe(201);
    const cartB = await createReleaseCart();
    vi.restoreAllMocks();
    await env.DB.prepare(
      "UPDATE catalog_releases SET candidate_status = 'expired', candidate_expires_at = '2000-01-01T00:00:00.000Z' WHERE id IN (?, ?)",
    )
      .bind(first.identity.catalogReleaseId, second.identity.catalogReleaseId)
      .run();
    const rollback = await data<StorefrontPublication>(
      await api.fetch(
        request("/admin/storefront-publications/rollback", {
          targetPublicationId: first.id,
          expectedActivePublicationId: second.id,
          reason: "Restore the previous public store",
        }),
        env,
      ),
    );
    installed = await activate(api, rollback, "worker-cart-a");
    for (const [cart, releaseId] of [
      [retainedCartA, first.identity.catalogReleaseId],
      [cartB, second.identity.catalogReleaseId],
    ] as const) {
      expect((await publicRequest("/cart", cart.token)).status).toBe(200);
      expect(
        (await publicRequest(`/cart/lines/${variant.id}`, cart.token, { quantity: 2 }, "PATCH"))
          .status,
      ).toBe(200);
      expect((await checkout(cart)).status).toBe(201);
      const stored = await env.DB.prepare("SELECT pricing_context_json FROM carts WHERE id = ?")
        .bind(cart.cart.id)
        .first<{ pricing_context_json: string }>();
      expect(JSON.parse(stored!.pricing_context_json).releaseId).toBe(releaseId);
    }
    expect(createHostedSession).toHaveBeenCalledTimes(3);
  }, 20_000);
  test.each([true, false])(
    "finalizes a same-run preparation failure only when the retained baseline is verifiable (%s)",
    async (baselineAvailable) => {
      const trigger = vi.fn(async () => ({ correlationId: "preparation-failure-run" }));
      const api = app(trigger);
      const baseline = await activate(api, await publish(api, await seedApproval(api)));
      vi.restoreAllMocks();
      const input = await seedApproval(api);
      const pending = await publish(api, input, baseline.id);
      expect((await callback(api, pending, { ...run, status: "building" })).status).toBe(200);
      const currentStorefront = serveMarker(observation(baseline));
      if (!baselineAvailable)
        currentStorefront.mockResolvedValue(new Response("unavailable", { status: 503 }));
      const failed = await data<StorefrontPublication>(
        await callback(api, pending, {
          ...run,
          status: "failed",
          failureCode: "storefront_preparation_failed",
          restorationVerified: true,
        }),
      );
      expect(currentStorefront).toHaveBeenCalledTimes(1);
      expect(failed).toMatchObject({
        status: baselineAvailable ? "failed" : "unresolved",
        failureCode: "storefront_preparation_failed",
        ...run,
      });
      expect(
        await env.DB.prepare(
          "SELECT publication_id FROM storefront_active_publications WHERE environment = 'staging'",
        ).first<{ publication_id: string }>(),
      ).toEqual({ publication_id: baseline.id });
      if (baselineAvailable) {
        const retry = await publish(api, input, baseline.id);
        expect(retry.id).not.toBe(pending.id);
        expect(retry.status).toBe("queued");
        expect(trigger).toHaveBeenCalledTimes(3);
      } else {
        const { manifestJson: _manifest, ...body } = input;
        const retry = await api.fetch(
          request("/admin/storefront-publications", {
            ...body,
            expectedActivePublicationId: baseline.id,
          }),
          env,
        );
        expect(retry.status).toBe(409);
        expect(await retry.json()).toMatchObject({
          error: { code: "storefront_publication_pending" },
        });
        expect(trigger).toHaveBeenCalledTimes(2);
        expect(
          await env.DB.prepare(
            "SELECT id, status FROM storefront_publications WHERE environment = 'staging' AND status IN ('queued', 'building', 'unresolved')",
          ).first<{ id: string; status: string }>(),
        ).toEqual({ id: pending.id, status: "unresolved" });
      }
    },
  );
  test("records dispatch failure and uses a new intent for an explicit retry", async () => {
    const failedTrigger = vi.fn(async () => {
      throw new Error("hook failed");
    });
    const api = app(failedTrigger);
    const input = await seedApproval(api);
    const failed = await publish(api, input);
    expect(failed).toMatchObject({
      status: "failed",
      failureCode: "build_hook_failed",
      receipt: null,
    });
    const retry = await publish(app(), input);
    expect(retry.id).not.toBe(failed.id);
    expect(retry.status).toBe("queued");
  });
  test("requires restoration verification after a failed delivery and restores only a saved exact Worker", async () => {
    const api = app();
    const firstInput = await seedApproval(api);
    const first = await activate(api, await publish(api, firstInput));
    vi.restoreAllMocks();
    const secondInput = await seedApproval(api);
    const second = await publish(api, secondInput, first.id);
    await callback(api, second, { ...run, status: "building" });
    const unresolved = await data<StorefrontPublication>(
      await callback(api, second, {
        ...run,
        status: "failed",
        failureCode: "storefront_activation_failed",
        restorationVerified: false,
      }),
    );
    expect(unresolved.status).toBe("unresolved");
    serveMarker(observation(second, "worker-v2"));
    expect(
      (
        await callback(api, second, {
          ...run,
          status: "failed",
          failureCode: "storefront_activation_failed",
          restorationVerified: true,
        })
      ).status,
    ).toBe(409);
    vi.restoreAllMocks();
    serveMarker(observation(first));
    expect(
      (
        await data<StorefrontPublication>(
          await callback(api, second, {
            ...run,
            status: "failed",
            failureCode: "storefront_activation_failed",
            restorationVerified: true,
          }),
        )
      ).status,
    ).toBe("failed");
    vi.restoreAllMocks();
    const retry = await publish(api, secondInput, first.id);
    const secondActive = await activate(api, retry, "worker-v2");
    vi.restoreAllMocks();
    await env.DB.prepare(
      "UPDATE catalog_releases SET candidate_status = 'expired', candidate_expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
    )
      .bind(first.identity.catalogReleaseId)
      .run();
    expect(
      (
        await getCanonicalDeployedCatalogRelease(env.DB, first.identity.catalogReleaseId, {
          environment: "staging",
        })
      ).releaseId,
    ).toBe(first.identity.catalogReleaseId);
    await env.DB.prepare("UPDATE storefront_experience_drafts SET version = 2 WHERE id = ?")
      .bind(firstInput.draftId)
      .run();
    const rollback = await data<StorefrontPublication>(
      await api.fetch(
        request("/admin/storefront-publications/rollback", {
          targetPublicationId: first.id,
          expectedActivePublicationId: secondActive.id,
          reason: "Restore previous storefront",
        }),
        env,
      ),
    );
    expect(rollback).toMatchObject({
      operation: "rollback",
      identity: first.identity,
      restoreWorkerVersionId: "worker-v1",
    });
    const build = await api.fetch(
      new Request(`https://api.example.test/build/storefront-publications/${rollback.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
    );
    expect(await build.json()).toMatchObject({
      input: { inputIdentity: first.identity },
      rollbackReceipt: first.receipt,
      baselineReceipt: secondActive.receipt,
    });
    await callback(api, rollback, { ...run, status: "building" });
    serveMarker(observation(first));
    expect(
      (
        await callback(api, rollback, {
          ...run,
          status: "activated",
          receipt: { ...receipt(rollback), artifactDigest: "f".repeat(64) },
        })
      ).status,
    ).toBe(409);
    const restored = await data<StorefrontPublication>(
      await callback(api, rollback, { ...run, status: "activated", receipt: receipt(rollback) }),
    );
    expect(restored.status).toBe("succeeded");
    expect(
      await data<{ publication: StorefrontPublication; verification: string }>(
        await api.fetch(request("/admin/storefront-publications/active"), env),
      ),
    ).toMatchObject({ publication: { id: rollback.id }, verification: "verified" });
  }, 20_000);
});
