import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { recordAuditEvent } from "../../src/iam/audit";
import { requirePermission } from "../../src/iam/permissions";
import { idempotency } from "../../src/middleware/idempotency";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const NOW = "2026-07-30T00:00:00.000Z";

async function seedOperator(role: string, subject = "access-user-001"): Promise<void> {
  const roleId = {
    admin: ADMIN_ROLE_IDS.admin,
    analyst: ADMIN_ROLE_IDS.analyst,
    catalog_manager: ADMIN_ROLE_IDS.catalogManager,
    operations: ADMIN_ROLE_IDS.operations,
    support: ADMIN_ROLE_IDS.support,
  }[role];
  if (!roleId) throw new Error(`Unknown fixture role: ${role}`);
  await seedHumanAdmin(env.DB, {
    displayName: subject,
    email: `${subject}@example.test`,
    id: `admin-${subject}`,
    roleId,
    subject,
  });
}

function adminRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...init.headers,
    },
  });
}

describe("API shell", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM idempotency_claims"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM admin_identities"),
      env.DB.prepare("DELETE FROM admin_role_permissions WHERE permission_key = 'unknown.permission'"),
      env.DB.prepare("DELETE FROM admin_permission_definitions WHERE permission_key = 'unknown.permission'"),
      env.DB.prepare("UPDATE admin_roles SET enabled = 1"),
    ]);
    await seedOperator("operations");
  });

  test("publishes environment-scoped checkout security configuration without caching", async () => {
    const app = createApp();
    const response = await app.fetch(new Request("https://api.example.test/platform/config"), {
      ...env,
      TURNSTILE_REQUIRED: "true",
      TURNSTILE_SITE_KEY: "staging-site-key",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      data: {
        turnstile: {
          required: true,
          siteKey: "staging-site-key",
        },
      },
    });
  });

  test("maps an enabled Access identity and reaches an allowed use case", async () => {
    const app = createApp({
      accessVerifier: async () => ({
        email: "access-user-001@example.test",
        principalKind: "human",
        subject: "access-user-001",
      }),
    });
    const response = await app.fetch(adminRequest("/admin/orders"), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [],
      meta: { requestId: expect.any(String) },
    });
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);

    const session = await app.fetch(adminRequest("/admin/session"), env);
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      data: {
        displayName: "access-user-001",
        environment: "test",
        email: "access-user-001@example.test",
        identityId: "admin-access-user-001",
        permissions: expect.arrayContaining(["orders.read", "orders.refund"]),
        principalKind: "human",
        role: {
          enabled: true,
          id: ADMIN_ROLE_IDS.operations,
          key: "operations",
          name: "Operations",
          protected: false,
          system: true,
          version: 1,
        },
      },
    });
  });

  test("denies expired, malformed, or unmapped identities without leaking tokens", async () => {
    const denied = createApp({
      accessVerifier: async () => {
        throw new Error("invalid test-token");
      },
    });
    const response = await denied.fetch(adminRequest("/admin/orders"), env);
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(401);
    expect(body).not.toContain("test-token");

    const unmapped = createApp({
      accessVerifier: async () => ({
        email: "missing@example.test",
        principalKind: "human",
        subject: "missing-subject",
      }),
    });
    expect((await unmapped.fetch(adminRequest("/admin/orders"), env)).status).toBe(401);
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_events").first<{ count: number }>()
      )?.count,
    ).toBe(0);
  });

  test("reloads role permissions from D1 on every request", async () => {
    const app = createApp({
      accessVerifier: async () => ({
        email: "access-user-001@example.test",
        principalKind: "human",
        subject: "access-user-001",
      }),
    });
    expect((await app.fetch(adminRequest("/admin/orders"), env)).status).toBe(200);

    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = ? AND permission_key = 'orders.read'",
    )
      .bind(ADMIN_ROLE_IDS.operations)
      .run();
    expect((await app.fetch(adminRequest("/admin/orders"), env)).status).toBe(403);

    await env.DB.prepare(
      "INSERT INTO admin_role_permissions (role_id, permission_key, created_at) VALUES (?, 'orders.read', ?)",
    )
      .bind(ADMIN_ROLE_IDS.operations, NOW)
      .run();
    expect((await app.fetch(adminRequest("/admin/orders"), env)).status).toBe(200);
  });

  test("rejects disabled identities, disabled roles, kind mismatches, and unknown permission drift", async () => {
    const humanVerifier = async () => ({
      email: "access-user-001@example.test",
      principalKind: "human" as const,
      subject: "access-user-001",
    });
    const app = createApp({ accessVerifier: humanVerifier });

    await env.DB.prepare("UPDATE admin_identities SET enabled = 0 WHERE id = ?")
      .bind("admin-access-user-001")
      .run();
    expect((await app.fetch(adminRequest("/admin/orders"), env)).status).toBe(401);
    await env.DB.prepare("UPDATE admin_identities SET enabled = 1 WHERE id = ?")
      .bind("admin-access-user-001")
      .run();

    await env.DB.prepare("UPDATE admin_roles SET enabled = 0 WHERE id = ?")
      .bind(ADMIN_ROLE_IDS.operations)
      .run();
    expect((await app.fetch(adminRequest("/admin/orders"), env)).status).toBe(401);
    await env.DB.prepare("UPDATE admin_roles SET enabled = 1 WHERE id = ?")
      .bind(ADMIN_ROLE_IDS.operations)
      .run();

    const mismatched = createApp({
      accessVerifier: async () => ({
        principalKind: "service",
        serviceName: "access-user-001",
        subject: "access-user-001",
      }),
    });
    expect((await mismatched.fetch(adminRequest("/admin/orders"), env)).status).toBe(401);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_permission_definitions
          (permission_key, category, label, description, sort_order, created_at)
         VALUES ('unknown.permission', 'iam', 'Unknown', 'Drift fixture.', 99, ?)`,
      ).bind(NOW),
      env.DB.prepare(
        "INSERT INTO admin_role_permissions (role_id, permission_key, created_at) VALUES (?, 'unknown.permission', ?)",
      ).bind(ADMIN_ROLE_IDS.operations, NOW),
    ]);
    expect((await app.fetch(adminRequest("/admin/orders"), env)).status).toBe(403);
  });

  test("AE6: refund permission is enforced inside the use case and denial is audited", async () => {
    await seedOperator("support", "support-user");
    const app = createApp({
      accessVerifier: async () => ({
        email: "support-user@example.test",
        principalKind: "human",
        subject: "support-user",
      }),
    });
    const response = await app.fetch(
      adminRequest("/admin/orders/ORD-TEST/refunds", {
        body: JSON.stringify({ amount: 100, reason: "Customer request" }),
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(403);
    const audit = await env.DB.prepare(
      "SELECT action, result FROM audit_events WHERE actor_id = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind("admin-support-user")
      .first();
    expect(audit).toEqual({ action: "orders.refund", result: "denied" });
  });

  test("replays a completed idempotent mutation and rejects key reuse with another body", async () => {
    await seedOperator("operations", "access-user-002");
    const app = createApp({
      accessVerifier: async (token) => {
        const subject =
          token === "different-principal-token" ? "access-user-002" : "access-user-001";
        return { email: `${subject}@example.test`, principalKind: "human", subject };
      },
    });
    app.post("/admin/test/idempotent", idempotency("test.idempotent"), async (context) => {
      await requirePermission(context, "operations.replay", { type: "test" });
      const input = (await context.req.json()) as { value: string };
      const principal = context.get("principal");
      await recordAuditEvent(context.env.DB, {
        action: "test.idempotent",
        actorId: principal.id,
        actorType: "admin",
        id: crypto.randomUUID(),
        requestId: context.get("requestId"),
        result: "succeeded",
        targetType: "test",
      });
      return context.json({ data: input, meta: { requestId: context.get("requestId") } });
    });
    const headers = { "Idempotency-Key": "idempotency-key-0001" };
    const first = await app.fetch(
      adminRequest("/admin/test/idempotent", {
        body: JSON.stringify({ value: "first" }),
        headers,
        method: "POST",
      }),
      env,
    );
    const second = await app.fetch(
      adminRequest("/admin/test/idempotent", {
        body: JSON.stringify({ value: "first" }),
        headers,
        method: "POST",
      }),
      env,
    );

    expect(second.status).toBe(first.status);
    const firstBody = await first.text();
    expect(await second.text()).toBe(firstBody);
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'test.idempotent'",
        ).first<{ count: number }>()
      )?.count,
    ).toBe(1);

    const rotatedCredential = await app.fetch(
      adminRequest("/admin/test/idempotent", {
        body: JSON.stringify({ value: "first" }),
        headers: {
          "Cf-Access-Jwt-Assertion": "rotated-token",
          "Idempotency-Key": "idempotency-key-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(rotatedCredential.status).toBe(first.status);
    expect(await rotatedCredential.text()).toBe(firstBody);

    const differentPrincipal = await app.fetch(
      adminRequest("/admin/test/idempotent", {
        body: JSON.stringify({ value: "first" }),
        headers: {
          "Cf-Access-Jwt-Assertion": "different-principal-token",
          "Idempotency-Key": "idempotency-key-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(differentPrincipal.status).toBe(409);

    const conflict = await app.fetch(
      adminRequest("/admin/test/idempotent", {
        body: JSON.stringify({ value: "different" }),
        headers,
        method: "POST",
      }),
      env,
    );
    expect(conflict.status).toBe(409);
  });
});
