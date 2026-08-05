import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { ADMIN_PERMISSION_CATALOG } from "@shoppp/contracts";

import { seedLaunchFixture } from "../seed/apply";

const NOW = "2026-07-30T00:00:00.000Z";
const LEGACY_SERVICE_EMAIL_MARKER = "service-auth@cloudflare-access.invalid";
const SERVICE_EMAIL_MARKER = "service-auth@shoppp.invalid";

async function expectPreIamSchema(db: D1Database): Promise<void> {
  const iamMigrationIndex = env.TEST_MIGRATIONS.findIndex(({ name }) =>
    name.endsWith("0012_admin_iam.sql"),
  );
  expect(iamMigrationIndex).toBeGreaterThan(0);
  expect(
    (await db.prepare("SELECT COUNT(*) AS count FROM d1_migrations").first<{ count: number }>())
      ?.count,
  ).toBe(iamMigrationIndex);
}

async function applyIamMigration(db: D1Database): Promise<void> {
  await applyD1Migrations(db, env.TEST_MIGRATIONS);
}

describe("D1 migrations", () => {
  test("migrates a fresh database and accepts a relational launch fixture", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE '_cf_%' ORDER BY name",
    ).all<{ name: string }>();
    expect(tables.results.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "audit_events",
        "admin_invitations",
        "admin_login_throttles",
        "admin_password_credentials",
        "admin_password_reset_tokens",
        "admin_permission_definitions",
        "admin_role_permissions",
        "admin_roles",
        "admin_service_credentials",
        "admin_sessions",
        "d1_backup_runs",
        "carts",
        "catalog_releases",
        "checkout_attempts",
        "fulfillment_events",
        "idempotency_claims",
        "inventory_items",
        "inventory_reservations",
        "notification_attempts",
        "notification_jobs",
        "order_lines",
        "orders",
        "payment_events",
        "privacy_request_events",
        "privacy_requests",
        "prices",
        "product_variants",
        "products",
        "report_exports",
        "stock_ledger_entries",
        "storefront_experience_drafts",
        "storefront_experience_migrations",
        "storefront_experience_snapshots",
        "storefront_experience_validations",
        "storefront_preview_builds",
        "storefront_preview_grants",
        "storefront_preview_sessions",
      ]),
    );

    await seedLaunchFixture(env.DB);
    const cartColumns = await env.DB.prepare("PRAGMA table_info(carts)").all<{ name: string }>();
    expect(cartColumns.results.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["shipping_address_json", "shipping_method_id"]),
    );
    expect(
      await env.DB.prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'shipping_methods_zone_idx'",
      ).first(),
    ).toEqual({ name: "shipping_methods_zone_idx" });
    expect(
      (
        await env.DB.prepare(
          `SELECT name
             FROM sqlite_schema
            WHERE type = 'trigger' AND name LIKE 'shipping_%_guard'
            ORDER BY name`,
        ).all<{ name: string }>()
      ).results,
    ).toEqual([
      { name: "shipping_country_active_insert_guard" },
      { name: "shipping_country_active_update_guard" },
      { name: "shipping_zone_activation_guard" },
    ]);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO shipping_zones (id, name, status, created_at, updated_at) VALUES ('zone_active_us', 'Active US', 'active', ?, ?)",
      ).bind("2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z"),
      env.DB.prepare(
        "INSERT INTO shipping_zone_countries (zone_id, country_code) VALUES ('zone_active_us', 'US')",
      ),
      env.DB.prepare(
        "INSERT INTO shipping_zones (id, name, status, created_at, updated_at) VALUES ('zone_disabled_us', 'Disabled US', 'disabled', ?, ?)",
      ).bind("2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z"),
      env.DB.prepare(
        "INSERT INTO shipping_zone_countries (zone_id, country_code) VALUES ('zone_disabled_us', 'US')",
      ),
    ]);
    await expect(
      env.DB.prepare(
        "UPDATE shipping_zones SET status = 'active' WHERE id = 'zone_disabled_us'",
      ).run(),
    ).rejects.toThrow("shipping_country_zone_conflict");
    await env.DB.prepare(
      "INSERT INTO shipping_zones (id, name, status, created_at, updated_at) VALUES ('zone_active_other', 'Other active', 'active', ?, ?)",
    )
      .bind("2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z")
      .run();
    await expect(
      env.DB.prepare(
        "INSERT INTO shipping_zone_countries (zone_id, country_code) VALUES ('zone_active_other', 'US')",
      ).run(),
    ).rejects.toThrow("shipping_country_zone_conflict");
    await env.DB.prepare(
      "INSERT INTO shipping_zone_countries (zone_id, country_code) VALUES ('zone_active_other', 'CA')",
    ).run();
    await expect(
      env.DB.prepare(
        "UPDATE shipping_zone_countries SET country_code = 'US' WHERE zone_id = 'zone_active_other' AND country_code = 'CA'",
      ).run(),
    ).rejects.toThrow("shipping_country_zone_conflict");
    const notificationColumns = await env.DB.prepare("PRAGMA table_info(notification_jobs)").all<{
      name: string;
    }>();
    expect(notificationColumns.results.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "attempt_cycle_count",
        "claim_expires_at",
        "dead_lettered_at",
        "kind",
        "provider_message_id",
        "provider_event_id",
        "replay_count",
      ]),
    );
    const checkoutColumns = await env.DB.prepare("PRAGMA table_info(checkout_attempts)").all<{
      name: string;
    }>();
    expect(checkoutColumns.results.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["environment", "test_mode"]),
    );
    const orderColumns = await env.DB.prepare("PRAGMA table_info(orders)").all<{
      name: string;
    }>();
    expect(orderColumns.results.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["environment", "test_mode"]),
    );
    await expect(
      env.DB.prepare(
        "UPDATE orders SET environment = 'staging' WHERE id = 'ord_fixture_0001'",
      ).run(),
    ).rejects.toThrow("immutable_order_reporting_context");
    const job = await env.DB.prepare("SELECT id FROM notification_jobs LIMIT 1").first<{
      id: string;
    }>();
    await env.DB.prepare(
      `INSERT INTO notification_attempts
         (id, job_id, attempt_number, result, started_at, completed_at)
       VALUES ('attempt_immutable', ?, 1, 'sent', ?, ?)`,
    )
      .bind(job!.id, "2026-07-30T00:00:00.000Z", "2026-07-30T00:00:01.000Z")
      .run();
    await expect(
      env.DB.prepare(
        "UPDATE notification_attempts SET result = 'exhausted' WHERE id = 'attempt_immutable'",
      ).run(),
    ).rejects.toThrow("immutable_notification_attempt");
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_identities
           (id, principal_kind, access_subject, normalized_email, display_name, role_id,
            enabled, version, created_at, updated_at)
         VALUES ('admin_theme_test', 'human', 'theme-test', 'theme@example.test', 'Theme Test',
                 'role_admin', 1, 1, ?, ?)`,
      ).bind("2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO storefront_experience_drafts
           (id, experience_id, theme_id, theme_version, configuration_schema_version,
            preset_id, bindings_json, overrides_json, version, created_by, updated_by,
            created_at, updated_at)
         VALUES ('draft-theme-test', 'experience-theme-test', 'fashion', '1.0.0', 1,
                 'editorial', '[]', '[]', 1, 'admin_theme_test', 'admin_theme_test', ?, ?)`,
      ).bind("2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO storefront_experience_validations
           (id, draft_id, draft_version, status, issues_json, resolved_templates_json,
            validated_by, created_at)
         VALUES ('validation-theme-test', 'draft-theme-test', 1, 'valid', '[]', '[]',
                 'admin_theme_test', ?)`,
      ).bind("2026-07-30T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO storefront_experience_snapshots
           (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
            source_validation_id, kind, theme_id, theme_version,
            configuration_schema_version, snapshot_json, created_by, created_at)
         VALUES ('snapshot-theme-test', 'draft-theme-test:1:preview', 'experience-theme-test',
                 'draft-theme-test', 1, 'validation-theme-test', 'preview', 'fashion',
                 '1.0.0', 1, '{}', 'admin_theme_test', ?)`,
      ).bind("2026-07-30T00:00:00.000Z"),
    ]);
    await expect(
      env.DB.prepare(
        "UPDATE storefront_experience_snapshots SET snapshot_json = '{\"changed\":true}' WHERE id = 'snapshot-theme-test'",
      ).run(),
    ).rejects.toThrow("immutable_storefront_experience_snapshot");
    await expect(
      env.DB.prepare(
        "DELETE FROM storefront_experience_snapshots WHERE id = 'snapshot-theme-test'",
      ).run(),
    ).rejects.toThrow("append_only_storefront_experience_snapshot");
    const foreignKeyViolations = await env.DB.prepare("PRAGMA foreign_key_check").all();
    expect(foreignKeyViolations.results).toEqual([]);
    expect(
      (
        await env.DB.prepare(
          "SELECT permission_key AS key, category, label, description FROM admin_permission_definitions ORDER BY sort_order",
        ).all()
      ).results,
    ).toEqual(ADMIN_PERMISSION_CATALOG);
  });

  test("migrates all legacy roles and actor references without changing identity IDs", async () => {
    const db = env.LEGACY_DB;
    await expectPreIamSchema(db);
    const legacyIdentities = [
      ["identity_admin", "subject-admin", "admin@example.test", "Admin", "admin"],
      ["identity_catalog", "subject-catalog", "catalog@example.test", "Catalog", "catalog_manager"],
      [
        "identity_operations",
        "subject-operations",
        "operations@example.test",
        "Operations",
        "operations",
      ],
      ["identity_support", "subject-support", "support@example.test", "Support", "support"],
      ["identity_analyst", "subject-analyst", "analyst@example.test", "Analyst", "analyst"],
      [
        "identity_service",
        "ci-test-service",
        LEGACY_SERVICE_EMAIL_MARKER,
        "CI test service",
        "operations",
      ],
      [
        "identity_other_invalid",
        "subject-other-invalid",
        "service-auth@other.invalid",
        "Other invalid human",
        "support",
      ],
    ] as const;
    for (const identity of legacyIdentities) {
      await db
        .prepare(
          `INSERT INTO admin_identities
           (id, access_subject, email, display_name, role, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .bind(...identity, NOW, NOW)
        .run();
    }
    await seedLaunchFixture(db);
    await db.batch([
      db
        .prepare(
          `INSERT INTO stock_ledger_entries
           (id, variant_id, warehouse_id, quantity_delta, reason, actor_id, created_at)
         VALUES ('ledger_actor_fixture', 'var_fixture_0001', 'wh_primary', 1, 'IAM migration fixture', 'identity_admin', ?)`,
        )
        .bind(NOW),
      db
        .prepare(
          `INSERT INTO catalog_releases
           (id, status, manifest_json, approved_by, approved_at, created_at, updated_at)
         VALUES ('release_actor_fixture', 'approved', '{}', 'identity_catalog', ?, ?, ?)`,
        )
        .bind(NOW, NOW, NOW),
      db
        .prepare(
          `INSERT INTO refunds
           (id, order_id, amount, currency, reason, status, requested_by, created_at, updated_at)
         VALUES ('refund_actor_fixture', 'ord_fixture_0001', 100, 'USD', 'IAM migration fixture', 'pending', 'identity_support', ?, ?)`,
        )
        .bind(NOW, NOW),
      db
        .prepare(
          `INSERT INTO fulfillment_events
           (id, order_id, from_status, to_status, actor_id, reason, created_at)
         VALUES ('fulfillment_actor_fixture', 'ord_fixture_0001', 'unfulfilled', 'picking', 'identity_operations', 'IAM migration fixture', ?)`,
        )
        .bind(NOW),
      db
        .prepare(
          `INSERT INTO report_exports
           (id, environment, currency, time_zone, start_date, end_date, query_json,
            status, requested_by, expires_at, created_at, updated_at)
         VALUES ('report_actor_fixture', 'staging', 'USD', 'UTC', '2026-07-01', '2026-07-31', '{}',
                 'pending', 'identity_analyst', '2026-08-30T00:00:00.000Z', ?, ?)`,
        )
        .bind(NOW, NOW),
      db
        .prepare(
          `INSERT INTO privacy_requests
           (id, subject_hash, type, status, decision, requested_by, completed_at, created_at)
         VALUES ('privacy_actor_fixture', 'hash:fixture', 'access', 'completed', 'no_matching_records',
                 'identity_admin', ?, ?)`,
        )
        .bind(NOW, NOW),
    ]);

    await applyIamMigration(db);

    const migrated = await db
      .prepare(
        `SELECT identity.id, identity.principal_kind AS principalKind,
              identity.normalized_email AS normalizedEmail, role.key AS roleKey
         FROM admin_identities identity
         JOIN admin_roles role ON role.id = identity.role_id
        ORDER BY identity.id`,
      )
      .all<{
        id: string;
        normalizedEmail: string | null;
        principalKind: string;
        roleKey: string;
      }>();
    expect(migrated.results).toEqual([
      {
        id: "identity_admin",
        normalizedEmail: "admin@example.test",
        principalKind: "human",
        roleKey: "admin",
      },
      {
        id: "identity_analyst",
        normalizedEmail: "analyst@example.test",
        principalKind: "human",
        roleKey: "analyst",
      },
      {
        id: "identity_catalog",
        normalizedEmail: "catalog@example.test",
        principalKind: "human",
        roleKey: "catalog_manager",
      },
      {
        id: "identity_operations",
        normalizedEmail: "operations@example.test",
        principalKind: "human",
        roleKey: "operations",
      },
      {
        id: "identity_other_invalid",
        normalizedEmail: "service-auth@other.invalid",
        principalKind: "human",
        roleKey: "support",
      },
      {
        id: "identity_service",
        normalizedEmail: null,
        principalKind: "service",
        roleKey: "operations",
      },
      {
        id: "identity_support",
        normalizedEmail: "support@example.test",
        principalKind: "human",
        roleKey: "support",
      },
    ]);
    expect(
      await db
        .prepare(
          "SELECT id, email, role FROM admin_identities WHERE id IN ('identity_admin', 'identity_service') ORDER BY id",
        )
        .all(),
    ).toMatchObject({
      results: [
        { email: "admin@example.test", id: "identity_admin", role: "admin" },
        { email: SERVICE_EMAIL_MARKER, id: "identity_service", role: "operations" },
      ],
    });
    for (const [table, column, rowId, identityId] of [
      ["stock_ledger_entries", "actor_id", "ledger_actor_fixture", "identity_admin"],
      ["catalog_releases", "approved_by", "release_actor_fixture", "identity_catalog"],
      ["refunds", "requested_by", "refund_actor_fixture", "identity_support"],
      ["fulfillment_events", "actor_id", "fulfillment_actor_fixture", "identity_operations"],
      ["report_exports", "requested_by", "report_actor_fixture", "identity_analyst"],
      ["privacy_requests", "requested_by", "privacy_actor_fixture", "identity_admin"],
    ] as const) {
      expect(
        await db
          .prepare(`SELECT ${column} AS identityId FROM ${table} WHERE id = ?`)
          .bind(rowId)
          .first(),
      ).toEqual({ identityId });
    }
    await db
      .prepare(
        `INSERT INTO stock_ledger_entries
         (id, variant_id, warehouse_id, quantity_delta, reason, actor_id, created_at)
       VALUES ('ledger_machine_fixture', 'var_fixture_0001', 'wh_primary', 1, 'Machine actor after migration', 'identity_service', ?)`,
      )
      .bind(NOW)
      .run();
    expect(
      (await db.prepare("PRAGMA quick_check").first<{ quick_check: string }>())?.quick_check,
    ).toBe("ok");
    expect((await db.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
  });

  test("enforces principal, permission, and active invitation invariants", async () => {
    const humanInsert = `INSERT INTO admin_identities
      (id, principal_kind, access_subject, normalized_email, display_name, role_id,
       enabled, version, created_at, updated_at)
      VALUES (?, 'human', ?, ?, ?, 'role_admin', 1, 1, ?, ?)`;
    await env.DB.prepare(humanInsert)
      .bind(
        "identity_constraints",
        "subject-constraints",
        "constraints@example.test",
        "Constraints",
        NOW,
        NOW,
      )
      .run();
    expect(
      await env.DB.prepare(
        "SELECT email, role FROM admin_identities WHERE id = 'identity_constraints'",
      ).first(),
    ).toEqual({ email: "constraints@example.test", role: "admin" });
    await env.DB.prepare(
      "UPDATE admin_identities SET role_id = 'role_support' WHERE id = 'identity_constraints'",
    ).run();
    expect(
      await env.DB.prepare(
        "SELECT email, role FROM admin_identities WHERE id = 'identity_constraints'",
      ).first(),
    ).toEqual({ email: "constraints@example.test", role: "support" });
    await env.DB.prepare(
      `INSERT INTO admin_identities
        (id, principal_kind, access_subject, normalized_email, display_name, role_id,
         enabled, version, created_at, updated_at)
       VALUES ('identity_service_marker', 'service', 'service-marker', NULL, 'Service marker',
               'role_operations', 1, 1, ?, ?)`,
    )
      .bind(NOW, NOW)
      .run();
    expect(
      await env.DB.prepare(
        "SELECT email, role FROM admin_identities WHERE id = 'identity_service_marker'",
      ).first(),
    ).toEqual({ email: SERVICE_EMAIL_MARKER, role: "operations" });
    expect(
      await env.DB.prepare(
        "SELECT dflt_value AS defaultValue FROM pragma_table_info('admin_identities') WHERE name = 'email'",
      ).first(),
    ).toEqual({ defaultValue: `'${LEGACY_SERVICE_EMAIL_MARKER}'` });
    await expect(
      env.DB.prepare(humanInsert)
        .bind(
          "identity_duplicate_email",
          "subject-other",
          "constraints@example.test",
          "Duplicate",
          NOW,
          NOW,
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        `INSERT INTO admin_identities
          (id, principal_kind, access_subject, normalized_email, display_name, role_id,
           enabled, version, created_at, updated_at)
         VALUES ('identity_bad_service', 'service', 'service-bad', 'service@example.test', 'Bad service',
                 'role_operations', 1, 1, ?, ?)`,
      )
        .bind(NOW, NOW)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO admin_role_permissions (role_id, permission_key, created_at) VALUES ('role_support', 'unknown.permission', ?)",
      )
        .bind(NOW)
        .run(),
    ).rejects.toThrow();

    const invitationInsert = `INSERT INTO admin_invitations
      (id, normalized_email, display_name, role_id, status, idempotency_key,
       invited_by_id, expires_at, created_at, updated_at, version)
      VALUES (?, 'invitee@example.test', 'Invitee', 'role_support', 'pending', ?,
              'identity_constraints', '2026-08-30T00:00:00.000Z', ?, ?, 1)`;
    await env.DB.prepare(invitationInsert).bind("invitation_one", "invite-key-one", NOW, NOW).run();
    await expect(
      env.DB.prepare(invitationInsert).bind("invitation_two", "invite-key-two", NOW, NOW).run(),
    ).rejects.toThrow();
    await env.DB.prepare(
      "UPDATE admin_invitations SET status = 'revoked', revoked_at = ?, version = 2 WHERE id = 'invitation_one'",
    )
      .bind(NOW)
      .run();
    await env.DB.prepare(invitationInsert).bind("invitation_two", "invite-key-two", NOW, NOW).run();
  });

  test("rolls back an IAM migration whose normalized human identities collide", async () => {
    const db = env.INVALID_LEGACY_DB;
    await expectPreIamSchema(db);
    for (const [id, subject, email] of [
      ["identity_case_one", "subject-case-one", "Case@Example.test"],
      ["identity_case_two", "subject-case-two", "case@example.test"],
    ]) {
      await db
        .prepare(
          `INSERT INTO admin_identities
           (id, access_subject, email, display_name, role, enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'Case collision', 'support', 1, ?, ?)`,
        )
        .bind(id, subject, email, NOW, NOW)
        .run();
    }

    await expect(applyIamMigration(db)).rejects.toThrow();
    const columns = await db.prepare("PRAGMA table_info(admin_identities)").all<{ name: string }>();
    expect(columns.results.map(({ name }) => name)).toContain("role");
    expect(columns.results.map(({ name }) => name)).not.toContain("role_id");
    expect(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM admin_identities")
          .first<{ count: number }>()
      )?.count,
    ).toBe(2);
    expect(
      await db.prepare("SELECT name FROM sqlite_schema WHERE name = 'admin_roles'").first(),
    ).toBeNull();
  });

  test("reapplying migrations is controlled", async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const applied = await env.DB.prepare("SELECT COUNT(*) AS count FROM d1_migrations").first<{
      count: number;
    }>();
    expect(applied?.count).toBe(env.TEST_MIGRATIONS.length);
  });

  test("a failed batch rolls back and leaves the database recoverable", async () => {
    await expect(
      env.DB.batch([
        env.DB.prepare(
          "INSERT INTO warehouses (id, code, name, created_at) VALUES (?, ?, ?, ?)",
        ).bind("wh_recovery", "RECOVERY", "Recovery", "2026-07-30T00:00:00.000Z"),
        env.DB.prepare(
          "INSERT INTO product_variants (id, product_id, sku, title, weight_grams, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          "var_orphan",
          "prd_missing",
          "ORPHAN",
          "Orphan",
          100,
          "active",
          "2026-07-30T00:00:00.000Z",
          "2026-07-30T00:00:00.000Z",
        ),
      ]),
    ).rejects.toThrow();

    expect(
      await env.DB.prepare("SELECT id FROM warehouses WHERE id = ?").bind("wh_recovery").first(),
    ).toBeNull();
    expect(
      (await env.DB.prepare("PRAGMA quick_check").first<{ quick_check: string }>())?.quick_check,
    ).toBe("ok");
  });
});
