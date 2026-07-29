import type { AdminOrder, AdminOrderDetail, OrderTimelineEntry } from "@shoppp/contracts";
import type { FulfillmentStatus } from "@shoppp/domain";
import type { Context } from "hono";
import * as z from "zod";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";

const listQuerySchema = z.object({
  fulfillmentStatus: z
    .enum(["unfulfilled", "picking", "packed", "shipped", "delivered", "canceled"])
    .optional(),
  orderStatus: z
    .enum(["checkout_pending", "confirmed", "processing", "completed", "canceled"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  paymentStatus: z
    .enum(["pending", "authorized", "paid", "failed", "canceled", "partially_refunded", "refunded"])
    .optional(),
  query: z.string().trim().max(160).optional(),
});

interface OrderRow {
  created_at: string;
  currency: string;
  discount_amount: number;
  email: string;
  fulfillment_status: AdminOrder["fulfillmentStatus"];
  grand_total_amount: number;
  id: string;
  order_status: AdminOrder["orderStatus"];
  payment_status: AdminOrder["paymentStatus"];
  public_reference: string;
  shipping_amount: number;
  subtotal_amount: number;
  tax_amount: number;
}

function parseListQuery(context: Context<ApiEnvironment>) {
  const parsed = listQuerySchema.safeParse({
    fulfillmentStatus: context.req.query("fulfillmentStatus"),
    orderStatus: context.req.query("orderStatus"),
    page: context.req.query("page"),
    pageSize: context.req.query("pageSize"),
    paymentStatus: context.req.query("paymentStatus"),
    query: context.req.query("query"),
  });
  if (!parsed.success) {
    throw new ApiError(422, "validation_failed", "Order filters are invalid.", parsed.error.issues);
  }
  return parsed.data;
}

function escapedLike(value: string): string {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

export async function listOrders(context: Context<ApiEnvironment>) {
  const input = parseListQuery(context);
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  if (input.query) {
    conditions.push("(public_reference LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
    const search = escapedLike(input.query);
    bindings.push(search, search);
  }
  for (const [column, value] of [
    ["payment_status", input.paymentStatus],
    ["order_status", input.orderStatus],
    ["fulfillment_status", input.fulfillmentStatus],
  ] as const) {
    if (value) {
      conditions.push(`${column} = ?`);
      bindings.push(value);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await context.env.DB.prepare(`SELECT COUNT(*) AS total FROM orders ${where}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const rows = await context.env.DB.prepare(
    `SELECT id, public_reference, email, currency, grand_total_amount,
            payment_status, order_status, fulfillment_status, created_at,
            subtotal_amount, discount_amount, shipping_amount, tax_amount
       FROM orders
       ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
  )
    .bind(...bindings, input.pageSize, (input.page - 1) * input.pageSize)
    .all<OrderRow>();
  return {
    data: rows.results.map((row): AdminOrder => ({
      createdAt: row.created_at,
      currency: row.currency,
      email: row.email,
      fulfillmentStatus: row.fulfillment_status,
      grandTotal: row.grand_total_amount,
      orderStatus: row.order_status,
      paymentStatus: row.payment_status,
      publicReference: row.public_reference,
    })),
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      requestId: context.get("requestId"),
      total: count?.total ?? 0,
    },
  };
}

function nextFulfillment(status: FulfillmentStatus): AdminOrderDetail["allowedActions"]["fulfill"] {
  const next: Partial<
    Record<FulfillmentStatus, AdminOrderDetail["allowedActions"]["fulfill"][number]>
  > = {
    packed: "shipped",
    picking: "packed",
    shipped: "delivered",
    unfulfilled: "picking",
  };
  return next[status] ? [next[status]] : [];
}

function timelineSort(left: OrderTimelineEntry, right: OrderTimelineEntry): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

export async function getOrderDetail(
  context: Context<ApiEnvironment>,
  reference: string,
): Promise<AdminOrderDetail> {
  const order = await context.env.DB.prepare(
    `SELECT id, public_reference, email, currency, subtotal_amount, discount_amount,
            shipping_amount, tax_amount, grand_total_amount, payment_status,
            order_status, fulfillment_status, created_at
       FROM orders WHERE public_reference = ?`,
  )
    .bind(reference)
    .first<OrderRow>();
  if (!order) throw new ApiError(404, "order_not_found", "The order was not found.");

  const [lines, address, paymentEvents, fulfillmentEvents, refunds, notifications, audits, events] =
    await Promise.all([
      context.env.DB.prepare(
        `SELECT sku, product_name, variant_name, quantity, unit_price_amount,
                discount_amount, tax_amount, line_total_amount, currency
           FROM order_lines WHERE order_id = ? ORDER BY id`,
      )
        .bind(order.id)
        .all<{
          currency: string;
          discount_amount: number;
          line_total_amount: number;
          product_name: string;
          quantity: number;
          sku: string;
          tax_amount: number;
          unit_price_amount: number;
          variant_name: string;
        }>(),
      context.env.DB.prepare(
        `SELECT name, line1, line2, city, region, postal_code, country_code, phone
           FROM order_addresses WHERE order_id = ? AND kind = 'shipping'`,
      )
        .bind(order.id)
        .first<{
          city: string;
          country_code: string;
          line1: string;
          line2: string | null;
          name: string;
          phone: string | null;
          postal_code: string;
          region: string | null;
        }>(),
      context.env.DB.prepare(
        `SELECT id, type, result, received_at
           FROM payment_events WHERE order_id = ? ORDER BY received_at, id`,
      )
        .bind(order.id)
        .all<{ id: string; received_at: string; result: string | null; type: string }>(),
      context.env.DB.prepare(
        `SELECT fe.id, fe.to_status, fe.carrier, fe.tracking_number, fe.reason,
                fe.created_at, ai.display_name AS actor
           FROM fulfillment_events fe
           LEFT JOIN admin_identities ai ON ai.id = fe.actor_id
          WHERE fe.order_id = ? ORDER BY fe.created_at, fe.id`,
      )
        .bind(order.id)
        .all<{
          actor: string | null;
          carrier: string | null;
          created_at: string;
          id: string;
          reason: string | null;
          to_status: string;
          tracking_number: string | null;
        }>(),
      context.env.DB.prepare(
        `SELECT r.id, r.amount, r.status, r.reason, r.created_at,
                ai.display_name AS actor
           FROM refunds r
           LEFT JOIN admin_identities ai ON ai.id = r.requested_by
          WHERE r.order_id = ? ORDER BY r.created_at, r.id`,
      )
        .bind(order.id)
        .all<{
          actor: string | null;
          amount: number;
          created_at: string;
          id: string;
          reason: string;
          status: string;
        }>(),
      context.env.DB.prepare(
        `SELECT id, type, status, created_at
           FROM notification_jobs WHERE order_id = ? ORDER BY created_at, id`,
      )
        .bind(order.id)
        .all<{ created_at: string; id: string; status: string; type: string }>(),
      context.env.DB.prepare(
        `SELECT ae.id, ae.action, ae.result, ae.reason, ae.created_at,
                ai.display_name AS actor
           FROM audit_events ae
           LEFT JOIN admin_identities ai ON ai.id = ae.actor_id
          WHERE ae.target_id IN (?, ?) AND ae.target_type = 'order'
          ORDER BY ae.created_at, ae.id`,
      )
        .bind(order.id, order.public_reference)
        .all<{
          action: string;
          actor: string | null;
          created_at: string;
          id: string;
          reason: string | null;
          result: string;
        }>(),
      context.env.DB.prepare(
        `SELECT oe.id, oe.to_status, oe.reason, oe.created_at,
                ai.display_name AS actor
           FROM order_events oe
           LEFT JOIN admin_identities ai ON ai.id = oe.actor_id
          WHERE oe.order_id = ? ORDER BY oe.created_at, oe.id`,
      )
        .bind(order.id)
        .all<{
          actor: string | null;
          created_at: string;
          id: string;
          reason: string;
          to_status: string;
        }>(),
    ]);
  if (!address || lines.results.length === 0) {
    throw new ApiError(500, "order_snapshot_incomplete", "The order snapshot is incomplete.");
  }
  const committedRefund = refunds.results
    .filter((refund) => refund.status === "pending" || refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amount, 0);
  const paymentApproved =
    order.payment_status === "paid" || order.payment_status === "partially_refunded";
  const fulfill =
    paymentApproved && order.order_status !== "canceled"
      ? nextFulfillment(order.fulfillment_status)
      : [];
  const timeline: OrderTimelineEntry[] = [
    ...paymentEvents.results.map((event) => ({
      createdAt: event.received_at,
      id: event.id,
      kind: "payment" as const,
      label: event.type,
      status: event.result,
    })),
    ...fulfillmentEvents.results.map((event) => ({
      actor: event.actor,
      createdAt: event.created_at,
      id: event.id,
      kind: "fulfillment" as const,
      label:
        event.to_status === "shipped"
          ? `${event.to_status} · ${event.carrier} ${event.tracking_number}`
          : event.to_status,
      reason: event.reason,
      status: event.to_status,
    })),
    ...refunds.results.map((refund) => ({
      actor: refund.actor,
      amount: refund.amount,
      createdAt: refund.created_at,
      id: refund.id,
      kind: "refund" as const,
      label: "refund",
      reason: refund.reason,
      status: refund.status,
    })),
    ...notifications.results.map((notification) => ({
      createdAt: notification.created_at,
      id: notification.id,
      kind: "notification" as const,
      label: notification.type,
      status: notification.status,
    })),
    ...audits.results.map((audit) => ({
      actor: audit.actor,
      createdAt: audit.created_at,
      id: audit.id,
      kind: "audit" as const,
      label: audit.action,
      reason: audit.reason,
      status: audit.result,
    })),
    ...events.results.map((event) => ({
      actor: event.actor,
      createdAt: event.created_at,
      id: event.id,
      kind: "order" as const,
      label: event.to_status,
      reason: event.reason,
      status: event.to_status,
    })),
  ].sort(timelineSort);
  return {
    allowedActions: {
      cancel:
        order.order_status === "confirmed" &&
        order.fulfillment_status === "unfulfilled" &&
        (paymentApproved || order.payment_status === "refunded"),
      fulfill,
      refundMaximum: Math.max(0, order.grand_total_amount - committedRefund),
    },
    facts: {
      createdAt: order.created_at,
      currency: order.currency,
      email: order.email,
      fulfillmentStatus: order.fulfillment_status,
      lines: lines.results.map((line) => ({
        currency: line.currency,
        discountAmount: line.discount_amount,
        lineTotalAmount: line.line_total_amount,
        productName: line.product_name,
        quantity: line.quantity,
        sku: line.sku,
        taxAmount: line.tax_amount,
        unitPriceAmount: line.unit_price_amount,
        variantName: line.variant_name,
      })),
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      publicReference: order.public_reference,
      shippingAddress: {
        city: address.city,
        countryCode: address.country_code,
        line1: address.line1,
        ...(address.line2 ? { line2: address.line2 } : {}),
        name: address.name,
        ...(address.phone ? { phone: address.phone } : {}),
        postalCode: address.postal_code,
        ...(address.region ? { region: address.region } : {}),
      },
      totals: {
        discountTotal: order.discount_amount,
        grandTotal: order.grand_total_amount,
        shippingTotal: order.shipping_amount,
        subtotal: order.subtotal_amount,
        taxTotal: order.tax_amount,
      },
    },
    timeline,
  };
}
