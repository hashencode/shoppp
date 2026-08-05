import { parseArgs } from "node:util";

import { hashPassword } from "../apps/api/src/iam/passwords";

export interface RecoverAdminPasswordOptions {
  readonly confirmation?: string;
  readonly databaseIdentity: string;
  readonly email: string;
  readonly environment: "production" | "test";
  readonly password: string;
}

export type RecoveryCommandRunner = (command: readonly string[]) => Promise<number>;

const DATABASE_IDENTITIES = {
  production: "shoppp-production",
  test: "shoppp-staging",
} as const;

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("A valid protected administrator email is required.");
  }
  return email;
}

export function recoveryConfirmation(input: { databaseIdentity: string; email: string }): string {
  return `RECOVER_PRODUCTION_ADMIN:${input.databaseIdentity}:${normalizeEmail(input.email)}`;
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function buildAdminRecoverySql(
  options: RecoverAdminPasswordOptions,
  now = new Date().toISOString(),
): Promise<string> {
  const email = normalizeEmail(options.email);
  if (options.password.length < 12 || options.password.length > 128) {
    throw new Error("ADMIN_RECOVERY_PASSWORD must contain between 12 and 128 characters.");
  }
  const expectedDatabase = DATABASE_IDENTITIES[options.environment];
  if (options.databaseIdentity !== expectedDatabase) {
    throw new Error(`${options.environment} recovery must target ${expectedDatabase}.`);
  }
  if (
    options.environment === "production" &&
    options.confirmation !==
      recoveryConfirmation({ databaseIdentity: options.databaseIdentity, email })
  ) {
    throw new Error("Production recovery confirmation does not match the exact target.");
  }
  const password = await hashPassword(options.password);
  const guard = `_admin_recovery_guard_${crypto.randomUUID().replaceAll("-", "")}`;
  return [
    `CREATE TABLE ${guard} (invalid_count INTEGER NOT NULL CHECK (invalid_count = 0));`,
    `INSERT INTO ${guard} (invalid_count) SELECT abs(1 - COUNT(*)) FROM admin_identities identity JOIN admin_roles role ON role.id = identity.role_id WHERE identity.principal_kind = 'human' AND identity.normalized_email = ${sqlLiteral(email)} AND identity.enabled = 1 AND role.enabled = 1 AND role.protected = 1;`,
    `INSERT INTO admin_password_credentials (identity_id, password_hash, password_salt, password_iterations, password_version, must_change_password, created_at, updated_at) SELECT identity.id, ${sqlLiteral(password.hash)}, ${sqlLiteral(password.salt)}, ${password.iterations}, 1, 0, ${sqlLiteral(now)}, ${sqlLiteral(now)} FROM admin_identities identity JOIN admin_roles role ON role.id = identity.role_id WHERE identity.normalized_email = ${sqlLiteral(email)} AND role.protected = 1 ON CONFLICT(identity_id) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt, password_iterations = excluded.password_iterations, password_version = admin_password_credentials.password_version + 1, must_change_password = 0, updated_at = excluded.updated_at;`,
    `UPDATE admin_sessions SET revoked_at = ${sqlLiteral(now)} WHERE identity_id = (SELECT identity.id FROM admin_identities identity JOIN admin_roles role ON role.id = identity.role_id WHERE identity.normalized_email = ${sqlLiteral(email)} AND role.protected = 1) AND revoked_at IS NULL;`,
    `INSERT INTO audit_events (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at) SELECT ${sqlLiteral(crypto.randomUUID())}, 'machine', NULL, 'iam.password.recover', 'admin_identity', identity.id, 'succeeded', 'controlled_offline_recovery', NULL, ${sqlLiteral(JSON.stringify({ databaseIdentity: options.databaseIdentity, environment: options.environment }))}, ${sqlLiteral(now)} FROM admin_identities identity JOIN admin_roles role ON role.id = identity.role_id WHERE identity.normalized_email = ${sqlLiteral(email)} AND role.protected = 1;`,
    `DROP TABLE ${guard};`,
  ].join("\n");
}

export async function runAdminPasswordRecovery(
  options: RecoverAdminPasswordOptions,
  runner: RecoveryCommandRunner,
): Promise<void> {
  const sql = await buildAdminRecoverySql(options);
  const environment = options.environment === "production" ? "production" : "staging";
  const exitCode = await runner([
    "bunx",
    "wrangler",
    "d1",
    "execute",
    options.databaseIdentity,
    "--remote",
    "--config",
    "apps/api/wrangler.jsonc",
    "--env",
    environment,
    "--command",
    sql,
  ]);
  if (exitCode !== 0) throw new Error("Protected administrator recovery failed.");
}

function cliOptions(): RecoverAdminPasswordOptions {
  const { values } = parseArgs({
    options: {
      confirm: { type: "string" },
      database: { type: "string" },
      email: { type: "string" },
      environment: { type: "string" },
    },
    strict: true,
  });
  const password = process.env.ADMIN_RECOVERY_PASSWORD;
  if (!values.database || !values.email || !values.environment || !password) {
    throw new Error(
      "Set ADMIN_RECOVERY_PASSWORD and run recover:admin-password --environment test|production --database NAME --email EMAIL [--confirm EXACT]",
    );
  }
  if (values.environment !== "test" && values.environment !== "production") {
    throw new Error("Environment must be test or production.");
  }
  return {
    ...(values.confirm ? { confirmation: values.confirm } : {}),
    databaseIdentity: values.database,
    email: values.email,
    environment: values.environment,
    password,
  };
}

if (import.meta.main) {
  await runAdminPasswordRecovery(cliOptions(), async (command) => {
    const process = Bun.spawn([...command], { stderr: "inherit", stdout: "inherit" });
    return process.exited;
  });
}
