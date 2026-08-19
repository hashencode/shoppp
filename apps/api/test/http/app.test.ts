import { env } from "cloudflare:workers";
import { ADMIN_PERMISSION_KEYS, type AdminPermission } from "@shoppp/contracts";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { recordAuditEvent } from "../../src/iam/audit";
import { requirePermission } from "../../src/iam/permissions";
import { idempotency } from "../../src/middleware/idempotency";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const NOW = "2026-07-30T00:00:00.000Z";

interface AdminRoutePermission {
  readonly method: "GET" | "PATCH" | "POST" | "PUT";
  readonly path: string;
  readonly permission: AdminPermission;
}

const ADMIN_ROUTE_PERMISSIONS: readonly AdminRoutePermission[] = [
  { method: "GET", path: "/admin/iam/users", permission: "iam.users.read" },
  { method: "PATCH", path: "/admin/iam/users/:id", permission: "iam.users.write" },
  { method: "GET", path: "/admin/iam/users/:id", permission: "iam.users.read" },
  { method: "GET", path: "/admin/iam/invitations", permission: "iam.users.read" },
  { method: "POST", path: "/admin/iam/invitations", permission: "iam.users.write" },
  {
    method: "POST",
    path: "/admin/iam/invitations/:id/resend",
    permission: "iam.users.write",
  },
  {
    method: "POST",
    path: "/admin/iam/invitations/:id/revoke",
    permission: "iam.users.write",
  },
  { method: "GET", path: "/admin/iam/roles", permission: "iam.roles.read" },
  { method: "POST", path: "/admin/iam/roles", permission: "iam.roles.write" },
  { method: "PATCH", path: "/admin/iam/roles/:id", permission: "iam.roles.write" },
  { method: "GET", path: "/admin/iam/roles/:id", permission: "iam.roles.read" },
  { method: "GET", path: "/admin/settings/launch", permission: "settings.read" },
  { method: "GET", path: "/admin/settings/shipping", permission: "settings.read" },
  {
    method: "PUT",
    path: "/admin/settings/shipping/zones/:id",
    permission: "settings.write",
  },
  {
    method: "POST",
    path: "/admin/settings/shipping/zones",
    permission: "settings.write",
  },
  { method: "PUT", path: "/admin/settings/launch", permission: "settings.write" },
  { method: "GET", path: "/admin/audit", permission: "audit.read" },
  { method: "GET", path: "/admin/operations/health", permission: "settings.read" },
  { method: "GET", path: "/admin/privacy/requests", permission: "privacy.manage" },
  { method: "POST", path: "/admin/privacy/requests", permission: "privacy.manage" },
  {
    method: "GET",
    path: "/admin/privacy/requests/:id/download",
    permission: "privacy.manage",
  },
  { method: "GET", path: "/admin/catalog/products", permission: "catalog.read" },
  { method: "GET", path: "/admin/catalog/products/:id", permission: "catalog.read" },
  { method: "POST", path: "/admin/catalog/products", permission: "catalog.write" },
  { method: "PUT", path: "/admin/catalog/products/:id", permission: "catalog.write" },
  { method: "PUT", path: "/admin/media/*", permission: "catalog.write" },
  {
    method: "POST",
    path: "/admin/catalog/products/:id/preview",
    permission: "catalog.read",
  },
  {
    method: "POST",
    path: "/admin/catalog/products/:id/publish",
    permission: "catalog.publish",
  },
  { method: "GET", path: "/admin/inventory", permission: "inventory.read" },
  {
    method: "GET",
    path: "/admin/inventory/:variantId/:warehouseId",
    permission: "inventory.read",
  },
  {
    method: "POST",
    path: "/admin/inventory/:variantId/:warehouseId/adjustments",
    permission: "inventory.adjust",
  },
  { method: "GET", path: "/admin/orders", permission: "orders.read" },
  { method: "GET", path: "/admin/reporting/revenue", permission: "reporting.read" },
  { method: "GET", path: "/admin/reporting/orders", permission: "reporting.read" },
  { method: "POST", path: "/admin/reporting/exports", permission: "reporting.export" },
  {
    method: "GET",
    path: "/admin/reporting/exports/:id",
    permission: "reporting.export",
  },
  {
    method: "GET",
    path: "/admin/reporting/exports/:id/download",
    permission: "reporting.export",
  },
  { method: "GET", path: "/admin/orders/:reference", permission: "orders.read" },
  {
    method: "POST",
    path: "/admin/orders/:reference/fulfillment",
    permission: "orders.fulfill",
  },
  {
    method: "POST",
    path: "/admin/orders/:reference/refunds",
    permission: "orders.refund",
  },
  {
    method: "POST",
    path: "/admin/orders/:reference/cancel",
    permission: "orders.cancel",
  },
  { method: "GET", path: "/admin/operations/jobs", permission: "operations.jobs.read" },
  {
    method: "POST",
    path: "/admin/operations/jobs/:id/replay",
    permission: "operations.replay",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/themes",
    permission: "themes.read",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/catalog-releases",
    permission: "themes.preview",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/catalog-releases/:id/resources",
    permission: "themes.preview",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/media",
    permission: "themes.write",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/drafts",
    permission: "themes.write",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/drafts",
    permission: "themes.read",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/drafts/:id",
    permission: "themes.read",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/drafts/:id/successors",
    permission: "themes.write",
  },
  {
    method: "PUT",
    path: "/admin/storefront-experiences/drafts/:id",
    permission: "themes.write",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/drafts/:id/validate",
    permission: "themes.write",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/drafts/:id/preview",
    permission: "themes.preview",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/drafts/:id/preview-context",
    permission: "themes.preview",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/drafts/:id/approve",
    permission: "themes.approve",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/drafts/:id/migrations/dry-run",
    permission: "themes.write",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/drafts/:id/migrations/approve",
    permission: "themes.approve",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/snapshots/:id",
    permission: "themes.read",
  },
  {
    method: "GET",
    path: "/admin/storefront-experiences/builds/:id",
    permission: "themes.preview",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/snapshots/:id/build",
    permission: "themes.preview",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/snapshots/:id/grants",
    permission: "themes.preview",
  },
  {
    method: "POST",
    path: "/admin/storefront-experiences/snapshots/:id/revoke",
    permission: "themes.preview",
  },
] as const;

