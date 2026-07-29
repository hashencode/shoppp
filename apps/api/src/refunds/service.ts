import type { RefundRequest } from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { getOrderDetail } from "../orders/queries";
import { PaymentProviderError, type PaymentProvider, type ProviderRefund } from "../payments/port";

interface RefundableOrder {
  currency: string;
  grand_total_amount: number;
  id: string;
  payment_status: string;
  provider_payment_id: string | null;
}

export interface RefundEffect {
  readonly providerStatus: ProviderRefund["status"];
  readonly refundId: string;
}

async function auditRefund(
  context: Context<ApiEnvironment>,
  orderId: string,
  reason: string,
  result: "succeeded" | "failed" | "denied",
  metadata: Record<string, unknown>,
): Promise<void> {
  const principal = context.get("principal");
  await recordAuditEvent(context.env.DB, {
    action: "orders.refund",
    actorId: principal.id,
    actorType: "admin",
    id: `aud_${crypto.randomUUID().replaceAll("-", "")}`,
    metadata,
    reason,
    requestId: context.get("requestId"),
    result,
    targetId: orderId,
    targetType: "order",
  });
}

async function committedRefundAmount(db: D1Database, orderId: string): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS amount
         FROM refunds
        WHERE order_id = ? AND status IN ('pending', 'succeeded')`,
    )
    .bind(orderId)
    .first<{ amount: number }>();
  return result?.amount ?? 0;
}

async function markRefundFailure(
  context: Context<ApiEnvironment>,
  refundId: string,
  order: RefundableOrder,
  reason: string,
  code: string,
): Promise<void> {
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE refunds
          SET status = 'failed', provider_status = ?, completed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'`,
    ).bind(code, now, now, refundId),
    context.env.DB.prepare(
      `INSERT OR IGNORE INTO refund_events
         (id, refund_id, from_status, to_status, reason, created_at)
       VALUES (?, ?, 'pending', 'failed', ?, ?)`,
    ).bind(`re_${crypto.randomUUID().replaceAll("-", "")}`, refundId, code, now),
  ]);
  await auditRefund(context, order.id, reason, "failed", { code, refundId });
}

function validateProviderRefund(
  refund: ProviderRefund,
  order: RefundableOrder,
  refundId: string,
  amount: number,
): void {
  if (
    refund.amount !== amount ||
    refund.currency !== order.currency ||
    refund.paymentId !== order.provider_payment_id
  ) {
    throw new PaymentProviderError(
      "provider_refund_mismatch",
      "The payment provider returned mismatched refund facts.",
      false,
    );
  }
  if (!refund.id || !refundId) {
    throw new PaymentProviderError(
      "provider_refund_invalid",
      "The payment provider returned an invalid refund.",
      false,
    );
  }
}

