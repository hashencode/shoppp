import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import {
  consumeNotificationQueue,
  dispatchPendingNotifications,
  type NotificationQueuePayload,
} from "../../src/automation/queue-consumer";
import { deliverNotificationJob } from "../../src/automation/workflows";
import type { ApiBindings } from "../../src/http/context";
import { listNotificationJobs, replayNotificationJob } from "../../src/recovery/notification-jobs";
import {
  EmailProviderError,
  type EmailMessage,
  type EmailProvider,
} from "../../src/notifications/port";

class FakeEmailProvider implements EmailProvider {
  readonly messages: EmailMessage[] = [];
  failures: EmailProviderError[] = [];

  async send(message: EmailMessage) {
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.messages.push(message);
    return { id: `message-${this.messages.length}` };
  }
}

const queue = () => {
  const payloads: NotificationQueuePayload[] = [];
  return {
    binding: {
      async send() {},
      async sendBatch(messages: Iterable<MessageSendRequest<NotificationQueuePayload>>) {
        payloads.push(...[...messages].map((message) => message.body));
      },
    } as unknown as Queue<NotificationQueuePayload>,
    payloads,
  };
};

async function receiptJob() {
  const order = await env.DB.prepare("SELECT id FROM orders ORDER BY id LIMIT 1").first<{
    id: string;
  }>();
  const id = `notify_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const deduplicationKey = `test.receipt:${id}`;
  await env.DB.prepare(
    `INSERT INTO notification_jobs
       (id, order_id, type, deduplication_key, payload_json, status,
        attempt_count, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, 'order_receipt', ?, ?, 'pending', 0, ?, ?, ?)`,
  )
    .bind(
      id,
      order!.id,
      deduplicationKey,
      JSON.stringify({ orderId: order!.id }),
      "2000-01-01T00:00:00.000Z",
      "2000-01-01T00:00:00.000Z",
      "2000-01-01T00:00:00.000Z",
    )
    .run();
  return { deduplication_key: deduplicationKey, id };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-07-30T00:00:00.000Z");
  await seedLaunchFixture(env.DB);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("notification automation", () => {
  test("outbox dispatch carries only a stable job identifier", async () => {
    const target = await receiptJob();
    const targetQueue = queue();

    expect(await dispatchPendingNotifications(env.DB, targetQueue.binding)).toBeGreaterThan(0);
    expect(targetQueue.payloads).toContainEqual({ jobId: target!.id });
    expect(JSON.stringify(targetQueue.payloads)).not.toContain("shopper@example.test");
    expect(JSON.stringify(targetQueue.payloads)).not.toContain("Market Street");
  });

  test("duplicate delivery produces one provider message", async () => {
    const target = await receiptJob();
    const provider = new FakeEmailProvider();

    expect(
      await deliverNotificationJob(env.DB, provider, "https://shop.example.test", target!.id),
    ).toMatchObject({ status: "sent" });
    expect(
      await deliverNotificationJob(env.DB, provider, "https://shop.example.test", target!.id),
    ).toMatchObject({ status: "duplicate" });
    expect(provider.messages).toHaveLength(1);
    expect(provider.messages[0]?.idempotencyKey).toBe(target!.deduplication_key);
  });

  test("transient failures retry within bounds and then succeed", async () => {
    const target = await receiptJob();
    const provider = new FakeEmailProvider();
    provider.failures = [
      new EmailProviderError("provider_timeout", "Provider timed out.", true),
      new EmailProviderError("provider_timeout", "Provider timed out.", true),
    ];

    expect(
      await deliverNotificationJob(
        env.DB,
        provider,
        "https://shop.example.test",
        target!.id,
        "2026-07-30T01:00:00.000Z",
      ),
    ).toMatchObject({ status: "retry" });
    expect(
      await deliverNotificationJob(
        env.DB,
        provider,
        "https://shop.example.test",
        target!.id,
        "2026-07-30T01:10:00.000Z",
      ),
    ).toMatchObject({ status: "retry" });
    expect(
      await deliverNotificationJob(
        env.DB,
        provider,
        "https://shop.example.test",
        target!.id,
        "2026-07-30T01:30:00.000Z",
      ),
    ).toMatchObject({ status: "sent" });

    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM notification_attempts WHERE job_id = ?")
        .bind(target!.id)
        .first(),
    ).toEqual({ count: 3 });
  });

  test("permanent failure is visible and safe replay reuses the deduplication identity", async () => {
    const target = await receiptJob();
    const failing = new FakeEmailProvider();
    failing.failures = [
      new EmailProviderError("invalid_recipient", "Recipient address is invalid.", false),
    ];

    expect(
      await deliverNotificationJob(env.DB, failing, "https://shop.example.test", target!.id),
    ).toMatchObject({ status: "dead_letter" });
    const deadLetters = await listNotificationJobs(env.DB, {
      page: 1,
      pageSize: 20,
      status: "dead_letter",
    });
    expect(deadLetters.data[0]).toMatchObject({
      id: target!.id,
      lastErrorCode: "invalid_recipient",
      status: "dead_letter",
    });

    await replayNotificationJob(env.DB, target!.id, {
      actorId: "admin-operations",
      reason: "Corrected recipient address",
    });
    const recovered = new FakeEmailProvider();
    expect(
      await deliverNotificationJob(env.DB, recovered, "https://shop.example.test", target!.id),
    ).toMatchObject({ status: "sent" });
    expect(recovered.messages[0]?.idempotencyKey).toBe(target!.deduplication_key);
  });

  test("repeated transient failure exhausts the bounded attempt budget", async () => {
    const target = await receiptJob();
    const provider = new FakeEmailProvider();
    provider.failures = Array.from(
      { length: 3 },
      () => new EmailProviderError("provider_timeout", "Provider timed out.", true),
    );

    expect(
      await deliverNotificationJob(
        env.DB,
        provider,
        "https://shop.example.test",
        target.id,
        "2026-07-30T03:00:00.000Z",
      ),
    ).toMatchObject({ status: "retry" });
    expect(
      await deliverNotificationJob(
        env.DB,
        provider,
        "https://shop.example.test",
        target.id,
        "2026-07-30T03:10:00.000Z",
      ),
    ).toMatchObject({ status: "retry" });
    expect(
      await deliverNotificationJob(
        env.DB,
        provider,
        "https://shop.example.test",
        target.id,
        "2026-07-30T03:30:00.000Z",
      ),
    ).toMatchObject({ status: "dead_letter" });
    expect(
      await env.DB.prepare(
        "SELECT status, attempt_count, last_error_code FROM notification_jobs WHERE id = ?",
      )
        .bind(target.id)
        .first(),
    ).toEqual({
      attempt_count: 3,
      last_error_code: "provider_timeout",
      status: "dead_letter",
    });
  });

  test("duplicate queue delivery starts one stable workflow instance", async () => {
    const target = await receiptJob();
    let created = false;
    const workflow = {
      async create() {
        if (created) throw new Error("instance already exists");
        created = true;
        return {};
      },
      async get() {
        return {
          async status() {
            return { status: "running" as const };
          },
        };
      },
    };
    const acknowledgements: string[] = [];
    const messages = ["first", "duplicate"].map((id) => ({
      ack: () => acknowledgements.push(id),
      attempts: 1,
      body: { jobId: target.id },
      id,
      retry: () => {
        throw new Error("duplicate delivery must not retry");
      },
      timestamp: new Date(),
    }));

    await consumeNotificationQueue(
      {
        ackAll() {},
        messages,
        queue: "shoppp-staging-notifications",
        retryAll() {},
      } as unknown as MessageBatch<unknown>,
      {
        DB: env.DB,
        NOTIFICATION_WORKFLOW: workflow as unknown as Workflow,
      } as unknown as ApiBindings,
    );

    expect(created).toBe(true);
    expect(acknowledgements).toEqual(["first", "duplicate"]);
  });

  test("the dead-letter queue makes exhausted work operator-visible", async () => {
    const target = await receiptJob();
    let acknowledged = false;
    await consumeNotificationQueue(
      {
        ackAll() {},
        messages: [
          {
            ack: () => {
              acknowledged = true;
            },
            attempts: 4,
            body: { jobId: target.id },
            id: "dead-letter",
            retry() {},
            timestamp: new Date(),
          },
        ],
        queue: "shoppp-staging-notifications-dlq",
        retryAll() {},
      } as unknown as MessageBatch<unknown>,
      { DB: env.DB } as unknown as ApiBindings,
    );

    expect(acknowledged).toBe(true);
    expect(
      await env.DB.prepare(
        "SELECT status, attempt_count, last_error_code FROM notification_jobs WHERE id = ?",
      )
        .bind(target.id)
        .first(),
    ).toEqual({
      attempt_count: 1,
      last_error_code: "queue_delivery_exhausted",
      status: "dead_letter",
    });
  });
});
