import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const app = createApp({
  testIdentityVerifier: async () => ({
    email: "identity-owner@example.test",
    principalKind: "human" as const,
    subject: "identity-owner",
  }),
});
const restrictedApp = createApp({
  testIdentityVerifier: async () => ({
    email: "identity-restricted@example.test",
    principalKind: "human" as const,
    subject: "identity-restricted",
  }),
});

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      "X-Test-Admin-Identity": "test-token",
      ...init.headers,
    },
  });
}

const identityInput = {
  expectedVersion: null,
  faviconAssetId: null,
  logoAssets: [{ assetId: "asset.identity.primary", variant: "primary" }],
  reason: "Set the public storefront identity",
  seo: { description: "Independent design objects.", title: "Shoppp" },
  socialShareAssetId: null,
  storefrontName: "Shoppp",
  tagline: "Objects with a point of view",
};

describe("store identity", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM catalog_release_sources"),
      env.DB.prepare("DELETE FROM store_identity_logo_assets"),
      env.DB.prepare("DELETE FROM store_identity_versions"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM storefront_experience_drafts"),
      env.DB.prepare("DELETE FROM product_media"),
      env.DB.prepare("DELETE FROM product_media_assets"),
      env.DB.prepare("DELETE FROM products"),
      env.DB.prepare("DELETE FROM admin_identities"),
      env.DB.prepare(
        "DELETE FROM admin_role_permissions WHERE role_id = 'custom_identity_manager'",
      ),
      env.DB.prepare("DELETE FROM admin_roles WHERE id = 'custom_identity_manager'"),
      env.DB.prepare(
        "DELETE FROM admin_role_permissions WHERE role_id LIKE 'custom_%_media_reader'",
      ),
      env.DB.prepare("DELETE FROM admin_roles WHERE id LIKE 'custom_%_media_reader'"),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "identity-owner@example.test",
      id: "identity-owner",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "identity-owner",
    });
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO products
          (id, slug, name, description, status, version, created_at, updated_at)
         VALUES ('product.identity-assets', 'identity-assets', 'Identity assets', '', 'published', 1, ?, ?)`,
      ).bind(now, now),
      env.DB.prepare(
        `INSERT INTO product_media_assets (id, product_id, r2_key, created_at)
         VALUES ('asset.identity.primary', 'product.identity-assets', 'catalog/identity-primary.svg', ?)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO product_media_assets (id, product_id, r2_key, created_at)
         VALUES ('asset.identity.compact', 'product.identity-assets', 'catalog/identity-compact.svg', ?)`,
      ).bind(now),
    ]);
  });

  test("saves optimistically, audits the reason, and rejects stale or server-owned fields", async () => {
    const created = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify(identityInput),
        method: "PUT",
      }),
      env,
    );
    expect(created.status).toBe(200);
    const saved = (await created.json()) as { data: { id: string; version: number } };
    expect(saved.data).toMatchObject({ id: "identity.primary", version: 1 });

    const stale = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify({ ...identityInput, storefrontName: "Stale" }),
        method: "PUT",
      }),
      env,
    );
    expect(stale.status).toBe(409);

    const assigned = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify({ ...identityInput, id: "identity.client" }),
        method: "PUT",
      }),
      env,
    );
    expect(assigned.status).toBe(422);
    expect(
      await env.DB.prepare(
        "SELECT action, reason FROM audit_events WHERE action = 'identity.update'",
      ).first(),
    ).toEqual({ action: "identity.update", reason: identityInput.reason });
  });

  test("saves identity without a note and defaults SEO at the version boundary", async () => {
    const { reason: _reason, ...input } = identityInput;
    const saved = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify({ ...input, seo: { description: "", title: " " } }),
        method: "PUT",
      }),
      env,
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ data: { seo: { title: "Shoppp" }, version: 1 } });
    expect(
      await env.DB.prepare(
        "SELECT actor_id, action, target_id, reason, metadata_json FROM audit_events WHERE action = 'identity.update'",
      ).first(),
    ).toMatchObject({
      actor_id: "identity-owner",
      action: "identity.update",
      target_id: "identity.primary",
      reason: null,
      metadata_json: expect.stringContaining('"toVersion":1'),
    });
    expect(
      await env.DB.prepare(
        "SELECT seo_json FROM store_identity_versions WHERE version = 1",
      ).first(),
    ).toEqual({ seo_json: JSON.stringify({ description: "", title: "Shoppp" }) });
  });

  test("saves and reads digit-leading Catalog UUIDs in all six Identity media fields", async () => {
    const assets = Array.from(
      { length: 6 },
      (_, index) => `0f0dd0ad-8eaf-4aae-8a3b-773e05a4560${index}`,
    );
    const now = new Date().toISOString();
    await env.DB.batch(
      assets.map((id) =>
        env.DB.prepare(
          `INSERT INTO product_media_assets (id, product_id, r2_key, created_at)
         VALUES (?, 'product.identity-assets', ?, ?)`,
        ).bind(id, `catalog/${id}.png`, now),
      ),
    );
    const media = {
      faviconAssetId: assets[4],
      logoAssets: (["primary", "light", "dark", "compact"] as const).map((variant, index) => ({
        assetId: assets[index],
        variant,
      })),
      socialShareAssetId: assets[5],
    };
    const saved = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify({ ...identityInput, ...media }),
        method: "PUT",
      }),
      env,
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      data: { ...media, logoAssets: expect.arrayContaining(media.logoAssets), version: 1 },
    });
    const read = await app.fetch(request("/admin/settings/store-identity"), env);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      data: { ...media, logoAssets: expect.arrayContaining(media.logoAssets), version: 1 },
    });
    expect(
      await env.DB.prepare(
        "SELECT favicon_asset_id, social_share_asset_id FROM store_identity_versions WHERE version = 1",
      ).first(),
    ).toEqual({ favicon_asset_id: assets[4], social_share_asset_id: assets[5] });
    expect(
      (
        await env.DB.prepare(
          "SELECT asset_id AS assetId, variant FROM store_identity_logo_assets WHERE identity_version = 1 ORDER BY variant",
        ).all()
      ).results,
    ).toEqual(
      [...media.logoAssets].sort((left, right) => left.variant.localeCompare(right.variant)),
    );
  });

  test("reads approved media through only the corresponding identity or catalog permission", async () => {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO product_media
      (id, product_id, r2_key, alt_text, width, height, position, created_at)
      VALUES ('asset.identity.primary', 'product.identity-assets', 'catalog/identity-primary.svg', 'Identity logo', 100, 100, 0, ?)`,
    )
      .bind(now)
      .run();
    for (const [domain, path] of [
      ["identity", "/admin/settings/store-identity/media"],
      ["catalog", "/admin/catalog/collections/media"],
    ] as const) {
      const roleId = `custom_${domain}_media_reader`;
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO admin_roles (id, key, name, protected, system, enabled, version, created_at, updated_at) VALUES (?, ?, ?, 0, 0, 1, 1, ?, ?)",
        ).bind(roleId, roleId, roleId, now, now),
        env.DB.prepare(
          "INSERT INTO admin_role_permissions (role_id, permission_key, created_at) VALUES (?, ?, ?)",
        ).bind(roleId, `${domain}.read`, now),
      ]);
      await seedHumanAdmin(env.DB, {
        email: `${domain}-media@example.test`,
        id: `${domain}-media`,
        roleId,
        subject: `${domain}-media`,
      });
      const reader = createApp({
        testIdentityVerifier: async () => ({
          email: `${domain}-media@example.test`,
          principalKind: "human",
          subject: `${domain}-media`,
        }),
      });
      const response = await reader.fetch(request(`${path}?page=1&pageSize=1&query=logo`), env);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        data: [{ id: "asset.identity.primary", alt: "Identity logo" }],
        meta: { page: 1, pageSize: 1, total: 1 },
      });
      expect((await reader.fetch(request("/admin/content/media"), env)).status).toBe(403);
      const otherPath =
        domain === "identity"
          ? "/admin/catalog/collections/media"
          : "/admin/settings/store-identity/media";
      expect((await reader.fetch(request(otherPath), env)).status).toBe(403);
    }
  });

  test("blocks removing a Logo used by a mutable Theme draft and reports a repair link", async () => {
    const created = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify(identityInput),
        method: "PUT",
      }),
      env,
    );
    expect(created.status).toBe(200);
    await env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
        (id, experience_id, theme_id, theme_version, configuration_schema_version, preset_id,
         bindings_json, overrides_json, version, created_by, updated_by, created_at, updated_at)
       VALUES ('draft.logo', 'experience.logo', 'fashion-store', '1.0.0', 1, 'default', '[]', ?, 1,
               'identity-owner', 'identity-owner', ?, ?)`,
    )
      .bind(
        JSON.stringify({ logoAssetId: "asset.identity.primary" }),
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();

    const blocked = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify({
          ...identityInput,
          expectedVersion: 1,
          logoAssets: [{ assetId: "asset.identity.compact", variant: "compact" }],
        }),
        method: "PUT",
      }),
      env,
    );
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({
      error: {
        code: "store_identity_logo_in_use",
        details: { backlinks: [{ href: "/storefront/themes/draft.logo", id: "draft.logo" }] },
      },
    });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM store_identity_versions WHERE identity_id = 'identity.primary'",
        ).first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });

  test("rejects unapproved media without partially creating the singleton", async () => {
    const response = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify({
          ...identityInput,
          faviconAssetId: "asset.identity.missing",
        }),
        method: "PUT",
      }),
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: "store_identity_asset_invalid",
        details: { assetIds: ["asset.identity.missing"] },
      },
    });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM store_identity_versions").first(),
    ).toEqual({ count: 0 });
  });

  test("replaces the singleton version and keeps each version's Logo assets immutable", async () => {
    expect(
      (
        await app.fetch(
          request("/admin/settings/store-identity", {
            body: JSON.stringify(identityInput),
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    const replaced = await app.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify({
          ...identityInput,
          expectedVersion: 1,
          logoAssets: [{ assetId: "asset.identity.compact", variant: "compact" }],
          reason: "Replace the shared Logo set",
        }),
        method: "PUT",
      }),
      env,
    );
    expect(replaced.status).toBe(200);
    expect(await replaced.json()).toMatchObject({
      data: {
        logoAssets: [{ assetId: "asset.identity.compact", variant: "compact" }],
        version: 2,
      },
    });
    expect(
      (
        await env.DB.prepare(
          `SELECT identity_version AS version, asset_id AS assetId
             FROM store_identity_logo_assets ORDER BY identity_version`,
        ).all()
      ).results,
    ).toEqual([
      { assetId: "asset.identity.primary", version: 1 },
      { assetId: "asset.identity.compact", version: 2 },
    ]);
    expect(
      (
        await env.DB.prepare(
          "SELECT version, status FROM store_identity_versions ORDER BY version",
        ).all()
      ).results,
    ).toEqual([
      { status: "archived", version: 1 },
      { status: "published", version: 2 },
    ]);
  });

  test("blocks a referenced Logo without exposing Theme draft diagnostics to identity-only roles", async () => {
    expect(
      (
        await app.fetch(
          request("/admin/settings/store-identity", {
            body: JSON.stringify(identityInput),
            method: "PUT",
          }),
          env,
        )
      ).status,
    ).toBe(200);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO storefront_experience_drafts
          (id, experience_id, theme_id, theme_version, configuration_schema_version, preset_id,
           bindings_json, overrides_json, version, created_by, updated_by, created_at, updated_at)
         VALUES ('draft.restricted-logo', 'experience.restricted-logo', 'fashion-store', '1.0.0', 1,
                 'default', '[]', ?, 1, 'identity-owner', 'identity-owner', ?, ?)`,
      ).bind(JSON.stringify({ logoAssetId: "asset.identity.primary" }), now, now),
      env.DB.prepare(
        `INSERT INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('custom_identity_manager', 'identity_manager', 'Identity manager', 0, 0, 1, 1, ?, ?)`,
      ).bind(now, now),
      ...["identity.read", "identity.write"].map((permission) =>
        env.DB.prepare(
          `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
           VALUES ('custom_identity_manager', ?, ?)`,
        ).bind(permission, now),
      ),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "identity-restricted@example.test",
      id: "identity-restricted",
      roleId: "custom_identity_manager",
      subject: "identity-restricted",
    });
    const blocked = await restrictedApp.fetch(
      request("/admin/settings/store-identity", {
        body: JSON.stringify({
          ...identityInput,
          expectedVersion: 1,
          logoAssets: [{ assetId: "asset.identity.compact", variant: "compact" }],
        }),
        method: "PUT",
      }),
      env,
    );
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({
      error: { code: "store_identity_logo_in_use", details: { backlinks: [] } },
    });
  });
});
