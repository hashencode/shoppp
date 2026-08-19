import { parseArgs } from "node:util";

import { hashOpaqueToken } from "../apps/api/src/iam/passwords";

const CONFIRMATION = "PROVISION FASHION U12 PREPARER";
const ROLE_ID = "role_fashion_u12_preparer";
const IDENTITY_ID = "identity_fashion_u12_preparer";
const CREDENTIAL_ID = "service_credential_fashion_u12_preparer";
const SUBJECT = "fashion-u12-preparer";
const PERMISSIONS = [
  "catalog.read",
  "themes.approve",
  "themes.preview",
  "themes.read",
  "themes.write",
] as const;

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function fashionStagingU12PreparerSql(
  token: string,
  confirmation: string,
  now = new Date().toISOString(),
): Promise<string> {
  if (confirmation !== CONFIRMATION)
    throw new Error("Fashion U12 preparer confirmation is invalid");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error("FASHION_U12_ADMIN_SERVICE_TOKEN must be one opaque credential");
  }
  const tokenHash = await hashOpaqueToken(token);
  return [
    "PRAGMA foreign_keys = ON;",
    `INSERT OR IGNORE INTO admin_roles (id, key, name, description, protected, system, enabled, version, created_at, updated_at) VALUES (${sql(ROLE_ID)}, 'fashion_u12_preparer', 'Fashion U12 preparer', 'Least-privilege service role for one governed Fashion staging Catalog and immutable Experience preparation.', 0, 0, 1, 1, ${sql(now)}, ${sql(now)});`,
    ...PERMISSIONS.map(
      (permission) =>
        `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at) VALUES (${sql(ROLE_ID)}, ${sql(permission)}, ${sql(now)});`,
    ),
    `INSERT OR IGNORE INTO admin_identities (id, principal_kind, access_subject, normalized_email, display_name, role_id, enabled, version, created_at, updated_at) VALUES (${sql(IDENTITY_ID)}, 'service', ${sql(SUBJECT)}, NULL, 'Fashion U12 preparer', ${sql(ROLE_ID)}, 1, 1, ${sql(now)}, ${sql(now)});`,
    `INSERT INTO admin_service_credentials (id, identity_id, name, token_hash, enabled, created_at) VALUES (${sql(CREDENTIAL_ID)}, ${sql(IDENTITY_ID)}, 'Fashion staging U12 preparation workflow', ${sql(tokenHash)}, 1, ${sql(now)}) ON CONFLICT(token_hash) DO UPDATE SET name = excluded.name, enabled = 1;`,
    `CREATE TABLE _fashion_u12_preparer_guard (invalid_count INTEGER NOT NULL CHECK (invalid_count = 0));`,
    `INSERT INTO _fashion_u12_preparer_guard SELECT COUNT(*) FROM admin_roles WHERE id = ${sql(ROLE_ID)} AND (key <> 'fashion_u12_preparer' OR protected <> 0 OR system <> 0 OR enabled <> 1);`,
    `INSERT INTO _fashion_u12_preparer_guard SELECT abs(${PERMISSIONS.length} - COUNT(*)) FROM admin_role_permissions WHERE role_id = ${sql(ROLE_ID)} AND permission_key IN (${PERMISSIONS.map(sql).join(", ")});`,
    `INSERT INTO _fashion_u12_preparer_guard SELECT COUNT(*) FROM admin_role_permissions WHERE role_id = ${sql(ROLE_ID)} AND permission_key NOT IN (${PERMISSIONS.map(sql).join(", ")});`,
    `INSERT INTO _fashion_u12_preparer_guard SELECT abs(1 - COUNT(*)) FROM admin_identities WHERE id = ${sql(IDENTITY_ID)} AND principal_kind = 'service' AND access_subject = ${sql(SUBJECT)} AND role_id = ${sql(ROLE_ID)} AND enabled = 1;`,
    `INSERT INTO _fashion_u12_preparer_guard SELECT COUNT(*) FROM admin_service_credentials WHERE token_hash = ${sql(tokenHash)} AND identity_id <> ${sql(IDENTITY_ID)};`,
    "DROP TABLE _fashion_u12_preparer_guard;",
    "",
  ].join("\n");
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { confirm: { type: "string" } },
    strict: true,
  });
  const token = process.env.FASHION_U12_ADMIN_SERVICE_TOKEN;
  if (!token || !values.confirm) {
    throw new Error("Set FASHION_U12_ADMIN_SERVICE_TOKEN and use --confirm");
  }
  process.stdout.write(await fashionStagingU12PreparerSql(token, values.confirm));
}
