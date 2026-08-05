import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { inspectThemeFont } from "./inspect-theme-fonts";

const fonts = {
  figtree: {
    hash: "8330490a01c60c196eae00b823de8102275aaa5862e7b76a7af21b8745338928",
    path: "apps/storefront/app/themes/fashion/assets/fonts/figtree-latin.woff2",
  },
  outfit: {
    hash: "92684e4acde79ef07758cd09380b7e01e9824d8b061eddeda046f78c166d7b12",
    path: "apps/storefront/app/themes/fashion/assets/fonts/outfit-latin.woff2",
  },
  plusJakartaSans: {
    hash: "cd8db90cd950e26bc8761f65d323588bd5cd112d326d6d322bc7c8ea86771215",
    path: "apps/storefront/app/themes/decor/assets/fonts/plus-jakarta-sans-latin.woff2",
  },
} as const;

describe("theme font binaries", () => {
  test.each([
    ["figtree", "Figtree Light", 300, 900],
    ["outfit", "Outfit Thin", 100, 900],
    ["plusJakartaSans", "Plus Jakarta Sans", 200, 800],
  ] as const)(
    "%s keeps the approved hash, family, and weight axis",
    async (id, family, min, max) => {
      const expected = fonts[id];
      const inspection = await inspectThemeFont(resolve(expected.path));
      const weightAxis = inspection.axes.find(({ tag }) => tag === "wght");

      expect(inspection.hash).toBe(expected.hash);
      expect(inspection.family).toBe(family);
      expect(weightAxis).toMatchObject({ minimum: min, maximum: max });
    },
  );
});
