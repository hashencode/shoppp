import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const app = createApp({
  testIdentityVerifier: async () => ({
    email: "navigation-owner@example.test",
    principalKind: "human" as const,
    subject: "navigation-owner",
  }),
});

const supportApp = createApp({
  testIdentityVerifier: async () => ({
    email: "navigation-support@example.test",
    principalKind: "human" as const,
    subject: "navigation-support",
  }),
});

const limitedPublisherApp = createApp({
  testIdentityVerifier: async () => ({
    email: "navigation-limited@example.test",
    principalKind: "human" as const,
    subject: "navigation-limited",
  }),
});

function request(path: string, body?: unknown, method = "GET") {
  return new Request(`https://api.example.test${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      "X-Test-Admin-Identity": "test-token",
    },
    method,
  });
}

const headerItems = [
  {
    id: "nav.shop",
    label: "Shop",
    parentId: null,
    position: 0,
    target: { kind: "route", path: "/collections/new-arrivals" },
  },
  {
    id: "nav.about",
    label: "About",
    parentId: "nav.shop",
    position: 0,
    target: { kind: "internal", reference: { id: "page.about", kind: "page" } },
  },
];

describe("storefront navigation", () => {
  beforeEach(async () => {
    await env.DB.prepare(
      "DELETE FROM catalog_release_media_ledger WHERE release_id IN (SELECT id FROM catalog_releases WHERE purpose = 'private-preview')",
    ).run();
    await env.DB.prepare(
      "DELETE FROM catalog_release_sources WHERE release_id IN (SELECT id FROM catalog_releases WHERE purpose = 'private-preview')",
    ).run();
    await env.DB.prepare("DELETE FROM catalog_releases WHERE purpose = 'private-preview'").run();
    for (const table of [
      "storefront_experience_drafts",
      "navigation_product_references",
      "navigation_policy_references",
      "navigation_collection_references",
      "navigation_article_references",
      "navigation_page_references",
      "content_page_versions",
      "audit_events",
      "admin_identities",
    ]) {
      try {
        await env.DB.prepare(`DELETE FROM ${table}`).run();
      } catch (error) {
        throw new Error(`cleanup failed for ${table}`, { cause: error });
      }
    }
    await env.DB.prepare("DELETE FROM navigation_items WHERE parent_item_id IS NOT NULL").run();
    await env.DB.prepare("DELETE FROM navigation_items").run();
    await env.DB.prepare("DELETE FROM navigation_menu_versions").run();
    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = 'role_navigation_publisher'",
    ).run();
    await env.DB.prepare("DELETE FROM admin_roles WHERE id = 'role_navigation_publisher'").run();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO admin_roles
        (id, key, name, description, protected, system, enabled, version, created_at, updated_at)
       VALUES ('role_navigation_publisher', 'navigation_publisher', 'Navigation publisher',
               'Navigation without Theme visibility.', 0, 0, 1, 1, ?, ?)`,
    )
      .bind(now, now)
      .run();
    for (const permission of ["navigation.read", "navigation.write", "navigation.publish"]) {
      await env.DB.prepare(
        `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_navigation_publisher', ?, ?)`,
      )
        .bind(permission, now)
        .run();
    }
    await seedHumanAdmin(env.DB, {
      email: "navigation-owner@example.test",
      id: "navigation-owner",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "navigation-owner",
    });
    await seedHumanAdmin(env.DB, {
      email: "navigation-support@example.test",
      id: "navigation-support",
      roleId: ADMIN_ROLE_IDS.support,
      subject: "navigation-support",
    });
    await seedHumanAdmin(env.DB, {
      email: "navigation-limited@example.test",
      id: "navigation-limited",
      roleId: "role_navigation_publisher",
      subject: "navigation-limited",
    });
    await env.DB.prepare(
      `INSERT INTO content_page_versions
        (page_id, version, slug, title, summary, sections_json, seo_json, status, published_at, created_at, updated_at)
       VALUES ('page.about', 1, 'about', 'About', '', '[{"id":"section.intro","kind":"paragraph","text":"About"}]',
               '{"title":"About","description":"About"}', 'published', ?, ?, ?)`,
    )
      .bind(now, now, now)
      .run();
  });

  test("creates, versions, publishes, and freezes stable two-level menu items", async () => {
    const resources = await app.fetch(
      request("/admin/storefront/navigation/resources?kind=page&page=1&pageSize=12&query=About"),
      env,
    );
    expect(resources.status).toBe(200);
    expect(await resources.json()).toMatchObject({
      data: [{ id: "page.about", kind: "page", name: "About", path: "/about" }],
      page: 1,
      pageSize: 12,
      total: 1,
    });

    const created = await app.fetch(
      request(
        "/admin/storefront/navigation/header",
        { items: headerItems, reason: "Create Header navigation" },
        "PUT",
      ),
      env,
    );
    expect(created.status).toBe(200);
    const createdBody = await created.json<{
      data: { items: typeof headerItems; version: number };
    }>();
    expect(createdBody).toMatchObject({
      data: {
        id: "menu.header",
        placement: "header",
        status: "draft",
        version: 1,
      },
    });
    expect(createdBody.data.items.map(({ id }) => id)).not.toEqual(headerItems.map(({ id }) => id));
    expect(createdBody.data.items[1]?.parentId).toBe(createdBody.data.items[0]?.id);

    const published = await app.fetch(
      request(
        "/admin/storefront/navigation/header/publish",
        { confirm: true, expectedVersion: 1, reason: "Publish Header navigation" },
        "POST",
      ),
      env,
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ data: { status: "published", version: 1 } });
    expect(
      (
        await env.DB.prepare(
          "SELECT item_id, parent_item_id, position FROM navigation_items ORDER BY parent_item_id IS NULL DESC",
        ).all()
      ).results,
    ).toEqual([
      { item_id: createdBody.data.items[0]?.id, parent_item_id: null, position: 0 },
      {
        item_id: createdBody.data.items[1]?.id,
        parent_item_id: createdBody.data.items[0]?.id,
        position: 0,
      },
    ]);
  });

  test("rejects unsafe shape, stale writes, and unpublished internal targets without partial state", async () => {
    const thirdLevel = [
      ...headerItems,
      {
        id: "nav.deep",
        label: "Deep",
        parentId: "nav.about",
        position: 0,
        target: { kind: "external", url: "https://example.test/deep" },
      },
    ];
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header",
            { items: thirdLevel, reason: "Reject deep tree" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(422);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM navigation_menu_versions").first(),
    ).toEqual({ count: 0 });

    const invalidTarget = headerItems.map((item) =>
      item.id === "nav.about"
        ? { ...item, target: { kind: "internal", reference: { id: "page.missing", kind: "page" } } }
        : item,
    );
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header",
            { items: invalidTarget, reason: "Reject missing target" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(422);

    const first = await app.fetch(
      request(
        "/admin/storefront/navigation/header",
        { items: headerItems, reason: "Create menu" },
        "PUT",
      ),
      env,
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json<{ data: { items: typeof headerItems } }>();
    const second = await app.fetch(
      request(
        "/admin/storefront/navigation/header",
        { expectedVersion: 1, items: firstBody.data.items, reason: "Create second version" },
        "PUT",
      ),
      env,
    );
    expect(second.status).toBe(200);
    expect(
      (await second.clone().json<{ data: { items: typeof headerItems } }>()).data.items,
    ).toEqual(firstBody.data.items);
    const stale = await app.fetch(
      request(
        "/admin/storefront/navigation/header",
        { expectedVersion: 1, items: firstBody.data.items, reason: "Stale writer" },
        "PUT",
      ),
      env,
    );
    expect(stale.status).toBe(409);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM navigation_menu_versions").first(),
    ).toEqual({
      count: 2,
    });
  });

  test("enforces the independent Navigation permission family", async () => {
    expect(
      (await supportApp.fetch(request("/admin/storefront/navigation/header"), env)).status,
    ).toBe(403);
    expect(
      (
        await supportApp.fetch(
          request(
            "/admin/storefront/navigation/header",
            { items: headerItems, reason: "Unauthorized change" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(403);
  });

  test("blocks archive with a permission-filtered Theme backlink", async () => {
    const created = await app.fetch(
      request(
        "/admin/storefront/navigation/header",
        { items: headerItems, reason: "Create referenced menu" },
        "PUT",
      ),
      env,
    );
    expect(created.status).toBe(200);
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header/publish",
            { confirm: true, expectedVersion: 1, reason: "Publish referenced menu" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
        (id, experience_id, theme_id, theme_version, configuration_schema_version,
         preset_id, bindings_json, overrides_json, version, created_by, updated_by,
         created_at, updated_at)
       VALUES ('draft.navigation', 'experience.navigation', 'fashion-store', '1.0.0', 1,
               'default', ?, '[]', 1, 'navigation-owner', 'navigation-owner', ?, ?)`,
    )
      .bind(
        JSON.stringify([
          {
            id: "binding.header",
            kind: "navigation",
            reference: { environment: env.ENVIRONMENT, id: "menu.header", version: 1 },
          },
        ]),
        now,
        now,
      )
      .run();

    const archived = await app.fetch(
      request(
        "/admin/storefront/navigation/header/archive",
        { confirm: true, expectedVersion: 1, reason: "Attempt referenced archive" },
        "POST",
      ),
      env,
    );
    expect(archived.status).toBe(409);
    expect(await archived.json()).toMatchObject({
      error: {
        code: "navigation_referenced",
        details: {
          backlinks: [
            {
              sourceDomain: "theme",
              sourceId: "draft.navigation",
              sourceItemId: "binding.header",
              targetDomain: "navigation",
              targetId: "menu.header",
              targetVersion: 1,
            },
          ],
        },
      },
    });

    const hidden = await limitedPublisherApp.fetch(
      request(
        "/admin/storefront/navigation/header/archive",
        { confirm: true, expectedVersion: 1, reason: "Attempt hidden referenced archive" },
        "POST",
      ),
      env,
    );
    expect(hidden.status).toBe(409);
    expect(await hidden.json()).toMatchObject({
      error: { code: "navigation_referenced", details: { backlinks: [] } },
    });
  });

  test("checks predecessor backlinks and archives the complete active version set", async () => {
    const first = await app.fetch(
      request(
        "/admin/storefront/navigation/header",
        { items: headerItems, reason: "Create first version" },
        "PUT",
      ),
      env,
    );
    const firstBody = await first.json<{ data: { items: typeof headerItems } }>();
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header/publish",
            { confirm: true, expectedVersion: 1, reason: "Publish first version" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header",
            { expectedVersion: 1, items: firstBody.data.items, reason: "Create second version" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
        (id, experience_id, theme_id, theme_version, configuration_schema_version,
         preset_id, bindings_json, overrides_json, version, created_by, updated_by,
         created_at, updated_at)
       VALUES ('draft.predecessor', 'experience.predecessor', 'fashion-store', '1.0.0', 1,
               'default', ?, '[]', 1, 'navigation-owner', 'navigation-owner', ?, ?)`,
    )
      .bind(
        JSON.stringify([
          {
            id: "binding.predecessor",
            kind: "navigation",
            reference: { environment: env.ENVIRONMENT, id: "menu.header", version: 1 },
          },
        ]),
        now,
        now,
      )
      .run();

    const blocked = await app.fetch(
      request(
        "/admin/storefront/navigation/header/publish",
        { confirm: true, expectedVersion: 2, reason: "Do not strand predecessor backlink" },
        "POST",
      ),
      env,
    );
    expect(blocked.status).toBe(409);
    expect(
      (
        await env.DB.prepare(
          "SELECT version, status FROM navigation_menu_versions ORDER BY version",
        ).all()
      ).results,
    ).toEqual([
      { status: "published", version: 1 },
      { status: "draft", version: 2 },
    ]);

    await env.DB.prepare("DELETE FROM storefront_experience_drafts").run();
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header/publish",
            { confirm: true, expectedVersion: 2, reason: "Replace first version" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header",
            { expectedVersion: 2, items: firstBody.data.items, reason: "Create third version" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header/archive",
            { confirm: true, expectedVersion: 3, reason: "Archive complete active set" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await env.DB.prepare(
          "SELECT version, status FROM navigation_menu_versions ORDER BY version",
        ).all()
      ).results,
    ).toEqual([
      { status: "archived", version: 1 },
      { status: "archived", version: 2 },
      { status: "archived", version: 3 },
    ]);
  });

  test("rejects concurrent transition drift without partial lifecycle mutation", async () => {
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header",
            { items: headerItems, reason: "Create race source" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    const raceApp = createApp({
      navigationTransitionBeforeCommit: async () => {
        const now = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO navigation_menu_versions
            (menu_id, version, placement, status, created_at, updated_at)
           SELECT menu_id, 2, placement, 'draft', created_at, ?
             FROM navigation_menu_versions WHERE menu_id = 'menu.header' AND version = 1`,
        )
          .bind(now)
          .run();
      },
      testIdentityVerifier: async () => ({
        email: "navigation-owner@example.test",
        principalKind: "human" as const,
        subject: "navigation-owner",
      }),
    });
    const response = await raceApp.fetch(
      request(
        "/admin/storefront/navigation/header/publish",
        { confirm: true, expectedVersion: 1, reason: "Race transition" },
        "POST",
      ),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "navigation_conflict" } });
    expect(
      (
        await env.DB.prepare(
          "SELECT version, status FROM navigation_menu_versions ORDER BY version",
        ).all()
      ).results,
    ).toEqual([
      { status: "draft", version: 1 },
      { status: "draft", version: 2 },
    ]);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'navigation.publish'",
      ).first(),
    ).toEqual({ count: 0 });
  });

  test("maps candidate locks for save, publish, and archive to the stable retryable conflict", async () => {
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/header",
            { items: headerItems, reason: "Create publish source" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/footer",
            { items: headerItems, reason: "Create archive source" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.fetch(
          request(
            "/admin/storefront/navigation/footer/publish",
            { confirm: true, expectedVersion: 1, reason: "Publish archive source" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO catalog_releases
        (id, status, manifest_json, approved_at, purpose, environment, manifest_digest,
         source_digest, candidate_status, candidate_expires_at, created_at, updated_at)
       VALUES ('navigation-lock-candidate', 'building', ?, ?, 'private-preview', ?, ?, ?,
               'pending', '2099-09-30T00:00:00.000Z', ?, ?)`,
    )
      .bind(
        JSON.stringify({
          environment: env.ENVIRONMENT,
          purpose: "private-preview",
          schemaVersion: 3,
        }),
        now,
        env.ENVIRONMENT,
        "a".repeat(64),
        "b".repeat(64),
        now,
        now,
      )
      .run();
    const responses = await Promise.all([
      app.fetch(
        request(
          "/admin/storefront/navigation/header",
          { expectedVersion: 1, items: headerItems, reason: "Locked save" },
          "PUT",
        ),
        env,
      ),
      app.fetch(
        request(
          "/admin/storefront/navigation/header/publish",
          { confirm: true, expectedVersion: 1, reason: "Locked publish" },
          "POST",
        ),
        env,
      ),
      app.fetch(
        request(
          "/admin/storefront/navigation/footer/archive",
          { confirm: true, expectedVersion: 1, reason: "Locked archive" },
          "POST",
        ),
        env,
      ),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: { code: "catalog_candidate_sources_locked" },
      });
    }
    expect(
      (
        await env.DB.prepare(
          "SELECT menu_id, version, status FROM navigation_menu_versions ORDER BY menu_id, version",
        ).all()
      ).results,
    ).toEqual([
      { menu_id: "menu.footer", status: "published", version: 1 },
      { menu_id: "menu.header", status: "draft", version: 1 },
    ]);
  });
});
