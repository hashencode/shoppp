import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const runbook = readFile(resolve(import.meta.dir, "../docs/runbooks/local-first-ci.md"), "utf8");
const availabilityRunbook = readFile(
  resolve(import.meta.dir, "../docs/runbooks/github-first-release-availability.md"),
  "utf8",
);
const releaseRunbook = readFile(resolve(import.meta.dir, "../docs/runbooks/release.md"), "utf8");
const productMasterPlan = readFile(
  resolve(import.meta.dir, "../docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md"),
  "utf8",
);

function markdownSection(contents: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = contents.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = contents.indexOf("\n## ", start + marker.length);
  return contents.slice(start, end === -1 ? undefined : end);
}

function markdownTableRows(contents: string): string[][] {
  return contents
    .split("\n")
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
}

function tableRow(contents: string, firstCell: string): string[] {
  const matches = markdownTableRows(contents).filter((cells) => cells[0] === firstCell);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function normalizedMarkdown(contents: string): string {
  return contents.replace(/\s+/g, " ");
}

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

  test("publishes the four GitHub-first availability states and their authority boundaries", async () => {
    const [availability, local, release] = await Promise.all([
      availabilityRunbook,
      runbook,
      releaseRunbook,
    ]);

    const states = markdownSection(availability, "Availability states");
    const normal = tableRow(states, "`normal`");
    expect(normal).toHaveLength(5);
    expect(normal[2]).toContain("Local fast and post-commit commands continue normally");
    expect(normal[3]).toContain("protected GitHub workflow may validate and deploy");
    expect(normal[4]).toContain("move to the matching degraded state");

    const actionsDegraded = tableRow(states, "`actions-degraded`");
    expect(actionsDegraded).toHaveLength(5);
    expect(actionsDegraded[2]).toContain("Local development may continue");
    expect(actionsDegraded[3]).toContain("Formal release is paused");
    expect(actionsDegraded[4]).toContain("enter `recovery-audit`");

    const githubUnavailable = tableRow(states, "`github-unavailable`");
    expect(githubUnavailable).toHaveLength(5);
    expect(githubUnavailable[2]).toContain("already available clean checkout");
    expect(githubUnavailable[3]).toContain("No staging or production workflow is dispatched");
    expect(githubUnavailable[4]).toContain("reconcile remote source and workflow state");

    const recoveryAudit = tableRow(states, "`recovery-audit`");
    expect(recoveryAudit).toHaveLength(5);
    expect(recoveryAudit[2]).toContain("reports remain development evidence");
    expect(recoveryAudit[3]).toContain("new exact-SHA hosted run establishes fresh proof");
    expect(recoveryAudit[4]).toContain("same-run artifact verification");
    expect(recoveryAudit[4]).toContain("return to `normal`");

    expect(availability).toMatch(
      /local, self-hosted, or historical evidence[^.]*must not substitute/i,
    );
    expect(local).toContain("GitHub-first release availability");
    expect(release).toContain("GitHub-first availability and recovery");
  });

  test("inventories every release dependency and fails closed on unavailable artifacts", async () => {
    const contents = await availabilityRunbook;

    const inventory = markdownSection(contents, "Provider dependency inventory");
    const surfaces = [
      "Source remote",
      "Workflow triggers and Actions control plane",
      "GitHub-hosted runners",
      "Environments, secrets, and approvals",
      "Workflow artifacts",
      "Status checks",
      "GitHub Releases",
      "Cloudflare Workers and D1",
      "Deployment audit",
      "Package registry and bootstrap network",
    ];

    for (const surface of surfaces) {
      const row = tableRow(inventory, surface);
      expect(row).toHaveLength(5);
      expect(row.every((cell) => cell.length > 0)).toBe(true);
    }

    expect(tableRow(inventory, "Surface")).toEqual([
      "Surface",
      "Development impact",
      "Release impact",
      "Recovery owner",
      "Acceptable outage behavior",
    ]);

    const artifacts = tableRow(inventory, "Workflow artifacts");
    expect(artifacts[1]).toContain("Local reports may diagnose development state");
    expect(artifacts[2]).toContain("cannot be joined or retained");
    expect(artifacts[3]).toBe("Release operator");
    expect(artifacts[4]).toContain("fails closed");

    const environments = tableRow(inventory, "Environments, secrets, and approvals");
    expect(environments[1]).toContain("Ordinary local development remains credential-free");
    expect(environments[2]).toContain(
      "credentials and approvals cannot be safely exposed or audited",
    );
    expect(environments[3]).toBe("Environment owner for staging or production");
    expect(environments[4]).toContain("Pause every credentialed job");

    const cloudflare = tableRow(inventory, "Cloudflare Workers and D1");
    expect(cloudflare[1]).toContain("Local development may continue");
    expect(cloudflare[2]).toContain("baseline capture, verification, reconciliation, or rollback");
    expect(cloudflare[3]).toBe("Environment owner and deployment operator");
    expect(cloudflare[4]).toContain("Stop before mutation when preconditions fail");
  });

  test("scopes artifact refusal and recovery rehearsal to their governing sections", async () => {
    const contents = await availabilityRunbook;
    const states = markdownSection(contents, "Availability states");
    const artifacts = markdownSection(contents, "Fail-closed artifact handling");
    const recovery = markdownSection(contents, "Recovery audit");
    const stateText = normalizedMarkdown(states);
    const artifactText = normalizedMarkdown(artifacts);
    const recoveryText = normalizedMarkdown(recovery);

    expect(stateText).toContain("allowlisted structured fields");
    expect(stateText).toContain("Do not include free-form provider observations");
    expect(stateText).toContain("redact incidental sensitive values");
    expect(stateText).toContain("R32 canary-secret scan");
    expect(stateText).toContain("refuse publication or retention");

    expect(artifactText).toContain("artifact uniquely named for its source SHA");
    expect(artifactText).toContain("same caller GitHub run and attempt");
    expect(artifactText).toContain(
      "trusted GitHub source checkout and same-run artifact download may precede verification",
    );
    expect(artifactText).toContain("before its first Cloudflare Workers or D1 operation");
    expect(artifactText).toContain(
      "Do not retry a failed deployment job against historical artifacts",
    );
    expect(artifactText).toContain("dispatch a new exact-SHA hosted run");

    expect(recoveryText).toContain("production promotion disabled");
    expect(recoveryText).toContain("captures the exact pre-mutation Worker/D1 baseline");
    expect(recoveryText).toContain("refuses unsafe pending migrations");
    expect(recoveryText).toContain("restores exact Worker versions and release lifecycle");
    expect(recoveryText).toContain("reconciles run-scoped D1 state");
    expect(recoveryText).toContain("verifies the restored safe state");
    expect(recoveryText).toContain("Human-access and production jobs remain skipped");
    expect(recoveryText).toContain("production mutation remains disabled");
  });

  test("keeps the product master pointer and plan register on CI-U11.1", async () => {
    const contents = await productMasterPlan;
    const frontmatter = contents.slice(0, contents.indexOf("\n---", 4) + 4);
    const pointer = markdownSection(contents, "Current execution pointer");
    const register = markdownSection(contents, "Product-plan register");

    expect(frontmatter).toContain("current_plan: 2026-08-19-1737-refactor-local-first-ci-plan.md");
    expect(frontmatter).toContain("current_unit: CI-U11.1");
    expect(pointer).toContain("**Current parent/child stage:** `CI-U11.1`");

    const activeRows = markdownTableRows(register).filter((row) =>
      row.some((cell) => cell.includes("**Active at")),
    );
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]![0]).toBe("`CI`");
    expect(activeRows[0]![3]).toContain("**Active at `CI-U11.1`");

    const fashion = tableRow(register, "`FS`");
    expect(fashion[3]).toContain("waiting at the completed `FS-U8.2` cleanup-only handoff");
    expect(fashion[3]).toContain("behind active `CI-U11.1`");

    expect(tableRow(register, "`CI`")[3]).toContain("CI-U8.3");
  });
});
