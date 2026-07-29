import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import { createApp } from "../../src/http/app";

const NOW = "2026-07-30T02:00:00.000Z";
const JOB_ID = "notify_recovery_api_001";

async function seedOperator(role: string, subject: string): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO admin_identities
       (id, access_subject, email, display_name, role, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(`admin-${subject}`, subject, `${subject}@example.test`, subject, role, NOW, NOW)
    .run();
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Cf-Access-Jwt-Assertion": "test-token",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

beforeAll(async () => {
  await seedLaunchFixture(env.DB);
  await seedOperator("operations", "notification-operator");
  await seedOperator("support", "notification-support");
  const order = await env.DB.prepare("SELECT id FROM orders ORDER BY id LIMIT 1").first<{
    id: string;
  }>();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO notification_jobs
       (id, order_id, type, deduplication_key, payload_json, status, attempt_count,
        attempt_cycle_count, max_attempts, last_error_code, dead_lettered_at,
        created_at, updated_at)
     VALUES (?, ?, 'order_receipt', ?, ?, 'dead_letter', 3, 3, 3,
             'email_provider_timeout', ?, ?, ?)`,
  )
    .bind(
      JOB_ID,
      order!.id,
      `test.recovery:${JOB_ID}`,
      JSON.stringify({ orderId: order!.id }),
      NOW,
      NOW,
      NOW,
    )
    .run();
});

describe("notification recovery API", () => {
  test("authorized operations staff can list and idempotently replay a dead letter", async () => {
    const app = createApp({
      accessVerifier: async () => ({
        email: "notification-operator@example.test",
        subject: "notification-operator",
      }),
    });
    const listed = await app.fetch(
      request(`/admin/operations/jobs?status=dead_letter&query=${JOB_ID}`),
      env,
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      data: [
        {
          id: JOB_ID,
          lastErrorCode: "email_provider_timeout",
          recipient: expect.stringMatching(/\*\*\*@/),
          status: "dead_letter",
        },
      ],
    });

    const replayRequest = () =>
      request(`/admin/operations/jobs/${JOB_ID}/replay`, {
        body: JSON.stringify({
          confirm: true,
          reason: "Provider configuration corrected",
        }),
        headers: { "Idempotency-Key": "notification-replay-api-001" },
        method: "POST",
      });
    const first = await app.fetch(replayRequest(), env);
    const replay = await app.fetch(replayRequest(), env);
    expect(first.status).toBe(200);
    expect(await replay.text()).toBe(await first.text());
    expect(
      await env.DB.prepare(
        "SELECT status, replay_count, attempt_cycle_count FROM notification_jobs WHERE id = ?",
      )
        .bind(JOB_ID)
        .first(),
    ).toEqual({ attempt_cycle_count: 0, replay_count: 1, status: "pending" });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'notifications.replay' AND target_id = ?",
      )
        .bind(JOB_ID)
        .first(),
    ).toEqual({ count: 1 });
  });

  test("support staff cannot list or directly replay recovery jobs and denial is audited", async () => {
    const app = createApp({
      accessVerifier: async () => ({
        email: "notification-support@example.test",
        subject: "notification-support",
      }),
    });
    expect((await app.fetch(request("/admin/operations/jobs"), env)).status).toBe(403);
    const denied = await app.fetch(
      request(`/admin/operations/jobs/${JOB_ID}/replay`, {
        body: JSON.stringify({ confirm: true, reason: "Unauthorized replay" }),
        headers: { "Idempotency-Key": "notification-replay-denied-001" },
        method: "POST",
      }),
      env,
    );
    expect(denied.status).toBe(403);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM audit_events
          WHERE actor_id = 'admin-notification-support'
            AND action IN ('operations.jobs.read', 'operations.replay')
            AND result = 'denied'`,
      ).first(),
    ).toEqual({ count: 2 });
  });
});
