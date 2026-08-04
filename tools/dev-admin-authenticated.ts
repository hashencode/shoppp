import { resolve } from "node:path";
export { shouldForwardAccessAssertion } from "../apps/admin/authenticated-dev-policy";

type Environment = Record<string, string | undefined>;

export interface AuthenticatedDevelopmentConfig {
  readonly accessAudience: string;
  readonly apiProxyTarget: string;
  readonly databaseId: string;
  readonly tunnelHostname: string;
  readonly tunnelName: string;
}

const ROOT = resolve(import.meta.dir, "..");

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for authenticated admin development.`);
  return value;
}

function normalizedHostname(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function resolveAuthenticatedDevelopmentConfig(
  environment: Environment,
): AuthenticatedDevelopmentConfig {
  const apiProxyTarget = required(environment, "TEST_API_ORIGIN");
  const tunnelHostname = normalizedHostname(required(environment, "ADMIN_TUNNEL_HOSTNAME"));
  const tunnelName = required(environment, "CLOUDFLARE_TUNNEL_NAME");
  const accessAudience = required(environment, "TEST_ACCESS_AUDIENCE");
  const databaseId = required(environment, "TEST_D1_DATABASE_ID");
  const productionAudience = required(environment, "PRODUCTION_ACCESS_AUDIENCE");
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
    /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(apiUrl.hostname)
  ) {
    throw new Error("TEST_API_ORIGIN must be an absolute HTTPS test API origin.");
  }
  if (/production/i.test(apiUrl.hostname) || !/(?:staging|test)/i.test(apiUrl.hostname)) {
    throw new Error("TEST_API_ORIGIN must identify the allowlisted staging/test API, never production.");
  }
  if (
    !tunnelHostname.includes(".") ||
    /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(tunnelHostname) ||
    /production/i.test(tunnelHostname)
  ) {
    throw new Error("ADMIN_TUNNEL_HOSTNAME must be the named non-production Access hostname.");
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(tunnelName)) {
    throw new Error("CLOUDFLARE_TUNNEL_NAME must be one explicit named tunnel.");
  }
  if (accessAudience === productionAudience) {
    throw new Error("Test and production Access audience identifiers must be distinct.");
  }
  if (databaseId === productionDatabaseId) {
    throw new Error("Test and production database identifiers must be distinct.");
  }

  return { accessAudience, apiProxyTarget: apiUrl.origin, databaseId, tunnelHostname, tunnelName };
}

export function authenticatedDevelopmentCommands(config: AuthenticatedDevelopmentConfig) {
  return {
    admin: ["bun", "x", "rsbuild", "dev", "--env-mode", "test", "--host", "127.0.0.1"],
    tunnel: ["cloudflared", "tunnel", "run", config.tunnelName],
  } as const;
}

export async function runAuthenticatedDevelopment(
  environment: Environment = process.env,
): Promise<number> {
  const config = resolveAuthenticatedDevelopmentConfig(environment);
  const commands = authenticatedDevelopmentCommands(config);
  const childEnvironment = {
    ...process.env,
    ADMIN_TUNNEL_HOSTNAME: config.tunnelHostname,
    API_PROXY_TARGET: config.apiProxyTarget,
  };
  const admin = Bun.spawn([...commands.admin], {
    cwd: resolve(ROOT, "apps/admin"),
    env: childEnvironment,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  let tunnel: Bun.Subprocess;
  try {
    tunnel = Bun.spawn([...commands.tunnel], {
      cwd: ROOT,
      env: childEnvironment,
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    });
  } catch (error) {
    admin.kill("SIGTERM");
    await admin.exited;
    throw error;
  }
  const first = await Promise.race([
    admin.exited.then((code) => ({ code, sibling: tunnel })),
    tunnel.exited.then((code) => ({ code, sibling: admin })),
  ]);
  first.sibling.kill("SIGTERM");
  await first.sibling.exited;
  return first.code;
}

if (import.meta.main) {
  process.exitCode = await runAuthenticatedDevelopment();
}
