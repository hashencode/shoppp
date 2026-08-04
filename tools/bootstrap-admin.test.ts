import { describe, expect, test } from "bun:test";

import {
  buildBootstrapSql,
  productionConfirmation,
  runBootstrapAdmin,
  validateBootstrapOptions,
} from "./bootstrap-admin";

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

  test("rejects database identities outside the canonical two-database model", () => {
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
