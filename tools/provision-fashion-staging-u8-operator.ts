import { parseArgs } from "node:util";

import { hashPassword } from "../apps/api/src/iam/passwords";

export type FashionU8OperatorAction = "cleanup" | "provision" | "reconcile";

export interface FashionU8OperatorInput {
  action: FashionU8OperatorAction;
  confirmation: string;
  expiresAt: string;
  now?: string;
  runId: string;
}

interface NoEchoInput extends AsyncIterable<Uint8Array | string> {
  readonly isTTY?: boolean;
  setRawMode?(value: boolean): void;
}

const PERMISSIONS = [
  "catalog.read",
  "themes.approve",
  "themes.preview",
  "themes.read",
  "themes.write",
] as const;
const MAX_OPERATOR_LIFETIME_MS = 24 * 60 * 60 * 1000;

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function namespace(runId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(runId)) {
    throw new Error("runId must be a stable identifier");
  }
  return runId.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_");
}

function validateInput(input: FashionU8OperatorInput): {
  expiresAt: string;
  namespace: string;
  now: string;
} {
  const expectedConfirmation = `PROVISION FASHION U8 OPERATOR ${input.runId}`;
  if (input.confirmation !== expectedConfirmation) {
    throw new Error("Fashion U8 operator confirmation is invalid");
  }
  const now = input.now ?? new Date().toISOString();
  const nowMs = Date.parse(now);
  const expiryMs = Date.parse(input.expiresAt);
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(expiryMs) ||
    new Date(nowMs).toISOString() !== now ||
    new Date(expiryMs).toISOString() !== input.expiresAt ||
    expiryMs <= nowMs ||
    expiryMs - nowMs > MAX_OPERATOR_LIFETIME_MS
  ) {
    throw new Error("Fashion U8 operator expiry must be canonical, future, and at most 24 hours");
  }
  return { expiresAt: input.expiresAt, namespace: namespace(input.runId), now };
}

function reconciliationSql(now: string): string[] {
  return [
    `UPDATE admin_sessions SET revoked_at = COALESCE(revoked_at, ${sql(now)}) WHERE identity_id IN (SELECT id FROM admin_identities WHERE id LIKE 'identity_fashion_u8_%');`,
    `UPDATE admin_identities SET enabled = 0, version = version + 1, updated_at = ${sql(now)} WHERE id LIKE 'identity_fashion_u8_%' AND enabled = 1;`,
  ];
}

function cleanupSql(identityId: string, now: string): string[] {
  return [
    `UPDATE admin_sessions SET revoked_at = COALESCE(revoked_at, ${sql(now)}) WHERE identity_id = ${sql(identityId)};`,
    `UPDATE admin_identities SET enabled = 0, version = version + 1, updated_at = ${sql(now)} WHERE id = ${sql(identityId)} AND enabled = 1;`,
  ];
}

function validateBootstrapCredential(value: string): void {
  if (
    value.length < 32 ||
    value.length > 256 ||
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/\d/.test(value) ||
    !/[^A-Za-z0-9]/.test(value) ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    throw new Error("bootstrap credential must be a high-entropy 32-256 character value");
  }
}

