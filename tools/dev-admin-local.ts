import { resolve } from "node:path";

import { hashPassword, verifyPassword } from "../apps/api/src/iam/passwords";

type Environment = Record<string, string | undefined>;

export interface LocalAdminDevelopmentConfig {
  readonly adminOrigin: string;
  readonly adminPort: number;
  readonly apiOrigin: string;
  readonly apiPort: number;
}

export interface LocalAdminCredentials {
  readonly email: string;
  readonly password: string;
}

export interface LocalAdminCredential {
  readonly normalized_email: string;
  readonly password_hash: string;
  readonly password_iterations: number;
  readonly password_salt: string;
}

const ROOT = resolve(import.meta.dir, "..");
const API_ROOT = resolve(ROOT, "apps/api");
const ADMIN_ROOT = resolve(ROOT, "apps/admin");

function port(environment: Environment, name: string, fallback: number): number {
  const value = Number(environment[name]?.trim() || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return value;
}

export function resolveLocalAdminDevelopmentConfig(
  environment: Environment,
): LocalAdminDevelopmentConfig {
  const adminPort = port(environment, "ADMIN_DEV_PORT", 3418);
  const apiPort = port(environment, "API_DEV_PORT", 8787);
  if (adminPort === apiPort) throw new Error("Admin and API development must use different ports.");
  return {
    adminOrigin: `http://127.0.0.1:${adminPort}`,
    adminPort,
    apiOrigin: `http://127.0.0.1:${apiPort}`,
    apiPort,
  };
}

export function resolveLocalAdminCredentials(environment: Environment): LocalAdminCredentials {
  const password = environment.LOCAL_ADMIN_PASSWORD?.trim();
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error("LOCAL_ADMIN_PASSWORD must contain between 12 and 128 characters.");
  }
  const email = environment.LOCAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("LOCAL_ADMIN_EMAIL must be a valid email address.");
  }
  return { email, password };
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function buildLocalAdminSeedSql(
  credentials: LocalAdminCredentials,
  now = new Date().toISOString(),
): Promise<string> {
  const password = await hashPassword(credentials.password);
  return [
    `INSERT INTO admin_identities (id, principal_kind, access_subject, normalized_email, display_name, role_id, enabled, version, created_at, updated_at) VALUES ('identity-local-admin', 'human', 'local:admin', ${sqlLiteral(credentials.email)}, 'Local administrator', 'role_admin', 1, 1, ${sqlLiteral(now)}, ${sqlLiteral(now)}) ON CONFLICT(id) DO UPDATE SET normalized_email = excluded.normalized_email, display_name = excluded.display_name, role_id = 'role_admin', enabled = 1, version = admin_identities.version + 1, updated_at = excluded.updated_at;`,
    `INSERT INTO admin_password_credentials (identity_id, password_hash, password_salt, password_iterations, password_version, must_change_password, created_at, updated_at) VALUES ('identity-local-admin', ${sqlLiteral(password.hash)}, ${sqlLiteral(password.salt)}, ${password.iterations}, 1, 0, ${sqlLiteral(now)}, ${sqlLiteral(now)}) ON CONFLICT(identity_id) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt, password_iterations = excluded.password_iterations, password_version = admin_password_credentials.password_version + 1, must_change_password = 0, updated_at = excluded.updated_at;`,
    `UPDATE admin_sessions SET revoked_at = ${sqlLiteral(now)} WHERE identity_id = 'identity-local-admin' AND revoked_at IS NULL;`,
  ].join("\n");
}

export function createLocalMigrationCommand(): string[] {
  return [
    "bun",
    "x",
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
  ];
}

export function createLocalAdminSeedCommand(sql: string): string[] {
  return [
    "bun",
    "x",
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--command",
    sql,
  ];
}

export function createLocalAdminCredentialQueryCommand(): string[] {
  return [
    "bun",
    "x",
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--command",
    "SELECT identity.normalized_email, credential.password_hash, credential.password_iterations, credential.password_salt FROM admin_identities identity JOIN admin_password_credentials credential ON credential.identity_id = identity.id WHERE identity.id = 'identity-local-admin' LIMIT 1;",
    "--json",
  ];
}

export function parseLocalAdminCredential(output: string): LocalAdminCredential | null {
  const executions: unknown = JSON.parse(output);
  if (!Array.isArray(executions) || executions[0]?.success !== true) {
    throw new Error("Local administrator lookup returned an invalid result.");
  }
  const row: unknown = executions[0].results?.[0];
  if (row === undefined) return null;
  if (
    row === null ||
    typeof row !== "object" ||
    typeof Reflect.get(row, "normalized_email") !== "string" ||
    typeof Reflect.get(row, "password_hash") !== "string" ||
    typeof Reflect.get(row, "password_iterations") !== "number" ||
    typeof Reflect.get(row, "password_salt") !== "string"
  ) {
    throw new Error("Local administrator lookup returned malformed credentials.");
  }
  return row as LocalAdminCredential;
}

