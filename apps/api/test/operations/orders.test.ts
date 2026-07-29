import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import { createApp } from "../../src/http/app";
import type {
  CreateHostedSessionInput,
  CreateRefundInput,
  PaymentProvider,
  ProviderRefund,
  ProviderSession,
  VerifiedProviderEvent,
} from "../../src/payments/port";

const NOW = "2026-07-30T00:00:00.000Z";
let operationSequence = 0;

async function seedOperator(role: string, subject: string): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO admin_identities
       (id, access_subject, email, display_name, role, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(`admin-${subject}`, subject, `${subject}@example.test`, subject, role, NOW, NOW)
    .run();
}

async function seedOperationalOrder(label: string) {
  operationSequence += 1;
  const suffix = `${label}_${operationSequence}`;
  const orderId = `ord_${suffix}`;
  const reference = `ORD-${label.toUpperCase()}${operationSequence.toString().padStart(4, "0")}`;
  const variantId = `var_${suffix}`;
  const checkoutId = `checkout_${suffix}`;
  const cartId = `cart_${suffix}`;
  const groupId = `irg_${suffix}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO products
         (id, slug, name, description, status, seo_title, seo_description,
          published_at, created_at, updated_at)
       VALUES (?, ?, ?, 'Operations fixture', 'published', ?, 'Operations fixture', ?, ?, ?)`,
    ).bind(
      `prd_${suffix}`,
      `operations-${suffix}`,
      `Operations ${label}`,
      `Operations ${label}`,
      NOW,
      NOW,
      NOW,
    ),
    env.DB.prepare(
      `INSERT INTO product_variants
         (id, product_id, sku, title, option_values_json, weight_grams, status,
          created_at, updated_at)
       VALUES (?, ?, ?, 'Default', '{}', 100, 'active', ?, ?)`,
    ).bind(variantId, `prd_${suffix}`, `OPS-${operationSequence}`, NOW, NOW),
    env.DB.prepare(
      `INSERT INTO inventory_items
         (variant_id, warehouse_id, on_hand_quantity, reserved_quantity,
          oversell_limit, version, updated_at)
       VALUES (?, 'wh_primary', 2, 0, 0, 0, ?)`,
    ).bind(variantId, NOW),
    env.DB.prepare(
      `INSERT INTO carts
         (id, public_token_hash, currency, pricing_context_json, promotion_context_json,
          status, expires_at, created_at, updated_at)
       VALUES (?, ?, 'USD', '{}', '{}', 'active', '2026-07-31T00:00:00.000Z', ?, ?)`,
    ).bind(cartId, `hash_${suffix}`, NOW, NOW),
    env.DB.prepare(
      `INSERT INTO inventory_reservation_groups
         (id, cart_id, idempotency_key, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, 'active', '2026-07-30T00:30:00.000Z', ?, ?)`,
    ).bind(groupId, cartId, `reserve_${suffix}`, NOW, NOW),
    env.DB.prepare(
      `INSERT INTO inventory_reservations
         (id, group_id, cart_id, checkout_attempt_id, variant_id, warehouse_id,
          quantity, status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'wh_primary', 1, 'active',
               '2026-07-30T00:30:00.000Z', ?, ?)`,
    ).bind(`ir_${suffix}`, groupId, cartId, checkoutId, variantId, NOW, NOW),
    env.DB.prepare(
      `INSERT INTO checkout_attempts
         (id, cart_id, reservation_group_id, provider, provider_session_id,
          provider_payment_id, idempotency_key, currency, subtotal_amount,
          discount_amount, shipping_amount, tax_amount, grand_total_amount,
          shipping_address_json, email, snapshot_json, guest_access_token_hash,
          guest_access_expires_at, status, created_at, updated_at)
       VALUES (?, ?, ?, 'stripe', ?, ?, ?, 'USD', 2500, 0, 0, 0, 2500,
               ?, 'operator-fixture@example.test', '{}', ?,
               '2026-08-29T00:00:00.000Z', 'payment_pending', ?, ?)`,
    ).bind(
      checkoutId,
      cartId,
      groupId,
      `cs_${suffix}`,
      `pi_${suffix}`,
      `checkout_key_${suffix}`,
      JSON.stringify({
        city: "Portland",
        countryCode: "US",
        line1: "100 Market Street",
        name: "Operations Shopper",
        postalCode: "97205",
        region: "OR",
      }),
      `guest_hash_${suffix}`,
      NOW,
      NOW,
    ),
    env.DB.prepare(
      `INSERT INTO orders
         (id, public_reference, guest_access_token_hash, guest_access_expires_at,
          checkout_attempt_id, provider_payment_id, email, currency, subtotal_amount,
          discount_amount, shipping_amount, tax_amount, grand_total_amount,
          payment_status, order_status, fulfillment_status, created_at, updated_at)
       VALUES (?, ?, ?, '2026-08-29T00:00:00.000Z', ?, ?,
               'operator-fixture@example.test', 'USD', 2500, 0, 0, 0, 2500,
               'paid', 'confirmed', 'unfulfilled', ?, ?)`,
    ).bind(orderId, reference, `guest_hash_${suffix}`, checkoutId, `pi_${suffix}`, NOW, NOW),
    env.DB.prepare(
      `INSERT INTO order_addresses
         (id, order_id, kind, name, line1, city, region, postal_code, country_code)
       VALUES (?, ?, 'shipping', 'Operations Shopper', '100 Market Street',
               'Portland', 'OR', '97205', 'US')`,
    ).bind(`oa_${suffix}`, orderId),
    env.DB.prepare(
      `INSERT INTO order_lines
         (id, order_id, product_id, variant_id, sku, product_name, variant_name,
          option_values_json, quantity, unit_price_amount, discount_amount,
          tax_amount, line_total_amount, currency)
       VALUES (?, ?, ?, ?, ?, ?, 'Default', '{}', 1, 2500, 0, 0, 2500, 'USD')`,
    ).bind(
      `ol_${suffix}`,
      orderId,
      `prd_${suffix}`,
      variantId,
      `OPS-${operationSequence}`,
      `Operations ${label}`,
    ),
  ]);
  return { orderId, reference, variantId };
}

class OperationsPaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly refunds = new Map<string, ProviderRefund>();
  readonly createRefund = vi.fn(async (input: CreateRefundInput): Promise<ProviderRefund> => {
    const refund = {
      amount: input.amount,
      createdAt: NOW,
      currency: input.currency,
      id: `re_test_${input.refundId}`,
      paymentId: input.paymentId,
      status: "succeeded" as const,
    };
    this.refunds.set(refund.id, refund);
    return refund;
  });

  async createHostedSession(_input: CreateHostedSessionInput): Promise<ProviderSession> {
    throw new Error("Checkout is outside this operations test.");
  }

  async retrieveRefund(id: string): Promise<ProviderRefund> {
    const refund = this.refunds.get(id);
    if (!refund) throw new Error("Refund not found.");
    return refund;
  }

  async retrieveSession(_id: string): Promise<ProviderSession> {
    throw new Error("Checkout is outside this operations test.");
  }

  async verifyWebhook(_raw: string, _signature: string): Promise<VerifiedProviderEvent> {
    throw new Error("Webhooks are outside this operations test.");
  }
}

function appFor(subject: string, paymentProvider?: PaymentProvider) {
  return createApp({
    accessVerifier: async () => ({
      email: `${subject}@example.test`,
      subject,
    }),
    ...(paymentProvider ? { paymentProvider } : {}),
  });
}

function request(
  path: string,
  subject: string,
  init: RequestInit = {},
  idempotencyKey?: string,
): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...init.headers,
    },
  });
}

