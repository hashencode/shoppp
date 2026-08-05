import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { deliverNotificationJob } from "../../src/automation/workflows";
import { createApp } from "../../src/http/app";
import { bootstrapFirstAdmin, productionBootstrapConfirmation } from "../../src/iam/bootstrap";
import { EmailProviderError, type EmailProvider } from "../../src/notifications/port";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

function request(path: string, method = "GET", body?: unknown, headers: HeadersInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      "X-Test-Admin-Identity": "test-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...headers,
    },
    method,
  });
}

function humanApp(subject: string, email: string) {
  return createApp({
    testIdentityVerifier: async () => ({ email, principalKind: "human", subject }),
  });
}

const adminApp = humanApp("inviting-admin", "inviting-admin@example.test");
const AUTH_TOKEN_SECRET = "test-auth-token-secret-that-is-at-least-32-characters";

async function invite(email = "Operator@Example.com", idempotencyKey = "invite-operator-0001") {
  return adminApp.fetch(
    request("/admin/iam/invitations", "POST", {
      displayName: "<Operator & Owner>",
      email,
      idempotencyKey,
      roleId: ADMIN_ROLE_IDS.operations,
    }),
    env,
  );
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM admin_invitations"),
    env.DB.prepare("DELETE FROM admin_identities"),
  ]);
  await seedHumanAdmin(env.DB, {
    email: "inviting-admin@example.test",
    id: "inviting-admin",
    roleId: ADMIN_ROLE_IDS.admin,
    subject: "inviting-admin",
  });
});