export async function localAdminCredentialsMatch(
  credentials: LocalAdminCredentials,
  stored: LocalAdminCredential | null,
): Promise<boolean> {
  return (
    stored !== null &&
    stored.normalized_email === credentials.email &&
    (await verifyPassword(credentials.password, {
      hash: stored.password_hash,
      iterations: stored.password_iterations,
      salt: stored.password_salt,
    }))
  );
}

export function createLocalApiCommand(config: LocalAdminDevelopmentConfig): string[] {
  const variables = [
    `PUBLIC_ORIGIN:${config.apiOrigin}`,
    `ADMIN_ORIGIN:${config.adminOrigin}`,
    `ADMIN_DEVELOPMENT_ORIGIN:${config.adminOrigin}`,
    `MEDIA_PUBLIC_ORIGIN:${config.apiOrigin}/media`,
  ];
  return [
    "bun",
    "x",
    "wrangler",
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(config.apiPort),
    "--config",
    "wrangler.local.jsonc",
    ...variables.flatMap((variable) => ["--var", variable]),
  ];
}

export function createLocalAdminCommand(config: LocalAdminDevelopmentConfig): string[] {
  return [
    "bun",
    "x",
    "rsbuild",
    "dev",
    "--env-mode",
    "development",
    "--host",
    "127.0.0.1",
    "--port",
    String(config.adminPort),
  ];
}

async function runSetup(command: readonly string[], failureMessage: string): Promise<void> {
  const child = Bun.spawn([...command], {
    cwd: API_ROOT,
    env: process.env,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  if ((await child.exited) !== 0) throw new Error(failureMessage);
}

async function readLocalAdminCredential(): Promise<LocalAdminCredential | null> {
  const child = Bun.spawn(createLocalAdminCredentialQueryCommand(), {
    cwd: API_ROOT,
    env: process.env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`Local administrator lookup failed.${error.trim() ? ` ${error.trim()}` : ""}`);
  }
  return parseLocalAdminCredential(output);
}

async function waitForApi(origin: string, child: Bun.Subprocess): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local API exited before becoming ready (${child.exitCode}).`);
    }
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // Wrangler is still starting.
    }
    await Bun.sleep(200);
  }
  throw new Error(`Local API did not become ready at ${origin}.`);
}

export async function runLocalAdminDevelopment(
  environment: Environment = process.env,
): Promise<number> {
  const config = resolveLocalAdminDevelopmentConfig(environment);
  const credentials = resolveLocalAdminCredentials(environment);
  await runSetup(createLocalMigrationCommand(), "Local D1 migration failed.");
  if (await localAdminCredentialsMatch(credentials, await readLocalAdminCredential())) {
    console.log(`Local administrator reused: ${credentials.email}`);
  } else {
    await runSetup(
      createLocalAdminSeedCommand(await buildLocalAdminSeedSql(credentials)),
      "Local administrator initialization failed.",
    );
    console.log(`Local administrator initialized: ${credentials.email}`);
  }

  const api = Bun.spawn(createLocalApiCommand(config), {
    cwd: API_ROOT,
    env: process.env,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  let admin: Bun.Subprocess | undefined;
  const stop = () => {
    if (api.exitCode === null) api.kill();
    if (admin?.exitCode === null) admin.kill();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await waitForApi(config.apiOrigin, api);
    console.log(`Shoppp API local development: ${config.apiOrigin}`);
    console.log("D1 source: local Wrangler persistence (remote bindings disabled)");
    admin = Bun.spawn(createLocalAdminCommand(config), {
      cwd: ADMIN_ROOT,
      env: { ...process.env, ...environment, API_PROXY_TARGET: config.apiOrigin },
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    });
    console.log(`Shoppp Admin local development: ${config.adminOrigin}`);
    const winner = await Promise.race([
      api.exited.then((exitCode) => ({ exitCode, process: "API" })),
      admin.exited.then((exitCode) => ({ exitCode, process: "Admin" })),
    ]);
    stop();
    if (winner.exitCode !== 0) {
      console.error(`${winner.process} development process exited with code ${winner.exitCode}.`);
    }
    return winner.exitCode;
  } finally {
    stop();
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

if (import.meta.main) process.exitCode = await runLocalAdminDevelopment();
