import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createAdminDevelopmentCommand,
  resolveAdminDevelopmentConfig,
  verifyAdminDevelopmentContract,
} from "./dev-admin";

const environment = (): Record<string, string | undefined> => ({
  ADMIN_DEVELOPMENT_PROFILE: "fashion-staging",
  PRODUCTION_D1_DATABASE_ID: "production-database-id",
  TEST_API_ORIGIN: "https://shoppp-api-fashion-staging.example.com",
  TEST_D1_DATABASE_ID: "test-database-id",
});

describe("password-authenticated admin development preflight", () => {
  test.each(["PRODUCTION_D1_DATABASE_ID", "TEST_API_ORIGIN", "TEST_D1_DATABASE_ID"])(
    "fails closed when %s is missing",
    (name) => {
      const fixture = environment();
      delete fixture[name];
      expect(() => resolveAdminDevelopmentConfig(fixture)).toThrow(name);
    },
  );

  test("requires the explicit fashion-staging profile", () => {
    const missing = environment();
    delete missing.ADMIN_DEVELOPMENT_PROFILE;
    expect(() => resolveAdminDevelopmentConfig(missing)).toThrow(/ADMIN_DEVELOPMENT_PROFILE/);

    const legacy = environment();
    legacy.ADMIN_DEVELOPMENT_PROFILE = "staging";
    expect(() => resolveAdminDevelopmentConfig(legacy)).toThrow(/fashion-staging/);
  });

  test("rejects production targets and shared databases", () => {
    const production = environment();
    production.TEST_API_ORIGIN = "https://shoppp-api-production.example.com";
    expect(() => resolveAdminDevelopmentConfig(production)).toThrow(/production/i);
    const shared = environment();
    shared.TEST_D1_DATABASE_ID = shared.PRODUCTION_D1_DATABASE_ID;
    expect(() => resolveAdminDevelopmentConfig(shared)).toThrow(/database/i);
  });

  test("forwards the isolated acceptance port to Rsbuild", () => {
    expect(createAdminDevelopmentCommand({ E2E_PORT: "3418" })).toEqual([
      "bun",
      "x",
      "rsbuild",
      "dev",
      "--env-mode",
      "test",
      "--host",
      "127.0.0.1",
      "--port",
      "3418",
    ]);
    expect(() => createAdminDevelopmentCommand({ E2E_PORT: "0" })).toThrow(/E2E_PORT/);
    expect(() => createAdminDevelopmentCommand({ E2E_PORT: "not-a-port" })).toThrow(/E2E_PORT/);
  });

  test("binds local development only to the repository test API and D1", async () => {
    const canonical = environment();
    canonical.TEST_API_ORIGIN = "https://shoppp-api-fashion-staging.hashencode.workers.dev";
    canonical.TEST_D1_DATABASE_ID = "eb1ca4ef-3121-4d02-b20e-e619eac1cecc";
    await expect(
      verifyAdminDevelopmentContract(resolveAdminDevelopmentConfig(canonical)),
    ).resolves.toBeUndefined();
  });

  test("rejects the ordinary staging origin even when its D1 is supplied", async () => {
    const legacy = environment();
    legacy.TEST_API_ORIGIN = "https://shoppp-api-staging.hashencode.workers.dev";
    legacy.TEST_D1_DATABASE_ID = "0c84c9e0-5ef1-4897-815e-5ec7efb7582e";
    await expect(
      verifyAdminDevelopmentContract(resolveAdminDevelopmentConfig(legacy)),
    ).rejects.toThrow(/fashion-staging/);
  });

  test("exposes one normal test-only development script with no external tunnel", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(import.meta.dir, "../apps/admin/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts.dev).toBe("bun --env-file=../../.env ../../tools/dev-admin.ts");
    expect(JSON.stringify(packageJson.scripts)).not.toMatch(/cloudflared|tunnel/i);
  });
});
