import type { ApiBindings } from "../http/context";
import { moveNotificationToDeadLetter } from "../recovery/notification-jobs";
import { notificationWorkflowIdentity } from "./deduplication";

export interface NotificationQueuePayload {
  readonly jobId: string;
}

function validPayload(value: unknown): value is NotificationQueuePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && typeof record.jobId === "string" && !!record.jobId;
}

export async function dispatchPendingNotifications(
  db: D1Database,
  queue: Queue<NotificationQueuePayload>,
  now = new Date().toISOString(),
): Promise<number> {
  const staleEnqueue = new Date(new Date(now).getTime() - 5 * 60_000).toISOString();
  const jobs = await db
    .prepare(
      `SELECT id
         FROM notification_jobs
        WHERE status IN ('pending', 'failed')
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
          AND (enqueued_at IS NULL OR enqueued_at <= ?)
        ORDER BY created_at, id
        LIMIT 100`,
    )
    .bind(now, staleEnqueue)
    .all<{ id: string }>();
  if (!jobs.results.length) return 0;
  await queue.sendBatch(jobs.results.map((job) => ({ body: { jobId: job.id } })));
  const placeholders = jobs.results.map(() => "?").join(", ");
  await db
    .prepare(
      `UPDATE notification_jobs SET enqueued_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
    )
    .bind(now, now, ...jobs.results.map((job) => job.id))
    .run();
  return jobs.results.length;
}

export async function consumeNotificationQueue(
  batch: MessageBatch<unknown>,
  env: ApiBindings,
): Promise<void> {
  const isDeadLetterQueue = batch.queue.endsWith("-dlq");
  for (const message of batch.messages) {
    if (!validPayload(message.body)) {
      message.ack();
      continue;
    }
    if (isDeadLetterQueue) {
      await moveNotificationToDeadLetter(env.DB, message.body.jobId, "queue_delivery_exhausted");
      message.ack();
      continue;
    }
    if (!env.NOTIFICATION_WORKFLOW) {
      message.retry({ delaySeconds: 60 });
      continue;
    }
    const workflowId = await notificationWorkflowIdentity(env.DB, message.body.jobId);
    if (!workflowId) {
      message.ack();
      continue;
    }
    try {
      await env.NOTIFICATION_WORKFLOW.create({
        id: workflowId,
        params: { jobId: message.body.jobId },
      });
      message.ack();
    } catch {
      const existing = await env.NOTIFICATION_WORKFLOW.get(workflowId);
      const status = await existing.status();
      if (status.status === "errored" || status.status === "terminated") {
        message.retry({ delaySeconds: 60 });
      } else {
        message.ack();
      }
    }
  }
}
