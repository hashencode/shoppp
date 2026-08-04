import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  authenticatedDevelopmentCommands,
  resolveAuthenticatedDevelopmentConfig,
  shouldForwardAccessAssertion,
} from "./dev-admin-authenticated";

const environment = () => ({
  ADMIN_TUNNEL_HOSTNAME: "admin-dev-test.example.com",
  CLOUDFLARE_TUNNEL_NAME: "shoppp-admin-test",
  PRODUCTION_ACCESS_AUDIENCE: "production-audience-id",
  PRODUCTION_D1_DATABASE_ID: "production-database-id",
  TEST_ACCESS_AUDIENCE: "test-audience-id",
  TEST_API_ORIGIN: "https://shoppp-api-staging.example.com",
  TEST_D1_DATABASE_ID: "test-database-id",
});

describe("authenticated admin development preflight", () => {
  test.each([
    "ADMIN_TUNNEL_HOSTNAME",
    "CLOUDFLARE_TUNNEL_NAME",
    "PRODUCTION_ACCESS_AUDIENCE",
    "PRODUCTION_D1_DATABASE_ID",
    "TEST_ACCESS_AUDIENCE",
    "TEST_API_ORIGIN",
    "TEST_D1_DATABASE_ID",
  ])("fails closed when %s is missing", (name) => {
    const fixture = environment();
    delete fixture[name as keyof typeof fixture];
    expect(() => resolveAuthenticatedDevelopmentConfig(fixture)).toThrow(name);
  });

  test("rejects production and localhost targets", () => {
    const production = environment();
    production.TEST_API_ORIGIN = "https://shoppp-api-production.example.com";
    expect(() => resolveAuthenticatedDevelopmentConfig(production)).toThrow(/production/i);

    const localhost = environment();
    localhost.TEST_API_ORIGIN = "http://localhost:8787";
    expect(() => resolveAuthenticatedDevelopmentConfig(localhost)).toThrow(/HTTPS test API/i);
  });

  test("rejects shared test and production identity metadata", () => {
    const sharedAudience = environment();
    sharedAudience.TEST_ACCESS_AUDIENCE = sharedAudience.PRODUCTION_ACCESS_AUDIENCE;
    expect(() => resolveAuthenticatedDevelopmentConfig(sharedAudience)).toThrow(/audience/i);

    const sharedDatabase = environment();
    sharedDatabase.TEST_D1_DATABASE_ID = sharedDatabase.PRODUCTION_D1_DATABASE_ID;
    expect(() => resolveAuthenticatedDevelopmentConfig(sharedDatabase)).toThrow(/database/i);
  });

  test("maps the only supported local command to the test API and named Access tunnel", () => {
    const config = resolveAuthenticatedDevelopmentConfig(environment());
    expect(config).toMatchObject({
      apiProxyTarget: "https://shoppp-api-staging.example.com",
      databaseId: "test-database-id",
      tunnelHostname: "admin-dev-test.example.com",
      tunnelName: "shoppp-admin-test",
    });
    expect(authenticatedDevelopmentCommands(config)).toEqual({
      admin: ["bun", "x", "rsbuild", "dev", "--env-mode", "test", "--host", "127.0.0.1"],
      tunnel: ["cloudflared", "tunnel", "run", "shoppp-admin-test"],
    });
  });

  test("exposes no normal development or production dev script", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(import.meta.dir, "../apps/admin/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts.dev).toBe(
      "bun --env-file=../../.env ../../tools/dev-admin-authenticated.ts",
    );
    expect(packageJson.scripts["dev:development"]).toBeUndefined();
    expect(packageJson.scripts["dev:production"]).toBeUndefined();
  });

  test("forwards Access assertions only on the exact protected tunnel hostname", () => {
    expect(shouldForwardAccessAssertion("admin-dev-test.example.com", "admin-dev-test.example.com")).toBe(true);
    expect(shouldForwardAccessAssertion("admin-dev-test.example.com:443", "admin-dev-test.example.com")).toBe(true);
    expect(shouldForwardAccessAssertion("localhost:3000", "admin-dev-test.example.com")).toBe(false);
    expect(shouldForwardAccessAssertion("admin-dev-test.example.com.attacker.test", "admin-dev-test.example.com")).toBe(false);
  });
});
