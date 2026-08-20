import { markProviderEvent, recordProviderEvent, releaseInventoryReservation } from "@shoppp/db";

import { createPaidOrderFromAttempt } from "../orders/create-order";
import { sha256Hex } from "../orders/tokens";
import { PaymentProviderError, type PaymentProvider, type VerifiedProviderEvent } from "./port";

interface AttemptRow {
  currency: string;
  grand_total_amount: number;
  id: string;
  provider_session_id: string | null;
  reservation_group_id: string | null;
  status: string;
}

export interface ReconciliationResult {
  readonly eventResult: "applied" | "failed" | "ignored";
  readonly orderReference?: string;
  readonly replayed: boolean;
}

async function attemptForSession(
  db: D1Database,
  event: VerifiedProviderEvent,
): Promise<AttemptRow | null> {
  if (!event.session) return null;
  return db
    .prepare(
      `SELECT id, provider_session_id, reservation_group_id, currency,
              grand_total_amount, status
         FROM checkout_attempts
        WHERE provider_session_id = ? OR id = ?
        ORDER BY CASE WHEN provider_session_id = ? THEN 0 ELSE 1 END
        LIMIT 1`,
    )
    .bind(event.session.id, event.session.attemptId, event.session.id)
    .first<AttemptRow>();
}

async function failEvent(
  db: D1Database,
  eventId: string,
  code: string,
  attemptId?: string,
): Promise<ReconciliationResult> {
  await markProviderEvent(db, {
    ...(attemptId ? { checkoutAttemptId: attemptId } : {}),
    id: eventId,
    lastErrorCode: code,
    processedAt: new Date().toISOString(),
    result: "failed",
  });
  return { eventResult: "failed", replayed: false };
}

