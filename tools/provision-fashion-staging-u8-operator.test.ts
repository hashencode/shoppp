import { describe, expect, test } from "bun:test";

import {
  fashionStagingU8OperatorSql,
  readNoEchoBootstrapCredential,
} from "./provision-fashion-staging-u8-operator";

const input = () => ({
  action: "provision" as const,
  confirmation: "PROVISION FASHION U8 OPERATOR fashion-u8-run-1",
  expiresAt: "2026-08-24T04:00:00.000Z",
  now: "2026-08-24T02:00:00.000Z",
  runId: "fashion-u8-run-1",
});

describe("Fashion staging U8 human operator", () => {
  test("provisions one expiring run-namespaced operator with exact minimal permissions", async () => {
    const credential = "Correct-Horse-Battery-Staple-U8-2026!";
    const sql = await fashionStagingU8OperatorSql(input(), credential);
    expect(sql).toContain("identity_fashion_u8_fashion_u8_run_1");
    expect(sql).toContain("2026-08-24T04:00:00.000Z");
    for (const permission of [
      "catalog.read",
      "themes.approve",
      "themes.preview",
      "themes.read",
      "themes.write",
    ])
      expect(sql).toContain(`'${permission}'`);
    for (const forbidden of ["catalog.write", "iam.users.write", "orders.read"]) {
      expect(sql).not.toContain(`'${forbidden}'`);
    }
    expect(sql).not.toContain(credential);
    expect(sql).toContain("expires_at");
    expect(sql).toContain("UPDATE admin_sessions SET revoked_at");
    expect(sql).toContain("identity_fashion_u8_%");
    expect(sql).toContain("access_subject = excluded.access_subject");
    expect(sql).toContain("normalized_email = excluded.normalized_email");
    expect(sql).toContain("protected = 0");
    expect(sql).toContain("system = 0");
    expect(sql).toContain(
      "access_subject = 'password:fashion-u8-fashion_u8_run_1@operators.invalid'",
    );
  });

  test("requires exact confirmation, bounded future expiry, and a high-entropy credential", async () => {
    await expect(
      fashionStagingU8OperatorSql({ ...input(), confirmation: "PROVISION" }, "A".repeat(40)),
    ).rejects.toThrow(/confirmation/);
    await expect(
      fashionStagingU8OperatorSql(
        { ...input(), expiresAt: "2026-08-25T02:00:00.001Z" },
        "A".repeat(40),
      ),
    ).rejects.toThrow(/expiry/);
    await expect(fashionStagingU8OperatorSql(input(), "short password")).rejects.toThrow(
      /credential/,
    );
  });

  test("emits reconciliation and cleanup that revoke sessions and disable identities", async () => {
    const reconcile = await fashionStagingU8OperatorSql({ ...input(), action: "reconcile" });
    const cleanup = await fashionStagingU8OperatorSql({ ...input(), action: "cleanup" });
    for (const sql of [reconcile, cleanup]) {
      expect(sql).toContain("UPDATE admin_sessions SET revoked_at");
      expect(sql).toContain("UPDATE admin_identities SET enabled = 0");
    }
    expect(cleanup).toContain("identity_fashion_u8_fashion_u8_run_1");
  });

  test("reads the bootstrap credential only from a no-echo input channel", async () => {
    const rawMode: boolean[] = [];
    const source = {
      isTTY: true,
      setRawMode(value: boolean) {
        rawMode.push(value);
      },
      async *[Symbol.asyncIterator]() {
        yield new TextEncoder().encode("Secret-U8-Credential-With-Entropy!\n");
      },
    };
    await expect(readNoEchoBootstrapCredential(source)).resolves.toBe(
      "Secret-U8-Credential-With-Entropy!",
    );
    expect(rawMode).toEqual([true, false]);
  });

  test("accepts TTY return, handles backspace, and restores raw mode on interrupt", async () => {
    const rawMode: boolean[] = [];
    const source = {
      isTTY: true,
      setRawMode(value: boolean) {
        rawMode.push(value);
      },
      async *[Symbol.asyncIterator]() {
        yield new TextEncoder().encode("CorrectHorseX\bBattery9!\r");
      },
    };
    await expect(readNoEchoBootstrapCredential(source)).resolves.toBe("CorrectHorseBattery9!");
    const interrupted = {
      ...source,
      async *[Symbol.asyncIterator]() {
        yield new Uint8Array([3]);
      },
    };
    await expect(readNoEchoBootstrapCredential(interrupted)).rejects.toThrow(/interrupted/);
    expect(rawMode).toEqual([true, false, true, false]);
  });
});
