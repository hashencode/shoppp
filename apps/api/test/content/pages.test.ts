import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const app = createApp({
  testIdentityVerifier: async () => ({
    email: "content-owner@example.test",
    principalKind: "human" as const,
    subject: "content-owner",
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

const pageDraft = {
  body: [{ id: "section.intro", kind: "paragraph", text: "About our studio." }],
  reason: "Create the About page",
  seo: { description: "About our studio", title: "About" },
  slug: "about",
  summary: "Our story",
  title: "About",
};

function exactByteDocument() {
  const body = Array.from({ length: 13 }, (_, index) => ({
    id: `section.bytes${index}`,
    kind: "paragraph" as const,
    text: "x".repeat(5_000),
  }));
  const encoder = new TextEncoder();
  const excess = encoder.encode(JSON.stringify(body)).byteLength - 64_000;
  body.at(-1)!.text = "x".repeat(5_000 - excess);
  expect(encoder.encode(JSON.stringify(body)).byteLength).toBe(64_000);
  return body;
}

describe("content pages", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM navigation_page_references"),
      env.DB.prepare("DELETE FROM content_route_redirects"),
      env.DB.prepare("DELETE FROM content_page_versions"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM admin_identities"),
      env.DB.prepare("DELETE FROM admin_role_permissions WHERE role_id = 'custom_content_reader'"),
      env.DB.prepare("DELETE FROM admin_role_permissions WHERE role_id = 'custom_content_writer'"),
      env.DB.prepare("DELETE FROM admin_roles WHERE id = 'custom_content_reader'"),
      env.DB.prepare("DELETE FROM admin_roles WHERE id = 'custom_content_writer'"),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "content-owner@example.test",
      id: "content-owner",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "content-owner",
    });
  });

  test("creates, revises, and publishes an optimistic Page without mutating the prior version", async () => {
    const created = await app.fetch(request("/admin/content/pages", pageDraft, "POST"), env);
    expect(created.status).toBe(201);
    const page = ((await created.json()) as { data: { id: string; version: number } }).data;

    const revised = await app.fetch(
      request(
        `/admin/content/pages/${page.id}`,
        { ...pageDraft, expectedVersion: 1, reason: "Revise the About page", title: "Our studio" },
        "PUT",
      ),
      env,
    );
    expect(revised.status).toBe(200);
    expect(await revised.json()).toMatchObject({ data: { status: "draft", version: 2 } });

    const stale = await app.fetch(
      request(
        `/admin/content/pages/${page.id}`,
        { ...pageDraft, expectedVersion: 1, reason: "Overwrite a stale draft" },
        "PUT",
      ),
      env,
    );
    expect(stale.status).toBe(409);

    const published = await app.fetch(
      request(
        `/admin/content/pages/${page.id}/publish`,
        { confirm: true, expectedVersion: 2, reason: "Publish the reviewed About page" },
        "POST",
      ),
      env,
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ data: { status: "published", version: 2 } });
    expect(
      (
        await env.DB.prepare(
          "SELECT version, status FROM content_page_versions WHERE page_id = ? ORDER BY version",
        )
          .bind(page.id)
          .all()
      ).results,
    ).toEqual([
      { status: "draft", version: 1 },
      { status: "published", version: 2 },
    ]);
  });

  test("saves optional notes and business-title SEO without bypassing publication reasons", async () => {
    const { reason: _reason, ...input } = pageDraft;
    const created = await app.fetch(
      request("/admin/content/pages", { ...input, seo: { description: "" } }, "POST"),
      env,
    );
    expect(created.status).toBe(201);
    const page = (await created.json<{ data: { id: string; seo: { title: string } } }>()).data;
    expect(page.seo.title).toBe(input.title);
    const revised = await app.fetch(
      request(
        `/admin/content/pages/${page.id}`,
        {
          ...input,
          expectedVersion: 1,
          reason: "  ",
          title: "Studio story",
          seo: { description: "", title: " " },
        },
        "PUT",
      ),
      env,
    );
    expect(revised.status).toBe(200);
    expect(await revised.json()).toMatchObject({
      data: { seo: { title: "Studio story" }, version: 2 },
    });
    expect(
      (
        await env.DB.prepare(
          "SELECT actor_id, action, target_id, reason, metadata_json FROM audit_events WHERE target_id = ? ORDER BY created_at",
        )
          .bind(page.id)
          .all()
      ).results,
    ).toEqual([
      expect.objectContaining({
        actor_id: "content-owner",
        action: "content.page.create",
        target_id: page.id,
        reason: null,
        metadata_json: expect.stringContaining('"version":1'),
      }),
      expect.objectContaining({
        actor_id: "content-owner",
        action: "content.page.update",
        target_id: page.id,
        reason: null,
        metadata_json: expect.stringContaining('"toVersion":2'),
      }),
    ]);
    expect(
      (
        await app.fetch(
          request(
            `/admin/content/pages/${page.id}/publish`,
            {
              confirm: true,
              expectedVersion: 2,
              reason: "ok",
            },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await env.DB.prepare(
          "SELECT version, status, seo_json FROM content_page_versions WHERE page_id = ? ORDER BY version",
        )
          .bind(page.id)
          .all()
      ).results,
    ).toEqual([
      {
        version: 1,
        status: "draft",
        seo_json: JSON.stringify({ description: "", title: "About" }),
      },
      {
        version: 2,
        status: "draft",
        seo_json: JSON.stringify({ description: "", title: "Studio story" }),
      },
    ]);
  });

  test("rejects duplicate routes, unsafe sections, and server-owned lifecycle fields", async () => {
    expect((await app.fetch(request("/admin/content/pages", pageDraft, "POST"), env)).status).toBe(
      201,
    );
    expect(
      (
        await app.fetch(
          request(
            "/admin/content/pages",
            { ...pageDraft, reason: "Duplicate the About route" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await app.fetch(
          request(
            "/admin/content/pages",
            {
              ...pageDraft,
              body: [{ id: "section.bad", kind: "paragraph", text: "<script>alert(1)</script>" }],
              reason: "Attempt unsafe content",
              slug: "unsafe",
            },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await app.fetch(
          request(
            "/admin/content/pages",
            {
              ...pageDraft,
              body: [
                {
                  alt: "Missing media",
                  assetId: "media.missing",
                  id: "section.missing-media",
                  kind: "image",
                },
              ],
              reason: "Attempt unpublished media",
              slug: "missing-media",
            },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await app.fetch(
          request(
            "/admin/content/pages",
            { ...pageDraft, publishedAt: new Date().toISOString(), slug: "assigned" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(422);
  });

  test("separates content read, write, and publish authority", async () => {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('custom_content_writer', 'content_writer', 'Content writer', 0, 0, 1, 1, ?, ?)`,
      ).bind(now, now),
      ...["content.read", "content.write"].map((permission) =>
        env.DB.prepare(
          `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
           VALUES ('custom_content_writer', ?, ?)`,
        ).bind(permission, now),
      ),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "content-writer@example.test",
      id: "content-writer",
      roleId: "custom_content_writer",
      subject: "content-writer",
    });
    const writerApp = createApp({
      testIdentityVerifier: async () => ({
        email: "content-writer@example.test",
        principalKind: "human" as const,
        subject: "content-writer",
      }),
    });

    expect((await writerApp.fetch(request("/admin/content/pages"), env)).status).toBe(200);
    expect((await writerApp.fetch(request("/admin/content/media"), env)).status).toBe(200);
    const created = await writerApp.fetch(
      request("/admin/content/pages", { ...pageDraft, slug: "writer-page" }, "POST"),
      env,
    );
    expect(created.status).toBe(201);
    const page = ((await created.json()) as { data: { id: string } }).data;
    expect(
      (
        await writerApp.fetch(
          request(
            `/admin/content/pages/${page.id}/publish`,
            { confirm: true, expectedVersion: 1, reason: "Attempt unauthorized publish" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(403);
  });

  test("allows a read-only API principal to inspect Content but denies every mutation", async () => {
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('custom_content_reader', 'content_reader', 'Content reader', 0, 0, 1, 1, ?, ?)`,
      ).bind(now, now),
      env.DB.prepare(
        `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('custom_content_reader', 'content.read', ?)`,
      ).bind(now),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "content-reader@example.test",
      id: "content-reader",
      roleId: "custom_content_reader",
      subject: "content-reader",
    });
    const readerApp = createApp({
      testIdentityVerifier: async () => ({
        email: "content-reader@example.test",
        principalKind: "human" as const,
        subject: "content-reader",
      }),
    });
    const created = await app.fetch(
      request("/admin/content/pages", { ...pageDraft, slug: "reader-target" }, "POST"),
      env,
    );
    const page = ((await created.json()) as { data: { id: string } }).data;
    expect((await readerApp.fetch(request("/admin/content/pages"), env)).status).toBe(200);
    expect((await readerApp.fetch(request(`/admin/content/pages/${page.id}`), env)).status).toBe(
      200,
    );
    expect(
      (
        await readerApp.fetch(
          request("/admin/content/pages", { ...pageDraft, slug: "reader-write" }, "POST"),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await readerApp.fetch(
          request(
            `/admin/content/pages/${page.id}`,
            { ...pageDraft, expectedVersion: 1, reason: "Attempt read-only update" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(403);
    for (const action of ["publish", "archive"] as const) {
      expect(
        (
          await readerApp.fetch(
            request(
              `/admin/content/pages/${page.id}/${action}`,
              { confirm: true, expectedVersion: 1, reason: `Attempt read-only ${action}` },
              "POST",
            ),
            env,
          )
        ).status,
      ).toBe(403);
    }
  });

  test("accepts an exact 64000-byte document at save and rejects max-plus-one", async () => {
    const body = exactByteDocument();
    const accepted = await app.fetch(
      request(
        "/admin/content/pages",
        { ...pageDraft, body, reason: "Save exact Content boundary", slug: "exact-boundary" },
        "POST",
      ),
      env,
    );
    expect(accepted.status).toBe(201);
    body.at(-1)!.text += "x";
    const rejected = await app.fetch(
      request(
        "/admin/content/pages",
        { ...pageDraft, body, reason: "Reject Content overflow", slug: "overflow-boundary" },
        "POST",
      ),
      env,
    );
    expect(rejected.status).toBe(422);
  });

  test("rolls back version and lifecycle mutations when their audit write fails", async () => {
    const created = await app.fetch(
      request("/admin/content/pages", { ...pageDraft, slug: "audit-atomic" }, "POST"),
      env,
    );
    const page = ((await created.json()) as { data: { id: string } }).data;
    await env.DB.prepare(
      `CREATE TRIGGER reject_content_update_audit
       BEFORE INSERT ON audit_events
       WHEN NEW.action = 'content.page.update'
       BEGIN
         SELECT RAISE(ABORT, 'injected content audit failure');
       END`,
    ).run();
    try {
      const response = await app.fetch(
        request(
          `/admin/content/pages/${page.id}`,
          { ...pageDraft, expectedVersion: 1, reason: "Exercise audit rollback", title: "v2" },
          "PUT",
        ),
        env,
      );
      expect(response.status).toBe(500);
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM content_page_versions WHERE page_id = ?",
        )
          .bind(page.id)
          .first(),
      ).toEqual({ count: 1 });
    } finally {
      await env.DB.prepare("DROP TRIGGER reject_content_update_audit").run();
    }
    await env.DB.prepare(
      `CREATE TRIGGER reject_content_publish_audit
       BEFORE INSERT ON audit_events
       WHEN NEW.action = 'content.page.publish'
       BEGIN
         SELECT RAISE(ABORT, 'injected content publish audit failure');
       END`,
    ).run();
    try {
      const response = await app.fetch(
        request(
          `/admin/content/pages/${page.id}/publish`,
          { confirm: true, expectedVersion: 1, reason: "Exercise lifecycle audit rollback" },
          "POST",
        ),
        env,
      );
      expect(response.status).toBe(500);
      expect(
        await env.DB.prepare(
          "SELECT status FROM content_page_versions WHERE page_id = ? AND version = 1",
        )
          .bind(page.id)
          .first(),
      ).toEqual({ status: "draft" });
    } finally {
      await env.DB.prepare("DROP TRIGGER reject_content_publish_audit").run();
    }
  });

  test("archives the whole resource after a newer draft and rejects stale or repeated transitions", async () => {
    const created = await app.fetch(request("/admin/content/pages", pageDraft, "POST"), env);
    const page = ((await created.json()) as { data: { id: string } }).data;
    expect(
      (
        await app.fetch(
          request(
            `/admin/content/pages/${page.id}/publish`,
            { confirm: true, expectedVersion: 1, reason: "Publish the original page" },
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
            `/admin/content/pages/${page.id}`,
            { ...pageDraft, expectedVersion: 1, reason: "Prepare a successor", title: "Successor" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    const stale = await app.fetch(
      request(
        `/admin/content/pages/${page.id}/archive`,
        { confirm: true, expectedVersion: 1, reason: "Archive stale input" },
        "POST",
      ),
      env,
    );
    expect(stale.status).toBe(409);
    const archived = await app.fetch(
      request(
        `/admin/content/pages/${page.id}/archive`,
        { confirm: true, expectedVersion: 2, reason: "Retire the whole page" },
        "POST",
      ),
      env,
    );
    expect(archived.status).toBe(200);
    expect(
      (
        await env.DB.prepare(
          "SELECT version, status FROM content_page_versions WHERE page_id = ? ORDER BY version",
        )
          .bind(page.id)
          .all()
      ).results,
    ).toEqual([
      { status: "archived", version: 1 },
      { status: "archived", version: 2 },
    ]);
    expect(
      (
        await app.fetch(
          request(
            `/admin/content/pages/${page.id}/archive`,
            { confirm: true, expectedVersion: 2, reason: "Repeat archive" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(409);
  });

  test("normalizes repeated route aliases to the latest live route and removes them on archive", async () => {
    const created = await app.fetch(
      request("/admin/content/pages", { ...pageDraft, slug: "route-a" }, "POST"),
      env,
    );
    const page = ((await created.json()) as { data: { id: string } }).data;
    await app.fetch(
      request(
        `/admin/content/pages/${page.id}/publish`,
        { confirm: true, expectedVersion: 1, reason: "Publish route A" },
        "POST",
      ),
      env,
    );
    await app.fetch(
      request(
        `/admin/content/pages/${page.id}`,
        { ...pageDraft, expectedVersion: 1, reason: "Rename to route B", slug: "route-b" },
        "PUT",
      ),
      env,
    );
    const required = await app.fetch(
      request(
        `/admin/content/pages/${page.id}/publish`,
        { confirm: true, expectedVersion: 2, reason: "Publish route B" },
        "POST",
      ),
      env,
    );
    expect(required.status).toBe(409);
    await app.fetch(
      request(
        `/admin/content/pages/${page.id}/publish`,
        {
          confirm: true,
          expectedVersion: 2,
          reason: "Publish route B with redirect",
          redirectFromOldSlug: true,
        },
        "POST",
      ),
      env,
    );
    await app.fetch(
      request(
        `/admin/content/pages/${page.id}`,
        { ...pageDraft, expectedVersion: 2, reason: "Rename to route C", slug: "route-c" },
        "PUT",
      ),
      env,
    );
    expect(
      (
        await app.fetch(
          request(
            `/admin/content/pages/${page.id}/publish`,
            {
              confirm: true,
              expectedVersion: 3,
              reason: "Publish route C with redirect",
              redirectFromOldSlug: true,
            },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await env.DB.prepare(
          "SELECT from_path, to_path FROM content_route_redirects WHERE content_id = ? ORDER BY from_path",
        )
          .bind(page.id)
          .all()
      ).results,
    ).toEqual([
      { from_path: "/pages/route-a", to_path: "/pages/route-c" },
      { from_path: "/pages/route-b", to_path: "/pages/route-c" },
    ]);
    expect(
      (
        await app.fetch(
          request(
            `/admin/content/pages/${page.id}`,
            { ...pageDraft, expectedVersion: 3, reason: "Return to route A", slug: "route-a" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    const returned = await app.fetch(
      request(
        `/admin/content/pages/${page.id}/publish`,
        {
          confirm: true,
          expectedVersion: 4,
          reason: "Publish route A again",
          redirectFromOldSlug: true,
        },
        "POST",
      ),
      env,
    );
    expect(returned.status).toBe(200);
    expect(
      (
        await env.DB.prepare(
          "SELECT from_path, to_path FROM content_route_redirects WHERE content_id = ? ORDER BY from_path",
        )
          .bind(page.id)
          .all()
      ).results,
    ).toEqual([
      { from_path: "/pages/route-b", to_path: "/pages/route-a" },
      { from_path: "/pages/route-c", to_path: "/pages/route-a" },
    ]);
    await app.fetch(
      request(
        `/admin/content/pages/${page.id}/archive`,
        { confirm: true, expectedVersion: 4, reason: "Retire all aliases" },
        "POST",
      ),
      env,
    );
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM content_route_redirects WHERE content_id = ?",
      )
        .bind(page.id)
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });
  });

  test("rejects archive for permission-visible Content and Theme backlinks", async () => {
    const targetResponse = await app.fetch(
      request("/admin/content/pages", { ...pageDraft, slug: "backlink-target" }, "POST"),
      env,
    );
    const target = ((await targetResponse.json()) as { data: { id: string } }).data;
    await app.fetch(
      request(
        `/admin/content/pages/${target.id}/publish`,
        { confirm: true, expectedVersion: 1, reason: "Publish backlink target" },
        "POST",
      ),
      env,
    );
    const sourceDraft = {
      ...pageDraft,
      body: [
        {
          id: "section.link",
          kind: "link",
          link: {
            label: "Target",
            target: { kind: "internal", reference: { id: target.id, kind: "page" } },
            targetBehavior: "same-window",
          },
        },
      ],
      reason: "Create a Content backlink",
      slug: "backlink-source",
    };
    const sourceResponse = await app.fetch(
      request("/admin/content/pages", sourceDraft, "POST"),
      env,
    );
    const source = ((await sourceResponse.json()) as { data: { id: string } }).data;
    await app.fetch(
      request(
        `/admin/content/pages/${source.id}/publish`,
        { confirm: true, expectedVersion: 1, reason: "Publish the Content backlink" },
        "POST",
      ),
      env,
    );
    const blocked = await app.fetch(
      request(
        `/admin/content/pages/${target.id}/archive`,
        { confirm: true, expectedVersion: 1, reason: "Attempt referenced archive" },
        "POST",
      ),
      env,
    );
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({
      error: { details: { backlinks: [{ sourceDomain: "content", sourceId: source.id }] } },
    });
    await app.fetch(
      request(
        `/admin/content/pages/${source.id}/archive`,
        { confirm: true, expectedVersion: 1, reason: "Remove the Content backlink" },
        "POST",
      ),
      env,
    );
    const draftId = `draft.${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
        (id, experience_id, theme_id, theme_version, configuration_schema_version,
         preset_id, bindings_json, overrides_json, version, created_by, updated_by,
         created_at, updated_at)
       VALUES (?, ?, 'fashion-store', '1.0.0', 1, 'default', '[]', ?, 1,
               'content-owner', 'content-owner', ?, ?)`,
    )
      .bind(
        draftId,
        `experience.${crypto.randomUUID()}`,
        JSON.stringify([{ setting: { id: target.id, kind: "page" } }]),
        now,
        now,
      )
      .run();
    const themeBlocked = await app.fetch(
      request(
        `/admin/content/pages/${target.id}/archive`,
        { confirm: true, expectedVersion: 1, reason: "Attempt Theme-referenced archive" },
        "POST",
      ),
      env,
    );
    expect(themeBlocked.status).toBe(409);
    expect(await themeBlocked.json()).toMatchObject({
      error: { details: { backlinks: [{ sourceDomain: "theme", sourceId: draftId }] } },
    });
    await env.DB.prepare("DELETE FROM storefront_experience_drafts WHERE id = ?")
      .bind(draftId)
      .run();
  });

  test("keeps predecessor and redirects atomic for competing publish and archive transitions", async () => {
    const created = await app.fetch(
      request("/admin/content/pages", { ...pageDraft, slug: "concurrent-page" }, "POST"),
      env,
    );
    const page = ((await created.json()) as { data: { id: string } }).data;
    expect(
      (
        await app.fetch(
          request(
            `/admin/content/pages/${page.id}/publish`,
            { confirm: true, expectedVersion: 1, reason: "Publish route A" },
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
            `/admin/content/pages/${page.id}`,
            {
              ...pageDraft,
              expectedVersion: 1,
              reason: "Create route B draft",
              slug: "concurrent-route-b",
            },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    await env.DB.prepare("DELETE FROM audit_events WHERE target_id = ?").bind(page.id).run();
    const lifecycleResults = await Promise.all([
      app.fetch(
        request(
          `/admin/content/pages/${page.id}/publish`,
          {
            confirm: true,
            expectedVersion: 2,
            reason: "Concurrent publish",
            redirectFromOldSlug: true,
          },
          "POST",
        ),
        env,
      ),
      app.fetch(
        request(
          `/admin/content/pages/${page.id}/archive`,
          { confirm: true, expectedVersion: 2, reason: "Concurrent archive" },
          "POST",
        ),
        env,
      ),
    ]);
    expect(lifecycleResults.map(({ status }) => status).sort()).toEqual([200, 409]);
    const winner = lifecycleResults[0]!.status === 200 ? "publish" : "archive";
    const versions = (
      await env.DB.prepare(
        "SELECT version, status FROM content_page_versions WHERE page_id = ? ORDER BY version",
      )
        .bind(page.id)
        .all<{ status: string; version: number }>()
    ).results;
    const redirects = (
      await env.DB.prepare(
        "SELECT from_path, to_path FROM content_route_redirects WHERE content_id = ?",
      )
        .bind(page.id)
        .all<{ from_path: string; to_path: string }>()
    ).results;
    expect(versions).toEqual(
      winner === "publish"
        ? [
            { status: "archived", version: 1 },
            { status: "published", version: 2 },
          ]
        : [
            { status: "archived", version: 1 },
            { status: "archived", version: 2 },
          ],
    );
    expect(redirects).toEqual(
      winner === "publish"
        ? [{ from_path: "/pages/concurrent-page", to_path: "/pages/concurrent-route-b" }]
        : [],
    );
    const audits = await env.DB.prepare(
      `SELECT action, COUNT(*) AS count FROM audit_events
        WHERE target_id = ? AND action IN ('content.page.publish', 'content.page.archive')
        GROUP BY action ORDER BY action`,
    )
      .bind(page.id)
      .all<{ action: string; count: number }>();
    expect(audits.results.reduce((sum, row) => sum + row.count, 0)).toBe(1);
  });
});
