import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { notificationJobSchema } from "@shoppp/contracts";

import { deliverNotificationJob } from "../../src/automation/workflows";
import { createApp } from "../../src/http/app";
import { cleanupExpiredAdminAuthState } from "../../src/iam/password-auth";
import {
  createSignedInvitationToken,
  hashOpaqueToken,
  hashPassword,
} from "../../src/iam/passwords";
import { ADMIN_ROLE_IDS, seedHumanAdmin, seedServiceAdmin } from "../fixtures/admin-iam";
import type { EmailProvider } from "../../src/notifications/port";
import { listNotificationJobs } from "../../src/recovery/notification-jobs";

const PASSWORD = "correct horse battery staple";

function request(path: string, body: unknown, cookie?: string): Request {
  return new Request(`https://api.example.test${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    method: "POST",
  });
}

async function seedPasswordUser(input: {
  email: string;
  id: string;
  roleId: string;
}): Promise<void> {
  await seedHumanAdmin(env.DB, {
    email: input.email,
    id: input.id,
    roleId: input.roleId,
    subject: `password:${input.id}`,
  });
  const password = await hashPassword(PASSWORD);
  await env.DB.prepare(
    `INSERT INTO admin_password_credentials
       (identity_id, password_hash, password_salt, password_iterations, password_version,
        must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 0, ?, ?)`,
  )
    .bind(
      input.id,
      password.hash,
      password.salt,
      password.iterations,
      "2026-08-04T00:00:00.000Z",
      "2026-08-04T00:00:00.000Z",
    )
    .run();
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_password_reset_tokens"),
    env.DB.prepare("DELETE FROM admin_sessions"),
    env.DB.prepare("DELETE FROM admin_login_throttles"),
    env.DB.prepare("DELETE FROM admin_service_credentials"),
    env.DB.prepare("DELETE FROM admin_password_credentials"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM admin_invitations"),
    env.DB.prepare("DELETE FROM admin_identities"),
  ]);
});

describe("administrator password authentication", () => {
  test("authenticates a machine with an independent bearer credential", async () => {
    await seedServiceAdmin(env.DB, {
      id: "identity-password-service",
      roleId: ADMIN_ROLE_IDS.operations,
      subject: "catalog-automation",
    });
    const token = "service_token_that_is_random_and_long_enough_for_testing";
    await env.DB.prepare(
      `INSERT INTO admin_service_credentials
         (id, identity_id, name, token_hash, enabled, created_at)
       VALUES ('credential-service-test', 'identity-password-service', 'Catalog automation', ?, 1, ?)`,
    )
      .bind(await hashOpaqueToken(token), new Date().toISOString())
      .run();

    const response = await createApp().fetch(
      new Request("https://api.example.test/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT last_used_at FROM admin_service_credentials WHERE id = 'credential-service-test'",
      ).first(),
    ).toMatchObject({ last_used_at: expect.any(String) });
  });

  test("activates an invitation by setting the first password and starts a session", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO admin_invitations
         (id, normalized_email, display_name, role_id, status, idempotency_key,
          invited_by_id, expires_at, version, created_at, updated_at)
       VALUES ('inv_password_operator', 'new-operator@example.test', 'New operator', ?,
               'pending', 'password-activation-0001', NULL, ?, 1, ?, ?)`,
    )
      .bind(ADMIN_ROLE_IDS.operations, expiresAt, now.toISOString(), now.toISOString())
      .run();
    const secret = "test-auth-token-secret-that-is-at-least-32-characters";
    const token = await createSignedInvitationToken(secret, {
      expiresAt,
      invitationId: "inv_password_operator",
      version: 1,
    });

    const activated = await createApp({ passwordResetSecret: secret }).fetch(
      request("/admin/auth/activate", { password: PASSWORD, token }),
      env,
    );

    expect(activated.status).toBe(200);
    expect(activated.headers.get("set-cookie")).toContain("shoppp_admin_session=");
    expect(await activated.json()).toMatchObject({
      data: { email: "new-operator@example.test", role: { key: "operations" } },
    });
    expect(
      await env.DB.prepare(
        `SELECT invitation.status, credential.password_version
           FROM admin_invitations invitation
           JOIN admin_password_credentials credential
             ON credential.identity_id = invitation.accepted_identity_id
          WHERE invitation.id = 'inv_password_operator'`,
      ).first(),
    ).toEqual({ password_version: 1, status: "accepted" });
  });

  test("does not misreport an activation infrastructure failure as a used invitation", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO admin_invitations
         (id, normalized_email, display_name, role_id, status, idempotency_key,
          invited_by_id, expires_at, version, created_at, updated_at)
       VALUES ('inv_activation_failure', 'activation-failure@example.test', 'Failure test', ?,
               'pending', 'password-activation-failure', NULL, ?, 1, ?, ?)`,
    )
      .bind(ADMIN_ROLE_IDS.operations, expiresAt, now.toISOString(), now.toISOString())
      .run();
    await env.DB.prepare(
      `CREATE TRIGGER fail_activation_audit BEFORE INSERT ON audit_events
       WHEN NEW.action = 'iam.invitations.accept'
       BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END`,
    ).run();
    const token = await createSignedInvitationToken(
      "test-auth-token-secret-that-is-at-least-32-characters",
      { expiresAt, invitationId: "inv_activation_failure", version: 1 },
    );

    try {
      const response = await createApp({
        passwordResetSecret: "test-auth-token-secret-that-is-at-least-32-characters",
      }).fetch(request("/admin/auth/activate", { password: PASSWORD, token }), env);
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: { code: "internal_error" } });
      expect(
        await env.DB.prepare(
          "SELECT status FROM admin_invitations WHERE id = 'inv_activation_failure'",
        ).first(),
      ).toEqual({ status: "pending" });
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_activation_audit").run();
    }
  });

  test("logs in with email and password and authenticates the session cookie", async () => {
    await seedPasswordUser({
      email: "operator@example.test",
      id: "identity-password-operator",
      roleId: ADMIN_ROLE_IDS.operations,
    });
    const app = createApp();
    const login = await app.fetch(
      request("/admin/auth/login", {
        email: "Operator@Example.Test",
        password: PASSWORD,
      }),
      env,
    );

    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie");
    expect(cookie).toContain("shoppp_admin_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");

    const session = await app.fetch(
      new Request("https://api.example.test/admin/session", {
        headers: { Cookie: cookie!.split(";")[0]! },
      }),
      env,
    );
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      data: {
        email: "operator@example.test",
        identityId: "identity-password-operator",
        principalKind: "human",
        role: { key: "operations" },
      },
    });
  });

  test("does not commit a login session when its success audit fails", async () => {
    await seedPasswordUser({
      email: "audit-failure@example.test",
      id: "identity-password-audit-failure",
      roleId: ADMIN_ROLE_IDS.operations,
    });
    await env.DB.prepare(
      `CREATE TRIGGER fail_login_audit BEFORE INSERT ON audit_events
       WHEN NEW.action = 'iam.password.login' AND NEW.result = 'succeeded'
       BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END`,
    ).run();

    try {
      const response = await createApp().fetch(
        request("/admin/auth/login", {
          email: "audit-failure@example.test",
          password: PASSWORD,
        }),
        env,
      );
      expect(response.status).toBe(500);
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM admin_sessions WHERE identity_id = 'identity-password-audit-failure'",
        ).first(),
      ).toEqual({ count: 0 });
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_login_audit").run();
    }
  });

  test("logs out the current cookie session", async () => {
    await seedPasswordUser({
      email: "logout@example.test",
      id: "identity-password-logout",
      roleId: ADMIN_ROLE_IDS.support,
    });
    const app = createApp();
    const login = await app.fetch(
      request("/admin/auth/login", { email: "logout@example.test", password: PASSWORD }),
      env,
    );
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const logout = await app.fetch(request("/admin/auth/logout", {}, cookie), env);
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("shoppp_admin_session=");
    expect(
      (
        await app.fetch(
          new Request("https://api.example.test/admin/session", { headers: { Cookie: cookie } }),
          env,
        )
      ).status,
    ).toBe(401);
  });

  test("lets a protected administrator change a known password and rotates the session", async () => {
    await seedPasswordUser({
      email: "change-owner@example.test",
      id: "identity-password-change-owner",
      roleId: ADMIN_ROLE_IDS.admin,
    });
    const app = createApp();
    const login = await app.fetch(
      request("/admin/auth/login", { email: "change-owner@example.test", password: PASSWORD }),
      env,
    );
    const oldCookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const changed = await app.fetch(
      request(
        "/admin/auth/password/change",
        {
          currentPassword: PASSWORD,
          newPassword: "new correct horse battery staple",
        },
        oldCookie,
      ),
      env,
    );
    expect(changed.status).toBe(204);
    expect(changed.headers.get("set-cookie")).toContain("shoppp_admin_session=");
    expect(
      (
        await app.fetch(
          new Request("https://api.example.test/admin/session", {
            headers: { Cookie: oldCookie },
          }),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await app.fetch(
          request("/admin/auth/login", {
            email: "change-owner@example.test",
            password: "new correct horse battery staple",
          }),
          env,
        )
      ).status,
    ).toBe(200);
  });

  test("rolls back password rotation when its success audit fails", async () => {
    await seedPasswordUser({
      email: "change-audit-failure@example.test",
      id: "identity-password-change-audit-failure",
      roleId: ADMIN_ROLE_IDS.admin,
    });
    const app = createApp();
    const login = await app.fetch(
      request("/admin/auth/login", {
        email: "change-audit-failure@example.test",
        password: PASSWORD,
      }),
      env,
    );
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    await env.DB.prepare(
      `CREATE TRIGGER fail_password_change_audit BEFORE INSERT ON audit_events
       WHEN NEW.action = 'iam.password.change' AND NEW.result = 'succeeded'
       BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END`,
    ).run();

    try {
      const response = await app.fetch(
        request(
          "/admin/auth/password/change",
          { currentPassword: PASSWORD, newPassword: "new correct horse battery staple" },
          cookie,
        ),
        env,
      );
      expect(response.status).toBe(500);
      expect(
        (
          await app.fetch(
            request("/admin/auth/login", {
              email: "change-audit-failure@example.test",
              password: PASSWORD,
            }),
            env,
          )
        ).status,
      ).toBe(200);
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_password_change_audit").run();
    }
  });

  test("throttles repeated invalid password attempts by account and address", async () => {
    await seedPasswordUser({
      email: "throttle@example.test",
      id: "identity-password-throttle",
      roleId: ADMIN_ROLE_IDS.support,
    });
    const app = createApp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.fetch(
        request("/admin/auth/login", {
          email: "throttle@example.test",
          password: "incorrect password value",
        }),
        env,
      );
      expect(response.status).toBe(401);
    }
    const blocked = await app.fetch(
      request("/admin/auth/login", {
        email: "throttle@example.test",
        password: PASSWORD,
      }),
      env,
    );
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: { code: "admin_login_throttled" } });
  });

  test("limits random-email guesses by address before password hashing", async () => {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO admin_login_throttles
         (key_hash, failure_count, window_started_at, blocked_until, updated_at)
       VALUES (?, 25, ?, NULL, ?)`,
    )
      .bind(await hashOpaqueToken("address\nunknown"), now, now)
      .run();

    const response = await createApp().fetch(
      request("/admin/auth/login", {
        email: "never-seen-before@example.test",
        password: "incorrect password value",
      }),
      env,
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "admin_login_throttled" } });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_login_throttles").first(),
    ).toEqual({ count: 1 });
  });

  test("removes stale authentication state in bounded scheduled cleanup", async () => {
    const stale = "2026-07-01T00:00:00.000Z";
    const fresh = "2026-08-04T00:00:00.000Z";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_login_throttles
           (key_hash, failure_count, window_started_at, blocked_until, updated_at)
         VALUES ('stale-throttle-key-hash-that-is-long-enough', 1, ?, NULL, ?),
                ('fresh-throttle-key-hash-that-is-long-enough', 1, ?, NULL, ?)`,
      ).bind(stale, stale, fresh, fresh),
    ]);

    await cleanupExpiredAdminAuthState(env.DB, new Date("2026-08-04T01:00:00.000Z"));

    expect(
      await env.DB.prepare("SELECT key_hash FROM admin_login_throttles ORDER BY key_hash").all(),
    ).toMatchObject({
      results: [{ key_hash: "fresh-throttle-key-hash-that-is-long-enough" }],
    });
  });

  test("rejects online reset for the protected administrator role", async () => {
    await seedPasswordUser({
      email: "owner@example.test",
      id: "identity-password-owner",
      roleId: ADMIN_ROLE_IDS.admin,
    });
    const response = await createApp().fetch(
      request("/admin/auth/password-reset/request", { email: "owner@example.test" }),
      env,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "protected_admin_password_reset_denied" },
    });
  });

  test("lets a migrated ordinary user without a credential establish one by reset", async () => {
    await seedHumanAdmin(env.DB, {
      email: "migrated-support@example.test",
      id: "identity-password-migrated-support",
      roleId: ADMIN_ROLE_IDS.support,
      subject: "legacy-access-subject",
    });
    const app = createApp({ exposePasswordResetToken: true });
    const requested = await app.fetch(
      request("/admin/auth/password-reset/request", {
        email: "migrated-support@example.test",
      }),
      env,
    );
    expect(requested.status).toBe(202);
    const { data } = (await requested.json()) as { data: { resetToken: string } };

    expect(
      (
        await app.fetch(
          request("/admin/auth/password-reset/confirm", {
            newPassword: "migrated correct horse battery staple",
            token: data.resetToken,
          }),
          env,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await app.fetch(
          request("/admin/auth/login", {
            email: "migrated-support@example.test",
            password: "migrated correct horse battery staple",
          }),
          env,
        )
      ).status,
    ).toBe(200);
  });

  test("allows a non-protected user to reset once and revokes existing sessions", async () => {
    await seedPasswordUser({
      email: "support@example.test",
      id: "identity-password-support",
      roleId: ADMIN_ROLE_IDS.support,
    });
    const app = createApp({ exposePasswordResetToken: true });
    const login = await app.fetch(
      request("/admin/auth/login", { email: "support@example.test", password: PASSWORD }),
      env,
    );
    const oldCookie = login.headers.get("set-cookie")!.split(";")[0]!;

    const requested = await app.fetch(
      request("/admin/auth/password-reset/request", { email: "support@example.test" }),
      env,
    );
    expect(requested.status).toBe(202);
    const { data } = (await requested.json()) as { data: { resetToken: string } };
    const resetJobsBeforeRepeated = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notification_jobs WHERE type = 'admin_password_reset'",
    ).first<{ count: number }>();
    const repeated = await app.fetch(
      request("/admin/auth/password-reset/request", { email: "support@example.test" }),
      env,
    );
    expect(repeated.status).toBe(202);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM notification_jobs WHERE type = 'admin_password_reset'",
      ).first(),
    ).toEqual(resetJobsBeforeRepeated);
    const job = await env.DB.prepare(
      "SELECT id FROM notification_jobs WHERE type = 'admin_password_reset' ORDER BY created_at DESC LIMIT 1",
    ).first<{ id: string }>();
    const listedJobs = await listNotificationJobs(env.DB, { page: 1, pageSize: 20 });
    const listedReset = listedJobs.data.find((item) => item.id === job?.id);
    expect(notificationJobSchema.parse(listedReset)).toMatchObject({
      recipient: "s***@example.test",
      type: "admin_password_reset",
    });
    const send = vi.fn(async () => ({ id: "password-reset-message" }));
    const provider: EmailProvider = { send };
    expect(
      await deliverNotificationJob(
        env.DB,
        provider,
        "https://shop.example.test",
        job!.id,
        new Date().toISOString(),
        "admin@example.test",
        "https://admin.example.test",
        "test-auth-token-secret-that-is-at-least-32-characters",
      ),
    ).toEqual({ status: "sent" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("https://admin.example.test/reset-password?token="),
        to: "support@example.test",
      }),
    );

    const confirmed = await app.fetch(
      request("/admin/auth/password-reset/confirm", {
        newPassword: "new correct horse battery staple",
        token: data.resetToken,
      }),
      env,
    );
    expect(confirmed.status).toBe(204);

    expect(
      (
        await app.fetch(
          new Request("https://api.example.test/admin/session", {
            headers: { Cookie: oldCookie },
          }),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await app.fetch(
          request("/admin/auth/password-reset/confirm", {
            newPassword: "another correct horse battery staple",
            token: data.resetToken,
          }),
          env,
        )
      ).status,
    ).toBe(400);
  });
});
