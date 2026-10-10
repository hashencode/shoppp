import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const app = createApp({
  testIdentityVerifier: async () => ({
    email: "article-owner@example.test",
    principalKind: "human" as const,
    subject: "article-owner",
  }),
});

const request = (path: string, body?: unknown, method = "GET") =>
  new Request(`https://api.example.test${path}`, {
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

const draft = {
  body: [{ id: "section.intro", kind: "paragraph", text: "A useful article." }],
  coverAssetId: null,
  reason: "Create the Article",
  seo: { description: "A useful article", title: "Useful notes" },
  slug: "useful-notes",
  summary: "Useful notes",
  title: "Useful notes",
};

describe("content articles", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM navigation_article_references"),
      env.DB.prepare("DELETE FROM content_route_redirects"),
      env.DB.prepare("DELETE FROM content_article_versions"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM admin_identities"),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "article-owner@example.test",
      id: "article-owner",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "article-owner",
    });
  });

  test("publishes a stable Article identity and activates a safe redirect on successor publish", async () => {
    const { reason: _reason, ...input } = draft;
    const created = await app.fetch(
      request(
        "/admin/content/articles",
        {
          ...input,
          seo: { description: input.seo.description, title: " " },
        },
        "POST",
      ),
      env,
    );
    expect(created.status).toBe(201);
    const article = ((await created.json()) as { data: { id: string; seo: { title: string } } })
      .data;
    expect(article.seo.title).toBe(input.title);
    expect(
      await env.DB.prepare(
        "SELECT reason FROM audit_events WHERE target_id = ? AND action = 'content.article.create'",
      )
        .bind(article.id)
        .first(),
    ).toEqual({ reason: null });
    expect(
      (
        await app.fetch(
          request(
            `/admin/content/articles/${article.id}/publish`,
            { confirm: true, expectedVersion: 1, reason: "Publish the first Article" },
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
            `/admin/content/articles/${article.id}`,
            {
              ...draft,
              expectedVersion: 1,
              reason: "Rename the Article route",
              slug: "better-notes",
            },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    const published = await app.fetch(
      request(
        `/admin/content/articles/${article.id}/publish`,
        {
          confirm: true,
          expectedVersion: 2,
          reason: "Publish the renamed Article",
          redirectFromOldSlug: true,
        },
        "POST",
      ),
      env,
    );
    expect(published.status).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT from_path, to_path FROM content_route_redirects WHERE content_id = ?",
      )
        .bind(article.id)
        .first(),
    ).toEqual({ from_path: "/magazine/useful-notes", to_path: "/magazine/better-notes" });
    expect(
      (
        await app.fetch(
          request(
            `/admin/content/articles/${article.id}`,
            { ...draft, expectedVersion: 2, reason: "Restore original Article slug" },
            "PUT",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    const returned = await app.fetch(
      request(
        `/admin/content/articles/${article.id}/publish`,
        {
          confirm: true,
          expectedVersion: 3,
          reason: "Publish restored Article slug",
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
          "SELECT from_path, to_path FROM content_route_redirects WHERE content_id = ?",
        )
          .bind(article.id)
          .all()
      ).results,
    ).toEqual([{ from_path: "/magazine/better-notes", to_path: "/magazine/useful-notes" }]);
  });

  test("returns an empty truthful Article list when nothing is published", async () => {
    const response = await app.fetch(request("/admin/content/articles?status=published"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [], meta: { total: 0 } });
  });
});
