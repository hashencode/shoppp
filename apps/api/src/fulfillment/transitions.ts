import type { FulfillmentTransitionRequest } from "@shoppp/contracts";
import { transitionFulfillment, type FulfillmentStatus } from "@shoppp/domain";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import { getOrderDetail } from "../orders/queries";

interface OperationalOrder {
  fulfillment_status: FulfillmentStatus;
  id: string;
  order_status: string;
  payment_status: string;
}

async function denied(
  context: Context<ApiEnvironment>,
  order: OperationalOrder,
  code: string,
  reason: string,
): Promise<never> {
  const principal = context.get("principal");
  await recordAuditEvent(context.env.DB, {
    action: "orders.fulfill",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: `aud_${crypto.randomUUID().replaceAll("-", "")}`,
    metadata: { code, fulfillmentStatus: order.fulfillment_status },
    reason,
    requestId: context.get("requestId"),
    result: "denied",
    targetId: order.id,
    targetType: "order",
  });
  throw new ApiError(409, code, reason);
}

export async function transitionOrderFulfillment(
  context: Context<ApiEnvironment>,
  reference: string,
  input: FulfillmentTransitionRequest,
) {
  const order = await context.env.DB.prepare(
    `SELECT id, payment_status, order_status, fulfillment_status
       FROM orders WHERE public_reference = ?`,
  )
    .bind(reference)
    .first<OperationalOrder>();
  if (!order) throw new ApiError(404, "order_not_found", "The order was not found.");
  if (order.order_status === "canceled") {
    return denied(
      context,
      order,
      "fulfillment_order_canceled",
      "A canceled order cannot be fulfilled.",
    );
  }
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    return denied(
      context,
      order,
      "fulfillment_payment_not_approved",
      "Payment is not approved for fulfillment.",
    );
  }
  try {
    transitionFulfillment(order.fulfillment_status, input.toStatus);
  } catch {
    return denied(
      context,
      order,
      "fulfillment_transition_invalid",
      `The order cannot move from ${order.fulfillment_status} to ${input.toStatus}.`,
    );
  }
  const principal = context.get("principal");
  const now = new Date().toISOString();
  const eventId = `fe_${crypto.randomUUID().replaceAll("-", "")}`;
  const statements = [
    context.env.DB.prepare(
      `INSERT INTO fulfillment_events
         (id, order_id, from_status, to_status, tracking_number, carrier,
          actor_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      eventId,
      order.id,
      order.fulfillment_status,
      input.toStatus,
      input.trackingNumber ?? null,
      input.carrier ?? null,
      principal.id,
      input.reason,
      now,
    ),
  ];
  if (input.toStatus === "shipped") {
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO notification_jobs
           (id, order_id, type, deduplication_key, payload_json, status,
            attempt_count, next_attempt_at, created_at, updated_at)
         VALUES (?, ?, 'shipment', ?, ?, 'pending', 0, ?, ?, ?)`,
      ).bind(
        `notify_${eventId}`,
        order.id,
        `order.shipment:${order.id}`,
        JSON.stringify({
          carrier: input.carrier,
          orderId: order.id,
          trackingNumber: input.trackingNumber,
        }),
        now,
        now,
        now,
      ),
    );
  }
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("fulfillment_") || error.message.includes("UNIQUE constraint failed"))
    ) {
      return denied(
        context,
        order,
        "fulfillment_transition_conflict",
        "The fulfillment state changed before this action completed.",
      );
    }
    throw error;
  }
  await recordAuditEvent(context.env.DB, {
    action: "orders.fulfill",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: `aud_${crypto.randomUUID().replaceAll("-", "")}`,
    metadata: {
      carrier: input.carrier,
      fromStatus: order.fulfillment_status,
      toStatus: input.toStatus,
      trackingNumber: input.trackingNumber,
    },
    reason: input.reason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: order.id,
    targetType: "order",
  });
  return getOrderDetail(context, reference);
}
