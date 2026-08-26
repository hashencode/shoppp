import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("candidate evidence operating contract", () => {
  test("keeps the solo baseline separate from the optional signed profile", async () => {
    const [policy, plan, masterPlan, runbook, reference] = await Promise.all(
      [
        "../docs/architecture/ci-evidence-trust-and-retention.md",
        "../docs/plans/2026-08-19-1737-refactor-local-first-ci-plan.md",
        "../docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md",
        "../docs/runbooks/release.md",
        "../docs/reference/candidate-evidence-bundle.md",
      ].map((path) => readFile(resolve(import.meta.dir, path), "utf8")),
    );

    expect(policy).toMatch(/required personal-project baseline/is);
    expect(policy).toMatch(/default evidence baseline.*without requiring a private PKI ceremony/is);
    expect(policy).toMatch(/optional high-assurance signing profile/is);

    expect(plan).toMatch(/\*\*Current parent\/child stage:\*\* CI-U7\.3\b/);
    expect(masterPlan).toMatch(/\*\*Current parent\/child stage:\*\* `CI-U7\.3`/);
    expect(plan).toMatch(
      /CI-U7\.2 is complete only for the optional high-assurance signed profile/is,
    );
    expect(plan).toMatch(
      /CI-U7\.2 — Implement optional signed profile:[\s\S]{0,300}high-assurance profile is complete/is,
    );
    expect(plan).toMatch(
      /\*\*Next concrete action:\*\*[\s\S]{0,240}practical restore[\s\S]{0,180}Intel target/is,
    );
    expect(masterPlan).toMatch(
      /\*\*Next action:\*\*[\s\S]{0,240}practical Intel-target\s+restore/is,
    );
    expect(plan).not.toMatch(/\*\*Next concrete action:\*\*[^\n]*commit/is);
    expect(masterPlan).not.toMatch(/\*\*Next action:\*\*[^\n]*commit/is);

    expect(runbook).toContain("--capsule-receipt");
    expect(runbook).toContain("intel:intel-append-only:intel-jenkins");
    expect(runbook).toMatch(
      /default solo-developer release baseline.*does not require.*offline root/is,
    );
    expect(runbook).toMatch(/one encrypted.*durable copy.*digest read-back/is);
    expect(runbook).toMatch(/second.*recommended.*not required/is);
    expect(reference).toMatch(/signed profile.*needs local bytes.*GitHub metadata/s);
    expect(reference).toMatch(/offline Ed25519 root.*short-lived signer/s);
    expect(reference).toMatch(
      /signed-profile finalization.*one successfully written and read-back-verified target/is,
    );
    expect(runbook).toMatch(
      /`evidence:baseline:build`,\s+`evidence:baseline:verify`, and\s+`evidence:baseline:restore`/is,
    );
    expect(runbook).toMatch(/baseline commands.*do not accept.*certificate.*signer.*trust-store/is);
    expect(runbook).toMatch(
      /Retention roots are paths local to the environment where the command runs/is,
    );
    expect(runbook).toMatch(
      /\/srv\/shoppp-evidence.*must run on the Intel Jenkins host or against an explicitly\s+mounted Intel filesystem/is,
    );
    expect(runbook).toMatch(/Retention metadata.*does not establish\s+a remote connection/is);
    expect(runbook).toMatch(
      /Use the commands below only when a later REL\/security decision explicitly activates the optional\s+high-assurance signed profile/is,
    );
  });
});
