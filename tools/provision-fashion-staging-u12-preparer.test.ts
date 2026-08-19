import { describe, expect, test } from "bun:test";

import { fashionStagingU12PreparerSql } from "./provision-fashion-staging-u12-preparer";

describe("Fashion U12 least-privilege preparer", () => {
  test("requires exact authorization and emits only the five preparation permissions", async () => {
    await expect(
      fashionStagingU12PreparerSql("t".repeat(40), "PROVISION SOMETHING ELSE"),
    ).rejects.toThrow(/confirmation is invalid/);

    const token = "t".repeat(40);
    const sql = await fashionStagingU12PreparerSql(
      token,
      "PROVISION FASHION U12 PREPARER",
      "2026-08-18T00:00:00.000Z",
    );
    for (const permission of [
      "catalog.read",
      "themes.approve",
      "themes.preview",
      "themes.read",
      "themes.write",
    ]) {
      expect(sql).toContain(`'${permission}'`);
    }
    expect(sql).not.toContain("catalog.write");
    expect(sql).not.toContain("iam.roles.write");
    expect(sql).not.toContain(token);
    expect(sql).not.toContain("BEGIN TRANSACTION");
    expect(sql).not.toContain("COMMIT;");
    expect(sql).toContain("_fashion_u12_preparer_guard");
  });
});