async function terminateAttempt(
  db: D1Database,
  attempt: AttemptRow,
  status: "expired" | "failed",
  providerStatus: string,
  at: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE checkout_attempts
          SET status = ?, provider_status = ?, last_provider_event_created_at = ?,
              updated_at = ?
        WHERE id = ? AND status IN ('validating', 'payment_pending')`,
    )
    .bind(status, providerStatus, at, at, attempt.id)
    .run();
  if (attempt.reservation_group_id) {
    await releaseInventoryReservation(db, attempt.reservation_group_id, at);
  }
  if (status === "failed") {
    await db
      .prepare(
        `INSERT OR IGNORE INTO notification_jobs
           (id, checkout_attempt_id, type, deduplication_key, payload_json, status,
            attempt_count, next_attempt_at, created_at, updated_at)
         VALUES (?, ?, 'payment_failed', ?, ?, 'pending', 0, ?, ?, ?)`,
      )
      .bind(
        `notify_payment_failed_${attempt.id}`,
        attempt.id,
        `checkout.payment_failed:${attempt.id}`,
        JSON.stringify({ checkoutAttemptId: attempt.id }),
        at,
        at,
        at,
      )
      .run();
  }
}

export async function reconcilePaymentEvent(
  db: D1Database,
  provider: Pick<PaymentProvider, "name" | "retrieveSession">,
  event: VerifiedProviderEvent,
  rawPayload: string,
): Promise<ReconciliationResult> {
  const attempt = await attemptForSession(db, event);
  const recorded = await recordProviderEvent(db, {
    ...(attempt ? { checkoutAttemptId: attempt.id } : {}),
    id: `pe_${crypto.randomUUID().replaceAll("-", "")}`,
    payloadHash: await sha256Hex(rawPayload),
    provider: provider.name,
    providerCreatedAt: event.createdAt,
    providerEventId: event.id,
    receivedAt: new Date().toISOString(),
    type: event.type,
  });
  if (!recorded.created && (recorded.result === "applied" || recorded.result === "ignored")) {
    return { eventResult: recorded.result, replayed: true };
  }
  if (
    !recorded.created &&
    recorded.result === "failed" &&
    recorded.lastErrorCode !== "provider_reconciliation_failed"
  ) {
    return { eventResult: "failed", replayed: true };
  }
  if (event.type === "ignored") {
    await markProviderEvent(db, {
      id: recorded.id,
      processedAt: new Date().toISOString(),
      result: "ignored",
    });
    return { eventResult: "ignored", replayed: !recorded.created };
  }
  if (!event.session || !attempt) {
    return failEvent(db, recorded.id, "checkout_attempt_unknown");
  }
  if (
    attempt.provider_session_id !== event.session.id ||
    attempt.currency !== event.session.currency ||
    attempt.grand_total_amount !== event.session.amountTotal
  ) {
    return failEvent(db, recorded.id, "provider_session_mismatch", attempt.id);
  }
  let authoritative;
  try {
    authoritative = await provider.retrieveSession(event.session.id);
  } catch (error) {
    await failEvent(db, recorded.id, "provider_reconciliation_failed", attempt.id);
    throw error instanceof PaymentProviderError
      ? error
      : new PaymentProviderError(
          "provider_reconciliation_failed",
          "Payment reconciliation failed.",
          true,
        );
  }
  if (
    authoritative.id !== event.session.id ||
    authoritative.attemptId !== attempt.id ||
    authoritative.currency !== attempt.currency ||
    authoritative.amountTotal !== attempt.grand_total_amount
  ) {
    return failEvent(db, recorded.id, "provider_truth_mismatch", attempt.id);
  }
  const at = new Date().toISOString();
  if (authoritative.paymentState === "approved") {
    try {
      if (authoritative.paymentId) {
        await db
          .prepare(
            `UPDATE checkout_attempts
                SET provider_payment_id = ?, updated_at = ?
              WHERE id = ? AND provider_payment_id IS NULL`,
          )
          .bind(authoritative.paymentId, at, attempt.id)
          .run();
      }
      const order = await createPaidOrderFromAttempt(db, attempt.id, at);
      await markProviderEvent(db, {
        checkoutAttemptId: attempt.id,
        id: recorded.id,
        orderId: order.id,
        processedAt: at,
        result: order.created ? "applied" : "ignored",
      });
      return {
        eventResult: order.created ? "applied" : "ignored",
        orderReference: order.publicReference,
        replayed: !order.created,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("active_reservation_required")) {
        return failEvent(db, recorded.id, "reservation_not_active", attempt.id);
      }
      await failEvent(db, recorded.id, "order_creation_failed", attempt.id);
      throw error;
    }
  }
  if (authoritative.paymentState === "expired" || event.type === "checkout.expired") {
    await terminateAttempt(db, attempt, "expired", "expired", at);
    await markProviderEvent(db, {
      checkoutAttemptId: attempt.id,
      id: recorded.id,
      processedAt: at,
      result: "applied",
    });
    return { eventResult: "applied", replayed: false };
  }
  if (event.type === "checkout.payment_failed") {
    await terminateAttempt(db, attempt, "failed", "failed", at);
    await markProviderEvent(db, {
      checkoutAttemptId: attempt.id,
      id: recorded.id,
      processedAt: at,
      result: "applied",
    });
    return { eventResult: "applied", replayed: false };
  }
  await db
    .prepare(
      `UPDATE checkout_attempts
          SET provider_status = 'pending',
              last_provider_event_created_at = CASE
                WHEN last_provider_event_created_at IS NULL OR last_provider_event_created_at < ?
                THEN ? ELSE last_provider_event_created_at END,
              updated_at = ?
        WHERE id = ? AND status = 'payment_pending'`,
    )
    .bind(event.createdAt, event.createdAt, at, attempt.id)
    .run();
  await markProviderEvent(db, {
    checkoutAttemptId: attempt.id,
    id: recorded.id,
    processedAt: at,
    result: "ignored",
  });
  return { eventResult: "ignored", replayed: false };
}
