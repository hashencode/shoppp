import type {
  NotificationAttempt,
  NotificationJob,
  NotificationJobStatus,
} from "@shoppp/contracts";

export interface NotificationJobFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly query?: string;
  readonly status?: NotificationJobStatus;
  readonly type?: NotificationJob["type"];
}

export class NotificationRecoveryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "NotificationRecoveryError";
    this.code = code;
  }
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "unavailable";
  return `${local.slice(0, 1) || "*"}***@${domain}`;
}

export async function listNotificationJobs(
  db: D1Database,
  filters: NotificationJobFilters,
): Promise<{ data: NotificationJob[]; page: number; pageSize: number; total: number }> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.status) {
    clauses.push("n.status = ?");
    values.push(filters.status);
  }
  if (filters.type) {
    clauses.push("n.type = ?");
    values.push(filters.type);
  }
  if (filters.query) {
    clauses.push("(LOWER(COALESCE(o.public_reference, '')) LIKE ? OR LOWER(n.id) LIKE ?)");
    const query = `%${filters.query.toLowerCase()}%`;
    values.push(query, query);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const total =
    (
      await db
        .prepare(
          `SELECT COUNT(*) AS total
             FROM notification_jobs n
             LEFT JOIN orders o ON o.id = n.order_id
             ${where}`,
        )
        .bind(...values)
        .first<{ total: number }>()
    )?.total ?? 0;
  const offset = (filters.page - 1) * filters.pageSize;
  const rows = await db
    .prepare(
      `SELECT n.id, n.kind, n.type, n.status, n.attempt_count, n.max_attempts,
              n.next_attempt_at, n.last_error_code, n.sent_at, n.dead_lettered_at,
              n.replay_count, n.created_at, n.updated_at, o.public_reference,
              CASE WHEN n.kind = 'provider_recovery'
                   THEN 'Provider · ' || COALESCE(p.provider, 'unknown')
                   ELSE COALESCE(o.email, c.email, '') END AS recipient
         FROM notification_jobs n
         LEFT JOIN orders o ON o.id = n.order_id
         LEFT JOIN checkout_attempts c ON c.id = n.checkout_attempt_id
         LEFT JOIN payment_events p ON p.id = n.provider_event_id
         ${where}
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT ? OFFSET ?`,
    )
    .bind(...values, filters.pageSize, offset)
    .all<{
      attempt_count: number;
      created_at: string;
      dead_lettered_at: string | null;
      id: string;
      kind: NotificationJob["kind"];
      last_error_code: string | null;
      max_attempts: number;
      next_attempt_at: string | null;
      public_reference: string | null;
      recipient: string;
      replay_count: number;
      sent_at: string | null;
      status: NotificationJobStatus;
      type: NotificationJob["type"];
      updated_at: string;
    }>();
  const attemptsByJob = new Map<string, NotificationAttempt[]>();
  if (rows.results.length) {
    const placeholders = rows.results.map(() => "?").join(", ");
    const attempts = await db
      .prepare(
        `SELECT id, job_id, attempt_number, result, error_code, provider_message_id,
                started_at, completed_at
           FROM notification_attempts
          WHERE job_id IN (${placeholders})
          ORDER BY job_id, attempt_number DESC`,
      )
      .bind(...rows.results.map((row) => row.id))
      .all<{
        attempt_number: number;
        completed_at: string;
        error_code: string | null;
        id: string;
        job_id: string;
        provider_message_id: string | null;
        result: NotificationAttempt["result"];
        started_at: string;
      }>();
    for (const attempt of attempts.results) {
      const current = attemptsByJob.get(attempt.job_id) ?? [];
      current.push({
        attemptNumber: attempt.attempt_number,
        completedAt: attempt.completed_at,
        errorCode: attempt.error_code,
        id: attempt.id,
        providerMessageId: attempt.provider_message_id,
        result: attempt.result,
        startedAt: attempt.started_at,
      });
      attemptsByJob.set(attempt.job_id, current);
    }
  }
  return {
    data: rows.results.map((row) => ({
      attemptCount: row.attempt_count,
      attempts: attemptsByJob.get(row.id) ?? [],
      createdAt: row.created_at,
      deadLetteredAt: row.dead_lettered_at,
      id: row.id,
      kind: row.kind,
      lastErrorCode: row.last_error_code,
      maxAttempts: row.max_attempts,
      nextAttemptAt: row.next_attempt_at,
      orderReference: row.public_reference,
      recipient: row.kind === "provider_recovery" ? row.recipient : maskEmail(row.recipient),
      replayCount: row.replay_count,
      sentAt: row.sent_at,
      status: row.status,
      type: row.type,
      updatedAt: row.updated_at,
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
  };
}

export async function replayNotificationJob(
  db: D1Database,
  jobId: string,
  input: { actorId: string; reason: string; requestId?: string },
  now = new Date().toISOString(),
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE notification_jobs
          SET status = 'pending', attempt_cycle_count = 0, next_attempt_at = ?,
              last_error_code = NULL, dead_lettered_at = NULL, claim_expires_at = NULL,
              enqueued_at = NULL, replay_count = replay_count + 1, updated_at = ?
        WHERE id = ? AND status = 'dead_letter'`,
    )
    .bind(now, now, jobId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) {
    throw new NotificationRecoveryError(
      "notification_not_replayable",
      "Only a dead-letter notification can be replayed.",
    );
  }
  await db
    .prepare(
      `INSERT INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result,
          reason, request_id, metadata_json, created_at)
       VALUES (?, 'admin', ?, 'notifications.replay', 'notification_job', ?,
               'succeeded', ?, ?, ?, ?)`,
    )
    .bind(
      `audit_${crypto.randomUUID().replaceAll("-", "")}`,
      input.actorId,
      jobId,
      input.reason,
      input.requestId ?? null,
      JSON.stringify({ reusedDeduplicationIdentity: true }),
      now,
    )
    .run();
}

export async function moveNotificationToDeadLetter(
  db: D1Database,
  jobId: string,
  errorCode: string,
  now = new Date().toISOString(),
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO notification_attempts
           (id, job_id, attempt_number, result, error_code, started_at, completed_at)
         SELECT ?, id, attempt_count + 1, 'exhausted', ?, ?, ?
           FROM notification_jobs
          WHERE id = ? AND status NOT IN ('sent', 'dead_letter')`,
      )
      .bind(`na_${crypto.randomUUID().replaceAll("-", "")}`, errorCode, now, now, jobId),
    db
      .prepare(
        `UPDATE notification_jobs
            SET status = 'dead_letter', attempt_count = attempt_count + 1,
                attempt_cycle_count = attempt_cycle_count + 1, last_error_code = ?,
                dead_lettered_at = ?, next_attempt_at = NULL, claim_expires_at = NULL,
                updated_at = ?
          WHERE id = ? AND status NOT IN ('sent', 'dead_letter')`,
      )
      .bind(errorCode, now, now, jobId),
  ]);
}
