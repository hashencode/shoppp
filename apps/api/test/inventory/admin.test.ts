import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin, seedServiceAdmin } from "../fixtures/admin-iam";

function appFor(subject: string) {
  return createApp({
    accessVerifier: async () => ({
      email: `${subject}@example.test`,
      principalKind: "human",
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
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
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
    await seedHumanAdmin(env.DB, {
      email: "inventory-operator@example.test",
      id: "admin-inventory-operator",
      roleId: ADMIN_ROLE_IDS.operations,
      subject: "inventory-operator",
    });
    await seedHumanAdmin(env.DB, {
      email: "inventory-viewer@example.test",
      id: "admin-inventory-viewer",
      roleId: ADMIN_ROLE_IDS.support,
      subject: "inventory-viewer",
    });
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
    const detailBody = (await detail.json()) as {
      data: { history: Record<string, unknown>[]; position: Record<string, unknown> };
    };
    expect(detailBody.data.position).toMatchObject({ available: 3, onHand: 3, reserved: 0 });
    expect(detailBody.data.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor_name: "inventory-operator",
          quantity_delta: 2,
          reason: "Cycle count correction",
          reference_type: "manual_adjustment",
        }),
      ]),
    );
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

  test("attributes an authorized service adjustment to a machine actor", async () => {
    await seedServiceAdmin(env.DB, {
      id: "service-inventory-automation",
      roleId: ADMIN_ROLE_IDS.operations,
      subject: "inventory-automation",
    });
    const app = createApp({
      accessVerifier: async () => ({
        principalKind: "service",
        serviceName: "inventory-automation",
        subject: "inventory-automation",
      }),
    });
    const response = await app.fetch(
      request("/admin/inventory/var_fixture_0001/wh_primary/adjustments", {
        body: JSON.stringify({ quantityDelta: 1, reason: "Automated reconciliation" }),
        headers: { "Idempotency-Key": "inventory-service-adjust-0001" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(201);
    expect(
      await env.DB.prepare(
        "SELECT actor_id, actor_type FROM audit_events WHERE action = 'inventory.adjust' AND reason = ?",
      )
        .bind("Automated reconciliation")
        .first(),
    ).toEqual({ actor_id: "service-inventory-automation", actor_type: "machine" });
  });
});
