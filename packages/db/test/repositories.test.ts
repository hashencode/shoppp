import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import { ADMIN_PERMISSION_KEYS } from "@shoppp/contracts";

import { InsufficientInventoryError, reserveInventory } from "../src/repositories/inventory";
import { recordProviderEvent } from "../src/repositories/payment-events";
import { seedLaunchFixture } from "../seed/apply";

describe("D1 repositories", () => {
  beforeEach(async () => {
    await seedLaunchFixture(env.DB);
  });

  test("AE2: two reservation writes cannot both claim the last unit", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const attempts = await Promise.allSettled([
      reserveInventory(env.DB, {
        expiresAt,
        id: "res_first",
        quantity: 1,
        variantId: "var_fixture_0001",
        warehouseId: "wh_primary",
      }),
      reserveInventory(env.DB, {
        expiresAt,
        id: "res_second",
        quantity: 1,
        variantId: "var_fixture_0001",
        warehouseId: "wh_primary",
      }),
    ]);

    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.filter(
      (attempt): attempt is PromiseRejectedResult => attempt.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(InsufficientInventoryError);
    const inventory = await env.DB.prepare(
      "SELECT on_hand_quantity, reserved_quantity FROM inventory_items WHERE variant_id = ? AND warehouse_id = ?",
    )
      .bind("var_fixture_0001", "wh_primary")
      .first<{ on_hand_quantity: number; reserved_quantity: number }>();
    expect(inventory).toEqual({ on_hand_quantity: 1, reserved_quantity: 1 });
  });

  test("AE3: duplicate provider event identifiers create one durable record", async () => {
    const input = {
      id: "evt_internal_0001",
      payloadHash: "sha256:fixture",
      provider: "stripe",
      providerEventId: "evt_provider_0001",
      receivedAt: "2026-07-30T00:00:00.000Z",
      type: "checkout.session.completed",
    };

    expect((await recordProviderEvent(env.DB, input)).created).toBe(true);
    expect(
      (
        await recordProviderEvent(env.DB, {
          ...input,
          id: "evt_internal_duplicate",
        })
      ).created,
    ).toBe(false);
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM payment_events WHERE provider = ? AND provider_event_id = ?",
        )
          .bind(input.provider, input.providerEventId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });

  test("immutable order-line snapshots reject update and delete", async () => {
    await expect(
      env.DB.prepare("UPDATE order_lines SET unit_price_amount = 1 WHERE id = ?")
        .bind("line_fixture_0001")
        .run(),
    ).rejects.toThrow("immutable");
    await expect(
      env.DB.prepare("DELETE FROM order_lines WHERE id = ?").bind("line_fixture_0001").run(),
    ).rejects.toThrow("immutable");
  });

  test("keeps seeded roles data-driven and the protected admin equal to the permission catalog", async () => {
    const roles = await env.DB.prepare(
      `SELECT role.key, role.protected, role.system, role.enabled,
              COUNT(role_permission.permission_key) AS permissionCount
         FROM admin_roles role
         LEFT JOIN admin_role_permissions role_permission ON role_permission.role_id = role.id
        GROUP BY role.id
        ORDER BY role.key`,
    ).all<{
      enabled: number;
      key: string;
      permissionCount: number;
      protected: number;
      system: number;
    }>();
    expect(roles.results).toEqual([
      {
        enabled: 1,
        key: "admin",
        permissionCount: ADMIN_PERMISSION_KEYS.length,
        protected: 1,
        system: 1,
      },
      { enabled: 1, key: "analyst", permissionCount: 5, protected: 0, system: 1 },
      { enabled: 1, key: "catalog_manager", permissionCount: 4, protected: 0, system: 1 },
      { enabled: 1, key: "operations", permissionCount: 10, protected: 0, system: 1 },
      { enabled: 1, key: "support", permissionCount: 3, protected: 0, system: 1 },
    ]);
    expect(
      (
        await env.DB.prepare(
          `SELECT permission_key
             FROM admin_role_permissions
            WHERE role_id = 'role_admin'
            ORDER BY permission_key`,
        ).all<{ permission_key: string }>()
      ).results.map(({ permission_key }) => permission_key),
    ).toEqual([...ADMIN_PERMISSION_KEYS].sort());
  });
});
