import type { PaymentProvider, VerifiedProviderEvent } from "../payments/port";
import { PaymentProviderError } from "../payments/port";
import { reconcilePaymentEvent } from "../payments/reconciliation";
import { claimNotificationJob } from "../automation/deduplication";
import {
  completedAtAfter,
  recordAutomationFailure,
  recordAutomationSuccess,
  type NotificationDeliveryResult,
} from "../automation/attempts";

function providerEventType(value: string): VerifiedProviderEvent["type"] | null {
  return [
    "checkout.completed",
    "checkout.expired",
    "checkout.payment_failed",
    "checkout.payment_succeeded",
    "ignored",
  ].includes(value)
    ? (value as VerifiedProviderEvent["type"])
    : null;
}

export async function enqueueProviderRecovery(
  db: D1Database,
  provider: string,
  providerEventId: string,
  now = new Date().toISOString(),
): Promise<void> {
  const event = await db
    .prepare(
      `SELECT id, order_id, checkout_attempt_id
         FROM payment_events
        WHERE provider = ? AND provider_event_id = ?`,
    )
    .bind(provider, providerEventId)
    .first<{ checkout_attempt_id: string | null; id: string; order_id: string | null }>();
  if (!event) return;
  await db
    .prepare(
      `INSERT OR IGNORE INTO notification_jobs
         (id, order_id, checkout_attempt_id, provider_event_id, kind, type,
          deduplication_key, payload_json, status, attempt_count, next_attempt_at,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, 'provider_recovery', 'payment_reconciliation',
               ?, ?, 'pending', 0, ?, ?, ?)`,
    )
    .bind(
      `recover_${event.id}`,
      event.order_id,
      event.checkout_attempt_id,
      event.id,
      `payment.reconciliation:${event.id}`,
      JSON.stringify({ paymentEventId: event.id }),
      now,
      now,
      now,
    )
    .run();
}

export async function completeProviderRecovery(
  db: D1Database,
  provider: string,
  providerEventId: string,
  now = new Date().toISOString(),
): Promise<void> {
  await db
    .prepare(
      `UPDATE notification_jobs
          SET status = 'sent', sent_at = ?, last_error_code = NULL,
              next_attempt_at = NULL, claim_expires_at = NULL, updated_at = ?
        WHERE kind = 'provider_recovery'
          AND provider_event_id = (
            SELECT id FROM payment_events WHERE provider = ? AND provider_event_id = ?
          )
          AND status != 'sent'`,
    )
    .bind(now, now, provider, providerEventId)
    .run();
}

export async function deliverProviderRecoveryJob(
  db: D1Database,
  provider: PaymentProvider,
  jobId: string,
  now = new Date().toISOString(),
  onPurchaseConfirmed?: () => void,
): Promise<NotificationDeliveryResult> {
  const job = await claimNotificationJob(db, jobId, now);
  if (!job) {
    const state = await db
      .prepare("SELECT status FROM notification_jobs WHERE id = ?")
      .bind(jobId)
      .first<{ status: string }>();
    return { status: state?.status === "dead_letter" ? "dead_letter" : "duplicate" };
  }
  const startedAt = now;
  try {
    if (job.kind !== "provider_recovery" || !job.providerEventId) {
      throw new PaymentProviderError(
        "provider_recovery_job_invalid",
        "Provider recovery job is invalid.",
        false,
      );
    }
    const event = await db
      .prepare(
        `SELECT p.provider, p.provider_event_id, p.type, p.provider_created_at,
                c.provider_session_id
           FROM payment_events p
           LEFT JOIN checkout_attempts c ON c.id = p.checkout_attempt_id
          WHERE p.id = ?`,
      )
      .bind(job.providerEventId)
      .first<{
        provider: string;
        provider_created_at: string | null;
        provider_event_id: string;
        provider_session_id: string | null;
        type: string;
      }>();
    const type = event ? providerEventType(event.type) : null;
    if (!event || event.provider !== provider.name || !event.provider_session_id || !type) {
      throw new PaymentProviderError(
        "provider_recovery_snapshot_invalid",
        "Provider recovery snapshot is invalid.",
        false,
      );
    }
    const session = await provider.retrieveSession(event.provider_session_id);
    const result = await reconcilePaymentEvent(
      db,
      provider,
      {
        createdAt: event.provider_created_at ?? now,
        id: event.provider_event_id,
        session,
        type,
      },
      `provider-recovery:${event.provider_event_id}`,
    );
    if (result.eventResult === "failed") {
      const failed = await db
        .prepare("SELECT last_error_code FROM payment_events WHERE id = ?")
        .bind(job.providerEventId)
        .first<{ last_error_code: string | null }>();
      throw new PaymentProviderError(
        failed?.last_error_code ?? "provider_recovery_failed",
        "Provider recovery did not converge.",
        false,
      );
    }
    if (result.orderReference && !result.replayed) onPurchaseConfirmed?.();
    await recordAutomationSuccess(
      db,
      job,
      event.provider_event_id,
      startedAt,
      completedAtAfter(startedAt),
    );
    return { status: "sent" };
  } catch (error) {
    const providerError =
      error instanceof PaymentProviderError
        ? error
        : new PaymentProviderError("provider_recovery_failed", "Provider recovery failed.", true);
    return recordAutomationFailure(db, job, providerError, startedAt, completedAtAfter(startedAt));
  }
}
