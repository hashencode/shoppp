import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { recordAuditEvent } from "../../src/iam/audit";
import { requirePermission } from "../../src/iam/permissions";
import { idempotency } from "../../src/middleware/idempotency";

const NOW = "2026-07-30T00:00:00.000Z";

async function seedOperator(role: string, subject = "access-user-001"): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO admin_identities (id, access_subject, email, display_name, role, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
  )
    .bind(`admin-${subject}`, subject, `${subject}@example.test`, subject, role, NOW, NOW)
    .run();
}

function adminRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      "Content-Type": "application/json",
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
        subject: "missing-subject",
      }),
    });
    expect((await unmapped.fetch(adminRequest("/admin/orders"), env)).status).toBe(401);
  });

  test("AE6: refund permission is enforced inside the use case and denial is audited", async () => {
    await seedOperator("support", "support-user");
    const app = createApp({
      accessVerifier: async () => ({
        email: "support@example.test",
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
    const app = createApp({
      accessVerifier: async () => ({
        email: "access-user-001@example.test",
        subject: "access-user-001",
      }),
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
    expect(await second.text()).toBe(await first.text());
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'test.idempotent'",
        ).first<{ count: number }>()
      )?.count,
    ).toBe(1);

    const differentCredential = await app.fetch(
      adminRequest("/admin/test/idempotent", {
        body: JSON.stringify({ value: "first" }),
        headers: {
          "Cf-Access-Jwt-Assertion": "another-principal-token",
          "Idempotency-Key": "idempotency-key-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(differentCredential.status).toBe(409);

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
