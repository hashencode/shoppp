import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { inspectThemeFont, type ThemeFontInspection } from "./inspect-theme-fonts";

const fonts = {
  figtree: {
    hash: "8330490a01c60c196eae00b823de8102275aaa5862e7b76a7af21b8745338928",
    path: "apps/storefront/app/themes/fashion-store/upstream/fonts/figtree-latin.woff2",
  },
  outfit: {
    hash: "92684e4acde79ef07758cd09380b7e01e9824d8b061eddeda046f78c166d7b12",
    path: "apps/storefront/app/themes/fashion-store/upstream/fonts/outfit-latin.woff2",
  },
} as const;

describe("theme font binaries", () => {
  test("inspects multiple CLI fonts without decoder state corruption", async () => {
    const subprocess = Bun.spawn(
      [
        process.execPath,
        "tools/inspect-theme-fonts.ts",
        ...Object.values(fonts).map(({ path }) => resolve(path)),
      ],
      { stderr: "pipe", stdout: "pipe" },
    );
    const [exitCode, stderr, stdout] = await Promise.all([
      subprocess.exited,
      new Response(subprocess.stderr).text(),
      new Response(subprocess.stdout).text(),
    ]);
    if (exitCode !== 0) throw new Error(stderr);
    const inspections = JSON.parse(stdout) as ThemeFontInspection[];

    expect(inspections.map(({ hash }) => hash)).toEqual([fonts.figtree.hash, fonts.outfit.hash]);
    expect(inspections.map(({ family }) => family)).toEqual(["Figtree Light", "Outfit Thin"]);
  });

  test("reports lockfile decoder failures with the font path", async () => {
    const root = await mkdtemp(join(tmpdir(), "shoppp-invalid-font-"));
    const path = join(root, "invalid.woff2");
    await writeFile(path, "not a font");
    try {
      await expect(inspectThemeFont(path)).rejects.toThrow(
        `WOFF2 decompression failed for ${path}.`,
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  test.each([
    ["figtree", "Figtree Light", 300, 900],
    ["outfit", "Outfit Thin", 100, 900],
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
    15_000,
  );
});
