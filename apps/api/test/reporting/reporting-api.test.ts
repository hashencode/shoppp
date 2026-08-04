import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const NOW = "2026-07-30T00:00:00.000Z";
const WINDOW_QUERY =
  "currency=USD&startDate=2026-07-29&endDate=2026-07-29&timeZone=America%2FNew_York";

async function seedReportingOrder(input: {
  amount: number;
  currency?: string;
  environment?: string;
  paymentStatus: string;
  reference: string;
  testMode?: boolean;
}): Promise<string> {
  const suffix = input.reference.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  const checkoutId = `checkout_report_${suffix}`;
  const orderId = `ord_report_${suffix}`;
  const currency = input.currency ?? "USD";
  const environment = input.environment ?? "staging";
  const testMode = input.testMode ? 1 : 0;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO inventory_reservation_groups
         (id, cart_id, idempotency_key, status, expires_at, created_at, updated_at)
       VALUES (?, 'cart_fixture_0001', ?, 'active',
               '2026-07-30T00:30:00.000Z', ?, ?)`,
    ).bind(`irg_report_${suffix}`, `report-reservation-${suffix}`, NOW, NOW),
    env.DB.prepare(
      `INSERT OR IGNORE INTO checkout_attempts
         (id, cart_id, reservation_group_id, provider, environment, test_mode, idempotency_key, currency,
          subtotal_amount, discount_amount, shipping_amount, tax_amount,
          grand_total_amount, shipping_address_json, email, status, created_at, updated_at)
       VALUES (?, 'cart_fixture_0001', ?, 'stripe', ?, ?, ?, ?, ?, 0, 0, 0, ?,
               '{}', 'report@example.test', 'completed', ?, ?)`,
    ).bind(
      checkoutId,
      `irg_report_${suffix}`,
      environment,
      testMode,
      `report-key-${suffix}`,
      currency,
      input.amount,
      input.amount,
      NOW,
      NOW,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO orders
         (id, public_reference, guest_access_token_hash, checkout_attempt_id,
          environment, test_mode, email, currency, subtotal_amount, discount_amount,
          shipping_amount, tax_amount, grand_total_amount, payment_status,
          order_status, fulfillment_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'report@example.test', ?, ?, 0, 0, 0, ?, ?,
               ?, 'unfulfilled', ?, ?)`,
    ).bind(
      orderId,
      input.reference,
      `report-hash-${suffix}`,
      checkoutId,
      environment,
      testMode,
      currency,
      input.amount,
      input.amount,
      input.paymentStatus,
      input.paymentStatus === "refunded" ? "canceled" : "confirmed",
      NOW,
      NOW,
    ),
  ]);
  return orderId;
}

function appFor(subject: string) {
  return createApp({
    testIdentityVerifier: async () => ({
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
      "X-Test-Admin-Identity": "test-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...init.headers,
    },
  });
}

let exportId = "";

beforeAll(async () => {
  await seedLaunchFixture(env.DB);
  await seedHumanAdmin(env.DB, {
    email: "report-analyst@example.test",
    id: "admin-report-analyst",
    roleId: ADMIN_ROLE_IDS.analyst,
    subject: "report-analyst",
  });
  await seedHumanAdmin(env.DB, {
    email: "other-analyst@example.test",
    id: "admin-other-analyst",
    roleId: ADMIN_ROLE_IDS.analyst,
    subject: "other-analyst",
  });
  await seedHumanAdmin(env.DB, {
    email: "report-support@example.test",
    id: "admin-report-support",
    roleId: ADMIN_ROLE_IDS.support,
    subject: "report-support",
  });
  const partialOrderId = await seedReportingOrder({
    amount: 2_500,
    paymentStatus: "partially_refunded",
    reference: "ORD-REPORT01",
  });
  const canceledOrderId = await seedReportingOrder({
    amount: 1_000,
    paymentStatus: "refunded",
    reference: "ORD-CANCEL01",
  });
  await seedReportingOrder({
    amount: 700,
    paymentStatus: "failed",
    reference: "ORD-FAILED01",
  });
  await seedReportingOrder({
    amount: 99_900,
    paymentStatus: "paid",
    reference: "ORD-TESTMODE1",
    testMode: true,
  });
  await seedReportingOrder({
    amount: 88_800,
    environment: "production",
    paymentStatus: "paid",
    reference: "ORD-PRODENV1",
  });
  await seedReportingOrder({
    amount: 77_700,
    currency: "EUR",
    paymentStatus: "paid",
    reference: "ORD-EURONLY1",
  });
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO refunds
         (id, order_id, amount, currency, reason, status, completed_at, created_at, updated_at)
       VALUES ('refund_report_partial', ?, 500, 'USD',
               'Partial return', 'succeeded', '2026-07-30T02:00:00.000Z',
               '2026-07-30T01:59:00.000Z', '2026-07-30T02:00:00.000Z')`,
    ).bind(partialOrderId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO refunds
         (id, order_id, amount, currency, reason, status, completed_at, created_at, updated_at)
       VALUES ('refund_report_cancel', ?, 1000, 'USD',
               'Cancellation', 'succeeded', '2026-07-30T03:00:00.000Z',
               '2026-07-30T02:59:00.000Z', '2026-07-30T03:00:00.000Z')`,
    ).bind(canceledOrderId),
  ]);
});

