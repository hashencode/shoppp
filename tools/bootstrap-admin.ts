import { parseArgs } from "node:util";
import { createHash } from "node:crypto";

export interface BootstrapAdminOptions {
  readonly confirmation?: string;
  readonly databaseIdentity: string;
  readonly displayName?: string;
  readonly email: string;
  readonly environment: "fashion-staging" | "production" | "test";
}

export type BootstrapCommandRunner = (command: readonly string[]) => Promise<number>;

const DATABASE_IDENTITIES = {
  "fashion-staging": "shoppp-fashion-staging",
  production: "shoppp-production",
  test: "shoppp-staging",
} as const;

const WRANGLER_ENVIRONMENTS = {
  "fashion-staging": "fashion-staging",
  production: "production",
  test: "staging",
} as const;

function notificationJobId(invitationId: string): string {
  return `notify_${invitationId}`;
}

function normalizeDisplayName(displayName: string | undefined): string | undefined {
  const normalized = displayName?.trim();
  if (normalized && normalized.length <= 120) return normalized;
  if (displayName !== undefined) {
    throw new Error("Administrator display name must contain 1 to 120 characters.");
  }
  return undefined;
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new Error("A valid administrator email is required.");
  }
  return normalized;
}

export function productionConfirmation(options: {
  databaseIdentity: string;
  email: string;
}): string {
  return `BOOTSTRAP_PRODUCTION:${options.databaseIdentity}:${normalizeEmail(options.email)}`;
}

