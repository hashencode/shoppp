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

    expect(plan).toMatch(/\*\*Bridge handoff:\*\* Current transition execution is handed to/is);
    expect(masterPlan).toMatch(/\*\*Current parent\/child stage:\*\* Active `CI-GH-U4`/);
    expect(plan).toMatch(/CI-U7\.1 and CI-U7\.2 remain completed historical implementation/is);
    expect(plan).toMatch(
      /CI-U7\.2 — Implement optional signed profile:[\s\S]{0,300}high-assurance profile is complete/is,
    );
    expect(plan).toMatch(
      /CI-U7\.3 was not completed[\s\S]{0,120}practical\s+Intel restore never ran/is,
    );
    expect(masterPlan).toMatch(/CI-U7\.3` remains incomplete[\s\S]{0,120}Intel restore remains/is);
    expect(masterPlan).toMatch(
      /\*\*Next action:\*\* Run immutable successor[\s\S]{0,360}production\s+disabled/is,
    );
    expect(masterPlan).toMatch(/No external billing blocker remains/is);
    expect(masterPlan).toMatch(/run\s+`33048142888`[\s\S]{0,140}all 17 gates/is);
    expect(masterPlan).toMatch(/run\s+`33052078852`[\s\S]{0,260}representative-catalog/is);
    expect(masterPlan).toMatch(/run\s+`33053063337`[\s\S]{0,260}collision refusal/is);
    expect(masterPlan).toMatch(/run\s+`33053216917`[\s\S]{0,260}all 17 gates/is);
    expect(masterPlan).toMatch(/run\s+`33055956466`[\s\S]{0,300}collision refusal/is);
    expect(masterPlan).toMatch(/run\s+`33056208460`[\s\S]{0,260}first 14 unchanged gates/is);
    expect(masterPlan).toMatch(/run\s+`33058031666`[\s\S]{0,300}collision refusal/is);
    expect(masterPlan).toMatch(/run\s+`33058180318`[\s\S]{0,260}all 17 unchanged gates/is);
    expect(masterPlan).toMatch(/run\s+`33061325008`[\s\S]{0,300}collision refusal/is);
    expect(masterPlan).toMatch(/run\s+`33061506493`[\s\S]{0,260}first eight unchanged gates/is);
    expect(masterPlan).toMatch(/run\s+`33062008517`[\s\S]{0,260}collision\s+refusal/is);
    expect(masterPlan).toMatch(
      /run\s+`33062287746`[\s\S]{0,260}trusted-source preflight refused/is,
    );
    expect(masterPlan).toMatch(/run\s+`33062452797`[\s\S]{0,260}collision refusal/is);
    expect(masterPlan).toMatch(/run\s+`33062635406`[\s\S]{0,260}all 17 unchanged gates/is);
    expect(masterPlan).toMatch(/run\s+`33064643874`[\s\S]{0,360}collision\s+refusal/is);
    expect(masterPlan).toMatch(/run\s+`33064849074`[\s\S]{0,260}all 17 unchanged gates/is);
    expect(masterPlan).toMatch(/run\s+`33067448314`[\s\S]{0,360}collision\s+refusal/is);
    expect(plan).not.toContain("**Next concrete action:**");

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
