import { parseArgs } from "node:util";

export interface BootstrapAdminOptions {
  readonly confirmation?: string;
  readonly databaseIdentity: string;
  readonly email: string;
  readonly environment: "production" | "test";
}

export type BootstrapCommandRunner = (command: readonly string[]) => Promise<number>;

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
  if (
    options.environment === "production" &&
    options.confirmation !== productionConfirmation({ ...options, email })
  ) {
    throw new Error("Production bootstrap confirmation does not match the exact target.");
  }
  return { ...options, email };
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
  return [
    `CREATE TABLE ${guard} (invalid_count INTEGER NOT NULL CHECK (invalid_count = 0));`,
    `INSERT INTO ${guard} (invalid_count) SELECT COUNT(*) FROM admin_identities identity JOIN admin_roles role ON role.id = identity.role_id WHERE identity.principal_kind = 'human' AND identity.enabled = 1 AND role.protected = 1 AND role.enabled = 1;`,
    `INSERT INTO admin_invitations (id, normalized_email, display_name, role_id, status, idempotency_key, invited_by_id, expires_at, version, created_at, updated_at) SELECT ${sqlLiteral(ids.invitationId)}, ${sqlLiteral(validated.email)}, NULL, role.id, 'pending', ${sqlLiteral(`bootstrap:${validated.databaseIdentity}:${validated.email}`)}, NULL, ${sqlLiteral(expiresAt)}, 1, ${sqlLiteral(now)}, ${sqlLiteral(now)} FROM admin_roles role WHERE role.protected = 1 AND role.enabled = 1 LIMIT 1;`,
    `INSERT INTO notification_jobs (id, order_id, type, deduplication_key, payload_json, status, attempt_count, max_attempts, created_at, updated_at) VALUES (${sqlLiteral(`notify_${ids.invitationId}`)}, NULL, 'admin_invitation', ${sqlLiteral(`admin-invitation:${ids.invitationId}:v1`)}, ${sqlLiteral(JSON.stringify({ invitationId: ids.invitationId }))}, 'pending', 0, 3, ${sqlLiteral(now)}, ${sqlLiteral(now)});`,
    `INSERT INTO audit_events (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at) VALUES (${sqlLiteral(ids.auditId)}, 'machine', NULL, 'iam.bootstrap.invitation', 'admin_invitation', ${sqlLiteral(ids.invitationId)}, 'succeeded', NULL, NULL, ${sqlLiteral(JSON.stringify({ databaseIdentity: validated.databaseIdentity, environment: validated.environment }))}, ${sqlLiteral(now)});`,
    `DROP TABLE ${guard};`,
  ].join("\n");
}

export async function runBootstrapAdmin(
  options: BootstrapAdminOptions,
  runner: BootstrapCommandRunner,
): Promise<void> {
  const validated = validateBootstrapOptions(options);
  const invitationId = `inv_${crypto.randomUUID().replaceAll("-", "")}`;
  const sql = buildBootstrapSql(
    validated,
    { auditId: crypto.randomUUID(), invitationId },
    new Date().toISOString(),
  );
  const environment = validated.environment === "production" ? "production" : "staging";
  const exitCode = await runner([
    "bunx",
    "wrangler",
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
}

function cliOptions(): BootstrapAdminOptions {
  const { values } = parseArgs({
    options: {
      confirm: { type: "string" },
      database: { type: "string" },
      email: { type: "string" },
      environment: { type: "string" },
    },
    strict: true,
  });
  if (!values.database || !values.email || !values.environment) {
    throw new Error(
      "Usage: bootstrap:admin --environment test|production --database NAME --email EMAIL [--confirm EXACT]",
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
  };
}

if (import.meta.main) {
  await runBootstrapAdmin(cliOptions(), async (command) => {
    const process = Bun.spawn([...command], { stderr: "inherit", stdout: "inherit" });
    return process.exited;
  });
}