export function validateBootstrapOptions(options: BootstrapAdminOptions): BootstrapAdminOptions {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.databaseIdentity)) {
    throw new Error("Database identity must be explicit and contain only letters, digits, _ or -.");
  }
  const email = normalizeEmail(options.email);
  const displayName = normalizeDisplayName(options.displayName);
  const expectedDatabaseIdentity = DATABASE_IDENTITIES[options.environment];
  if (options.databaseIdentity !== expectedDatabaseIdentity) {
    throw new Error(
      `${options.environment} bootstrap must target ${expectedDatabaseIdentity}; received ${options.databaseIdentity}.`,
    );
  }
  if (
    options.environment === "production" &&
    options.confirmation !== productionConfirmation({ ...options, email })
  ) {
    throw new Error("Production bootstrap confirmation does not match the exact target.");
  }
  if (options.environment === "fashion-staging" && !displayName) {
    throw new Error("Fashion staging bootstrap requires a durable operator display name.");
  }
  return { ...options, ...(displayName ? { displayName } : {}), email };
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildBootstrapSql(
  options: BootstrapAdminOptions,
  ids: { auditId: string; invitationId: string },
  now: string,
): string {
  const validated = validateBootstrapOptions(options);
  const expiresAt = new Date(new Date(now).getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString();
  const guard = `_bootstrap_admin_guard_${ids.invitationId.replaceAll(/[^a-zA-Z0-9]/g, "")}`;
  const invitationIdempotencyKey = `bootstrap:${validated.databaseIdentity}:${validated.email}`;
  const jobId = notificationJobId(ids.invitationId);
  return [
    `CREATE TABLE ${guard} (invalid_count INTEGER NOT NULL CHECK (invalid_count = 0));`,
    `INSERT INTO ${guard} (invalid_count) SELECT (SELECT COUNT(*) FROM admin_identities identity JOIN admin_roles role ON role.id = identity.role_id WHERE identity.principal_kind = 'human' AND identity.enabled = 1 AND role.protected = 1 AND role.enabled = 1) + CASE (SELECT COUNT(*) FROM admin_roles role WHERE role.protected = 1 AND role.enabled = 1) WHEN 1 THEN 0 ELSE 1 END;`,
    `INSERT INTO admin_invitations (id, normalized_email, display_name, role_id, status, idempotency_key, invited_by_id, expires_at, version, created_at, updated_at) SELECT ${sqlLiteral(ids.invitationId)}, ${sqlLiteral(validated.email)}, ${validated.displayName ? sqlLiteral(validated.displayName) : "NULL"}, role.id, 'pending', ${sqlLiteral(invitationIdempotencyKey)}, NULL, ${sqlLiteral(expiresAt)}, 1, ${sqlLiteral(now)}, ${sqlLiteral(now)} FROM admin_roles role WHERE role.protected = 1 AND role.enabled = 1 LIMIT 1 ON CONFLICT(idempotency_key) DO NOTHING;`,
    `INSERT INTO notification_jobs (id, order_id, type, deduplication_key, payload_json, status, attempt_count, max_attempts, created_at, updated_at) VALUES (${sqlLiteral(jobId)}, NULL, 'admin_invitation', ${sqlLiteral(`admin-invitation:${ids.invitationId}:v1`)}, ${sqlLiteral(JSON.stringify({ invitationId: ids.invitationId }))}, 'pending', 0, 3, ${sqlLiteral(now)}, ${sqlLiteral(now)}) ON CONFLICT(id) DO UPDATE SET status = 'pending', attempt_count = 0, attempt_cycle_count = 0, next_attempt_at = NULL, claim_expires_at = NULL, enqueued_at = NULL, sent_at = NULL, provider_message_id = NULL, dead_lettered_at = NULL, last_error_code = NULL, updated_at = excluded.updated_at WHERE notification_jobs.status <> 'sent';`,
    `INSERT INTO audit_events (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at) VALUES (${sqlLiteral(ids.auditId)}, 'machine', NULL, 'iam.bootstrap.invitation', 'admin_invitation', ${sqlLiteral(ids.invitationId)}, 'succeeded', NULL, NULL, ${sqlLiteral(JSON.stringify({ databaseIdentity: validated.databaseIdentity, environment: validated.environment }))}, ${sqlLiteral(now)}) ON CONFLICT(id) DO NOTHING;`,
    `DROP TABLE ${guard};`,
  ].join("\n");
}

export async function runBootstrapAdmin(
  options: BootstrapAdminOptions,
  runner: BootstrapCommandRunner,
): Promise<{ invitationId: string; notificationJobId: string }> {
  const validated = validateBootstrapOptions(options);
  const identityDigest = createHash("sha256")
    .update(`${validated.databaseIdentity}:${validated.email}`)
    .digest("hex");
  const invitationId = `inv_${identityDigest.slice(0, 32)}`;
  const sql = buildBootstrapSql(
    validated,
    { auditId: `audit_${identityDigest.slice(32)}`, invitationId },
    new Date().toISOString(),
  );
  const environment = WRANGLER_ENVIRONMENTS[validated.environment];
  const exitCode = await runner([
    "apps/api/node_modules/.bin/wrangler",
    "d1",
    "execute",
    validated.databaseIdentity,
    "--remote",
    "--config",
    "apps/api/wrangler.jsonc",
    "--env",
    environment,
    "--command",
    sql,
  ]);
  if (exitCode !== 0) throw new Error("Administrator bootstrap failed; no retry was attempted.");
  return { invitationId, notificationJobId: notificationJobId(invitationId) };
}

function cliOptions(): BootstrapAdminOptions {
  const { values } = parseArgs({
    options: {
      confirm: { type: "string" },
      database: { type: "string" },
      "display-name": { type: "string" },
      email: { type: "string" },
      environment: { type: "string" },
    },
    strict: true,
  });
  if (!values.database || !values.email || !values.environment) {
    throw new Error(
      "Usage: bootstrap:admin --environment test|fashion-staging|production --database NAME --email EMAIL [--display-name NAME] [--confirm EXACT]",
    );
  }
  if (
    values.environment !== "test" &&
    values.environment !== "fashion-staging" &&
    values.environment !== "production"
  ) {
    throw new Error("Environment must be test, fashion-staging, or production.");
  }
  return {
    ...(values.confirm ? { confirmation: values.confirm } : {}),
    databaseIdentity: values.database,
    ...(values["display-name"] ? { displayName: values["display-name"] } : {}),
    email: values.email,
    environment: values.environment,
  };
}

if (import.meta.main) {
  const result = await runBootstrapAdmin(cliOptions(), async (command) => {
    const process = Bun.spawn([...command], { stderr: "inherit", stdout: "inherit" });
    return process.exited;
  });
  process.stdout.write(`SHOPPP_BOOTSTRAP_RESULT=${JSON.stringify(result)}\n`);
}
