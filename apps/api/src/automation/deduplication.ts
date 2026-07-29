export interface ClaimedNotificationJob {
  readonly attemptCount: number;
  readonly attemptCycleCount: number;
  readonly checkoutAttemptId: string | null;
  readonly deduplicationKey: string;
  readonly id: string;
  readonly kind: "notification" | "provider_recovery";
  readonly maxAttempts: number;
  readonly orderId: string | null;
  readonly payloadJson: string;
  readonly providerEventId: string | null;
  readonly replayCount: number;
  readonly type: string;
}

export async function claimNotificationJob(
  db: D1Database,
  jobId: string,
  now: string,
): Promise<ClaimedNotificationJob | null> {
  const claimExpiresAt = new Date(new Date(now).getTime() + 2 * 60_000).toISOString();
  return db
    .prepare(
      `UPDATE notification_jobs
          SET status = 'processing',
              attempt_count = attempt_count + 1,
              attempt_cycle_count = attempt_cycle_count + 1,
              claim_expires_at = ?,
              updated_at = ?
        WHERE id = ?
          AND (
            (status IN ('pending', 'failed') AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
            OR (status = 'processing' AND claim_expires_at <= ?)
          )
      RETURNING id, order_id, checkout_attempt_id, provider_event_id, kind,
                type, deduplication_key,
                payload_json, attempt_count, attempt_cycle_count, max_attempts, replay_count`,
    )
    .bind(claimExpiresAt, now, jobId, now, now)
    .first<{
      attempt_count: number;
      attempt_cycle_count: number;
      checkout_attempt_id: string | null;
      deduplication_key: string;
      id: string;
      kind: "notification" | "provider_recovery";
      max_attempts: number;
      order_id: string | null;
      payload_json: string;
      provider_event_id: string | null;
      replay_count: number;
      type: string;
    }>()
    .then((row) =>
      row
        ? {
            attemptCount: row.attempt_count,
            attemptCycleCount: row.attempt_cycle_count,
            checkoutAttemptId: row.checkout_attempt_id,
            deduplicationKey: row.deduplication_key,
            id: row.id,
            kind: row.kind,
            maxAttempts: row.max_attempts,
            orderId: row.order_id,
            payloadJson: row.payload_json,
            providerEventId: row.provider_event_id,
            replayCount: row.replay_count,
            type: row.type,
          }
        : null,
    );
}

export async function notificationWorkflowIdentity(
  db: D1Database,
  jobId: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT replay_count FROM notification_jobs WHERE id = ?")
    .bind(jobId)
    .first<{ replay_count: number }>();
  return row ? `notification-${jobId}-replay-${row.replay_count}`.slice(0, 100) : null;
}
