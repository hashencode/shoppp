import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAcceptancePlan } from "./run-source-equivalence-acceptance";
import { loadSourceEquivalencePolicy } from "./verify-source-equivalent-themes";

describe("source-equivalence acceptance orchestration", () => {
  test("focuses one policy-declared state and reports incomplete final evidence", async () => {
    const plan = buildAcceptancePlan(await loadSourceEquivalencePolicy(), {
      mode: "interaction",
      scope: "focused",
      state: "search-open",
      themeId: "fashion-store",
    });
    expect(plan.fullEvidenceOutstanding).toBe(true);
    expect(plan.filteredModes).toEqual(["interaction"]);
    expect(plan.steps[0]!.command).toContain("search-open interaction");
    expect(plan.steps[0]!.command).toContain("apps/storefront/playwright.fashion-store.config.ts");
  });

  test("binds every policy-focused state and mode to a discoverable test title", async () => {
    const policy = await loadSourceEquivalencePolicy();
    const e2eSources = await Promise.all(
      [
        "fashion-store-theme.spec.ts",
        "fashion-store-acceptance-slice.spec.ts",
        "fashion-store-acceptance-self-test.spec.ts",
        "theme-behavior-contract.spec.ts",
      ].map((file) => readFile(resolve(import.meta.dir, "../apps/storefront/e2e", file), "utf8")),
    );
    const testSource = e2eSources.join("\n");
    for (const theme of policy.themes) {
      for (const state of theme.acceptance.focusedStates) {
        for (const mode of state.modes) expect(testSource).toContain(`${state.id} ${mode}`);
      }
    }
  });

  test("builds the final repository path without duplicate per-page commands", async () => {
    const plan = buildAcceptancePlan(await loadSourceEquivalencePolicy(), {
      commit: "abcdef1",
      evidencePath: "artifacts/source-equivalence",
      scope: "repository",
    });
    expect(plan.fullEvidenceOutstanding).toBe(false);
    expect(plan.steps.map(({ label }) => label)).toEqual([
      "contracts",
      "all-pages",
      "fidelity-evidence",
    ]);
  });

  test("rejects unknown selectors and excessive browser workers", async () => {
    const policy = await loadSourceEquivalencePolicy();
    expect(() => buildAcceptancePlan(policy, { scope: "page", themeId: "missing" })).toThrow(
      /unknown/,
    );
    expect(() =>
      buildAcceptancePlan(policy, {
        mode: "interaction",
        scope: "focused",
        state: "invented-state",
        themeId: "fashion-store",
      }),
    ).toThrow(/unknown focused state/);
    expect(() =>
      buildAcceptancePlan(policy, {
        mode: "temporal",
        scope: "focused",
        state: "search-open",
        themeId: "fashion-store",
      }),
    ).toThrow(/mode temporal is not declared/);
    expect(() => buildAcceptancePlan(policy, { scope: "repository", workers: 3 })).toThrow(
      /workers/,
    );
    expect(() => buildAcceptancePlan(policy, { scope: "repository" })).toThrow(/--commit/);
  });
});