export async function fashionStagingU8OperatorSql(
  input: FashionU8OperatorInput,
  bootstrapCredential?: string,
): Promise<string> {
  const validated = validateInput(input);
  const roleId = `role_fashion_u8_${validated.namespace}`;
  const identityId = `identity_fashion_u8_${validated.namespace}`;
  const email = `fashion-u8-${validated.namespace}@operators.invalid`;
  const statements = ["PRAGMA foreign_keys = ON;"];

  if (input.action === "reconcile") {
    statements.push(...reconciliationSql(validated.now));
    return `${statements.join("\n")}\n`;
  }
  if (input.action === "cleanup") {
    statements.push(...cleanupSql(identityId, validated.now));
    return `${statements.join("\n")}\n`;
  }
  if (!bootstrapCredential) throw new Error("bootstrap credential is required for provision");
  validateBootstrapCredential(bootstrapCredential);
  const password = await hashPassword(bootstrapCredential);

  statements.push(
    ...reconciliationSql(validated.now),
    `INSERT INTO admin_roles (id, key, name, description, protected, system, enabled, version, created_at, updated_at) VALUES (${sql(roleId)}, ${sql(`fashion_u8_${validated.namespace}`)}, 'Fashion U8 operator', 'Run-scoped least-privilege human acceptance operator.', 0, 0, 1, 1, ${sql(validated.now)}, ${sql(validated.now)}) ON CONFLICT(id) DO UPDATE SET key = excluded.key, name = excluded.name, description = excluded.description, protected = 0, system = 0, enabled = 1, version = admin_roles.version + 1, updated_at = excluded.updated_at;`,
    `DELETE FROM admin_role_permissions WHERE role_id = ${sql(roleId)};`,
    ...PERMISSIONS.map(
      (permission) =>
        `INSERT INTO admin_role_permissions (role_id, permission_key, created_at) VALUES (${sql(roleId)}, ${sql(permission)}, ${sql(validated.now)});`,
    ),
    `INSERT INTO admin_identities (id, principal_kind, access_subject, normalized_email, display_name, role_id, enabled, expires_at, version, created_at, updated_at) VALUES (${sql(identityId)}, 'human', ${sql(`password:${email}`)}, ${sql(email)}, 'Fashion U8 operator ${validated.namespace}', ${sql(roleId)}, 1, ${sql(validated.expiresAt)}, 1, ${sql(validated.now)}, ${sql(validated.now)}) ON CONFLICT(id) DO UPDATE SET principal_kind = 'human', access_subject = excluded.access_subject, normalized_email = excluded.normalized_email, display_name = excluded.display_name, role_id = excluded.role_id, enabled = 1, expires_at = excluded.expires_at, version = admin_identities.version + 1, updated_at = excluded.updated_at;`,
    `INSERT INTO admin_password_credentials (identity_id, password_hash, password_salt, password_iterations, password_version, must_change_password, created_at, updated_at) VALUES (${sql(identityId)}, ${sql(password.hash)}, ${sql(password.salt)}, ${password.iterations}, 1, 0, ${sql(validated.now)}, ${sql(validated.now)}) ON CONFLICT(identity_id) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt, password_iterations = excluded.password_iterations, password_version = admin_password_credentials.password_version + 1, must_change_password = 0, updated_at = excluded.updated_at;`,
    `CREATE TABLE _fashion_u8_operator_guard (invalid_count INTEGER NOT NULL CHECK (invalid_count = 0));`,
    `INSERT INTO _fashion_u8_operator_guard SELECT abs(${PERMISSIONS.length} - COUNT(*)) FROM admin_role_permissions WHERE role_id = ${sql(roleId)} AND permission_key IN (${PERMISSIONS.map(sql).join(", ")});`,
    `INSERT INTO _fashion_u8_operator_guard SELECT COUNT(*) FROM admin_role_permissions WHERE role_id = ${sql(roleId)} AND permission_key NOT IN (${PERMISSIONS.map(sql).join(", ")});`,
    `INSERT INTO _fashion_u8_operator_guard SELECT abs(1 - COUNT(*)) FROM admin_roles WHERE id = ${sql(roleId)} AND key = ${sql(`fashion_u8_${validated.namespace}`)} AND protected = 0 AND system = 0 AND enabled = 1;`,
    `INSERT INTO _fashion_u8_operator_guard SELECT abs(1 - COUNT(*)) FROM admin_identities WHERE id = ${sql(identityId)} AND principal_kind = 'human' AND access_subject = ${sql(`password:${email}`)} AND normalized_email = ${sql(email)} AND role_id = ${sql(roleId)} AND enabled = 1 AND expires_at = ${sql(validated.expiresAt)};`,
    "DROP TABLE _fashion_u8_operator_guard;",
  );
  return `${statements.join("\n")}\n`;
}

export async function readNoEchoBootstrapCredential(input: NoEchoInput): Promise<string> {
  const bytes: number[] = [];
  if (input.isTTY) input.setRawMode?.(true);
  try {
    for await (const chunk of input) {
      const next = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
      let complete = false;
      for (const byte of next) {
        if (byte === 3) throw new Error("bootstrap credential input was interrupted");
        if (byte === 10 || byte === 13) {
          complete = true;
          break;
        }
        if (byte === 8 || byte === 127) {
          bytes.pop();
          continue;
        }
        bytes.push(byte);
      }
      if (complete) break;
    }
  } finally {
    if (input.isTTY) input.setRawMode?.(false);
  }
  const value = new TextDecoder().decode(Uint8Array.from(bytes));
  if (!value) throw new Error("bootstrap credential input was empty");
  return value;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      action: { type: "string" },
      confirm: { type: "string" },
      "expires-at": { type: "string" },
      "run-id": { type: "string" },
    },
    strict: true,
  });
  if (!/^(cleanup|provision|reconcile)$/.test(values.action ?? "")) {
    throw new Error("Use --action=cleanup|provision|reconcile");
  }
  if (!values.confirm || !values["expires-at"] || !values["run-id"]) {
    throw new Error("Use --confirm, --expires-at, and --run-id");
  }
  const action = values.action as FashionU8OperatorAction;
  if (action === "provision" && process.stdin.isTTY) {
    process.stderr.write("Bootstrap credential (input hidden): ");
  }
  const bootstrapCredential =
    action === "provision" ? await readNoEchoBootstrapCredential(process.stdin) : undefined;
  if (action === "provision" && process.stdin.isTTY) process.stderr.write("\n");
  process.stdout.write(
    await fashionStagingU8OperatorSql(
      {
        action,
        confirmation: values.confirm,
        expiresAt: values["expires-at"],
        runId: values["run-id"],
      },
      bootstrapCredential,
    ),
  );
}
