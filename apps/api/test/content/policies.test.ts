import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin, seedServiceAdmin } from "../fixtures/admin-iam";

const humanApp = createApp({
  testIdentityVerifier: async () => ({
    email: "policy-owner@example.test",
    principalKind: "human" as const,
    subject: "policy-owner",
  }),
});
const serviceApp = createApp({
  testIdentityVerifier: async () => ({
    principalKind: "service" as const,
    serviceName: "policy-bot",
    subject: "policy-bot",
  }),
});

function request(path: string, body?: unknown, method = "GET") {
  return new Request(`https://api.example.test${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      "X-Test-Admin-Identity": "test-token",
    },
  });
}

const draft = {
  effectiveDate: "2026-10-01",
  kind: "returns",
  reason: "Draft the returns terms",
  sections: [
    { id: "section.summary", kind: "paragraph", text: "Returns are accepted within 30 days." },
  ],
  slug: "returns",
  title: "Returns policy",
};

describe("policies", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM navigation_policy_references"),
      env.DB.prepare("DELETE FROM policy_versions"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM admin_identities"),
      env.DB.prepare("DELETE FROM admin_role_permissions WHERE role_id LIKE 'custom_policy_%'"),
      env.DB.prepare("DELETE FROM admin_roles WHERE id LIKE 'custom_policy_%'"),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "policy-owner@example.test",
      id: "policy-owner",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "policy-owner",
    });
  });

  test("keeps edit, exact review, approval, and publication as independently audited gates", async () => {
    const { reason: _reason, ...input } = draft;
    const created = await humanApp.fetch(request("/admin/settings/policies", input, "POST"), env);
    expect(created.status).toBe(201);
    const policy = ((await created.json()) as { data: { id: string; version: number } }).data;
    expect(
      await env.DB.prepare(
        "SELECT reason FROM audit_events WHERE target_id = ? AND action = 'policies.create'",
      )
        .bind(policy.id)
        .first(),
    ).toEqual({ reason: null });
    expect(
      (
        await humanApp.fetch(
          request(
            `/admin/settings/policies/${policy.id}/approve`,
            {
              confirm: true,
              expectedVersion: 1,
              reason: "ok",
            },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(422);

    const review = await humanApp.fetch(
      request(`/admin/settings/policies/${policy.id}/review?version=${policy.version}`),
      env,
    );
    expect(review.status).toBe(200);
    expect(await review.json()).toMatchObject({
      data: { current: { status: "draft" }, renderedText: "Returns are accepted within 30 days." },
    });

    const approved = await humanApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Approve the reviewed returns policy" },
        "POST",
      ),
      env,
    );
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ data: { status: "approved", version: 1 } });

    const published = await humanApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}/publish`,
        { confirm: true, expectedVersion: 1, reason: "Publish the approved returns policy" },
        "POST",
      ),
      env,
    );
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ data: { status: "published", version: 1 } });

    const audit = await env.DB.prepare(
      "SELECT action, reason FROM audit_events WHERE target_id = ? ORDER BY created_at, action",
    )
      .bind(policy.id)
      .all<{ action: string; reason: string }>();
    expect(audit.results.map(({ action }) => action).sort()).toEqual([
      "policies.approve",
      "policies.create",
      "policies.publish",
    ]);
    expect(new Set(audit.results.map(({ reason }) => reason)).size).toBe(3);
  });

  test("rejects stale transitions, duplicate published slugs, and server-owned lifecycle fields", async () => {
    const assigned = await humanApp.fetch(
      request("/admin/settings/policies", { ...draft, status: "published" }, "POST"),
      env,
    );
    expect(assigned.status).toBe(422);

    const created = await humanApp.fetch(request("/admin/settings/policies", draft, "POST"), env);
    const policy = ((await created.json()) as { data: { id: string } }).data;
    const stale = await humanApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}/approve`,
        { confirm: true, expectedVersion: 2, reason: "Approve a stale version" },
        "POST",
      ),
      env,
    );
    expect(stale.status).toBe(409);
    expect(
      await env.DB.prepare(
        "SELECT result FROM audit_events WHERE action = 'policies.approve' ORDER BY created_at DESC LIMIT 1",
      ).first(),
    ).toEqual({ result: "denied" });

    const duplicate = await humanApp.fetch(
      request("/admin/settings/policies", { ...draft, reason: "Duplicate the route" }, "POST"),
      env,
    );
    expect(duplicate.status).toBe(409);

    const missingEffectiveDate = await humanApp.fetch(
      request(
        "/admin/settings/policies",
        { ...draft, effectiveDate: undefined, reason: "Missing effective date" },
        "POST",
      ),
      env,
    );
    expect(missingEffectiveDate.status).toBe(422);
  });

  test("rejects non-human legal approval even when the service role has the permission", async () => {
    const created = await humanApp.fetch(request("/admin/settings/policies", draft, "POST"), env);
    const policy = ((await created.json()) as { data: { id: string } }).data;
    await seedServiceAdmin(env.DB, {
      id: "policy-bot",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "policy-bot",
    });
    const response = await serviceApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Bot attempted legal approval" },
        "POST",
      ),
      env,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "human_approval_required" } });
  });

  test("rejects publication when exact approval evidence belongs to another environment", async () => {
    const created = await humanApp.fetch(request("/admin/settings/policies", draft, "POST"), env);
    const policy = ((await created.json()) as { data: { id: string } }).data;
    expect(
      (
        await humanApp.fetch(
          request(
            `/admin/settings/policies/${policy.id}/approve`,
            { confirm: true, expectedVersion: 1, reason: "Approve exact policy" },
            "POST",
          ),
          env,
        )
      ).status,
    ).toBe(200);
    await env.DB.prepare(
      "UPDATE policy_versions SET approval_environment = ? WHERE policy_id = ? AND version = 1",
    )
      .bind(env.ENVIRONMENT === "production" ? "staging" : "production", policy.id)
      .run();
    const response = await humanApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}/publish`,
        { confirm: true, expectedVersion: 1, reason: "Publish cross environment" },
        "POST",
      ),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "policy_approval_environment_mismatch" },
    });
    expect(
      await env.DB.prepare(
        "SELECT result FROM audit_events WHERE action = 'policies.publish' ORDER BY created_at DESC LIMIT 1",
      ).first(),
    ).toEqual({ result: "denied" });
  });

  test("invalidates approval evidence if approved content drifts or is reused", async () => {
    const created = await humanApp.fetch(request("/admin/settings/policies", draft, "POST"), env);
    const policy = ((await created.json()) as { data: { id: string } }).data;
    const approvalInput = {
      confirm: true,
      expectedVersion: 1,
      reason: "Approve the exact reviewed content",
    };
    expect(
      (
        await humanApp.fetch(
          request(`/admin/settings/policies/${policy.id}/approve`, approvalInput, "POST"),
          env,
        )
      ).status,
    ).toBe(200);

    const reused = await humanApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}/approve`,
        { ...approvalInput, reason: "Attempt to reuse approval" },
        "POST",
      ),
      env,
    );
    expect(reused.status).toBe(409);

    await env.DB.prepare(
      "UPDATE policy_versions SET title = 'Changed after approval' WHERE policy_id = ? AND version = 1",
    )
      .bind(policy.id)
      .run();
    const drifted = await humanApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}/publish`,
        { confirm: true, expectedVersion: 1, reason: "Attempt to publish drifted content" },
        "POST",
      ),
      env,
    );
    expect(drifted.status).toBe(409);
    expect(await drifted.json()).toMatchObject({ error: { code: "policy_approval_stale" } });
    expect(
      (
        await env.DB.prepare(
          "SELECT action, result FROM audit_events WHERE result = 'denied' ORDER BY created_at",
        ).all<{ action: string; result: string }>()
      ).results,
    ).toEqual([
      { action: "policies.approve", result: "denied" },
      { action: "policies.publish", result: "denied" },
    ]);
  });

  test("updates optimistically, audits the successor, and publishes it over the prior version", async () => {
    const created = await humanApp.fetch(request("/admin/settings/policies", draft, "POST"), env);
    const policy = ((await created.json()) as { data: { id: string } }).data;
    for (const action of ["approve", "publish"] as const) {
      expect(
        (
          await humanApp.fetch(
            request(
              `/admin/settings/policies/${policy.id}/${action}`,
              { confirm: true, expectedVersion: 1, reason: `${action} version one` },
              "POST",
            ),
            env,
          )
        ).status,
      ).toBe(200);
    }

    const updated = await humanApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}`,
        { ...draft, expectedVersion: 1, reason: " ", title: "Returns policy v2" },
        "PUT",
      ),
      env,
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ data: { status: "draft", version: 2 } });
    expect(
      await env.DB.prepare(
        "SELECT reason FROM audit_events WHERE action = 'policies.update' AND target_id = ?",
      )
        .bind(policy.id)
        .first(),
    ).toEqual({ reason: null });

    const stale = await humanApp.fetch(
      request(
        `/admin/settings/policies/${policy.id}`,
        { ...draft, expectedVersion: 1, reason: "Overwrite stale successor" },
        "PUT",
      ),
      env,
    );
    expect(stale.status).toBe(409);

    for (const action of ["approve", "publish"] as const) {
      expect(
        (
          await humanApp.fetch(
            request(
              `/admin/settings/policies/${policy.id}/${action}`,
              { confirm: true, expectedVersion: 2, reason: `${action} version two` },
              "POST",
            ),
            env,
          )
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await env.DB.prepare(
          "SELECT version, status FROM policy_versions WHERE policy_id = ? ORDER BY version",
        )
          .bind(policy.id)
          .all()
      ).results,
    ).toEqual([
      { status: "archived", version: 1 },
      { status: "published", version: 2 },
    ]);
  });

  test("audits archive denial, filters backlinks, then archives once after repair", async () => {
    const created = await humanApp.fetch(request("/admin/settings/policies", draft, "POST"), env);
    const policy = ((await created.json()) as { data: { id: string } }).data;
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO navigation_menu_versions
          (menu_id, version, placement, status, created_at, updated_at)
         VALUES ('menu.policy-archive', 1, 'footer', 'draft', ?, ?)`,
      ).bind(now, now),
      env.DB.prepare(
        `INSERT INTO navigation_items
          (menu_id, menu_version, item_id, position, label, target_json)
         VALUES ('menu.policy-archive', 1, 'item.policy', 0, 'Returns', '{}')`,
      ),
      env.DB.prepare(
        `INSERT INTO navigation_policy_references
          (menu_id, menu_version, item_id, policy_id, policy_version, environment, created_at)
         VALUES ('menu.policy-archive', 1, 'item.policy', ?, 1, ?, ?)`,
      ).bind(policy.id, env.ENVIRONMENT, now),
      env.DB.prepare(
        `INSERT INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('custom_policy_archiver', 'policy_archiver', 'Policy archiver', 0, 0, 1, 1, ?, ?)`,
      ).bind(now, now),
      env.DB.prepare(
        `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('custom_policy_archiver', 'policies.publish', ?)`,
      ).bind(now),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "policy-restricted@example.test",
      id: "policy-restricted",
      roleId: "custom_policy_archiver",
      subject: "policy-restricted",
    });
    const restrictedApp = createApp({
      testIdentityVerifier: async () => ({
        email: "policy-restricted@example.test",
        principalKind: "human" as const,
        subject: "policy-restricted",
      }),
    });
    const archiveInput = {
      confirm: true,
      expectedVersion: 1,
      reason: "Archive after legal review",
    };
    const hidden = await restrictedApp.fetch(
      request(`/admin/settings/policies/${policy.id}/archive`, archiveInput, "POST"),
      env,
    );
    const hiddenBody = await hidden.json();
    expect(hiddenBody).toMatchObject({
      error: { code: "policy_referenced", details: { backlinks: [] } },
    });
    expect(hidden.status).toBe(409);
    expect(
      await env.DB.prepare(
        "SELECT result FROM audit_events WHERE action = 'policies.archive' AND actor_id = 'policy-restricted'",
      ).first(),
    ).toEqual({ result: "denied" });

    const visible = await humanApp.fetch(
      request(`/admin/settings/policies/${policy.id}/archive`, archiveInput, "POST"),
      env,
    );
    expect(await visible.json()).toMatchObject({
      error: { details: { backlinks: [{ sourceId: "menu.policy-archive" }] } },
    });
    await env.DB.prepare(
      "DELETE FROM navigation_policy_references WHERE menu_id = 'menu.policy-archive'",
    ).run();
    expect(
      (
        await humanApp.fetch(
          request(`/admin/settings/policies/${policy.id}/archive`, archiveInput, "POST"),
          env,
        )
      ).status,
    ).toBe(200);
    const retry = await humanApp.fetch(
      request(`/admin/settings/policies/${policy.id}/archive`, archiveInput, "POST"),
      env,
    );
    expect(retry.status).toBe(409);
    expect(
      (
        await env.DB.prepare(
          "SELECT result FROM audit_events WHERE action = 'policies.archive' AND actor_id = 'policy-owner' ORDER BY created_at",
        ).all<{ result: string }>()
      ).results.map(({ result }) => result),
    ).toEqual(["denied", "succeeded", "denied"]);
  });

  test("serializes concurrent draft creation and paginates the latest Policy records", async () => {
    const responses = await Promise.all([
      humanApp.fetch(request("/admin/settings/policies", draft, "POST"), env),
      humanApp.fetch(
        request(
          "/admin/settings/policies",
          { ...draft, reason: "Concurrent draft with same slug" },
          "POST",
        ),
        env,
      ),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM policy_versions WHERE slug = 'returns'",
      ).first(),
    ).toEqual({ count: 1 });

    for (const [index, kind] of ["privacy", "shipping", "terms"].entries()) {
      const response = await humanApp.fetch(
        request(
          "/admin/settings/policies",
          {
            ...draft,
            kind,
            reason: `Create pagination policy ${index}`,
            slug: `${kind}-${index}`,
            title: `${kind} policy`,
          },
          "POST",
        ),
        env,
      );
      expect(response.status).toBe(201);
    }
    const first = await humanApp.fetch(request("/admin/settings/policies?limit=2"), env);
    const firstBody = (await first.json()) as {
      data: unknown[];
      meta: { nextCursor: string | null };
    };
    expect(firstBody.data).toHaveLength(2);
    expect(firstBody.meta.nextCursor).toBeTruthy();
    const second = await humanApp.fetch(
      request(
        `/admin/settings/policies?limit=2&cursor=${encodeURIComponent(firstBody.meta.nextCursor!)}`,
      ),
      env,
    );
    const secondBody = (await second.json()) as {
      data: unknown[];
      meta: { nextCursor: string | null };
    };
    expect(secondBody.data).toHaveLength(2);
    expect(secondBody.meta.nextCursor).toBeNull();
  });
});
