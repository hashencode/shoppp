import { describe, expect, test } from "vitest";

import {
  assertStorefrontThemeLifecycleWritable,
  isRetiredStorefrontThemeId,
  RETIRED_STOREFRONT_THEME_IDS,
} from "../../src/storefront-experience/retirement-policy";

describe("storefront theme retirement policy", () => {
  test("matches only the two exact Decor runtime identities", () => {
    expect(RETIRED_STOREFRONT_THEME_IDS).toEqual(["decor", "decor-store"]);
    expect(isRetiredStorefrontThemeId("decor")).toBe(true);
    expect(isRetiredStorefrontThemeId("decor-store")).toBe(true);
    expect(isRetiredStorefrontThemeId("decor-store-source")).toBe(false);
    expect(isRetiredStorefrontThemeId("decorative")).toBe(false);
    expect(isRetiredStorefrontThemeId("fashion-store")).toBe(false);
  });

  test("returns one stable retired-package response for lifecycle writes", () => {
    expect(() => assertStorefrontThemeLifecycleWritable("fashion-store")).not.toThrow();
    for (const themeId of RETIRED_STOREFRONT_THEME_IDS) {
      expect(() => assertStorefrontThemeLifecycleWritable(themeId)).toThrowError(
        expect.objectContaining({ code: "storefront_theme_package_retired", status: 422 }),
      );
    }
  });
});
