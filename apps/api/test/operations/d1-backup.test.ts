import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import {
  finishD1Export,
  reconcileRestoredDatabase,
  startScheduledD1Backup,
  startD1Export,
} from "../../src/operations/d1-backup";

describe("scheduled D1 backup and restore reconciliation", () => {
  test("starts one deterministic Workflow instance per UTC day", async () => {
    const instances = new Map<string, { id: string }>();
    const workflow = {
      async create(options: { id?: string }) {
        const id = options.id!;
        if (instances.has(id)) throw new Error("instance already exists");
        const instance = { id };
        instances.set(id, instance);
        return instance;
      },
      async get(id: string) {
        const instance = instances.get(id);
        if (!instance) throw new Error("instance does not exist");
        return instance;
      },
    } as unknown as Workflow;

    await expect(
      startScheduledD1Backup(workflow, Date.parse("2026-07-30T00:00:00.000Z")),
    ).resolves.toMatchObject({ id: "scheduled-2026-07-30" });
    await expect(
      startScheduledD1Backup(workflow, Date.parse("2026-07-30T00:05:00.000Z")),
    ).resolves.toMatchObject({ id: "scheduled-2026-07-30" });
    expect(instances).toHaveLength(1);
  });

  test("preserves the Workflow create error when no daily instance exists", async () => {
    const createError = new Error("workflow unavailable");
    const workflow = {
      async create() {
        throw createError;
      },
      async get() {
        throw new Error("instance does not exist");
      },
    } as unknown as Workflow;

    await expect(
      startScheduledD1Backup(workflow, Date.parse("2026-07-30T00:00:00.000Z")),
    ).rejects.toBe(createError);
  });

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
          body.current_bookmark === "bookmark-001"
            ? {
                result: {
                  filename: "backup.sql",
                  signed_url: "https://backup.example.test/dump.sql",
                },
                status: "complete",
              }
            : { at_bookmark: "bookmark-001" },
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
      expect.arrayContaining([
        { output_format: "polling" },
        { current_bookmark: "bookmark-001", output_format: "polling" },
      ]),
    );
    expect(
      await (await env.BACKUP_BUCKET.get("d1/staging/2026-07-30/backup.sql"))?.text(),
    ).toContain("CREATE TABLE restored");
    expect(JSON.stringify(calls)).not.toContain("test-api-token");
  });

  test.each([
    { error: "Export cancelled.", status: "error" as const },
    { error: "Not currently exporting anything." },
  ])("fails when Cloudflare reports a terminal export error: $error", async (result) => {
    const request = {
      accountId: "account-staging",
      apiToken: "test-api-token",
      databaseId: "database-staging",
      fetcher: async () =>
        Response.json({
          result,
          success: true,
        }),
    };

    await expect(
      finishD1Export(request, "bookmark-001", env.BACKUP_BUCKET, "unused.sql"),
    ).rejects.toThrow("d1_export_error");
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