describe("commerce reporting API", () => {
  test("reconciles currency-safe dashboard metrics and order drill-down", async () => {
    const app = appFor("report-analyst");
    const response = await app.fetch(request(`/admin/reporting/revenue?${WINDOW_QUERY}`), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        comparison: {
          endDate: "2026-07-28",
          metrics: {
            grossSales: 0,
            netSales: 0,
            orderCount: 0,
            refundTotal: 0,
          },
          startDate: "2026-07-28",
        },
        currency: "USD",
        current: {
          endDate: "2026-07-29",
          metrics: {
            averageOrderValue: 1_750,
            grossSales: 3_500,
            netSales: 2_000,
            orderCount: 2,
            refundTotal: 1_500,
          },
          startDate: "2026-07-29",
        },
        timeZone: "America/New_York",
      },
    });

    const drillDown = await app.fetch(
      request(`/admin/reporting/orders?${WINDOW_QUERY}&page=1&pageSize=20`),
      env,
    );
    expect(drillDown.status).toBe(200);
    const body = (await drillDown.json()) as {
      data: Array<{
        grossContribution: number;
        netContribution: number;
        publicReference: string;
        refundContribution: number;
      }>;
      meta: { currency: string; timeZone: string; total: number };
    };
    expect(body.meta).toMatchObject({
      currency: "USD",
      timeZone: "America/New_York",
      total: 2,
    });
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          grossContribution: 2_500,
          netContribution: 2_000,
          publicReference: "ORD-REPORT01",
          refundContribution: 500,
        }),
        expect.objectContaining({
          grossContribution: 1_000,
          netContribution: 0,
          publicReference: "ORD-CANCEL01",
          refundContribution: 1_000,
        }),
      ]),
    );
    expect(body.data.reduce((sum, row) => sum + row.netContribution, 0)).toBe(2_000);
  });

  test("creates a scoped, audited R2 export and only allows its owner to download it", async () => {
    const app = appFor("report-analyst");
    const response = await app.fetch(
      request("/admin/reporting/exports", {
        body: JSON.stringify({
          confirm: true,
          currency: "USD",
          endDate: "2026-07-29",
          reason: "Finance reconciliation",
          startDate: "2026-07-29",
          timeZone: "America/New_York",
        }),
        headers: { "Idempotency-Key": "report-export-001" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(202);
    const body = (await response.json()) as {
      data: { id: string; rowCount: number; status: string };
    };
    exportId = body.data.id;
    expect(body.data).toMatchObject({ rowCount: 2, status: "ready" });

    const download = await app.fetch(request(`/admin/reporting/exports/${exportId}/download`), env);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain("text/csv");
    const csv = await download.text();
    expect(csv).toContain("ORD-REPORT01");
    expect(csv).toContain("ORD-CANCEL01");
    expect(csv).not.toContain("ORD-EURONLY1");
    expect(csv).not.toContain("ORD-TESTMODE1");
    expect(csv).not.toContain("ORD-PRODENV1");
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM audit_events
          WHERE target_id = ? AND action IN ('report.export.create', 'report.export.download')`,
      )
        .bind(exportId)
        .first(),
    ).toEqual({ count: 2 });

    const other = appFor("other-analyst");
    expect(
      (await other.fetch(request(`/admin/reporting/exports/${exportId}/download`), env)).status,
    ).toBe(403);
  });

  test("defers a range larger than the interactive threshold and completes it in R2", async () => {
    const executionContext = createExecutionContext();
    const response = await appFor("report-analyst").fetch(
      request("/admin/reporting/exports", {
        body: JSON.stringify({
          confirm: true,
          currency: "USD",
          endDate: "2026-07-29",
          reason: "Quarterly reconciliation",
          startDate: "2026-06-01",
          timeZone: "America/New_York",
        }),
        headers: { "Idempotency-Key": "report-export-async-001" },
        method: "POST",
      }),
      env,
      executionContext,
    );
    expect(response.status).toBe(202);
    const body = (await response.json()) as { data: { id: string; status: string } };
    expect(["pending", "processing"]).toContain(body.data.status);
    await waitOnExecutionContext(executionContext);
    const stored = await env.DB.prepare(
      "SELECT status, object_key, row_count FROM report_exports WHERE id = ?",
    )
      .bind(body.data.id)
      .first<{ object_key: string; row_count: number; status: string }>();
    expect(stored).toMatchObject({ row_count: 2, status: "ready" });
    expect(await env.REPORT_EXPORTS.head(stored!.object_key)).not.toBeNull();
  });

  test("denies export creation and download without permission, then expires files", async () => {
    const support = appFor("report-support");
    expect(
      (await support.fetch(request(`/admin/reporting/revenue?${WINDOW_QUERY}`), env)).status,
    ).toBe(403);
    expect(
      (
        await support.fetch(
          request("/admin/reporting/exports", {
            body: JSON.stringify({
              confirm: true,
              currency: "USD",
              endDate: "2026-07-29",
              reason: "Unauthorized export",
              startDate: "2026-07-29",
              timeZone: "America/New_York",
            }),
            headers: { "Idempotency-Key": "report-export-denied" },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (await support.fetch(request(`/admin/reporting/exports/${exportId}/download`), env)).status,
    ).toBe(403);

    await env.DB.prepare("UPDATE report_exports SET expires_at = ? WHERE id = ?")
      .bind("2026-01-01T00:00:00.000Z", exportId)
      .run();
    expect(
      (
        await appFor("report-analyst").fetch(
          request(`/admin/reporting/exports/${exportId}/download`),
          env,
        )
      ).status,
    ).toBe(410);
  });
});
