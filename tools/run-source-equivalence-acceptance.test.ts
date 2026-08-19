import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  acceptanceFailureRecord,
  buildAcceptancePlan,
  classifyAcceptanceFailure,
} from "./run-source-equivalence-acceptance";
import { loadSourceEquivalencePolicy } from "./verify-source-equivalent-themes";

describe("source-equivalence acceptance orchestration", () => {
  const commit = "a".repeat(40);
  const rcManifest = "artifacts/source-equivalence/rc/fashion-store-a.json";
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
    expect(page.steps[0]!.command).toContain("--page=home");

    const theme = buildAcceptancePlan(policy, { scope: "theme", themeId: "fashion-store" });
    expect(theme.pageIds).toEqual([
      "home",
      "shop-left",
      "shop-none",
      "shop-right",
      "collection",
      "product",
      "cart",
      "checkout",
      "wishlist",
      "account",
      "magazine",
      "article",
      "about",
      "faq",
      "contact",
    ]);
    expect(theme.steps.map(({ label }) => label)).toEqual([
      "fashion-store/pages[home,shop-left,shop-none,shop-right,collection,product,cart,checkout,wishlist,account,magazine,article,about,faq,contact]",
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
      "collection",
      "product",
      "cart",
      "checkout",
      "wishlist",
      "account",
      "magazine",
      "article",
      "about",
      "faq",
      "contact",
      "synthetic",
    ]);
    expect(allPages.steps.map(({ label }) => label)).toEqual([
      "fashion-store/pages[home,shop-left,shop-none,shop-right,collection,product,cart,checkout,wishlist,account,magazine,article,about,faq,contact,synthetic]",
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
        "fashion-store-collection.spec.ts",
        "fashion-store-product.spec.ts",
        "fashion-store-cart.spec.ts",
        "fashion-store-checkout.spec.ts",
        "fashion-store-content.spec.ts",
        "fashion-store-magazine.spec.ts",
        "fashion-store-information-pages.spec.ts",
        "decor-store-source-equivalence.spec.ts",
        "decor-store-page-suite.spec.ts",
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
      commit,
      evidencePath: "artifacts/source-equivalence",
      rcManifest,
      scope: "repository",
    });
    expect(plan.fullEvidenceOutstanding).toBe(false);
    expect(plan.steps.map(({ label }) => label)).toEqual([
      "rc-identity",
      "contracts",
      "fashion-store/pages[home,shop-left,shop-none,shop-right,collection,product,cart,checkout,wishlist,account,magazine,article,about,faq,contact]",
      "decor-store/pages[home,shop-left,shop-none,shop-right,collection,product,wishlist,cart,checkout,account,blog,article,about,faq,contact]",
      "fidelity-evidence",
    ]);
    expect(
      plan.steps.filter(({ command }) =>
        command.join(" ").includes("run-fashion-store-acceptance.ts --scope=theme"),
      ),
    ).toHaveLength(1);
  });

  test("runs a full shadow pass before creating commit-bound evidence", async () => {
    const policy = await loadSourceEquivalencePolicy();
    const plan = buildAcceptancePlan(policy, {
      scope: "shadow",
      themeId: "fashion-store",
    });
    expect(plan.fullEvidenceOutstanding).toBe(true);
    expect(plan.steps.map(({ label }) => label)).toEqual([
      "contracts",
      "fashion-store/pages[home,shop-left,shop-none,shop-right,collection,product,cart,checkout,wishlist,account,magazine,article,about,faq,contact]",
    ]);
    expect(() =>
      buildAcceptancePlan(policy, {
        commit: "abcdef1",
        scope: "shadow",
        themeId: "fashion-store",
      }),
    ).toThrow();
  });

  test("verifies the mandatory frozen RC before final repository acceptance", async () => {
    const plan = buildAcceptancePlan(await loadSourceEquivalencePolicy(), {
      commit,
      evidencePath: "artifacts/source-equivalence/a-final",
      rcManifest,
      scope: "repository",
    });
    expect(plan.steps[0]).toEqual({
      command: [
        "bun",
        "tools/source-equivalence-rc.ts",
        "verify",
        `--manifest=${rcManifest}`,
        `--commit=${commit}`,
      ],
      label: "rc-identity",
    });
  });

  test("classifies failures and emits the narrow rerun command", () => {
    const state = {
      command: ["bunx", "playwright", "test", "--grep", "search-open interaction"],
      label: "fashion-store/home/search-open",
    };
    expect(classifyAcceptanceFailure(state)).toBe("STATE_OR_BEHAVIOR_FAILURE");
    expect(acceptanceFailureRecord(state, 1)).toEqual({
      classification: "STATE_OR_BEHAVIOR_FAILURE",
      exitCode: 1,
      failedStep: "fashion-store/home/search-open",
      rerunCommand: "bunx playwright test --grep search-open interaction",
    });
    expect(classifyAcceptanceFailure({ command: [], label: "fidelity-evidence" })).toBe(
      "EVIDENCE_MISMATCH",
    );
    expect(
      classifyAcceptanceFailure(
        { command: [], label: "fashion-store/pages[home]" },
        "http://127.0.0.1:3426 is already used, make sure that nothing is running on the port",
      ),
    ).toBe("TRANSIENT_INFRASTRUCTURE_FAILURE");
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
    expect(() =>
      buildAcceptancePlan(policy, {
        commit,
        evidencePath: "artifacts/source-equivalence/a-final",
        scope: "repository",
      }),
    ).toThrow(/--rc-manifest/);
    expect(() =>
      buildAcceptancePlan(policy, {
        commit: "abcdef1",
        evidencePath: "artifacts/source-equivalence/a-final",
        rcManifest,
        scope: "repository",
      }),
    ).toThrow(/full-git-sha/);
  });
});
