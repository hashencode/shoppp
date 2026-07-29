import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import {
  finishD1Export,
  reconcileRestoredDatabase,
  startD1Export,
} from "../../src/operations/d1-backup";

describe("scheduled D1 backup and restore reconciliation", () => {
  test("polls the official D1 export API and streams the SQL dump to isolated R2", async () => {
    const calls: Array<{ body?: string; url: string }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ ...(typeof init?.body === "string" ? { body: init.body } : {}), url });
      if (url === "https://backup.example.test/dump.sql") {
        return new Response("CREATE TABLE restored(id TEXT PRIMARY KEY);", { status: 200 });
      }
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      return Response.json({
        result:
          body.output_format === "polling"
            ? { at_bookmark: "bookmark-001" }
            : {
                filename: "backup.sql",
                signed_url: "https://backup.example.test/dump.sql",
              },
        success: true,
      });
    };
    const request = {
      accountId: "account-staging",
      apiToken: "test-api-token",
      databaseId: "database-staging",
      fetcher,
    };
    const bookmark = await startD1Export(request);
    await finishD1Export(request, bookmark, env.BACKUP_BUCKET, "d1/staging/2026-07-30/backup.sql");
    expect(bookmark).toBe("bookmark-001");
    expect(calls.map(({ body }) => body && JSON.parse(body))).toEqual(
      expect.arrayContaining([{ output_format: "polling" }, { current_bookmark: "bookmark-001" }]),
    );
    expect(
      await (await env.BACKUP_BUCKET.get("d1/staging/2026-07-30/backup.sql"))?.text(),
    ).toContain("CREATE TABLE restored");
    expect(JSON.stringify(calls)).not.toContain("test-api-token");
  });

  test("passes database, foreign-key, order-total, and inventory checks after restore", async () => {
    await applyD1Migrations(env.RESTORE_DB, env.TEST_MIGRATIONS);
    await seedLaunchFixture(env.RESTORE_DB);
    await expect(reconcileRestoredDatabase(env.RESTORE_DB)).resolves.toEqual({
      foreignKeyViolations: 0,
      inventoryViolations: 0,
      orderTotalViolations: 0,
      quickCheck: "ok",
    });
  });
});
