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
const ciPlan = readFile(
  resolve(import.meta.dir, "../docs/plans/2026-08-19-1737-refactor-local-first-ci-plan.md"),
  "utf8",
);
const fashionPlan = readFile(
  resolve(
    import.meta.dir,
    "../docs/plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md",
  ),
  "utf8",
);
const ciU11Evidence = readFile(
  resolve(import.meta.dir, "../docs/progress/ci-u11-github-first-steady-state-review.md"),
  "utf8",
);
const resilienceLearning = readFile(
  resolve(
    import.meta.dir,
    "../docs/solutions/workflow-issues/github-first-release-resilience-for-solo-maintainers-2026-08-28.md",
  ),
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

describe("GitHub-managed cloud CI operations contract", () => {
  test("uses the fixed standard hosted runner and forbids local runner authority", async () => {
    const contents = await runbook;
    expect(contents).toContain("`ubuntu-24.04`");
    expect(contents).toMatch(/No developer\s+machine/);
    expect(contents).toContain("runner listener");
    expect(contents).toMatch(/GitHub-hosted\s+larger or OS-specific runner/);
    expect(contents).toContain("side-effect-free preflight");
    expect(contents).toContain("never triggers runner escalation");
    expect(contents).toContain("`persist-credentials: false`");
  });

  test("keeps shared CI and Fashion protected authority disjoint", async () => {
    const contents = await runbook;
    expect(contents).toContain("active product plan owns the product unit");
    expect(contents).toContain("shared validation and post-commit workflow execution contract");
    expect(contents).toContain("no deployment environment");
    expect(contents).toContain("fashion-staging");
  });

  test("rejects untrusted protected workflow authority before credentials", async () => {
    const contents = await runbook;
    expect(contents).toContain("credential-free `verify-authority`");
    expect(contents).toContain("pull_request_target");
    expect(contents).toContain("unauthorized actors");
    expect(contents).toContain("GitHub OIDC token");
    expect(contents).toContain("`shoppp-fashion-staging`");
  });

  test("classifies failures without changing runner class", async () => {
    const contents = await runbook;
    for (const id of [
      "CI-POLICY-REJECT",
      "CI-CAPABILITY-STOP",
      "CI-INFRASTRUCTURE-FAILURE",
      "CI-TEST-FAILURE",
      "CI-EVIDENCE-REJECT",
    ]) {
      expect(contents).toMatch(new RegExp("\\| `" + id + "`\\s+\\|"));
    }
  });

  test("does not make a hosted runner wait for the U8 operator", async () => {
    const contents = await runbook;
    expect(contents).toContain("`awaiting_operator`");
    expect(contents).toMatch(/uploads only its\s+non-secret manifest, and exits/);
    expect(contents).toContain("No workflow provisions an account or waits for the human");
    expect(contents).toContain("server-side Snapshot and audit");
    expect(contents).toMatch(/separately dispatched hosted\s+acceptance run/);
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
      "Required recovery access",
      "Acceptable outage behavior",
    ]);

    const artifacts = tableRow(inventory, "Workflow artifacts");
    expect(artifacts[1]).toContain("Local reports may diagnose development state");
    expect(artifacts[2]).toContain("cannot be joined or retained");
    expect(artifacts[3]).toBe("GitHub Actions run and artifact access");
    expect(artifacts[4]).toContain("fails closed");

    const environments = tableRow(inventory, "Environments, secrets, and approvals");
    expect(environments[1]).toContain("Ordinary local development remains credential-free");
    expect(environments[2]).toContain(
      "credentials and approvals cannot be safely exposed or audited",
    );
    expect(environments[3]).toBe("GitHub environment and secret administration");
    expect(environments[4]).toContain("Pause every credentialed job");

    const cloudflare = tableRow(inventory, "Cloudflare Workers and D1");
    expect(cloudflare[1]).toContain("Local development may continue");
    expect(cloudflare[2]).toContain("baseline capture, verification, reconciliation, or rollback");
    expect(cloudflare[3]).toBe("Cloudflare Workers and D1 deployment access");
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

  test("hands the product master pointer to REL-Pre-DC after Fashion closure", async () => {
    const [contents, fashionContents] = await Promise.all([productMasterPlan, fashionPlan]);
    const frontmatter = contents.slice(0, contents.indexOf("\n---", 4) + 4);
    const pointer = markdownSection(contents, "Current execution pointer");
    const register = markdownSection(contents, "Product-plan register");
    const fashionCheckpoint = markdownSection(fashionContents, "Execution Checkpoint");

    expect(frontmatter).toContain(
      "current_plan: 2026-08-12-003-refactor-development-candidate-readiness-plan.md",
    );
    expect(frontmatter).toContain("current_unit: REL-Pre-DC");
    expect(pointer).toContain("**Current parent/child stage:** `REL-Pre-DC`");

    const activeRows = markdownTableRows(register).filter((row) =>
      row.some((cell) => cell.includes("**Active at blocked `REL-Pre-DC`")),
    );
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]![0]).toBe("`REL`");

    const fashion = tableRow(register, "`FS`");
    expect(fashion[3]).toContain("**Complete");
    expect(fashion[3]).toContain("U8.3 complete verification passed");

    const ci = tableRow(register, "`CI`");
    expect(ci[3]).toContain("**Complete");
    expect(ci[3]).toContain("Complete for its governed baseline");
    expect(fashionCheckpoint).toContain("**Current sub-stage:** None");
    expect(fashionCheckpoint).toContain("terminal acceptance run `33468537473`");
    expect(fashionCheckpoint).toContain(
      "**Blocker:** None. The Fashion Store functional-integration tail is closed.",
    );
  });

  test("keeps CI-U11.1 proportional to a single-maintainer project", async () => {
    const [plan, master] = await Promise.all([ciPlan, productMasterPlan]);
    const unit = normalizedMarkdown(
      markdownSection(plan, "CI-U11 — Establish steady-state resilience governance"),
    );
    const checkpoint = normalizedMarkdown(markdownSection(plan, "Execution Checkpoint"));
    const pointer = normalizedMarkdown(markdownSection(master, "Current execution pointer"));

    expect(unit).toContain("single-maintainer operating model");
    expect(unit).toMatch(/(?:requires|creates) no owner roster/i);
    expect(unit).toMatch(/(?:requires|creates) no [^.]*responsibility matrix/i);
    expect(unit).toMatch(/(?:requires|creates) no [^.]*escalation tree/i);
    expect(unit).toMatch(/(?:requires|creates) no [^.]*recurring (?:owner|task) assignment/i);
    expect(unit).toMatch(/(?:requires|creates) no [^.]*(?:periodic|calendar) [^.]*ceremony/i);
    expect(unit).toContain("event-driven re-review");
    expect(unit).toMatch(/re-review when [^.]*changes materially/i);
    expect(unit).not.toMatch(/record (?:operating )?owners/i);
    expect(unit).not.toContain("quarterly drills");

    expect(checkpoint).toContain("re-entry triggers and required checks");
    for (const provenance of ["exact branch/ref", "owner", "purpose", "cleanup condition"]) {
      expect(checkpoint).toContain(provenance);
    }

    expect(pointer).toContain("`CI-U11.1` complete");
    expect(pointer).toContain("documented event-driven boundary");
    expect(pointer).not.toMatch(/record (?:operating )?owners/i);
  });

  test("keeps future signing and deployment authorization within existing operating authority", async () => {
    const plan = await ciPlan;
    const requirements = normalizedMarkdown(markdownSection(plan, "Requirements"));
    const scope = normalizedMarkdown(markdownSection(plan, "Scope Boundaries"));
    const r29 = requirements.match(/\*\*R29:\*\* (.*?)(?=- \*\*R30:\*\*)/)?.[1];
    const r30 = requirements.match(/\*\*R30:\*\* (.*?)(?=- \*\*R31:\*\*)/)?.[1];

    expect(r29).toBeDefined();
    expect(r29).toContain("new governed plan");
    for (const authority of [
      "candidate",
      "consumers",
      "trust anchor",
      "key custody",
      "rotation/revocation",
      "operating authority",
    ]) {
      expect(r29).toContain(authority);
    }
    expect(r29).toMatch(/does not create a current .*owner roster/i);

    expect(r30).toBeDefined();
    for (const control of [
      "protected-environment",
      "authorized-actor",
      "explicit-confirmation",
      "exact-source",
      "run-attempt",
    ]) {
      expect(r30).toContain(control);
    }
    expect(r30).toContain("No alternate signed authorization envelope");
    expect(r30).toContain("second credentialed control plane");

    expect(scope).toContain("event-driven GitHub-first operational review");
    expect(scope).not.toContain("periodic GitHub-first operational review");
  });

  test("records an event-driven solo-maintainer operating review", async () => {
    const contents = await availabilityRunbook;
    const review = markdownSection(contents, "Event-driven steady-state review");
    const normalizedReview = normalizedMarkdown(review);

    const triggerContracts: Record<string, [string, string]> = {
      "GitHub billing or control-plane change": ["hosted-runner start", "Pause formal release"],
      "Artifact retention or access change": ["digest checks", "Stop artifact consumption"],
      "Staging recovery contract change": ["pre-mutation refusal", "Disable staging mutation"],
      "Credential rotation, revocation, or suspected disclosure": [
        "staging/production separation",
        "Disable every affected credentialed job",
      ],
      "Toolchain drift": ["declared Bun", "Invalidate affected validation/deployment evidence"],
      "Workflow action-pin update": ["full immutable SHA", "Reject mutable or unreviewed refs"],
    };

    for (const [trigger, [requiredCheck, shutdownCondition]] of Object.entries(triggerContracts)) {
      const row = tableRow(review, trigger);
      expect(row).toHaveLength(4);
      expect(row[1]).toContain(requiredCheck);
      expect(row[2]).toMatch(/Keep|keep|revise|remove/);
      expect(row[3]).toContain(shutdownCondition);
    }

    expect(tableRow(review, "Trigger")).toEqual([
      "Trigger",
      "Required checks",
      "Decision record",
      "Shutdown or reopen condition",
    ]);
    expect(normalizedReview).toContain("keep`, `revise`, or `remove");
    expect(normalizedReview).toContain("single maintainer");
    expect(normalizedReview).toContain("event-driven");
    expect(normalizedReview).not.toMatch(/\| (?:owner|cadence|frequency) \|/i);
    expect(normalizedReview).not.toMatch(/quarterly|monthly/i);
  });

  test("retains the inaugural recovery drill as historical evidence, not a second queue", async () => {
    const contents = normalizedMarkdown(await ciU11Evidence);
    const lowerContents = contents.toLowerCase();

    expect(contents).toContain("historical evidence");
    expect(contents).toContain("not a current-unit queue");
    expect(contents).toContain("33073613728");
    expect(contents).toContain("inaugural full recovery drill");
    for (const mode of [
      "pre-mutation refusal",
      "Worker/D1 baseline capture",
      "post-deploy checks",
      "rollback or forward reconciliation",
      "return to the prior safe staging state",
    ]) {
      expect(contents).toContain(mode);
    }
    expect(lowerContents).toContain("required access");
    expect(lowerContents).toContain("material-change triggers");
    expect(contents).toContain("Keep the GitHub-first path");
    expect(contents).toContain("production skipped");
  });

  test("captures the GitHub-first resilience boundary as durable repository guidance", async () => {
    const contents = normalizedMarkdown(await resilienceLearning);

    expect(contents).toContain("problem_type: workflow_issue");
    expect(contents).toContain("single maintainer");
    expect(contents).toContain("event-driven review");
    expect(contents).toContain("GitHub outage pauses release");
    expect(contents).toContain("local development continues");
    expect(contents).toContain("fresh exact-SHA hosted run");
    expect(contents).toContain("keep, revise, or remove");
    expect(contents).toContain("does not select a candidate");
  });

  test("closes CI-U11.1 without retaining periodic review language", async () => {
    const plan = await ciPlan;
    const checkpoint = normalizedMarkdown(markdownSection(plan, "Execution Checkpoint"));
    const decisions = normalizedMarkdown(markdownSection(plan, "Key Technical Decisions"));
    const unit = normalizedMarkdown(
      markdownSection(plan, "CI-U11 — Establish steady-state resilience governance"),
    );

    expect(checkpoint).toContain("CI-U11.1 is complete");
    expect(checkpoint).toContain("CI tail is closed");
    expect(checkpoint).toContain("FS-U8.2");
    expect(unit).toContain("CI-U11.1` complete");
    expect(decisions).toContain("event-driven human review");
    expect(decisions).not.toContain("periodic human review");
  });
});
