import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseJsonc } from "./lib/jsonc";

type Environment = Record<string, string | undefined>;

export interface AdminDevelopmentConfig {
  readonly adminDevelopmentOrigin: string;
  readonly adminPort: number;
  readonly apiProxyTarget: string;
  readonly databaseId: string;
  readonly profile: "fashion-staging";
}

const ROOT = resolve(import.meta.dir, "..");

interface ApiWranglerConfig {
  readonly env?: {
    readonly "fashion-staging"?: {
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
  const profile = required(environment, "ADMIN_DEVELOPMENT_PROFILE");
  if (profile !== "fashion-staging") {
    throw new Error("ADMIN_DEVELOPMENT_PROFILE must be exactly fashion-staging for U8 acceptance.");
  }
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
  const rawPort = environment.E2E_PORT?.trim() || "3418";
  const adminPort = Number(rawPort);
  if (!Number.isInteger(adminPort) || adminPort < 1 || adminPort > 65_535) {
    throw new Error("E2E_PORT must be an integer between 1 and 65535.");
  }
  return {
    adminDevelopmentOrigin: `http://127.0.0.1:${adminPort}`,
    adminPort,
    apiProxyTarget: apiUrl.origin,
    databaseId,
    profile,
  };
}

export async function verifyAdminDevelopmentContract(
  config: AdminDevelopmentConfig,
  root = ROOT,
): Promise<void> {
  const source = await readFile(resolve(root, "apps/api/wrangler.jsonc"), "utf8");
  const parsed = parseJsonc<ApiWranglerConfig>(source);
  const fashionStaging = parsed.env?.[config.profile];
  if (!fashionStaging) throw new Error("The API Wrangler config is missing env.fashion-staging.");
  const databases = fashionStaging.d1_databases ?? [];
  if (databases.length !== 1) {
    throw new Error("The fashion-staging API must bind exactly one test D1.");
  }
  const database = databases[0];
  const variables = fashionStaging.vars ?? {};
  if (
    !database?.database_id ||
    database.database_id !== variables.D1_DATABASE_ID ||
    config.databaseId !== database.database_id
  ) {
    throw new Error("TEST_D1_DATABASE_ID must equal the fashion-staging API test D1 binding.");
  }
  if (database.database_name !== "shoppp-fashion-staging") {
    throw new Error("Admin development requires the named shoppp-fashion-staging test D1.");
  }
  if (config.apiProxyTarget !== variables.PUBLIC_ORIGIN) {
    throw new Error("TEST_API_ORIGIN must equal the fashion-staging API PUBLIC_ORIGIN.");
  }
  if (config.adminDevelopmentOrigin !== variables.ADMIN_DEVELOPMENT_ORIGIN) {
    throw new Error(
      "The local Admin origin must equal the fashion-staging API ADMIN_DEVELOPMENT_ORIGIN.",
    );
  }
}

export function createAdminDevelopmentCommand(adminPort: number): string[] {
  const command = ["bun", "x", "rsbuild", "dev", "--env-mode", "test", "--host", "127.0.0.1"];
  return [...command, "--port", String(adminPort)];
}

export async function runAdminDevelopment(environment: Environment = process.env): Promise<number> {
  const config = resolveAdminDevelopmentConfig(environment);
  await verifyAdminDevelopmentContract(config);
  const child = Bun.spawn(createAdminDevelopmentCommand(config.adminPort), {
    cwd: resolve(ROOT, "apps/admin"),
    env: { ...process.env, ...environment, API_PROXY_TARGET: config.apiProxyTarget },
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  return child.exited;
}

if (import.meta.main) process.exitCode = await runAdminDevelopment();
