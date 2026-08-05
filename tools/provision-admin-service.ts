import { parseArgs } from "node:util";

import { hashOpaqueToken } from "../apps/api/src/iam/passwords";

export interface ProvisionAdminServiceOptions {
  readonly confirmation?: string;
  readonly databaseIdentity: string;
  readonly environment: "production" | "test";
  readonly name: string;
  readonly subject: string;
  readonly token: string;
}

export type ProvisionCommandRunner = (command: readonly string[]) => Promise<number>;

const DATABASE_IDENTITIES = { production: "shoppp-production", test: "shoppp-staging" } as const;

function safeIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/.test(normalized)) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function serviceProvisionConfirmation(input: {
  databaseIdentity: string;
  subject: string;
}): string {
  return `PROVISION_PRODUCTION_SERVICE:${input.databaseIdentity}:${safeIdentifier(input.subject, "Subject")}`;
}

export async function buildServiceProvisionSql(
  options: ProvisionAdminServiceOptions,
  now = new Date().toISOString(),
): Promise<string> {
  const subject = safeIdentifier(options.subject, "Subject");
  const name = options.name.trim();
  if (!name || name.length > 160) throw new Error("Service credential name is invalid.");
  if (options.token.length < 32)
    throw new Error("ADMIN_SERVICE_TOKEN must be at least 32 characters.");
  const expectedDatabase = DATABASE_IDENTITIES[options.environment];
  if (options.databaseIdentity !== expectedDatabase) {
    throw new Error(`${options.environment} provisioning must target ${expectedDatabase}.`);
  }
  if (
    options.environment === "production" &&
    options.confirmation !==
      serviceProvisionConfirmation({ databaseIdentity: options.databaseIdentity, subject })
  ) {
    throw new Error("Production service provisioning confirmation does not match the target.");
  }
  const tokenHash = await hashOpaqueToken(options.token);
  const credentialId = `service_credential_${crypto.randomUUID()}`;
  const guard = `_service_provision_guard_${crypto.randomUUID().replaceAll("-", "")}`;
  return [
    `CREATE TABLE ${guard} (invalid_count INTEGER NOT NULL CHECK (invalid_count = 0));`,
    `INSERT INTO ${guard} (invalid_count) SELECT abs(1 - COUNT(*)) FROM admin_identities WHERE principal_kind = 'service' AND access_subject = ${sqlLiteral(subject)} AND enabled = 1;`,
    `INSERT INTO ${guard} (invalid_count) SELECT COUNT(*) FROM admin_service_credentials credential JOIN admin_identities identity ON identity.id = credential.identity_id WHERE credential.token_hash = ${sqlLiteral(tokenHash)} AND identity.access_subject <> ${sqlLiteral(subject)};`,
    `INSERT INTO admin_service_credentials (id, identity_id, name, token_hash, enabled, created_at) SELECT ${sqlLiteral(credentialId)}, id, ${sqlLiteral(name)}, ${sqlLiteral(tokenHash)}, 1, ${sqlLiteral(now)} FROM admin_identities WHERE principal_kind = 'service' AND access_subject = ${sqlLiteral(subject)} AND enabled = 1 ON CONFLICT(token_hash) DO UPDATE SET name = excluded.name, enabled = 1;`,
    `INSERT INTO audit_events (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at) SELECT ${sqlLiteral(crypto.randomUUID())}, 'machine', identity.id, 'iam.service_credentials.provision', 'admin_service_credential', credential.id, 'succeeded', NULL, NULL, ${sqlLiteral(JSON.stringify({ environment: options.environment, name }))}, ${sqlLiteral(now)} FROM admin_identities identity JOIN admin_service_credentials credential ON credential.identity_id = identity.id WHERE identity.principal_kind = 'service' AND identity.access_subject = ${sqlLiteral(subject)} AND credential.token_hash = ${sqlLiteral(tokenHash)};`,
    `DROP TABLE ${guard};`,
  ].join("\n");
}

export async function runServiceProvision(
  options: ProvisionAdminServiceOptions,
  runner: ProvisionCommandRunner,
): Promise<void> {
  const sql = await buildServiceProvisionSql(options);
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
  if (exitCode !== 0) throw new Error("Administrator service credential provisioning failed.");
}

function cliOptions(): ProvisionAdminServiceOptions {
  const { values } = parseArgs({
    options: {
      confirm: { type: "string" },
      database: { type: "string" },
      environment: { type: "string" },
      name: { type: "string" },
      subject: { type: "string" },
    },
    strict: true,
  });
  const token = process.env.ADMIN_SERVICE_TOKEN;
  if (!values.database || !values.environment || !values.name || !values.subject || !token) {
    throw new Error(
      "Set ADMIN_SERVICE_TOKEN and provide --environment, --database, --subject, and --name.",
    );
  }
  if (values.environment !== "test" && values.environment !== "production") {
    throw new Error("Environment must be test or production.");
  }
  return {
    ...(values.confirm ? { confirmation: values.confirm } : {}),
    databaseIdentity: values.database,
    environment: values.environment,
    name: values.name,
    subject: values.subject,
    token,
  };
}

if (import.meta.main) {
  await runServiceProvision(cliOptions(), async (command) => {
    const process = Bun.spawn([...command], { stderr: "inherit", stdout: "inherit" });
    return process.exited;
  });
}
