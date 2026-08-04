export const ADMIN_ROLE_IDS = {
  admin: "role_admin",
  analyst: "role_analyst",
  catalogManager: "role_catalog_manager",
  operations: "role_operations",
  support: "role_support",
} as const;

export const ACCESS_SERVICE_EMAIL_MARKER = "service-auth@cloudflare-access.invalid";

interface HumanAdminFixture {
  readonly displayName?: string;
  readonly email?: string;
  readonly enabled?: boolean;
  readonly id?: string;
  readonly roleId?: (typeof ADMIN_ROLE_IDS)[keyof typeof ADMIN_ROLE_IDS];
  readonly subject?: string;
}

interface ServiceAdminFixture {
  readonly displayName?: string;
  readonly enabled?: boolean;
  readonly id?: string;
  readonly roleId?: (typeof ADMIN_ROLE_IDS)[keyof typeof ADMIN_ROLE_IDS];
  readonly subject?: string;
}

const FIXTURE_TIME = "2026-08-04T00:00:00.000Z";

export async function seedHumanAdmin(
  db: D1Database,
  fixture: HumanAdminFixture = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_identities
         (id, principal_kind, access_subject, normalized_email, display_name, role_id,
          enabled, version, created_at, updated_at)
       VALUES (?, 'human', ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      fixture.id ?? "identity-admin-fixture",
      fixture.subject ?? "access-admin-fixture",
      (fixture.email ?? "admin@example.test").trim().toLowerCase(),
      fixture.displayName ?? "Admin fixture",
      fixture.roleId ?? ADMIN_ROLE_IDS.admin,
      fixture.enabled === false ? 0 : 1,
      FIXTURE_TIME,
      FIXTURE_TIME,
    )
    .run();
}

export async function seedServiceAdmin(
  db: D1Database,
  fixture: ServiceAdminFixture = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_identities
         (id, principal_kind, access_subject, normalized_email, display_name, role_id,
          enabled, version, created_at, updated_at)
       VALUES (?, 'service', ?, NULL, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      fixture.id ?? "identity-service-fixture",
      fixture.subject ?? "access-service-fixture",
      fixture.displayName ?? "Service fixture",
      fixture.roleId ?? ADMIN_ROLE_IDS.operations,
      fixture.enabled === false ? 0 : 1,
      FIXTURE_TIME,
      FIXTURE_TIME,
    )
    .run();
}
