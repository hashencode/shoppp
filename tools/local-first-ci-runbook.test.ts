import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const runbook = readFile(resolve(import.meta.dir, "../docs/runbooks/local-first-ci.md"), "utf8");

describe("local-first CI runner operations contract", () => {
  test("requires complete acceptance before repository-controlled code", async () => {
    const contents = await runbook;
    for (const id of [
      "RUN-ACCEPT-AUTHORITY",
      "RUN-ACCEPT-ACCOUNT",
      "RUN-ACCEPT-ISOLATION",
      "RUN-ACCEPT-CREDENTIALS",
      "RUN-ACCEPT-LABELS",
      "RUN-ACCEPT-ADMISSION",
      "RUN-ACCEPT-TOOLS",
      "RUN-ACCEPT-SERVICE",
      "RUN-ACCEPT-WORKSPACE",
    ]) {
      expect(contents).toContain(`- [ ] **${id}**`);
    }
    expect(contents).toContain("dedicated non-admin macOS account");
    expect(contents).toMatch(/`self-hosted`,\s+`macOS`,\s+`ARM64`,\s+`shoppp-main-nonsecret`/);
    expect(contents).toContain("`contents: read`");
    expect(contents).toContain("`persist-credentials: false`");
  });

  test("keeps CI and FS-U8 runner authority disjoint", async () => {
    const contents = await runbook;
    expect(contents).toContain("Last reconciled 2026-08-24");
    expect(contents).toMatch(/dated snapshot, not current\s+authority/);
    expect(contents).toMatch(/read the live Fashion and product-master checkpoints/);
    expect(contents).toContain("fashion-staging-preview");
    expect(contents).toContain("fashion-staging-u8");
    expect(contents).toContain("fashion-staging");
    expect(contents).toMatch(/must never be\s+assigned/);
    expect(contents).toMatch(/no deployment\s+environment/);
  });

  test("admits only a human-approved exact SHA before checkout", async () => {
    const contents = await runbook;
    expect(contents).toContain("root-owned exact-SHA admission allowlist");
    expect(contents).toContain("human-authenticated host command");
    expect(contents).toContain("verified passing local post-commit report");
    expect(contents).toContain("before checkout");
    expect(contents).toContain("root-owned, non-writable executable dispatcher");
    expect(contents).toContain("ACTIONS_RUNNER_HOOK_JOB_STARTED=<absolute-dispatcher-path>");
    expect(contents).toContain("`GITHUB_EVENT_PATH`");
    expect(contents).toContain("internal timeout");
    expect(contents).toContain("synthetic event payloads");
    expect(contents).toContain("without creating a checkout");
    expect(contents).toContain("repository code cannot modify");
  });

  test("fails closed on drift and uses disposable job isolation", async () => {
    const contents = await runbook;
    for (const id of [
      "RUN-REJECT-ADMISSION",
      "RUN-REJECT-WORKFLOW",
      "RUN-REJECT-CREDENTIAL",
      "RUN-REJECT-WORKTREE",
      "RUN-REJECT-LABEL",
      "RUN-REJECT-TOOL",
      "RUN-REJECT-WORKSPACE",
      "RUN-REJECT-CLEANUP",
    ]) {
      expect(contents).toMatch(new RegExp("\\| `" + id + "`\\s+\\|"));
    }
    expect(contents).toMatch(/one disposable\s+workspace per job/);
    expect(contents).toContain("tracked, untracked, and material ignored-path manifests");
    expect(contents).toContain("infrastructure failure");
    expect(contents).toContain("test failure");
  });

  test("keeps human operations, recovery, and compromise response auditable", async () => {
    const contents = await runbook;
    expect(contents).toMatch(/Registration token[^.]*human-only\./);
    expect(contents).toMatch(/Runner service installation[^.]*human-only\./);
    expect(contents).toMatch(/Credential inspection[^;]*human-only;/i);
    expect(contents).toContain("10-minute expected-online queue threshold");
    expect(contents).toContain("same tested commit SHA");
    expect(contents).toContain("Compromise isolation and recovery");
    expect(contents).toContain("disable new jobs");
    expect(contents).toContain("invalidate every report since the last trusted checkpoint");
    expect(contents).toContain("clean rebuild and same-SHA replay");
    expect(contents).toContain("Deregister and clean exact paths");
    expect(contents).toContain("Never delete a branch");
  });
});