describe("admin invitation lifecycle", () => {
  test("normalizes, idempotently reuses, resends, lists, and revokes an invitation", async () => {
    const created = await invite();
    expect(created.status).toBe(201);
    const body = (await created.json()) as { data: { id: string; version: number } };
    const replay = await invite();
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      data: { email: "operator@example.com", id: body.data.id },
      meta: { reused: true },
    });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM notification_jobs WHERE payload_json = ?")
        .bind(JSON.stringify({ invitationId: body.data.id }))
        .first(),
    ).toEqual({ count: 1 });

    const resent = await adminApp.fetch(
      request(`/admin/iam/invitations/${body.data.id}/resend`, "POST", {
        expectedVersion: body.data.version,
        idempotencyKey: "resend-operator-0001",
      }),
      env,
    );
    expect(resent.status).toBe(200);
    expect(await resent.json()).toMatchObject({ data: { version: 2 } });
    const resendReplay = await adminApp.fetch(
      request(`/admin/iam/invitations/${body.data.id}/resend`, "POST", {
        expectedVersion: body.data.version,
        idempotencyKey: "resend-operator-0001",
      }),
      env,
    );
    expect(resendReplay.status).toBe(200);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM notification_jobs WHERE payload_json = ?")
        .bind(JSON.stringify({ invitationId: body.data.id }))
        .first(),
    ).toEqual({ count: 2 });

    const listed = await adminApp.fetch(
      request("/admin/iam/invitations?status=pending&search=operator"),
      env,
    );
    expect(await listed.json()).toMatchObject({ data: { total: 1 } });
    const revoked = await adminApp.fetch(
      request(`/admin/iam/invitations/${body.data.id}/revoke`, "POST", {
        expectedVersion: 2,
      }),
      env,
    );
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toMatchObject({ data: { status: "revoked", version: 3 } });
    expect(
      (
        await env.DB.prepare(
          "SELECT action, actor_type, result FROM audit_events WHERE target_id = ? ORDER BY action",
        )
          .bind(body.data.id)
          .all()
      ).results,
    ).toEqual([
      { action: "iam.invitations.create", actor_type: "admin", result: "succeeded" },
      { action: "iam.invitations.resend", actor_type: "admin", result: "succeeded" },
      { action: "iam.invitations.revoke", actor_type: "admin", result: "succeeded" },
    ]);
    const revokeAudit = await env.DB.prepare(
      "SELECT metadata_json FROM audit_events WHERE action = 'iam.invitations.revoke' AND target_id = ?",
    )
      .bind(body.data.id)
      .first<{ metadata_json: string }>();
    expect(JSON.parse(revokeAudit!.metadata_json)).toEqual({
      after: { status: "revoked", version: 3 },
      before: { status: "pending", version: 2 },
    });
  });

  test("collapses concurrent invitation creation to one active record", async () => {
    const responses = await Promise.all([
      invite("concurrent@example.test", "invite-concurrent-a"),
      invite("Concurrent@Example.test", "invite-concurrent-b"),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 201]);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM admin_invitations WHERE normalized_email = 'concurrent@example.test' AND status = 'pending'",
      ).first(),
    ).toEqual({ count: 1 });
  });

  test("rejects creation when the selected role is archived before the write batch", async () => {
    let intercepted = false;
    const db = new Proxy(env.DB, {
      get(target, property) {
        if (property === "batch") {
          return async (statements: D1PreparedStatement[]) => {
            if (!intercepted) {
              intercepted = true;
              await target
                .prepare("UPDATE admin_roles SET enabled = 0 WHERE id = ?")
                .bind(ADMIN_ROLE_IDS.operations)
                .run();
            }
            return target.batch(statements);
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    try {
      const response = await adminApp.fetch(
        request("/admin/iam/invitations", "POST", {
          email: "archived-role@example.test",
          idempotencyKey: "invite-archived-role-0001",
          roleId: ADMIN_ROLE_IDS.operations,
        }),
        { ...env, DB: db },
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code: "role_unavailable" } });
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM admin_invitations WHERE normalized_email = 'archived-role@example.test'",
        ).first(),
      ).toEqual({ count: 0 });
      expect(
        await env.DB.prepare(
          "SELECT reason, result FROM audit_events WHERE action = 'iam.invitations.create'",
        ).first(),
      ).toEqual({ reason: "role_unavailable", result: "denied" });
    } finally {
      await env.DB.prepare("UPDATE admin_roles SET enabled = 1 WHERE id = ?")
        .bind(ADMIN_ROLE_IDS.operations)
        .run();
    }
  });

  test("renders and delivers an escaped, environment-specific, secret-free sign-in link", async () => {
    const created = await invite("notify@example.test", "invite-notify-0001");
    const invitationId = ((await created.json()) as { data: { id: string } }).data.id;
    const job = await env.DB.prepare(
      "SELECT id FROM notification_jobs WHERE type = 'admin_invitation' AND payload_json = ?",
    )
      .bind(JSON.stringify({ invitationId }))
      .first<{ id: string }>();
    const send = vi.fn(async () => ({ id: "provider-message-1" }));
    const provider: EmailProvider = { send };
    await expect(
      deliverNotificationJob(
        env.DB,
        provider,
        "https://shop.example.test",
        job!.id,
        new Date().toISOString(),
        "admin@example.test",
        "https://admin-test.example.test",
        AUTH_TOKEN_SECRET,
      ),
    ).resolves.toEqual({ status: "sent" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("&lt;Operator &amp; Owner&gt;"),
        text: expect.stringContaining("https://admin-test.example.test/"),
        to: "notify@example.test",
      }),
    );
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/bearer|secret|access_token/i);
  });

  test("records retryable and permanent delivery failure separately from invitation validity", async () => {
    const created = await invite("failure@example.test", "invite-failure-0001");
    const invitationId = ((await created.json()) as { data: { id: string } }).data.id;
    const job = await env.DB.prepare(
      "SELECT id FROM notification_jobs WHERE type = 'admin_invitation' AND payload_json = ?",
    )
      .bind(JSON.stringify({ invitationId }))
      .first<{ id: string }>();
    const retrying: EmailProvider = {
      send: async () => {
        throw new EmailProviderError("provider_busy", "Busy", true);
      },
    };
    expect(
      (
        await deliverNotificationJob(
          env.DB,
          retrying,
          "https://shop.example.test",
          job!.id,
          new Date().toISOString(),
          "admin@example.test",
          "https://admin-test.example.test",
          AUTH_TOKEN_SECRET,
        )
      ).status,
    ).toBe("retry");
    await env.DB.prepare(
      "UPDATE notification_jobs SET status = 'pending', next_attempt_at = NULL WHERE id = ?",
    )
      .bind(job!.id)
      .run();
    const permanent: EmailProvider = {
      send: async () => {
        throw new EmailProviderError("recipient_rejected", "Rejected", false);
      },
    };
    expect(
      (
        await deliverNotificationJob(
          env.DB,
          permanent,
          "https://shop.example.test",
          job!.id,
          new Date().toISOString(),
          "admin@example.test",
          "https://admin-test.example.test",
          AUTH_TOKEN_SECRET,
        )
      ).status,
    ).toBe("dead_letter");
    expect(
      await env.DB.prepare("SELECT status FROM admin_invitations WHERE id = ?")
        .bind(invitationId)
        .first(),
    ).toEqual({ status: "pending" });
    const listed = await adminApp.fetch(
      request("/admin/iam/invitations?search=failure@example.test"),
      env,
    );
    expect(await listed.json()).toMatchObject({
      data: {
        items: [
          {
            delivery: {
              attemptCount: 2,
              lastErrorCode: "recipient_rejected",
              status: "dead_letter",
            },
            status: "pending",
          },
        ],
      },
    });
  });

  test("bootstraps one protected invitation, reuses it, and refuses after activation", async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM admin_identities"),
    ]);
    const input = {
      databaseIdentity: "shoppp-staging",
      email: "First.Admin@Example.test",
      environment: "test" as const,
    };
    const first = await bootstrapFirstAdmin(env.DB, input);
    expect(first.reused).toBe(false);
    expect(
      await env.DB.prepare(
        "SELECT actor_type, result FROM audit_events WHERE action = 'iam.bootstrap.invitation' AND target_id = ?",
      )
        .bind(first.invitationId)
        .first(),
    ).toEqual({ actor_type: "machine", result: "succeeded" });
    await expect(bootstrapFirstAdmin(env.DB, input)).resolves.toEqual({
      invitationId: first.invitationId,
      reused: true,
    });
    await seedHumanAdmin(env.DB, {
      email: "active-admin@example.test",
      id: "active-admin",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "active-admin",
    });
    await expect(bootstrapFirstAdmin(env.DB, input)).rejects.toThrow(/enabled protected/);
    await expect(
      bootstrapFirstAdmin(env.DB, {
        databaseIdentity: "shoppp-production",
        email: "owner@example.test",
        environment: "production",
      }),
    ).rejects.toThrow(/confirmation/);
    await expect(
      bootstrapFirstAdmin(env.DB, {
        databaseIdentity: "shoppp-development",
        email: "owner@example.test",
        environment: "test",
      }),
    ).rejects.toThrow(/shoppp-staging/);
    expect(productionBootstrapConfirmation("shoppp-production", "Owner@Example.test")).toBe(
      "BOOTSTRAP_PRODUCTION:shoppp-production:owner@example.test",
    );
  });
});
