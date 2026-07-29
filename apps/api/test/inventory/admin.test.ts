import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import { createApp } from "../../src/http/app";

const NOW = "2026-07-30T00:00:00.000Z";

async function seedOperator(role: string, subject: string): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO admin_identities
       (id, access_subject, email, display_name, role, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(`admin-${subject}`, subject, `${subject}@example.test`, subject, role, NOW, NOW)
    .run();
}

function appFor(subject: string) {
  return createApp({
    accessVerifier: async () => ({
      email: `${subject}@example.test`,
      subject,
    }),
  });
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe("admin inventory adjustments", () => {
  beforeEach(async () => {
    await seedLaunchFixture(env.DB);
    await env.DB.prepare(
      `UPDATE inventory_items
          SET on_hand_quantity = 1, reserved_quantity = 0, oversell_limit = 0
        WHERE variant_id = 'var_fixture_0001' AND warehouse_id = 'wh_primary'`,
    ).run();
    await seedOperator("operations", "inventory-operator");
    await seedOperator("support", "inventory-viewer");
  });

  test("requires adjustment permission and a reason", async () => {
    const denied = await appFor("inventory-viewer").fetch(
      request("/admin/inventory/var_fixture_0001/wh_primary/adjustments", {
        body: JSON.stringify({ quantityDelta: 1, reason: "Cycle count correction" }),
        headers: { "Idempotency-Key": "inventory-denied-0001" },
        method: "POST",
      }),
      env,
    );
    expect(denied.status).toBe(403);

    const invalid = await appFor("inventory-operator").fetch(
      request("/admin/inventory/var_fixture_0001/wh_primary/adjustments", {
        body: JSON.stringify({ quantityDelta: 1, reason: "" }),
        headers: { "Idempotency-Key": "inventory-invalid-0001" },
        method: "POST",
      }),
      env,
    );
    expect(invalid.status).toBe(422);
  });

  test("applies idempotent adjustments and exposes reconcilable append-only history", async () => {
    const app = appFor("inventory-operator");
    const adjustmentRequest = () =>
      request("/admin/inventory/var_fixture_0001/wh_primary/adjustments", {
        body: JSON.stringify({ quantityDelta: 2, reason: "Cycle count correction" }),
        headers: { "Idempotency-Key": "inventory-adjust-0001" },
        method: "POST",
      });
    const first = await app.fetch(adjustmentRequest(), env);
    const replay = await app.fetch(adjustmentRequest(), env);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(await replay.text()).toBe(await first.text());

    const list = await app.fetch(request("/admin/inventory?query=FIX-0001-1"), env);
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({
      data: [
        {
          adjusted: 2,
          available: 3,
          onHand: 3,
          reserved: 0,
          sku: "FIX-0001-1",
        },
      ],
      meta: { total: 1 },
    });

    const detail = await app.fetch(request("/admin/inventory/var_fixture_0001/wh_primary"), env);
    expect(await detail.json()).toMatchObject({
      data: {
        history: [
          {
            actor_name: "inventory-operator",
            quantity_delta: 2,
            reason: "Cycle count correction",
            reference_type: "manual_adjustment",
          },
        ],
        position: { available: 3, onHand: 3, reserved: 0 },
      },
    });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM stock_ledger_entries WHERE reference_type = 'manual_adjustment'",
        ).first<{ count: number }>()
      )?.count,
    ).toBe(1);
    await expect(
      env.DB.prepare(
        "UPDATE stock_ledger_entries SET reason = 'rewritten' WHERE reference_type = 'manual_adjustment'",
      ).run(),
    ).rejects.toThrow("append_only_stock_ledger");
  });

  test("rejects a negative adjustment that would violate stock conservation", async () => {
    const response = await appFor("inventory-operator").fetch(
      request("/admin/inventory/var_fixture_0001/wh_primary/adjustments", {
        body: JSON.stringify({ quantityDelta: -2, reason: "Damaged stock removal" }),
        headers: { "Idempotency-Key": "inventory-negative-0001" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "inventory_adjustment_invalid" },
    });
  });
});
