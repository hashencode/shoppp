import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  buildLocalAdminSeedSql,
  createLocalAdminCommand,
  createLocalApiCommand,
  createLocalAdminCredentialQueryCommand,
  createLocalAdminSeedCommand,
  createLocalMigrationCommand,
  localAdminCredentialsMatch,
  parseLocalAdminCredential,
  resolveLocalAdminCredentials,
  resolveLocalAdminDevelopmentConfig,
} from "./dev-admin-local";

describe("local admin development", () => {
  test("defaults to separate loopback Admin and API origins", () => {
    expect(resolveLocalAdminDevelopmentConfig({})).toEqual({
      adminOrigin: "http://127.0.0.1:3418",
      adminPort: 3418,
      apiOrigin: "http://127.0.0.1:8787",
      apiPort: 8787,
    });
  });

  test("accepts explicit ports and rejects invalid or shared ports", () => {
    expect(
      resolveLocalAdminDevelopmentConfig({ ADMIN_DEV_PORT: "4400", API_DEV_PORT: "9900" }),
    ).toMatchObject({ adminPort: 4400, apiPort: 9900 });
    expect(() => resolveLocalAdminDevelopmentConfig({ ADMIN_DEV_PORT: "0" })).toThrow(
      /ADMIN_DEV_PORT/,
    );
    expect(() =>
      resolveLocalAdminDevelopmentConfig({ ADMIN_DEV_PORT: "8787", API_DEV_PORT: "8787" }),
    ).toThrow(/different ports/);
  });

  test("migrates and serves only local Wrangler resources", () => {
    const config = resolveLocalAdminDevelopmentConfig({});
    const migrations = createLocalMigrationCommand();
    const api = createLocalApiCommand(config);

    expect(migrations).toContain("--local");
    expect(migrations).not.toContain("--remote");
    expect(api).toContain("--local");
    expect(api).not.toContain("--remote");
    expect(api).toContain("wrangler.local.jsonc");
    expect(api).toContain(`PUBLIC_ORIGIN:${config.apiOrigin}`);
    expect(api).toContain(`ADMIN_DEVELOPMENT_ORIGIN:${config.adminOrigin}`);
    expect(api).toContain(`MEDIA_PUBLIC_ORIGIN:${config.apiOrigin}/media`);
  });

  test("derives the local media origin from a custom API port", () => {
    const config = resolveLocalAdminDevelopmentConfig({ API_DEV_PORT: "9900" });

    expect(createLocalApiCommand(config)).toContain(
      "MEDIA_PUBLIC_ORIGIN:http://127.0.0.1:9900/media",
    );
  });

  test("keeps every local API resource out of staging configuration", async () => {
    const source = await readFile(
      resolve(import.meta.dir, "../apps/api/wrangler.local.jsonc"),
      "utf8",
    );
    expect(source).toContain('"ENVIRONMENT": "development"');
    expect(source).toContain('"database_name": "shoppp-development-local"');
    expect(source).not.toMatch(/shoppp-(?:fashion-)?staging|shoppp-production/);
  });

  test("points the Admin proxy at the loopback API", () => {
    const config = resolveLocalAdminDevelopmentConfig({});
    expect(createLocalAdminCommand(config)).toEqual([
      "bun",
      "x",
      "rsbuild",
      "dev",
      "--env-mode",
      "development",
      "--host",
      "127.0.0.1",
      "--port",
      "3418",
    ]);
  });

  test("requires local-only administrator credentials", () => {
    expect(
      resolveLocalAdminCredentials({
        LOCAL_ADMIN_EMAIL: "admin@local.test",
        LOCAL_ADMIN_PASSWORD: "local-password-123",
      }),
    ).toEqual({ email: "admin@local.test", password: "local-password-123" });
    expect(() => resolveLocalAdminCredentials({})).toThrow(/LOCAL_ADMIN_PASSWORD/);
    expect(() =>
      resolveLocalAdminCredentials({ LOCAL_ADMIN_PASSWORD: "local-password-123" }),
    ).toThrow(/LOCAL_ADMIN_EMAIL/);
    expect(() =>
      resolveLocalAdminCredentials({
        LOCAL_ADMIN_EMAIL: "not-an-email",
        LOCAL_ADMIN_PASSWORD: "local-password-123",
      }),
    ).toThrow(/LOCAL_ADMIN_EMAIL/);
  });

  test("seeds only the local D1 without exposing the plaintext password", async () => {
    const credentials = resolveLocalAdminCredentials({
      LOCAL_ADMIN_EMAIL: "admin@local.test",
      LOCAL_ADMIN_PASSWORD: "local-password-123",
    });
    const sql = await buildLocalAdminSeedSql(credentials, "2026-09-20T00:00:00.000Z");
    const command = createLocalAdminSeedCommand(sql);

    expect(sql).toContain("identity-local-admin");
    expect(sql).toContain("admin_password_credentials");
    expect(sql).not.toContain(credentials.password);
    expect(command).toContain("--local");
    expect(command).not.toContain("--remote");
  });

  test("reuses an unchanged local administrator without rotating its session", async () => {
    const credentials = resolveLocalAdminCredentials({
      LOCAL_ADMIN_EMAIL: "admin@local.test",
      LOCAL_ADMIN_PASSWORD: "local-password-123",
    });
    const sql = await buildLocalAdminSeedSql(credentials, "2026-09-20T00:00:00.000Z");
    const hash = sql.match(
      /admin_password_credentials[^;]+VALUES \('[^']+', '([^']+)', '([^']+)', (\d+)/,
    );
    expect(hash).not.toBeNull();
    const row = {
      normalized_email: credentials.email,
      password_hash: hash![1]!,
      password_iterations: Number(hash![3]),
      password_salt: hash![2]!,
    };

    expect(await localAdminCredentialsMatch(credentials, row)).toBe(true);
    expect(
      await localAdminCredentialsMatch({ ...credentials, password: "different-pass-123" }, row),
    ).toBe(false);
    expect(createLocalAdminCredentialQueryCommand()).toContain("--local");
    expect(parseLocalAdminCredential(JSON.stringify([{ results: [row], success: true }]))).toEqual(
      row,
    );
  });

  test("loads local defaults and optional personal overrides through the dev script", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(import.meta.dir, "../apps/admin/package.json"), "utf8"),
    ) as { scripts: { dev: string } };

    expect(packageJson.scripts.dev).toBe(
      "bun --env-file=../../.env.development --env-file=../../.env.development.local ../../tools/dev-admin-local.ts",
    );

    const directory = await mkdtemp(join(tmpdir(), "shoppp-admin-env-"));
    try {
      await writeFile(
        join(directory, ".env.development"),
        await readFile(resolve(import.meta.dir, "../.env.development"), "utf8"),
      );
      // Run the dev script's actual env flags without inheriting personal credentials.
      const flags = packageJson.scripts.dev
        .split(" ")
        .filter((argument) => argument.startsWith("--env-file="))
        .map((argument) => argument.replace("../../", ""));
      const code = `import { resolveLocalAdminCredentials } from ${JSON.stringify(resolve(import.meta.dir, "dev-admin-local.ts"))}; console.log(JSON.stringify(resolveLocalAdminCredentials(process.env)));`;
      const loadCredentials = () => {
        const child = Bun.spawnSync([process.execPath, ...flags, "-e", code], {
          cwd: directory,
          env: { PATH: process.env.PATH ?? "", NODE_ENV: "development" },
        });
        expect(child.exitCode).toBe(0);
        return JSON.parse(child.stdout.toString()) as { email: string; password: string };
      };

      const defaults = loadCredentials();
      expect(defaults.email).toBe("admin@local.test");
      expect(defaults.password.length).toBeGreaterThanOrEqual(12);
      await writeFile(
        join(directory, ".env.development.local"),
        "LOCAL_ADMIN_EMAIL=custom@local.test\nLOCAL_ADMIN_PASSWORD=custom-local-password\n",
      );
      expect(loadCredentials()).toEqual({
        email: "custom@local.test",
        password: "custom-local-password",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
