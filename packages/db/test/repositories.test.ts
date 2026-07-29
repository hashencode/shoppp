import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { reserveInventory } from "../src/repositories/inventory";
import { recordProviderEvent } from "../src/repositories/payment-events";
import { seedLaunchFixture } from "../seed/apply";

describe("D1 repositories", () => {
  beforeEach(async () => {
    await seedLaunchFixture(env.DB);
  });

  test("AE2: two reservation writes cannot both claim the last unit", async () => {
    const attempts = await Promise.allSettled([
      reserveInventory(env.DB, {
        expiresAt: "2026-07-30T00:15:00.000Z",
        id: "res_first",
        quantity: 1,
        variantId: "var_fixture_0001",
        warehouseId: "wh_primary",
      }),
      reserveInventory(env.DB, {
        expiresAt: "2026-07-30T00:15:00.000Z",
        id: "res_second",
        quantity: 1,
        variantId: "var_fixture_0001",
        warehouseId: "wh_primary",
      }),
    ]);

    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(1);
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
});
