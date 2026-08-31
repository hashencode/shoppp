import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import {
  buildBootstrapSql,
  productionConfirmation,
  runBootstrapAdmin,
  validateBootstrapOptions,
} from "./bootstrap-admin";

const FASHION_OPERATOR = {
  displayName: "Fashion Staging Owner",
  email: "fashion-owner@example.test",
} as const;

describe("guarded administrator bootstrap command", () => {
  test("maps test exclusively to the staging/test D1 environment", async () => {
    const commands: string[][] = [];
    await runBootstrapAdmin(
      {
        databaseIdentity: "shoppp-staging",
        email: "Admin@Example.test",
        environment: "test",
      },
      async (command) => {
        commands.push([...command]);
        return 0;
      },
    );
    expect(commands).toHaveLength(1);
    expect(commands[0]).toContain("--remote");
    expect(commands[0]).toContain("staging");
    expect(commands[0]).not.toContain("development");
  });

  test("maps Fashion staging exclusively to its dedicated D1 and preserves the operator name", async () => {
    const commands: string[][] = [];
    await runBootstrapAdmin(
      {
        databaseIdentity: "shoppp-fashion-staging",
        ...FASHION_OPERATOR,
        environment: "fashion-staging",
      },
      async (command) => {
        commands.push([...command]);
        return 0;
      },
    );
    expect(commands).toHaveLength(1);
    expect(commands[0]![0]).toBe("apps/api/node_modules/.bin/wrangler");
    expect(commands[0]![commands[0]!.indexOf("--env") + 1]).toBe("fashion-staging");
    expect(commands[0]!.join(" ")).toContain(FASHION_OPERATOR.displayName);
  });

  test("reuses one deterministic invitation and resets only an unsent delivery on rerun", async () => {
    const results = [];
    const commands: string[][] = [];
    const options = {
      databaseIdentity: "shoppp-fashion-staging",
      ...FASHION_OPERATOR,
      environment: "fashion-staging" as const,
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      results.push(
        await runBootstrapAdmin(options, async (command) => {
          commands.push([...command]);
          return 0;
        }),
      );
    }
    expect(results[0]).toEqual(results[1]);
    const sql = commands[0]![commands[0]!.indexOf("--command") + 1]!;
    expect(sql).toContain("ON CONFLICT(idempotency_key) DO NOTHING");
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE SET status = 'pending'");
    expect(sql).toContain("WHERE notification_jobs.status <> 'sent'");
  });

  test("requires an exact production database/email confirmation before running", async () => {
    const options = {
      databaseIdentity: "shoppp-production",
      email: "Owner@Example.test",
      environment: "production" as const,
    };
    expect(() => validateBootstrapOptions(options)).toThrow(/confirmation/);
    const confirmation = productionConfirmation(options);
    expect(confirmation).toBe("BOOTSTRAP_PRODUCTION:shoppp-production:owner@example.test");
    expect(validateBootstrapOptions({ ...options, confirmation })).toMatchObject({
      email: "owner@example.test",
    });
  });

  test("rejects database identities outside the canonical environment mapping", () => {
    expect(() =>
      validateBootstrapOptions({
        databaseIdentity: "shoppp-test",
        email: "admin@example.test",
        environment: "test",
      }),
    ).toThrow(/shoppp-staging/);
    expect(() =>
      validateBootstrapOptions({
        confirmation: "BOOTSTRAP_PRODUCTION:shoppp-staging:admin@example.test",
        databaseIdentity: "shoppp-staging",
        email: "admin@example.test",
        environment: "production",
      }),
    ).toThrow(/shoppp-production/);
  });

  test("builds guarded SQL with an invitation and audit but no password or bearer secret", () => {
    const sql = buildBootstrapSql(
      {
        databaseIdentity: "shoppp-staging",
        email: "admin@example.test",
        environment: "test",
      },
      { auditId: "audit-1", invitationId: "invitation-1" },
      "2026-08-04T00:00:00.000Z",
    );
    expect(sql).toContain("invalid_count = 0");
    expect(sql).toContain("WHEN 1 THEN 0 ELSE 1 END");
    expect(sql).toContain("iam.bootstrap.invitation");
    expect(sql).toContain("admin_invitation");
    expect(sql).not.toMatch(/password|bearer|access_token/i);
  });

  test("builds the durable Fashion invitation with a display name and no credential", () => {
    const sql = buildBootstrapSql(
      {
        databaseIdentity: "shoppp-fashion-staging",
        ...FASHION_OPERATOR,
        environment: "fashion-staging",
      },
      { auditId: "audit-fashion", invitationId: "invitation-fashion" },
      "2026-08-31T00:00:00.000Z",
    );
    expect(sql).toContain(`'${FASHION_OPERATOR.displayName}'`);
    expect(sql).toContain('"environment":"fashion-staging"');
    expect(sql).not.toMatch(/password|bearer|access_token/i);
  });

  test("executes the resumable Fashion bootstrap twice without duplicating state", () => {
    using database = new Database(":memory:");
    database.exec(`
      CREATE TABLE admin_roles (id TEXT PRIMARY KEY, protected INTEGER, enabled INTEGER);
      CREATE TABLE admin_identities (
        id TEXT PRIMARY KEY, principal_kind TEXT, enabled INTEGER, role_id TEXT
      );
      CREATE TABLE admin_invitations (
        id TEXT PRIMARY KEY, normalized_email TEXT, display_name TEXT, role_id TEXT,
        status TEXT, idempotency_key TEXT UNIQUE, invited_by_id TEXT, expires_at TEXT,
        accepted_identity_id TEXT, accepted_at TEXT, revoked_at TEXT, version INTEGER,
        created_at TEXT, updated_at TEXT
      );
      CREATE UNIQUE INDEX admin_invitations_active_email_unique
        ON admin_invitations(normalized_email) WHERE status = 'pending';
      CREATE TABLE notification_jobs (
        id TEXT PRIMARY KEY, order_id TEXT, type TEXT, deduplication_key TEXT UNIQUE,
        payload_json TEXT, status TEXT, attempt_count INTEGER, max_attempts INTEGER,
        attempt_cycle_count INTEGER DEFAULT 0, next_attempt_at TEXT, claim_expires_at TEXT,
        enqueued_at TEXT, sent_at TEXT, provider_message_id TEXT, dead_lettered_at TEXT,
        last_error_code TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE audit_events (
        id TEXT PRIMARY KEY, actor_type TEXT, actor_id TEXT, action TEXT, target_type TEXT,
        target_id TEXT, result TEXT, reason TEXT, request_id TEXT, metadata_json TEXT,
        created_at TEXT
      );
      INSERT INTO admin_roles VALUES ('role-admin', 1, 1);
    `);
    const sql = buildBootstrapSql(
      {
        databaseIdentity: "shoppp-fashion-staging",
        ...FASHION_OPERATOR,
        environment: "fashion-staging",
      },
      { auditId: "audit-resumable", invitationId: "inv_resumable" },
      "2026-08-31T00:00:00.000Z",
    );
    database.exec(sql);
    database.exec(
      "UPDATE notification_jobs SET status = 'dead_letter', attempt_count = 3, attempt_cycle_count = 3",
    );
    database.exec(sql);
    expect(
      database.query("SELECT COUNT(*) AS count FROM admin_invitations").get() as { count: number },
    ).toEqual({ count: 1 });
    expect(database.query("SELECT status, attempt_count FROM notification_jobs").get()).toEqual({
      attempt_count: 0,
      status: "pending",
    });
    database.exec(
      "UPDATE notification_jobs SET status = 'sent', attempt_count = 1, updated_at = 'sent-at'",
    );
    database.exec(sql);
    expect(
      database.query("SELECT status, attempt_count, updated_at FROM notification_jobs").get(),
    ).toEqual({ attempt_count: 1, status: "sent", updated_at: "sent-at" });
  });

  test("does not retry a failed database mutation", async () => {
    let attempts = 0;
    await expect(
      runBootstrapAdmin(
        {
          databaseIdentity: "shoppp-staging",
          email: "admin@example.test",
          environment: "test",
        },
        async () => {
          attempts += 1;
          return 1;
        },
      ),
    ).rejects.toThrow(/no retry/);
    expect(attempts).toBe(1);
  });
});
