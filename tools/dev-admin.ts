import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseJsonc } from "./lib/jsonc";

type Environment = Record<string, string | undefined>;

export interface AdminDevelopmentConfig {
  readonly apiProxyTarget: string;
  readonly databaseId: string;
}

const ROOT = resolve(import.meta.dir, "..");

interface ApiWranglerConfig {
  readonly env?: {
    readonly staging?: {
      readonly d1_databases?: readonly {
        readonly database_id?: string;
        readonly database_name?: string;
      }[];
      readonly vars?: Record<string, string>;
    };
  };
}

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for admin development.`);
  return value;
}

export function resolveAdminDevelopmentConfig(environment: Environment): AdminDevelopmentConfig {
  const apiProxyTarget = required(environment, "TEST_API_ORIGIN");
  const databaseId = required(environment, "TEST_D1_DATABASE_ID");
  const productionDatabaseId = required(environment, "PRODUCTION_D1_DATABASE_ID");
  let apiUrl: URL;
  try {
    apiUrl = new URL(apiProxyTarget);
  } catch {
    throw new Error("TEST_API_ORIGIN must be an absolute HTTPS test API origin.");
  }
  if (
    apiUrl.protocol !== "https:" ||
    apiUrl.pathname !== "/" ||
    apiUrl.search ||
    apiUrl.hash ||
    /production/i.test(apiUrl.hostname) ||
    !/(?:staging|test)/i.test(apiUrl.hostname)
  ) {
    throw new Error("TEST_API_ORIGIN must identify the HTTPS staging/test API, never production.");
  }
  if (databaseId === productionDatabaseId) {
    throw new Error("Test and production database identifiers must be distinct.");
  }
  return { apiProxyTarget: apiUrl.origin, databaseId };
}

export async function verifyAdminDevelopmentContract(
  config: AdminDevelopmentConfig,
  root = ROOT,
): Promise<void> {
  const source = await readFile(resolve(root, "apps/api/wrangler.jsonc"), "utf8");
  const staging = parseJsonc<ApiWranglerConfig>(source).env?.staging;
  if (!staging) throw new Error("The API Wrangler config is missing env.staging.");
  const databases = staging.d1_databases ?? [];
  if (databases.length !== 1) throw new Error("The staging API must bind exactly one test D1.");
  const database = databases[0];
  const variables = staging.vars ?? {};
  if (
    !database?.database_id ||
    database.database_id !== variables.D1_DATABASE_ID ||
    config.databaseId !== database.database_id
  ) {
    throw new Error("TEST_D1_DATABASE_ID must equal the staging API test D1 binding.");
  }
  if (database.database_name !== "shoppp-staging") {
    throw new Error("Admin development requires the named shoppp-staging test D1.");
  }
  if (config.apiProxyTarget !== variables.PUBLIC_ORIGIN) {
    throw new Error("TEST_API_ORIGIN must equal the staging API PUBLIC_ORIGIN.");
  }
}

export async function runAdminDevelopment(environment: Environment = process.env): Promise<number> {
  const config = resolveAdminDevelopmentConfig(environment);
  await verifyAdminDevelopmentContract(config);
  const child = Bun.spawn(
    ["bun", "x", "rsbuild", "dev", "--env-mode", "test", "--host", "127.0.0.1"],
    {
      cwd: resolve(ROOT, "apps/admin"),
      env: { ...process.env, API_PROXY_TARGET: config.apiProxyTarget },
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    },
  );
  return child.exited;
}

if (import.meta.main) process.exitCode = await runAdminDevelopment();
