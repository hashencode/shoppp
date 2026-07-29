import type { ClaimedNotificationJob } from "./deduplication";

export type NotificationDeliveryResult =
  | { readonly status: "dead_letter" | "duplicate" | "sent" }
  | { readonly delaySeconds: number; readonly status: "retry" };

function retryDelay(attempt: number): number {
  return Math.min(15 * 60, 60 * 2 ** Math.max(0, attempt - 1));
}

export function completedAtAfter(startedAt: string): string {
  return new Date(Math.max(Date.now(), Date.parse(startedAt))).toISOString();
}

export async function recordAutomationSuccess(
  db: D1Database,
  job: ClaimedNotificationJob,
  providerMessageId: string,
  startedAt: string,
  completedAt: string,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO notification_attempts
           (id, job_id, attempt_number, result, provider_message_id, started_at, completed_at)
         VALUES (?, ?, ?, 'sent', ?, ?, ?)`,
      )
      .bind(
        `na_${crypto.randomUUID().replaceAll("-", "")}`,
        job.id,
        job.attemptCount,
        providerMessageId,
        startedAt,
        completedAt,
      ),
    db
      .prepare(
        `UPDATE notification_jobs
            SET status = 'sent', sent_at = ?, provider_message_id = ?,
                last_error_code = NULL, next_attempt_at = NULL, claim_expires_at = NULL,
                updated_at = ?
          WHERE id = ? AND status = 'processing' AND attempt_count = ?`,
      )
      .bind(completedAt, providerMessageId, completedAt, job.id, job.attemptCount),
  ]);
}

export async function recordAutomationFailure(
  db: D1Database,
  job: ClaimedNotificationJob,
  error: { code: string; retryable: boolean },
  startedAt: string,
  completedAt: string,
): Promise<NotificationDeliveryResult> {
  const exhausted = !error.retryable || job.attemptCycleCount >= job.maxAttempts;
  const delaySeconds = retryDelay(job.attemptCycleCount);
  const nextAttemptAt = new Date(
    new Date(completedAt).getTime() + delaySeconds * 1000,
  ).toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO notification_attempts
           (id, job_id, attempt_number, result, error_code, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `na_${crypto.randomUUID().replaceAll("-", "")}`,
        job.id,
        job.attemptCount,
        !error.retryable
          ? "permanent_failure"
          : job.attemptCycleCount >= job.maxAttempts
            ? "exhausted"
            : "retryable_failure",
        error.code,
        startedAt,
        completedAt,
      ),
    db
      .prepare(
        `UPDATE notification_jobs
            SET status = ?, last_error_code = ?, next_attempt_at = ?,
                dead_lettered_at = ?, claim_expires_at = NULL, updated_at = ?
          WHERE id = ? AND status = 'processing' AND attempt_count = ?`,
      )
      .bind(
        exhausted ? "dead_letter" : "failed",
        error.code,
        exhausted ? null : nextAttemptAt,
        exhausted ? completedAt : null,
        completedAt,
        job.id,
        job.attemptCount,
      ),
  ]);
  return exhausted ? { status: "dead_letter" } : { delaySeconds, status: "retry" };
}
