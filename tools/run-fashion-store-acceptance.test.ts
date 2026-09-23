import { describe, expect, test } from "bun:test";

import {
  buildFashionStoreAcceptancePlan,
  fashionStorePageAcceptanceSelection,
  fashionStoreGeneratedStateFiles,
} from "./run-fashion-store-acceptance";

describe("Fashion Store page acceptance routing", () => {
  test("selects only the current page family for page convergence", () => {
    const cart = buildFashionStoreAcceptancePlan({ page: "cart", scope: "page" });
    expect(cart.pages).toEqual(["cart"]);
    expect(cart.steps.map(({ label }) => label)).toEqual([
      "cart/unit",
      "cart/browser",
      "cart/behavior-evidence",
    ]);
    expect(cart.steps[0]!.command).toContain("tests/fashion-store-cart.test.ts");
    expect(cart.steps[1]!.command).toContain("e2e/fashion-store-cart.spec.ts");
    expect(cart.steps[2]!.command).toContain("--page=cart");
  });

  test("keeps grouped source pages narrow without pretending they have separate specs", () => {
    expect(fashionStorePageAcceptanceSelection("wishlist")).toEqual(
      fashionStorePageAcceptanceSelection("account"),
    );
    expect(fashionStorePageAcceptanceSelection("about")).toEqual(
      fashionStorePageAcceptanceSelection("faq"),
    );
  });

  test("includes dedicated Hero branches in Home behavior evidence", () => {
    const home = buildFashionStoreAcceptancePlan({ page: "home", scope: "page" });
    expect(home.steps[1]!.command).toContain("e2e/fashion-store-decor-hero.spec.ts");
  });

  test("runs one full browser command and verifies all pages for theme/shadow acceptance", () => {
    const theme = buildFashionStoreAcceptancePlan({ scope: "theme" });
    expect(theme.pages).toHaveLength(15);
    expect(theme.steps.filter(({ label }) => label === "theme/browser")).toHaveLength(1);
    expect(theme.steps.filter(({ label }) => label.endsWith("/behavior-evidence"))).toHaveLength(
      15,
    );
    const browserCommand = theme.steps.find(({ label }) => label === "theme/browser")?.command;
    expect(browserCommand).toContain("playwright.fashion-store.config.ts");
    expect(browserCommand).toContain("e2e/fashion-store-acceptance-slice.spec.ts");
    expect(browserCommand).not.toContain("--grep-invert");
  });

  test("selects one acceptance stage without duplicating its page or test ledger", () => {
    const unit = buildFashionStoreAcceptancePlan({ scope: "theme", stage: "unit" });
    const behavior = buildFashionStoreAcceptancePlan({ scope: "theme", stage: "behavior" });
    const integrated = buildFashionStoreAcceptancePlan({ scope: "theme", stage: "integrated" });

    expect(unit.steps.map(({ label }) => label)).toEqual(["theme/unit"]);
    expect(behavior.pages).toHaveLength(15);
    expect(behavior.steps).toHaveLength(15);
    expect(behavior.steps.every(({ label }) => label.endsWith("/behavior-evidence"))).toBe(true);
    expect(integrated.steps.slice(0, 7).map(({ label }) => label)).toEqual([
      "admin/exact-draft-preview",
      "control-plane/exact-tuple-receipt",
      "theme/exact-tuple-build-browser",
      "control-plane/lifecycle-regressions",
      "theme/reader-matrix",
      "theme/generated-output",
      "theme/authored-hero-browser",
    ]);
    expect(integrated.steps[0]!.command).toEqual([
      "bun",
      "run",
      "--cwd",
      "../admin",
      "test:e2e",
      "--",
      "e2e/setup-guide.spec.ts",
      "e2e/storefront-theme-preview.spec.ts",
    ]);
    expect(integrated.steps[1]!.command).toEqual([
      "bun",
      "run",
      "--cwd",
      "../api",
      "test:workers",
      "--",
      "--disableConsoleIntercept",
      "test/catalog/candidate-release.test.ts",
      "-t",
      "propagates one sparse Admin tuple",
    ]);
    expect(integrated.steps[3]!.command).toContain(
      "test/storefront-experience/experience-api.test.ts",
    );
    expect(integrated.steps[4]!.command).toContain("tests/fashion-store-package-registry.test.ts");
    expect(integrated.steps[5]!.command).toContain("tests/fashion-store-product.test.ts");
    expect(integrated.steps[7]?.label).toBe("theme/browser");
    expect(integrated.steps.slice(8)).toHaveLength(15);
    expect(
      integrated.steps.slice(8).every(({ label }) => label.endsWith("/behavior-evidence")),
    ).toBe(true);
  });

  test("restores every generated storefront selection file after acceptance", () => {
    expect(fashionStoreGeneratedStateFiles().map((path) => path.split("/").at(-1))).toEqual([
      "active-theme.ts",
      "active-experience.ts",
    ]);
  });

  test("rejects unknown and contradictory scope arguments", () => {
    expect(() => buildFashionStoreAcceptancePlan({ scope: "page" })).toThrow(/--page/);
    expect(() => buildFashionStoreAcceptancePlan({ page: "missing", scope: "page" })).toThrow(
      /unknown/,
    );
    expect(() => buildFashionStoreAcceptancePlan({ page: "cart", scope: "theme" })).toThrow(
      /does not accept/,
    );
  });
});
