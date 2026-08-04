import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin, seedServiceAdmin } from "../fixtures/admin-iam";

function request(path: string, body?: unknown): Request {
  return new Request(`https://api.example.test${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
    },
    method: body === undefined ? "GET" : "PATCH",
  });
}

function humanApp(subject: string, email = `${subject}@example.test`) {
  return createApp({
    accessVerifier: async () => ({ email, principalKind: "human", subject }),
  });
}

const serviceApp = createApp({
  accessVerifier: async () => ({
    principalKind: "service",
    serviceName: "iam-controller",
    subject: "iam-controller",
  }),
});

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM notification_jobs"),
    env.DB.prepare("DELETE FROM admin_invitations"),
    env.DB.prepare("DELETE FROM admin_identities"),
  ]);
  await seedHumanAdmin(env.DB, {
    email: "admin-one@example.test",
    id: "admin-one",
    roleId: ADMIN_ROLE_IDS.admin,
    subject: "admin-one",
  });
  await seedHumanAdmin(env.DB, {
    email: "operator@example.test",
    id: "operator-one",
    roleId: ADMIN_ROLE_IDS.operations,
    subject: "operator",
  });
  await seedServiceAdmin(env.DB, {
    id: "service-controller",
    roleId: ADMIN_ROLE_IDS.admin,
    subject: "iam-controller",
  });
});

describe("admin user lifecycle", () => {
  test("lists only human identities and applies versioned role/status changes", async () => {
    const app = humanApp("admin-one");
    const listed = await app.fetch(request("/admin/iam/users?search=operator"), env);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      data: { items: [{ email: "operator@example.test", status: "active", version: 1 }], total: 1 },
    });
    const inspected = await app.fetch(request("/admin/iam/users/operator-one"), env);
    expect(inspected.status).toBe(200);
    expect(await inspected.json()).toMatchObject({
      data: { email: "operator@example.test", role: { id: ADMIN_ROLE_IDS.operations } },
    });

    const changed = await app.fetch(
      request("/admin/iam/users/operator-one", {
        enabled: false,
        expectedVersion: 1,
        roleId: ADMIN_ROLE_IDS.support,
      }),
      env,
    );
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({
      data: { role: { id: ADMIN_ROLE_IDS.support }, status: "disabled", version: 2 },
    });
    const audit = await env.DB.prepare(
      "SELECT metadata_json FROM audit_events WHERE action = 'iam.users.update' AND target_id = 'operator-one' AND result = 'succeeded'",
    ).first<{ metadata_json: string }>();
    expect(JSON.parse(audit!.metadata_json)).toEqual({
      after: { enabled: false, roleId: ADMIN_ROLE_IDS.support, version: 2 },
      before: { enabled: true, roleId: ADMIN_ROLE_IDS.operations, version: 1 },
    });
    expect(audit!.metadata_json).not.toMatch(/operator@example|test-token/i);
    const stale = await app.fetch(
      request("/admin/iam/users/operator-one", { displayName: "Stale", expectedVersion: 1 }),
      env,
    );
    expect(stale.status).toBe(409);
  });

  test("rejects every self role or status change and audits it", async () => {
    const response = await humanApp("admin-one").fetch(
      request("/admin/iam/users/admin-one", { enabled: false, expectedVersion: 1 }),
      env,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "self_user_change_denied" } });
    expect(
      await env.DB.prepare(
        "SELECT result FROM audit_events WHERE action = 'iam.users.update' AND target_id = 'admin-one'",
      ).first(),
    ).toEqual({ result: "denied" });
  });

  test("rejects protected-role assignment by a non-protected manager", async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('role_user_manager', 'user_manager', 'User manager', 0, 0, 1, 1, ?, ?)`,
      ).bind("2026-08-04T00:00:00.000Z", "2026-08-04T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
         VALUES ('role_user_manager', 'iam.users.write', '2026-08-04T00:00:00.000Z')`,
      ),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "manager@example.test",
      id: "manager-one",
      roleId: "role_user_manager",
      subject: "manager",
    });
    const response = await humanApp("manager").fetch(
      request("/admin/iam/users/operator-one", {
        expectedVersion: 1,
        roleId: ADMIN_ROLE_IDS.admin,
      }),
      env,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "protected_role_assignment_denied" },
    });
    expect(
      await env.DB.prepare(
        "SELECT actor_type, reason, result FROM audit_events WHERE action = 'iam.users.update' AND target_id = 'operator-one'",
      ).first(),
    ).toEqual({
      actor_type: "admin",
      reason: "protected_role_assignment_denied",
      result: "denied",
    });
  });

  test("rejects assignment when the selected role is archived before the write batch", async () => {
    let intercepted = false;
    const db = new Proxy(env.DB, {
      get(target, property) {
        if (property === "batch") {
          return async (statements: D1PreparedStatement[]) => {
            if (!intercepted) {
              intercepted = true;
              await target
                .prepare("UPDATE admin_roles SET enabled = 0 WHERE id = ?")
                .bind(ADMIN_ROLE_IDS.support)
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
      const response = await humanApp("admin-one").fetch(
        request("/admin/iam/users/operator-one", {
          expectedVersion: 1,
          roleId: ADMIN_ROLE_IDS.support,
        }),
        { ...env, DB: db },
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code: "role_unavailable" } });
      expect(
        await env.DB.prepare(
          "SELECT role_id, version FROM admin_identities WHERE id = 'operator-one'",
        ).first(),
      ).toEqual({ role_id: ADMIN_ROLE_IDS.operations, version: 1 });
      expect(
        await env.DB.prepare(
          "SELECT reason, result FROM audit_events WHERE action = 'iam.users.update' AND target_id = 'operator-one'",
        ).first(),
      ).toEqual({ reason: "role_unavailable", result: "denied" });
    } finally {
      await env.DB.prepare("UPDATE admin_roles SET enabled = 1 WHERE id = ?")
        .bind(ADMIN_ROLE_IDS.support)
        .run();
    }
  });

  test("serializes concurrent changes so an environment retains one human admin", async () => {
    await seedHumanAdmin(env.DB, {
      email: "admin-two@example.test",
      id: "admin-two",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "admin-two",
    });
    const responses = await Promise.all([
      serviceApp.fetch(
        request("/admin/iam/users/admin-one", { enabled: false, expectedVersion: 1 }),
        env,
      ),
      serviceApp.fetch(
        request("/admin/iam/users/admin-two", { enabled: false, expectedVersion: 1 }),
        env,
      ),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM admin_identities identity
         JOIN admin_roles role ON role.id = identity.role_id
         WHERE identity.principal_kind = 'human' AND identity.enabled = 1 AND role.protected = 1`,
      ).first(),
    ).toEqual({ count: 1 });
  });
});
