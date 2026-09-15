import { describe, expect, test } from "bun:test";
import { classifyThemeChangeImpact, commandsForThemeImpact } from "./verify-theme-change-impact";

const themeIds = ["fashion-store", "minimal-store"];

describe("theme change impact", () => {
  test("skips unrelated backend and documentation changes", () => {
    expect(
      classifyThemeChangeImpact(["apps/api/src/index.ts", "docs/progress/release.md"], themeIds),
    ).toEqual({ mode: "none", themeIds: [] });
  });

  test("selects only the theme whose package or named browser coverage changed", () => {
    expect(
      classifyThemeChangeImpact(
        [
          "apps/storefront/app/themes/fashion-store/components/ProductCard.vue",
          "apps/storefront/e2e/fashion-store-home.spec.ts",
        ],
        themeIds,
      ),
    ).toEqual({ mode: "themes", themeIds: ["fashion-store"] });
  });

  test("runs the full matrix for shared storefront theme infrastructure", () => {
    expect(
      classifyThemeChangeImpact(
        ["apps/storefront/app/components/ThemeSection.vue", "apps/storefront/nuxt.config.ts"],
        themeIds,
      ),
    ).toEqual({ mode: "matrix", themeIds: [] });
  });

  test("does not mistake a theme id inside a shared or unrelated filename for focused ownership", () => {
    expect(
      classifyThemeChangeImpact(
        ["apps/storefront/app/components/fashion-store-switcher.vue"],
        themeIds,
      ),
    ).toEqual({ mode: "matrix", themeIds: [] });
    expect(
      classifyThemeChangeImpact(["apps/storefront/e2e/fashion-storefront.spec.ts"], themeIds),
    ).toEqual({ mode: "none", themeIds: [] });
  });

  test("selects the longest exact theme token when ids overlap", () => {
    expect(
      classifyThemeChangeImpact(
        ["apps/storefront/e2e/fashion-store-home.spec.ts"],
        ["store", "fashion-store"],
      ),
    ).toEqual({ mode: "themes", themeIds: ["fashion-store"] });
  });

  test("fails closed when a new theme package has no declared theme id", () => {
    expect(() =>
      classifyThemeChangeImpact(
        ["apps/storefront/app/themes/new-store/components/Header.vue"],
        themeIds,
      ),
    ).toThrow('Theme path "new-store" has no matching test:<theme-id> script.');
  });

  test("builds focused commands for theme changes and one matrix command for shared changes", () => {
    expect(commandsForThemeImpact({ mode: "themes", themeIds: ["fashion-store"] })).toEqual([
      ["bun", "run", "--cwd", "apps/storefront", "test:fashion-store"],
    ]);
    expect(commandsForThemeImpact({ mode: "matrix", themeIds: [] })).toEqual([
      ["bun", "run", "test:theme-matrix"],
    ]);
  });
});
