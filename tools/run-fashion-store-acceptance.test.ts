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

  test("runs one full browser command and verifies all pages for theme/shadow acceptance", () => {
    const theme = buildFashionStoreAcceptancePlan({ scope: "theme" });
    expect(theme.pages).toHaveLength(15);
    expect(theme.steps.filter(({ label }) => label === "theme/browser")).toHaveLength(1);
    expect(theme.steps.filter(({ label }) => label.endsWith("/behavior-evidence"))).toHaveLength(
      15,
    );
    expect(theme.steps[1]!.command).toEqual([
      "bunx",
      "playwright",
      "test",
      "--config",
      "playwright.fashion-store.config.ts",
    ]);
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