export async function createRefundEffect(
  context: Context<ApiEnvironment>,
  reference: string,
  input: RefundRequest,
  provider: PaymentProvider,
  idempotencyKey: string,
): Promise<RefundEffect> {
  const order = await context.env.DB.prepare(
    `SELECT id, provider_payment_id, currency, grand_total_amount, payment_status
       FROM orders WHERE public_reference = ?`,
  )
    .bind(reference)
    .first<RefundableOrder>();
  if (!order) throw new ApiError(404, "order_not_found", "The order was not found.");
  if (!order.provider_payment_id) {
    await auditRefund(context, order.id, input.reason, "denied", {
      code: "refund_payment_reference_missing",
    });
    throw new ApiError(
      409,
      "refund_payment_reference_missing",
      "The provider payment reference is unavailable.",
    );
  }
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    await auditRefund(context, order.id, input.reason, "denied", {
      code: "refund_payment_state_ineligible",
    });
    throw new ApiError(
      409,
      "refund_payment_state_ineligible",
      "The order payment state is not refundable.",
    );
  }
  const alreadyCommitted = await committedRefundAmount(context.env.DB, order.id);
  if (input.amount > order.grand_total_amount - alreadyCommitted) {
    await auditRefund(context, order.id, input.reason, "denied", {
      amount: input.amount,
      code: "refund_amount_exceeds_remaining",
    });
    throw new ApiError(
      409,
      "refund_amount_exceeds_remaining",
      "The refund amount exceeds the remaining refundable amount.",
    );
  }
  const principal = context.get("principal");
  const refundId = `ref_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO refunds
         (id, order_id, provider_refund_id, idempotency_key, amount, currency,
          reason, status, provider_status, requested_by, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 'pending', 'creating', ?, ?, ?)`,
    ).bind(
      refundId,
      order.id,
      idempotencyKey,
      input.amount,
      order.currency,
      input.reason,
      principal.id,
      now,
      now,
    ),
    context.env.DB.prepare(
      `INSERT INTO refund_events
         (id, refund_id, from_status, to_status, reason, created_at)
       VALUES (?, ?, NULL, 'pending', ?, ?)`,
    ).bind(`re_${crypto.randomUUID().replaceAll("-", "")}`, refundId, input.reason, now),
  ]);

  let created: ProviderRefund;
  let authoritative: ProviderRefund;
  try {
    created = await provider.createRefund({
      amount: input.amount,
      currency: order.currency,
      idempotencyKey,
      orderId: order.id,
      paymentId: order.provider_payment_id,
      refundId,
    });
    validateProviderRefund(created, order, refundId, input.amount);
    await context.env.DB.prepare(
      `UPDATE refunds
          SET provider_refund_id = ?, provider_status = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'`,
    )
      .bind(created.id, created.status, new Date().toISOString(), refundId)
      .run();
    authoritative = await provider.retrieveRefund(created.id);
    validateProviderRefund(authoritative, order, refundId, input.amount);
  } catch (error) {
    const code =
      error instanceof PaymentProviderError ? error.code : "provider_refund_reconciliation_failed";
    await markRefundFailure(context, refundId, order, input.reason, code);
    throw error instanceof PaymentProviderError
      ? error
      : new PaymentProviderError(
          "provider_refund_reconciliation_failed",
          "The refund could not be reconciled with the payment provider.",
          true,
        );
  }

  const completedAt = new Date().toISOString();
  if (authoritative.status === "failed" || authoritative.status === "canceled") {
    await markRefundFailure(
      context,
      refundId,
      order,
      input.reason,
      `provider_refund_${authoritative.status}`,
    );
    throw new ApiError(
      409,
      "refund_provider_failed",
      "The payment provider did not approve the refund.",
    );
  }
  const statements = [
    context.env.DB.prepare(
      `UPDATE refunds
          SET status = ?, provider_status = ?, completed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'`,
    ).bind(
      authoritative.status,
      authoritative.status,
      authoritative.status === "succeeded" ? completedAt : null,
      completedAt,
      refundId,
    ),
  ];
  if (authoritative.status === "succeeded") {
    statements.push(
      context.env.DB.prepare(
        `INSERT OR IGNORE INTO refund_events
           (id, refund_id, from_status, to_status, provider_refund_id, reason, created_at)
         VALUES (?, ?, 'pending', 'succeeded', ?, ?, ?)`,
      ).bind(
        `re_${crypto.randomUUID().replaceAll("-", "")}`,
        refundId,
        authoritative.id,
        input.reason,
        completedAt,
      ),
      context.env.DB.prepare(
        `UPDATE orders
            SET payment_status = CASE
                  WHEN (
                    SELECT COALESCE(SUM(amount), 0)
                      FROM refunds
                     WHERE order_id = ? AND status = 'succeeded'
                  ) >= grand_total_amount
                  THEN 'refunded'
                  ELSE 'partially_refunded'
                END,
                updated_at = ?
          WHERE id = ? AND payment_status IN ('paid', 'partially_refunded')`,
      ).bind(order.id, completedAt, order.id),
      context.env.DB.prepare(
        `INSERT OR IGNORE INTO notification_jobs
           (id, order_id, type, deduplication_key, payload_json, status,
            attempt_count, next_attempt_at, created_at, updated_at)
         VALUES (?, ?, 'refund', ?, ?, 'pending', 0, ?, ?, ?)`,
      ).bind(
        `notify_${refundId}`,
        order.id,
        `order.refund:${refundId}`,
        JSON.stringify({ amount: input.amount, orderId: order.id, refundId }),
        completedAt,
        completedAt,
        completedAt,
      ),
    );
  }
  await context.env.DB.batch(statements);
  await auditRefund(context, order.id, input.reason, "succeeded", {
    amount: input.amount,
    providerStatus: authoritative.status,
    refundId,
  });
  return { providerStatus: authoritative.status, refundId };
}

export async function refundOrder(
  context: Context<ApiEnvironment>,
  reference: string,
  input: RefundRequest,
  provider: PaymentProvider,
) {
  const key = context.req.header("Idempotency-Key");
  if (!key) throw new ApiError(422, "idempotency_key_required", "Idempotency-Key is required.");
  await createRefundEffect(context, reference, input, provider, `refund:${key}`);
  return getOrderDetail(context, reference);
}
