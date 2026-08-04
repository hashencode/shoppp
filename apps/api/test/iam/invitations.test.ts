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
      "Cf-Access-Jwt-Assertion": "test-token",
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
    accessVerifier: async () => ({ email, principalKind: "human", subject }),
  });
}

const adminApp = humanApp("inviting-admin", "inviting-admin@example.test");

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

  test("atomically accepts one exact normalized human identity and returns its session", async () => {
    await invite();
    const app = humanApp("operator-subject", "operator@example.com");
    const tunnelHostname = "admin-dev-test.example.com";
    const accepted = await app.fetch(
      request("/admin/onboarding", "POST", undefined, {
        Origin: `https://${tunnelHostname}`,
      }),
      { ...env, ADMIN_TUNNEL_HOSTNAME: tunnelHostname, ENVIRONMENT: "staging" },
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      data: {
        email: "operator@example.com",
        principalKind: "human",
        role: { id: ADMIN_ROLE_IDS.operations },
      },
      meta: { accepted: true },
    });
    expect((await app.fetch(request("/admin/session"), env)).status).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT status, accepted_identity_id FROM admin_invitations WHERE normalized_email = 'operator@example.com'",
      ).first(),
    ).toMatchObject({ status: "accepted", accepted_identity_id: expect.any(String) });
    expect(
      await env.DB.prepare(
        "SELECT actor_type, result FROM audit_events WHERE action = 'iam.invitations.accept' AND target_id = (SELECT id FROM admin_invitations WHERE normalized_email = 'operator@example.com')",
      ).first(),
    ).toEqual({ actor_type: "admin", result: "succeeded" });
  });

  test("allows exactly one winner in an invitation acceptance race", async () => {
    await invite("race@example.test", "invite-race-0001");
    const responses = await Promise.all([
      humanApp("race-subject-one", "race@example.test").fetch(
        request("/admin/onboarding", "POST"),
        env,
      ),
      humanApp("race-subject-two", "race@example.test").fetch(
        request("/admin/onboarding", "POST"),
        env,
      ),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM admin_identities WHERE normalized_email = 'race@example.test'",
      ).first(),
    ).toEqual({ count: 1 });
  });

  test("does not create an identity when the invitation is revoked before the acceptance batch", async () => {
    const created = await invite("revoked-race@example.test", "invite-revoked-race-0001");
    const invitationId = ((await created.json()) as { data: { id: string } }).data.id;
    let intercepted = false;
    const db = new Proxy(env.DB, {
      get(target, property) {
        if (property === "batch") {
          return async (statements: D1PreparedStatement[]) => {
            if (!intercepted) {
              intercepted = true;
              const revokedAt = new Date().toISOString();
              await target
                .prepare(
                  `UPDATE admin_invitations
                      SET status = 'revoked', revoked_at = ?, version = version + 1, updated_at = ?
                    WHERE id = ?`,
                )
                .bind(revokedAt, revokedAt, invitationId)
                .run();
            }
            return target.batch(statements);
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const racedEnv = { ...env, DB: db };

    const response = await humanApp("revoked-race-subject", "revoked-race@example.test").fetch(
      request("/admin/onboarding", "POST"),
      racedEnv,
    );

    expect(response.status).toBe(409);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM admin_identities WHERE normalized_email = 'revoked-race@example.test'",
      ).first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare("SELECT status FROM admin_invitations WHERE id = ?")
        .bind(invitationId)
        .first(),
    ).toEqual({ status: "revoked" });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'iam.invitations.accept' AND target_id = ?",
      )
        .bind(invitationId)
        .first(),
    ).toEqual({ count: 0 });
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

  test("denies mismatched, absent, expired, and service invitation claims without creating users", async () => {
    const created = await invite("expected@example.test", "invite-denials-0001");
    const id = ((await created.json()) as { data: { id: string } }).data.id;
    const missingOrigin = await humanApp("expected-subject", "expected@example.test").fetch(
      new Request("https://api.example.test/admin/onboarding", {
        headers: { "Cf-Access-Jwt-Assertion": "test-token" },
        method: "POST",
      }),
      env,
    );
    expect(missingOrigin.status).toBe(403);
    expect(await missingOrigin.json()).toMatchObject({ error: { code: "admin_origin_denied" } });
    expect(
      (
        await humanApp("wrong-subject", "wrong@example.test").fetch(
          request("/admin/onboarding", "POST"),
          env,
        )
      ).status,
    ).toBe(401);
    const service = createApp({
      accessVerifier: async () => ({
        principalKind: "service",
        serviceName: "invite-claimer",
        subject: "invite-claimer",
      }),
    });
    const serviceResponse = await service.fetch(
      new Request("https://api.example.test/admin/onboarding", {
        headers: { "Cf-Access-Jwt-Assertion": "test-token" },
        method: "POST",
      }),
      env,
    );
    expect(serviceResponse.status).toBe(403);
    expect(await serviceResponse.json()).toMatchObject({
      error: { code: "human_invitation_required" },
    });
    await env.DB.prepare("UPDATE admin_invitations SET expires_at = ? WHERE id = ?")
      .bind("2020-01-01T00:00:00.000Z", id)
      .run();
    expect(
      (
        await humanApp("expected-subject", "expected@example.test").fetch(
          request("/admin/onboarding", "POST"),
          env,
        )
      ).status,
    ).toBe(401);
    const expired = await adminApp.fetch(
      request("/admin/iam/invitations?status=expired&search=expected"),
      env,
    );
    expect(await expired.json()).toMatchObject({
      data: { items: [{ id, status: "expired" }], total: 1 },
    });
    expect(
      await env.DB.prepare("SELECT status FROM admin_invitations WHERE id = ?").bind(id).first(),
    ).toEqual({ status: "pending" });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM admin_identities WHERE id != 'inviting-admin'",
      ).first(),
    ).toEqual({ count: 0 });
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
      (await deliverNotificationJob(env.DB, retrying, "https://shop.example.test", job!.id)).status,
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
      (await deliverNotificationJob(env.DB, permanent, "https://shop.example.test", job!.id))
        .status,
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
