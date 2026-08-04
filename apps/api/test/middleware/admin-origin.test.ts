import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import {
  ADMIN_ROLE_IDS,
  seedHumanAdmin,
  seedServiceAdmin,
} from "../fixtures/admin-iam";

const ADMIN_ORIGIN = "https://admin.example.test";

function mutationRequest(headers: HeadersInit = {}): Request {
  return new Request("https://api.example.test/admin/orders/ORD-TEST/refunds", {
    body: JSON.stringify({ amount: 100, reason: "Origin middleware fixture" }),
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      "Content-Type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}

describe("admin mutation origin protection", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM admin_invitations"),
      env.DB.prepare("DELETE FROM admin_identities"),
    ]);
  });

  test("accepts an exact human origin with same-origin Fetch Metadata", async () => {
    await seedHumanAdmin(env.DB, { roleId: ADMIN_ROLE_IDS.support });
    const app = createApp({
      accessVerifier: async () => ({
        email: "admin@example.test",
        principalKind: "human",
        subject: "access-admin-fixture",
      }),
    });
    const response = await app.fetch(
      mutationRequest({ Origin: ADMIN_ORIGIN, "Sec-Fetch-Site": "same-origin" }),
      { ...env, ADMIN_ORIGIN },
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "permission_denied" } });
  });

  test.each([
    ["missing origin", { "Sec-Fetch-Site": "same-origin" }],
    ["mismatched origin", { Origin: "https://attacker.example", "Sec-Fetch-Site": "same-origin" }],
    ["missing Fetch Metadata", { Origin: ADMIN_ORIGIN }],
    ["cross-site Fetch Metadata", { Origin: ADMIN_ORIGIN, "Sec-Fetch-Site": "cross-site" }],
  ])("rejects a human mutation with %s", async (_case, headers) => {
    await seedHumanAdmin(env.DB, { roleId: ADMIN_ROLE_IDS.support });
    const app = createApp({
      accessVerifier: async () => ({
        email: "admin@example.test",
        principalKind: "human",
        subject: "access-admin-fixture",
      }),
    });
    const response = await app.fetch(mutationRequest(headers), { ...env, ADMIN_ORIGIN });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "admin_origin_denied" } });
  });

  test("allows a typed service principal to omit browser headers and audits it as a machine", async () => {
    await seedServiceAdmin(env.DB, { roleId: ADMIN_ROLE_IDS.support });
    const app = createApp({
      accessVerifier: async () => ({
        principalKind: "service",
        serviceName: "access-service-fixture",
        subject: "access-service-fixture",
      }),
    });
    const response = await app.fetch(mutationRequest(), { ...env, ADMIN_ORIGIN });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "permission_denied" } });
    expect(
      await env.DB.prepare(
        "SELECT actor_type AS actorType, action, result FROM audit_events ORDER BY created_at DESC LIMIT 1",
      ).first(),
    ).toEqual({ action: "orders.refund", actorType: "machine", result: "denied" });
  });
});
