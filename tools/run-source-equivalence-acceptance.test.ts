import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAcceptancePlan } from "./run-source-equivalence-acceptance";
import { loadSourceEquivalencePolicy } from "./verify-source-equivalent-themes";

describe("source-equivalence acceptance orchestration", () => {
  test("focuses one policy-declared state and reports incomplete final evidence", async () => {
    const plan = buildAcceptancePlan(await loadSourceEquivalencePolicy(), {
      mode: "interaction",
      pageId: "home",
      scope: "focused",
      state: "search-open",
      themeId: "fashion-store",
    });
    expect(plan.fullEvidenceOutstanding).toBe(true);
    expect(plan.filteredModes).toEqual(["interaction"]);
    expect(plan.pageIds).toEqual(["home"]);
    expect(plan.steps[0]!.command).toContain("search-open interaction");
    expect(plan.steps[0]!.command).toContain("apps/storefront/playwright.fashion-store.config.ts");
  });

  test("selects one page for focused/page scope and enumerates pages for theme scope", async () => {
    const policy = await loadSourceEquivalencePolicy();
    const page = buildAcceptancePlan(policy, {
      pageId: "home",
      scope: "page",
      themeId: "fashion-store",
    });
    expect(page.pageIds).toEqual(["home"]);
    expect(page.steps[0]!.label).toBe("fashion-store/home/page");

    const theme = buildAcceptancePlan(policy, { scope: "theme", themeId: "fashion-store" });
    expect(theme.pageIds).toEqual(["home", "shop-left", "shop-none", "shop-right", "product"]);
    expect(theme.steps.map(({ label }) => label)).toEqual([
      "fashion-store/home/page",
      "fashion-store/shop-left/page",
      "fashion-store/shop-none/page",
      "fashion-store/shop-right/page",
      "fashion-store/product/page",
    ]);
  });

  test("does not leak a synthetic second page into a focused page run", async () => {
    const policy = structuredClone(await loadSourceEquivalencePolicy());
    const theme = policy.themes[0]!;
    theme.pages.push({
      ...theme.pages[0]!,
      focusedStates: [{ id: "synthetic-open", modes: ["interaction"] }],
      id: "synthetic",
      implementationRoute: "/synthetic",
      pageCommand: ["bun", "test", "synthetic-page.test.ts"],
    });
    theme.equivalenceScope.push("synthetic");

    const focused = buildAcceptancePlan(policy, {
      mode: "interaction",
      pageId: "synthetic",
      scope: "focused",
      state: "synthetic-open",
      themeId: "fashion-store",
    });
    expect(focused.pageIds).toEqual(["synthetic"]);
    expect(focused.steps[0]!.label).toBe("fashion-store/synthetic/synthetic-open");

    const allPages = buildAcceptancePlan(policy, {
      scope: "theme",
      themeId: "fashion-store",
    });
    expect(allPages.pageIds).toEqual([
      "home",
      "shop-left",
      "shop-none",
      "shop-right",
      "product",
      "synthetic",
    ]);
    expect(allPages.steps.map(({ label }) => label)).toEqual([
      "fashion-store/home/page",
      "fashion-store/shop-left/page",
      "fashion-store/shop-none/page",
      "fashion-store/shop-right/page",
      "fashion-store/product/page",
      "fashion-store/synthetic/page",
    ]);
  });

  test("binds every policy-focused state and mode to a discoverable test title", async () => {
    const policy = await loadSourceEquivalencePolicy();
    const e2eSources = await Promise.all(
      [
        "fashion-store-theme.spec.ts",
        "fashion-store-acceptance-slice.spec.ts",
        "fashion-store-acceptance-self-test.spec.ts",
        "fashion-store-shop.spec.ts",
        "fashion-store-product.spec.ts",
        "theme-behavior-contract.spec.ts",
      ].map((file) => readFile(resolve(import.meta.dir, "../apps/storefront/e2e", file), "utf8")),
    );
    const testSource = e2eSources.join("\n");
    for (const theme of policy.themes) {
      for (const page of theme.pages) {
        for (const state of page.focusedStates) {
          for (const mode of state.modes) expect(testSource).toContain(`${state.id} ${mode}`);
        }
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
      "fashion-store/home/page",
      "fashion-store/shop-left/page",
      "fashion-store/shop-none/page",
      "fashion-store/shop-right/page",
      "fashion-store/product/page",
      "fidelity-evidence",
    ]);
  });

  test("rejects unknown selectors and excessive browser workers", async () => {
    const policy = await loadSourceEquivalencePolicy();
    expect(() => buildAcceptancePlan(policy, { scope: "page", themeId: "missing" })).toThrow(
      /unknown/,
    );
    expect(() => buildAcceptancePlan(policy, { scope: "page", themeId: "fashion-store" })).toThrow(
      /--page/,
    );
    expect(() =>
      buildAcceptancePlan(policy, {
        mode: "interaction",
        pageId: "home",
        scope: "focused",
        state: "invented-state",
        themeId: "fashion-store",
      }),
    ).toThrow(/unknown focused state/);
    expect(() =>
      buildAcceptancePlan(policy, {
        mode: "temporal",
        pageId: "home",
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
