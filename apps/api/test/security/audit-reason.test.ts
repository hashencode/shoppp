import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { listAuditEvents, recordAuditEvent } from "../../src/iam/audit";
import { normalizeAuditReason } from "../../src/security/audit-reason";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM audit_events WHERE target_type = 'audit_reason_test'").run();
});

describe("audit reason boundary", () => {
  test.each(["line one\nline two", "control\u0007value", "safe\u202Etxt"])(
    "rejects control and bidirectional injection: %s",
    (reason) => {
      expect(() => normalizeAuditReason(reason)).toThrow(/audit reason/i);
    },
  );

  test("normalizes whitespace and redacts credential-shaped values", async () => {
    const credentialShapedTestValue = ["sk", "live", "supersecret"].join("_");
    await recordAuditEvent(env.DB, {
      action: "audit.reason.test",
      actorType: "admin",
      id: "audit_reason_redaction",
      metadata: {
        apiKey: "shoppp_live_abc123",
        nested: { note: "Authorization: Bearer secret-token" },
      },
      reason: `  rotated   token ${credentialShapedTestValue}  `,
      result: "succeeded",
      targetType: "audit_reason_test",
    });

    const row = await env.DB.prepare(
      "SELECT reason, metadata_json FROM audit_events WHERE id = 'audit_reason_redaction'",
    ).first<{ metadata_json: string; reason: string }>();
    expect(row?.reason).toBe("rotated token [REDACTED:credential]");
    expect(row?.metadata_json).not.toContain("abc123");
    expect(row?.metadata_json).not.toContain("secret-token");
  });

  test("redacts legacy stored secrets before returning diagnostics", async () => {
    await env.DB.prepare(
      `INSERT INTO audit_events
        (id, actor_type, action, target_type, result, reason, metadata_json, created_at)
       VALUES ('audit_reason_legacy', 'admin', 'audit.reason.test', 'audit_reason_test',
               'failed', ?, '{}', '2026-09-23T00:00:00.000Z')`,
    )
      .bind("failed\u202E password=hunter2")
      .run();

    const listed = await listAuditEvents(env.DB, {
      action: "audit.reason.test",
      pageSize: 100,
      targetType: "audit_reason_test",
    });
    const legacy = listed.data.find(({ id }) => id === "audit_reason_legacy");
    expect(legacy?.reason).toBe("failed [REDACTED:credential]");
  });
});
