import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../seed/apply";

describe("D1 migrations", () => {
  test("migrates a fresh database and accepts a relational launch fixture", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE '_cf_%' ORDER BY name",
    ).all<{ name: string }>();
    expect(tables.results.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "audit_events",
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
    const foreignKeyViolations = await env.DB.prepare("PRAGMA foreign_key_check").all();
    expect(foreignKeyViolations.results).toEqual([]);
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