describe("order operations", () => {
  beforeEach(async () => {
    await seedLaunchFixture(env.DB);
    await seedOperator("operations", "order-operator");
    await seedOperator("support", "order-viewer");
  });

  test("lists searchable orders and exposes one immutable operational timeline", async () => {
    const app = appFor("order-operator");
    const list = await app.fetch(
      request(
        "/admin/orders?query=ORD-FIXTURE1&paymentStatus=paid&page=1&pageSize=20",
        "order-operator",
      ),
      env,
    );
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({
      data: [
        {
          fulfillmentStatus: "unfulfilled",
          grandTotal: 2500,
          paymentStatus: "paid",
          publicReference: "ORD-FIXTURE1",
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1 },
    });

    const detail = await app.fetch(request("/admin/orders/ORD-FIXTURE1", "order-operator"), env);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      data: {
        allowedActions: {
          cancel: true,
          fulfill: ["picking"],
          refundMaximum: 2500,
        },
        facts: {
          email: "shopper@example.test",
          lines: [{ productName: "Fixture Product 0001", quantity: 1 }],
          publicReference: "ORD-FIXTURE1",
        },
        timeline: expect.arrayContaining([
          expect.objectContaining({ kind: "notification", label: "order_receipt" }),
        ]),
      },
    });
  });

  test("moves a paid order through picking, packed, and one shipment", async () => {
    const operation = await seedOperationalOrder("ship");
    const app = appFor("order-operator");
    for (const [index, input] of [
      { confirm: true, reason: "Started warehouse pick", toStatus: "picking" },
      { confirm: true, reason: "Packing complete", toStatus: "packed" },
      {
        carrier: "DHL",
        confirm: true,
        reason: "Handed to carrier",
        toStatus: "shipped",
        trackingNumber: "DHL-TRACK-001",
      },
    ].entries()) {
      const response = await app.fetch(
        request(
          `/admin/orders/${operation.reference}/fulfillment`,
          "order-operator",
          { body: JSON.stringify(input), method: "POST" },
          `fulfillment-transition-${index}`,
        ),
        env,
      );
      expect(response.status).toBe(200);
    }

    const replayedShipment = await app.fetch(
      request(
        `/admin/orders/${operation.reference}/fulfillment`,
        "order-operator",
        {
          body: JSON.stringify({
            carrier: "DHL",
            confirm: true,
            reason: "Handed to carrier",
            toStatus: "shipped",
            trackingNumber: "DHL-TRACK-001",
          }),
          method: "POST",
        },
        "fulfillment-transition-2",
      ),
      env,
    );
    expect(replayedShipment.status).toBe(200);
    const repeatedShipment = await app.fetch(
      request(
        `/admin/orders/${operation.reference}/fulfillment`,
        "order-operator",
        {
          body: JSON.stringify({
            carrier: "DHL",
            confirm: true,
            reason: "Repeated shipment",
            toStatus: "shipped",
            trackingNumber: "DHL-TRACK-001",
          }),
          method: "POST",
        },
        "fulfillment-repeated-shipment",
      ),
      env,
    );
    expect(repeatedShipment.status).toBe(409);
    expect(await repeatedShipment.json()).toMatchObject({
      error: { code: "fulfillment_transition_conflict" },
    });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM fulfillment_events WHERE order_id = ? AND to_status = 'shipped'",
        )
          .bind(operation.orderId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect(
      await env.DB.prepare("SELECT fulfillment_status, order_status FROM orders WHERE id = ?")
        .bind(operation.orderId)
        .first(),
    ).toEqual({ fulfillment_status: "shipped", order_status: "processing" });
  });

  test("denies fulfillment before approval and audits the invalid transition", async () => {
    const operation = await seedOperationalOrder("unpaid");
    await env.DB.prepare(
      `UPDATE orders
          SET payment_status = 'pending'
        WHERE id = ?`,
    )
      .bind(operation.orderId)
      .run();
    const response = await appFor("order-operator").fetch(
      request(
        `/admin/orders/${operation.reference}/fulfillment`,
        "order-operator",
        {
          body: JSON.stringify({
            confirm: true,
            reason: "Should not start",
            toStatus: "picking",
          }),
          method: "POST",
        },
        "fulfillment-denied-unpaid",
      ),
      env,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "fulfillment_payment_not_approved" },
    });
    expect(
      await env.DB.prepare(
        `SELECT action, result
           FROM audit_events
          WHERE action = 'orders.fulfill' AND target_id = ?
          ORDER BY created_at DESC LIMIT 1`,
      )
        .bind(operation.orderId)
        .first(),
    ).toEqual({ action: "orders.fulfill", result: "denied" });
  });

  test("a view-only operator cannot refund through the direct API", async () => {
    const response = await appFor("order-viewer").fetch(
      request(
        "/admin/orders/ORD-FIXTURE1/refunds",
        "order-viewer",
        {
          body: JSON.stringify({
            amount: 500,
            confirm: true,
            reason: "Customer service adjustment",
          }),
          method: "POST",
        },
        "refund-denied-0001",
      ),
      env,
    );

    expect(response.status).toBe(403);
    expect(
      await env.DB.prepare(
        `SELECT action, result
           FROM audit_events
          WHERE action = 'orders.refund' AND target_id = 'ORD-FIXTURE1'
          ORDER BY created_at DESC LIMIT 1`,
      ).first(),
    ).toEqual({ action: "orders.refund", result: "denied" });
  });

  test("AE5: a provider-confirmed partial refund preserves independent operational state", async () => {
    const operation = await seedOperationalOrder("refund");
    const provider = new OperationsPaymentProvider();
    const app = appFor("order-operator", provider);
    const refundRequest = () =>
      request(
        `/admin/orders/${operation.reference}/refunds`,
        "order-operator",
        {
          body: JSON.stringify({
            amount: 500,
            confirm: true,
            reason: "Customer service adjustment",
          }),
          method: "POST",
        },
        "refund-partial-0001",
      );
    const first = await app.fetch(refundRequest(), env);
    const replay = await app.fetch(refundRequest(), env);

    expect(first.status, await first.clone().text()).toBe(200);
    expect(replay.status).toBe(200);
    expect(await replay.text()).toBe(await first.text());
    expect(provider.createRefund).toHaveBeenCalledTimes(1);
    expect(
      await env.DB.prepare(
        `SELECT payment_status, order_status, fulfillment_status
           FROM orders WHERE id = ?`,
      )
        .bind(operation.orderId)
        .first(),
    ).toEqual({
      fulfillment_status: "unfulfilled",
      order_status: "confirmed",
      payment_status: "partially_refunded",
    });
    expect(
      await env.DB.prepare(
        `SELECT amount, status
           FROM refunds WHERE order_id = ?`,
      )
        .bind(operation.orderId)
        .first(),
    ).toEqual({ amount: 500, status: "succeeded" });
    expect(
      (
        await env.DB.prepare(
          `SELECT COUNT(*) AS count
             FROM notification_jobs
            WHERE order_id = ? AND type = 'refund'`,
        )
          .bind(operation.orderId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect(
      await env.DB.prepare(
        `SELECT on_hand_quantity, reserved_quantity
           FROM inventory_items
          WHERE variant_id = ? AND warehouse_id = 'wh_primary'`,
      )
        .bind(operation.variantId)
        .first(),
    ).toEqual({ on_hand_quantity: 1, reserved_quantity: 0 });
  });

  test("full cancellation refunds the remainder and restores confirmed stock once", async () => {
    const operation = await seedOperationalOrder("cancel");
    const provider = new OperationsPaymentProvider();
    const app = appFor("order-operator", provider);
    const cancelRequest = () =>
      request(
        `/admin/orders/${operation.reference}/cancel`,
        "order-operator",
        {
          body: JSON.stringify({
            confirm: true,
            reason: "Customer canceled before fulfillment",
          }),
          method: "POST",
        },
        "cancel-order-0001",
      );
    const first = await app.fetch(cancelRequest(), env);
    const replay = await app.fetch(cancelRequest(), env);

    expect(first.status, await first.clone().text()).toBe(200);
    expect(replay.status).toBe(200);
    expect(await replay.text()).toBe(await first.text());
    expect(provider.createRefund).toHaveBeenCalledTimes(1);
    expect(
      await env.DB.prepare(
        `SELECT payment_status, order_status, fulfillment_status
           FROM orders WHERE id = ?`,
      )
        .bind(operation.orderId)
        .first(),
    ).toEqual({
      fulfillment_status: "canceled",
      order_status: "canceled",
      payment_status: "refunded",
    });
    expect(
      await env.DB.prepare(
        `SELECT on_hand_quantity, reserved_quantity
           FROM inventory_items
          WHERE variant_id = ? AND warehouse_id = 'wh_primary'`,
      )
        .bind(operation.variantId)
        .first(),
    ).toEqual({ on_hand_quantity: 2, reserved_quantity: 0 });
    expect(
      (
        await env.DB.prepare(
          `SELECT COUNT(*) AS count
             FROM stock_ledger_entries
            WHERE reference_type = 'order_cancellation'
              AND reference_id = ?`,
        )
          .bind(operation.orderId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);

    const shipCanceled = await app.fetch(
      request(
        `/admin/orders/${operation.reference}/fulfillment`,
        "order-operator",
        {
          body: JSON.stringify({
            confirm: true,
            reason: "Should remain canceled",
            toStatus: "picking",
          }),
          method: "POST",
        },
        "fulfillment-canceled-order",
      ),
      env,
    );
    expect(shipCanceled.status).toBe(409);
    expect(await shipCanceled.json()).toMatchObject({
      error: { code: "fulfillment_order_canceled" },
    });
  });

  test("an order already in picking explains why cancellation is blocked", async () => {
    const operation = await seedOperationalOrder("late");
    const provider = new OperationsPaymentProvider();
    const app = appFor("order-operator", provider);
    await app.fetch(
      request(
        `/admin/orders/${operation.reference}/fulfillment`,
        "order-operator",
        {
          body: JSON.stringify({
            confirm: true,
            reason: "Started warehouse pick",
            toStatus: "picking",
          }),
          method: "POST",
        },
        "fulfillment-before-cancel",
      ),
      env,
    );
    const response = await app.fetch(
      request(
        `/admin/orders/${operation.reference}/cancel`,
        "order-operator",
        {
          body: JSON.stringify({
            confirm: true,
            reason: "Too late to cancel",
          }),
          method: "POST",
        },
        "cancel-ineligible-0001",
      ),
      env,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "order_cancellation_ineligible" },
    });
    expect(provider.createRefund).not.toHaveBeenCalled();
  });
});