function concreteAdminPath(path: string): string {
  return path.replaceAll(/:[A-Za-z][A-Za-z0-9]*/g, "fixture").replace("*", "catalog/proof.png");
}

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
      "X-Test-Admin-Identity": "test-token",
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
      env.DB.prepare(
        "DELETE FROM admin_role_permissions WHERE permission_key = 'unknown.permission'",
      ),
      env.DB.prepare(
        "DELETE FROM admin_permission_definitions WHERE permission_key = 'unknown.permission'",
      ),
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

  test("maps an enabled injected test identity and reaches an allowed use case", async () => {
    const app = createApp({
      testIdentityVerifier: async () => ({
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
      testIdentityVerifier: async () => {
        throw new Error("invalid test-token");
      },
    });
    const response = await denied.fetch(adminRequest("/admin/orders"), env);
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(401);
    expect(body).not.toContain("test-token");

    const unmapped = createApp({
      testIdentityVerifier: async () => ({
        email: "missing@example.test",
        principalKind: "human",
        subject: "missing-subject",
      }),
    });
    expect((await unmapped.fetch(adminRequest("/admin/orders"), env)).status).toBe(401);
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM audit_events").first<{
          count: number;
        }>()
      )?.count,
    ).toBe(0);
  });

  test("does not trust injected or retired perimeter identity headers in production", async () => {
    const legacyIdentityHeader = ["Cf", "Access", "Jwt", "Assertion"].join("-");
    const response = await createApp().fetch(
      adminRequest("/admin/orders", {
        headers: {
          [legacyIdentityHeader]: "retired-perimeter-token",
          "X-Test-Admin-Identity": "test-token",
        },
      }),
      env,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "admin_login_required" },
    });
  });

  test("reloads role permissions from D1 on every request", async () => {
    const app = createApp({
      testIdentityVerifier: async () => ({
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

  test("denies every registered admin route when its permission is absent", async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO admin_roles
          (id, key, name, protected, system, enabled, version, created_at, updated_at)
         VALUES ('role_permission_matrix', 'permission_matrix', 'Permission matrix', 0, 0, 1, 1, ?, ?)`,
      ).bind(NOW, NOW),
      env.DB.prepare("DELETE FROM admin_role_permissions WHERE role_id = 'role_permission_matrix'"),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "permission-matrix@example.test",
      id: "permission-matrix",
      roleId: "role_permission_matrix",
      subject: "permission-matrix",
    });
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "permission-matrix@example.test",
        principalKind: "human",
        subject: "permission-matrix",
      }),
    });

    for (const [index, route] of ADMIN_ROUTE_PERMISSIONS.entries()) {
      const response = await app.fetch(
        adminRequest(concreteAdminPath(route.path), {
          ...(route.method === "GET" ? {} : { body: "{}" }),
          headers: { "Idempotency-Key": `permission-matrix-${index}` },
          method: route.method,
        }),
        env,
      );
      const body = (await response.json()) as {
        error?: { code?: string };
        meta?: { requestId?: string };
      };
      expect(`${route.method} ${route.path}: ${response.status}`).toBe(
        `${route.method} ${route.path}: 403`,
      );
      expect(body.error?.code).toBe("permission_denied");
      expect(
        await env.DB.prepare(
          "SELECT action, actor_type, result FROM audit_events WHERE request_id = ? LIMIT 1",
        )
          .bind(body.meta?.requestId)
          .first(),
      ).toEqual({ action: route.permission, actor_type: "admin", result: "denied" });
    }

    expect(
      [...new Set(ADMIN_ROUTE_PERMISSIONS.map(({ permission }) => permission))].sort(),
    ).toEqual([...ADMIN_PERMISSION_KEYS].sort());
  });

  test("rejects disabled identities, disabled roles, kind mismatches, and unknown permission drift", async () => {
    const humanVerifier = async () => ({
      email: "access-user-001@example.test",
      principalKind: "human" as const,
      subject: "access-user-001",
    });
    const app = createApp({ testIdentityVerifier: humanVerifier });

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
      testIdentityVerifier: async () => ({
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
      testIdentityVerifier: async () => ({
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
      testIdentityVerifier: async (token) => {
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
          "X-Test-Admin-Identity": "rotated-token",
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
          "X-Test-Admin-Identity": "different-principal-token",
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
