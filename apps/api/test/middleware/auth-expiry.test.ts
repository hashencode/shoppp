import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_sessions"),
    env.DB.prepare("DELETE FROM admin_password_credentials"),
    env.DB.prepare("DELETE FROM audit_events"),
    env.DB.prepare("DELETE FROM admin_invitations"),
    env.DB.prepare("DELETE FROM admin_identities"),
  ]);
});

function app() {
  return createApp({
    testIdentityVerifier: async () => ({
      email: "u8-operator@example.test",
      principalKind: "human" as const,
      subject: "password:u8-operator",
    }),
  });
}

function sessionRequest(): Request {
  return new Request("https://api.example.test/admin/session", {
    headers: { "X-Test-Admin-Identity": "test-token" },
  });
}

describe("administrator identity expiry middleware", () => {
  test("rejects an expired externally verified identity before route execution", async () => {
    await seedHumanAdmin(env.DB, {
      email: "u8-operator@example.test",
      id: "identity-u8-expired",
      roleId: ADMIN_ROLE_IDS.operations,
      subject: "password:u8-operator",
    });
    await env.DB.prepare(
      "UPDATE admin_identities SET expires_at = ? WHERE id = 'identity-u8-expired'",
    )
      .bind("2020-01-01T00:00:00.000Z")
      .run();

    const response = await app().fetch(sessionRequest(), env);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "identity_expired" } });
  });

  test("preserves existing identities whose expiry is NULL", async () => {
    await seedHumanAdmin(env.DB, {
      email: "u8-operator@example.test",
      id: "identity-u8-no-expiry",
      roleId: ADMIN_ROLE_IDS.operations,
      subject: "password:u8-operator",
    });

    const response = await app().fetch(sessionRequest(), env);
    expect(response.status).toBe(200);
  });

  test("fails closed when an identity expiry is malformed", async () => {
    await seedHumanAdmin(env.DB, {
      email: "u8-operator@example.test",
      id: "identity-u8-malformed-expiry",
      roleId: ADMIN_ROLE_IDS.operations,
      subject: "password:u8-operator",
    });
    await env.DB.prepare(
      "UPDATE admin_identities SET expires_at = 'not-a-timestamp' WHERE id = 'identity-u8-malformed-expiry'",
    ).run();

    const response = await app().fetch(sessionRequest(), env);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "identity_expired" } });
  });
});
