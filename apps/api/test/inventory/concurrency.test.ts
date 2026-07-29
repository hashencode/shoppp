import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import {
  confirmInventoryReservation,
  releaseInventoryReservation,
  reserveInventoryGroup,
} from "@shoppp/db";

import { expireDueReservations } from "../../src/inventory/expiry";
import { seedLaunchFixture } from "../../../../packages/db/seed/apply";

const CREATED_AT = "2026-07-30T00:00:00.000Z";
const EXPIRES_AT = "2026-07-30T00:30:00.000Z";

function groupInput(index: number) {
  return {
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
    id: `irg_concurrency_${index.toString().padStart(3, "0")}`,
    lines: [
      {
        id: `ir_concurrency_${index.toString().padStart(3, "0")}`,
        quantity: 1,
        variantId: "var_fixture_0001",
        warehouseId: "wh_primary",
      },
    ],
  };
}

async function inventory() {
  return env.DB.prepare(
    `SELECT on_hand_quantity, reserved_quantity, oversell_limit
       FROM inventory_items WHERE variant_id = 'var_fixture_0001' AND warehouse_id = 'wh_primary'`,
  ).first<{
    on_hand_quantity: number;
    oversell_limit: number;
    reserved_quantity: number;
  }>();
}

describe("inventory reservation concurrency and lifecycle on D1", () => {
  beforeEach(async () => {
    await seedLaunchFixture(env.DB);
    const active = await env.DB.prepare(
      "SELECT id FROM inventory_reservation_groups WHERE status = 'active'",
    ).all<{ id: string }>();
    for (const group of active.results) {
      await releaseInventoryReservation(env.DB, group.id, CREATED_AT);
    }
    await env.DB.prepare(
      `UPDATE inventory_items
          SET on_hand_quantity = 1, reserved_quantity = 0, oversell_limit = 0
        WHERE variant_id = 'var_fixture_0001' AND warehouse_id = 'wh_primary'`,
    ).run();
  });

  test("AE2: fifty concurrent attempts yield exactly one claim on the last unit", async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 50 }, (_, index) => reserveInventoryGroup(env.DB, groupInput(index))),
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(49);
    expect(await inventory()).toEqual({
      on_hand_quantity: 1,
      oversell_limit: 0,
      reserved_quantity: 1,
    });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM inventory_reservation_groups WHERE id LIKE 'irg_concurrency_%'",
        ).first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });

  test("AE4: exact-boundary expiry releases stock once without a paid-order side effect", async () => {
    const ordersBefore = await env.DB.prepare("SELECT COUNT(*) AS count FROM orders").first<{
      count: number;
    }>();
    await reserveInventoryGroup(env.DB, groupInput(100));

    expect(await expireDueReservations(env.DB, EXPIRES_AT)).toEqual({
      examined: 1,
      expired: 1,
    });
    expect(await expireDueReservations(env.DB, EXPIRES_AT)).toEqual({
      examined: 0,
      expired: 0,
    });
    expect((await inventory())?.reserved_quantity).toBe(0);
    expect(
      await env.DB.prepare(
        `SELECT event_type, COUNT(*) AS count
           FROM inventory_reservation_events
          WHERE group_id = ?
          GROUP BY event_type ORDER BY event_type`,
      )
        .bind(groupInput(100).id)
        .all(),
    ).toMatchObject({
      results: [
        { count: 1, event_type: "created" },
        { count: 1, event_type: "expired" },
      ],
    });
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM orders").first()).toEqual(
      ordersBefore,
    );
    expect(
      (
        await env.DB.prepare("SELECT COUNT(*) AS count FROM payment_events").first<{
          count: number;
        }>()
      )?.count,
    ).toBe(0);
  });

  test("duplicate release and confirmation calls converge on one terminal event", async () => {
    await env.DB.prepare(
      `UPDATE inventory_items
          SET on_hand_quantity = 3
        WHERE variant_id = 'var_fixture_0001' AND warehouse_id = 'wh_primary'`,
    ).run();
    await reserveInventoryGroup(env.DB, groupInput(200));
    expect((await releaseInventoryReservation(env.DB, groupInput(200).id))?.changed).toBe(true);
    expect((await releaseInventoryReservation(env.DB, groupInput(200).id))?.changed).toBe(false);

    await reserveInventoryGroup(env.DB, groupInput(201));
    expect((await confirmInventoryReservation(env.DB, groupInput(201).id))?.changed).toBe(true);
    expect((await confirmInventoryReservation(env.DB, groupInput(201).id))?.changed).toBe(false);
    expect((await releaseInventoryReservation(env.DB, groupInput(201).id))?.status).toBe(
      "confirmed",
    );
    const events = await env.DB.prepare(
      `SELECT group_id, event_type, COUNT(*) AS count
         FROM inventory_reservation_events
        WHERE group_id IN (?, ?)
        GROUP BY group_id, event_type
        ORDER BY group_id, event_type`,
    )
      .bind(groupInput(200).id, groupInput(201).id)
      .all();
    expect(events.results).toEqual([
      { count: 1, event_type: "created", group_id: groupInput(200).id },
      { count: 1, event_type: "released", group_id: groupInput(200).id },
      { count: 1, event_type: "confirmed", group_id: groupInput(201).id },
      { count: 1, event_type: "created", group_id: groupInput(201).id },
    ]);
    expect(await inventory()).toEqual({
      on_hand_quantity: 2,
      oversell_limit: 0,
      reserved_quantity: 0,
    });
  });

  test("zero stock rejects while one configured oversell unit succeeds", async () => {
    await env.DB.prepare(
      `UPDATE inventory_items
          SET on_hand_quantity = 0, oversell_limit = 0
        WHERE variant_id = 'var_fixture_0001' AND warehouse_id = 'wh_primary'`,
    ).run();
    await expect(reserveInventoryGroup(env.DB, groupInput(300))).rejects.toThrow(
      "no longer available",
    );

    await env.DB.prepare(
      `UPDATE inventory_items
          SET oversell_limit = 1
        WHERE variant_id = 'var_fixture_0001' AND warehouse_id = 'wh_primary'`,
    ).run();
    await expect(reserveInventoryGroup(env.DB, groupInput(301))).resolves.toMatchObject({
      status: "active",
    });
    await expect(reserveInventoryGroup(env.DB, groupInput(302))).rejects.toThrow(
      "no longer available",
    );
    expect(await inventory()).toEqual({
      on_hand_quantity: 0,
      oversell_limit: 1,
      reserved_quantity: 1,
    });
  });
});
