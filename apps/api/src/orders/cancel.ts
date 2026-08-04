import type { CancelOrderRequest } from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import type { PaymentProvider } from "../payments/port";
import { createRefundEffect } from "../refunds/service";
import { getOrderDetail } from "./queries";

interface CancellableOrder {
  currency: string;
  fulfillment_status: string;
  grand_total_amount: number;
  id: string;
  order_status: string;
  payment_status: string;
}

async function auditCancellation(
  context: Context<ApiEnvironment>,
  orderId: string,
  reason: string,
  result: "succeeded" | "denied" | "failed",
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const principal = context.get("principal");
  await recordAuditEvent(context.env.DB, {
    action: "orders.cancel",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: `aud_${crypto.randomUUID().replaceAll("-", "")}`,
    metadata,
    reason,
    requestId: context.get("requestId"),
    result,
    targetId: orderId,
    targetType: "order",
  });
}

export async function cancelOrder(
  context: Context<ApiEnvironment>,
  reference: string,
  input: CancelOrderRequest,
  provider: PaymentProvider,
) {
  const order = await context.env.DB.prepare(
    `SELECT id, currency, grand_total_amount, payment_status, order_status, fulfillment_status
       FROM orders WHERE public_reference = ?`,
  )
    .bind(reference)
    .first<CancellableOrder>();
  if (!order) throw new ApiError(404, "order_not_found", "The order was not found.");
  if (order.order_status !== "confirmed" || order.fulfillment_status !== "unfulfilled") {
    await auditCancellation(context, order.id, input.reason, "denied", {
      code: "order_cancellation_ineligible",
      fulfillmentStatus: order.fulfillment_status,
      orderStatus: order.order_status,
    });
    throw new ApiError(
      409,
      "order_cancellation_ineligible",
      "Only an unfulfilled confirmed order can be canceled.",
    );
  }
  const committed = await context.env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS amount,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
       FROM refunds WHERE order_id = ? AND status IN ('pending', 'succeeded')`,
  )
    .bind(order.id)
    .first<{ amount: number; pending: number }>();
  if ((committed?.pending ?? 0) > 0) {
    await auditCancellation(context, order.id, input.reason, "denied", {
      code: "order_refund_pending",
    });
    throw new ApiError(
      409,
      "order_refund_pending",
      "A pending refund must converge before cancellation.",
    );
  }
  const remaining = Math.max(0, order.grand_total_amount - (committed?.amount ?? 0));
  if (remaining > 0) {
    const key = context.req.header("Idempotency-Key");
    if (!key) throw new ApiError(422, "idempotency_key_required", "Idempotency-Key is required.");
    const refund = await createRefundEffect(
      context,
      reference,
      { amount: remaining, confirm: true, reason: input.reason },
      provider,
      `cancel:${key}`,
    );
    if (refund.providerStatus !== "succeeded") {
      await auditCancellation(context, order.id, input.reason, "failed", {
        code: "order_cancellation_refund_pending",
      });
      throw new ApiError(
        409,
        "order_cancellation_refund_pending",
        "Cancellation is waiting for the provider refund.",
      );
    }
  } else if (order.payment_status !== "refunded") {
    await auditCancellation(context, order.id, input.reason, "denied", {
      code: "order_cancellation_payment_ineligible",
    });
    throw new ApiError(
      409,
      "order_cancellation_payment_ineligible",
      "The payment state cannot be canceled.",
    );
  }

  const inventory = await context.env.DB.prepare(
    `SELECT ir.variant_id, ir.warehouse_id, SUM(ir.quantity) AS quantity
       FROM orders o
       JOIN checkout_attempts ca ON ca.id = o.checkout_attempt_id
       JOIN inventory_reservations ir ON ir.group_id = ca.reservation_group_id
      WHERE o.id = ? AND ir.status = 'confirmed'
      GROUP BY ir.variant_id, ir.warehouse_id
      ORDER BY ir.variant_id, ir.warehouse_id`,
  )
    .bind(order.id)
    .all<{ quantity: number; variant_id: string; warehouse_id: string }>();
  const principal = context.get("principal");
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO order_events
         (id, order_id, from_status, to_status, actor_id, reason, created_at)
       VALUES (?, ?, ?, 'canceled', ?, ?, ?)`,
    ).bind(
      `oe_${crypto.randomUUID().replaceAll("-", "")}`,
      order.id,
      order.order_status,
      principal.id,
      input.reason,
      now,
    ),
    ...inventory.results.map((item) =>
      context.env.DB.prepare(
        `INSERT INTO stock_ledger_entries
           (id, variant_id, warehouse_id, quantity_delta, reason, reference_type,
            reference_id, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'order_cancellation', ?, ?, ?)`,
      ).bind(
        `sl_${crypto.randomUUID().replaceAll("-", "")}`,
        item.variant_id,
        item.warehouse_id,
        item.quantity,
        input.reason,
        order.id,
        principal.id,
        now,
      ),
    ),
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO notification_jobs
         (id, order_id, type, deduplication_key, payload_json, status,
          attempt_count, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, 'cancellation', ?, ?, 'pending', 0, ?, ?, ?)`,
    ).bind(
      `notify_cancel_${order.id}`,
      order.id,
      `order.cancellation:${order.id}`,
      JSON.stringify({ orderId: order.id }),
      now,
      now,
      now,
    ),
  ]);
  await auditCancellation(context, order.id, input.reason, "succeeded", {
    inventoryPositionsReturned: inventory.results.length,
  });
  return getOrderDetail(context, reference);
}
