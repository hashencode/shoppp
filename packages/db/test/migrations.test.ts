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
        "carts",
        "catalog_releases",
        "checkout_attempts",
        "fulfillment_events",
        "idempotency_claims",
        "inventory_items",
        "inventory_reservations",
        "notification_jobs",
        "order_lines",
        "orders",
        "payment_events",
        "prices",
        "product_variants",
        "products",
        "stock_ledger_entries",
      ]),
    );

    await seedLaunchFixture(env.DB);
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
