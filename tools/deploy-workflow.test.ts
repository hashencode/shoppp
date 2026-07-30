import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = resolve(import.meta.dir, "../.github/workflows/deploy.yml");

describe("production promotion workflow", () => {
  test("defaults to staging-only and requires explicit release confirmation", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("promote_production:");
    expect(workflow).toContain("default: false");
    expect(workflow).toContain('test "$PRODUCTION_CONFIRMATION" = "PROMOTE $RELEASE_ID"');
    expect(workflow).toContain(
      '[[ "$PRODUCTION_BACKUP_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$ ]]',
    );
  });

  test("verifies a recent ready production backup before migration", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const backupVerification = workflow.indexOf("Verify recent production backup before migration");
    const migration = workflow.indexOf("Apply production D1 migrations after approved backup");

    expect(backupVerification).toBeGreaterThan(0);
    expect(migration).toBeGreaterThan(backupVerification);
    expect(workflow).toContain("environment = 'production'");
    expect(workflow).toContain("status = 'ready'");
    expect(workflow).toContain("datetime(completed_at) >= datetime('now', '-24 hours')");
    expect(workflow).toContain(
      "RELEASE_BACKUP_ID: ${{ needs.approve-production.outputs.backup_id }}",
    );
  });
});
