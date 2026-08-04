import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

function request(path: string, method = "GET", body?: unknown): Request {
  return new Request(`https://api.example.test${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
    },
    method,
  });
}

function appFor(subject: string) {
  return createApp({
    accessVerifier: async () => ({
      email: `${subject}@example.test`,
      principalKind: "human",
      subject,
    }),
  });
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM notification_jobs"),
    env.DB.prepare("DELETE FROM admin_invitations"),
    env.DB.prepare("DELETE FROM admin_identities"),
    env.DB.prepare("DELETE FROM admin_role_permissions WHERE role_id LIKE 'custom_%'"),
    env.DB.prepare("DELETE FROM admin_roles WHERE id LIKE 'custom_%'"),
  ]);
  await seedHumanAdmin(env.DB, {
    email: "role-admin@example.test",
    id: "role-admin",
    roleId: ADMIN_ROLE_IDS.admin,
    subject: "role-admin",
  });
});

describe("admin role lifecycle", () => {
  test("creates, lists, and conditionally updates a custom role", async () => {
    const app = appFor("role-admin");
    const created = await app.fetch(
      request("/admin/iam/roles", "POST", {
        key: "returns_specialist",
        name: "Returns specialist",
        permissions: ["orders.read", "orders.refund"],
      }),
      env,
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { data: { id: string } };
    const roleId = createdBody.data.id;
    const inspected = await app.fetch(request(`/admin/iam/roles/${roleId}`), env);
    expect(inspected.status).toBe(200);
    expect(await inspected.json()).toMatchObject({
      data: { id: roleId, permissions: ["orders.read", "orders.refund"] },
    });
    const listed = await app.fetch(request("/admin/iam/roles?search=returns"), env);
    expect(await listed.json()).toMatchObject({
      data: {
        items: [
          {
            key: "returns_specialist",
            permissions: ["orders.read", "orders.refund"],
            version: 1,
          },
        ],
        total: 1,
      },
    });
    const changed = await app.fetch(
      request(`/admin/iam/roles/${roleId}`, "PATCH", {
        expectedVersion: 1,
        name: "Returns operator",
        permissions: ["orders.read"],
      }),
      env,
    );
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({
      data: { name: "Returns operator", permissions: ["orders.read"], version: 2 },
    });
    const concurrent = await Promise.all([
      app.fetch(
        request(`/admin/iam/roles/${roleId}`, "PATCH", {
          expectedVersion: 2,
          name: "Concurrent winner A",
        }),
        env,
      ),
      app.fetch(
        request(`/admin/iam/roles/${roleId}`, "PATCH", {
          expectedVersion: 2,
          name: "Concurrent winner B",
        }),
        env,
      ),
    ]);
    expect(concurrent.map(({ status }) => status).sort()).toEqual([200, 409]);
  });

  test("allows delegated subset creation and rejects permission escalation", async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('custom_role_manager', 'role_manager', 'Role manager', 0, 0, 1, 1, ?, ?)`,
      ).bind("2026-08-04T00:00:00.000Z", "2026-08-04T00:00:00.000Z"),
      ...["iam.roles.read", "iam.roles.write", "orders.read"].map((permission) =>
        env.DB.prepare(
          `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
           VALUES ('custom_role_manager', ?, '2026-08-04T00:00:00.000Z')`,
        ).bind(permission),
      ),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "delegated@example.test",
      id: "delegated-manager",
      roleId: "custom_role_manager",
      subject: "delegated",
    });
    const app = appFor("delegated");
    expect(
      (
        await app.fetch(
          request("/admin/iam/roles", "POST", {
            key: "order_viewer_custom",
            name: "Order viewer",
            permissions: ["orders.read"],
          }),
          env,
        )
      ).status,
    ).toBe(201);
    const denied = await app.fetch(
      request("/admin/iam/roles", "POST", {
        key: "refund_manager_custom",
        name: "Refund manager",
        permissions: ["orders.read", "orders.refund"],
      }),
      env,
    );
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      error: { code: "permission_escalation_denied" },
    });
  });

  test("rejects caller-role edits while allowing metadata changes to non-protected system roles", async () => {
    const own = await appFor("role-admin").fetch(
      request(`/admin/iam/roles/${ADMIN_ROLE_IDS.admin}`, "PATCH", {
        enabled: false,
        expectedVersion: 1,
      }),
      env,
    );
    expect(own.status).toBe(409);
    expect(await own.json()).toMatchObject({ error: { code: "self_role_edit_denied" } });

    const system = await appFor("role-admin").fetch(
      request(`/admin/iam/roles/${ADMIN_ROLE_IDS.support}`, "PATCH", {
        expectedVersion: 1,
        name: "Changed support",
      }),
      env,
    );
    expect(system.status).toBe(200);
    expect(await system.json()).toMatchObject({ data: { name: "Changed support", version: 2 } });

    const archiveSystem = await appFor("role-admin").fetch(
      request(`/admin/iam/roles/${ADMIN_ROLE_IDS.support}`, "PATCH", {
        enabled: false,
        expectedVersion: 2,
      }),
      env,
    );
    expect(archiveSystem.status).toBe(409);
    expect(await archiveSystem.json()).toMatchObject({
      error: { code: "system_role_archive_denied" },
    });

    const now = "2026-08-04T00:00:00.000Z";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('custom_full_manager', 'full_manager', 'Full manager', 0, 0, 1, 1, ?, ?)`,
      ).bind(now, now),
      env.DB.prepare(
        `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
         SELECT 'custom_full_manager', permission_key, ? FROM admin_permission_definitions`,
      ).bind(now),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "full-manager@example.test",
      id: "full-manager",
      roleId: "custom_full_manager",
      subject: "full-manager",
    });
    const protectedRole = await appFor("full-manager").fetch(
      request(`/admin/iam/roles/${ADMIN_ROLE_IDS.admin}`, "PATCH", {
        enabled: false,
        expectedVersion: 1,
        permissions: ["iam.roles.read"],
      }),
      env,
    );
    expect(protectedRole.status).toBe(409);
    expect(await protectedRole.json()).toMatchObject({
      error: { code: "system_role_edit_denied" },
    });
  });

  test("reports assigned identity and active invitation dependency counts on archive", async () => {
    const now = "2026-08-04T00:00:00.000Z";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('custom_assigned', 'assigned_custom', 'Assigned', 0, 0, 1, 1, ?, ?)`,
      ).bind(now, now),
      env.DB.prepare(
        `INSERT INTO admin_invitations
          (id, normalized_email, role_id, status, idempotency_key, invited_by_id,
           expires_at, version, created_at, updated_at)
         VALUES ('inv_assigned', 'pending@example.test', 'custom_assigned', 'pending',
                 'assigned-role-invite', 'role-admin', '2099-01-01T00:00:00.000Z', 1, ?, ?)`,
      ).bind(now, now),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "assigned@example.test",
      id: "assigned-user",
      roleId: "custom_assigned",
      subject: "assigned-user",
    });
    const response = await appFor("role-admin").fetch(
      request("/admin/iam/roles/custom_assigned", "PATCH", {
        enabled: false,
        expectedVersion: 1,
      }),
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        code: "role_has_dependencies",
        details: { identities: 1, pendingInvitations: 1 },
      },
    });
  });
});
