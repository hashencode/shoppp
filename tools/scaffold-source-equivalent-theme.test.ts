import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildSourceEquivalentThemeScaffold,
  writeSourceEquivalentThemeScaffold,
} from "./scaffold-source-equivalent-theme";

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("source-equivalent theme scaffold", () => {
  test("creates the complete integration and source-contract skeleton without guessed styling", () => {
    const files = buildSourceEquivalentThemeScaffold({
      label: "Atelier",
      sourceEntry: "demo-atelier-store.html",
      sourceIdentity: "atelier-template-v1",
      themeId: "atelier",
    });

    expect([...files.keys()].sort()).toEqual([
      "UPSTREAM.md",
      "components/AtelierFooter.vue",
      "components/AtelierHeader.vue",
      "components/AtelierHero.vue",
      "fixtures/home.ts",
      "manifest.ts",
      "presets/source-equivalent.ts",
      "registry.ts",
      "resources.ts",
      "source-contract.test.ts",
      "source-contract.ts",
      "source-equivalence-waivers.json",
      "tokens.css",
    ]);
    expect(files.get("source-contract.ts")).toContain('html: "demo-atelier-store.html"');
    expect(files.get("source-contract.ts")).toContain("interactionStates");
    expect(files.get("source-contract.ts")).toContain("responsiveStates");
    expect(files.get("source-contract.test.ts")).toContain(".assets.length");
    expect(files.get("source-contract.test.ts")).toContain(".computedStyles.length");
    expect(files.get("source-contract.test.ts")).toContain(".fonts.length");
    expect(files.get("source-contract.test.ts")).toContain(".geometry.length");
    expect(files.get("source-contract.test.ts")).toContain(".links.length");
    expect(files.get("source-contract.test.ts")).toContain(".motionStates.length");
    expect(files.get("source-contract.test.ts")).toContain("SOURCE_INTAKE_REQUIRED");
    expect(files.get("tokens.css")).toContain("Source-derived declarations only");
    expect([...files.values()].join("\n")).not.toMatch(/jquery|revolution\.min|vendor\.css/i);
  });

  test("rejects unsafe IDs and incomplete source identity", () => {
    expect(() =>
      buildSourceEquivalentThemeScaffold({
        label: "Bad",
        sourceEntry: "demo.html",
        sourceIdentity: "source",
        themeId: "Bad Theme",
      }),
    ).toThrow(/lowercase theme ID/);
    expect(() =>
      buildSourceEquivalentThemeScaffold({
        label: "Bad",
        sourceEntry: "",
        sourceIdentity: "",
        themeId: "bad",
      }),
    ).toThrow(/source entry|source identity/);
  });

  test("escapes source metadata when generating TypeScript", () => {
    const files = buildSourceEquivalentThemeScaffold({
      label: "Atelier",
      sourceEntry: 'demo-"atelier".html',
      sourceIdentity: 'atelier-"template"-v1',
      themeId: "atelier",
    });
    const transpiler = new Bun.Transpiler({ loader: "ts" });

    expect(() => transpiler.transformSync(files.get("manifest.ts")!)).not.toThrow();
    expect(() => transpiler.transformSync(files.get("source-contract.ts")!)).not.toThrow();
  });

  test("writes into a new theme directory and refuses to modify an existing target", async () => {
    const destinationRoot = await mkdtemp(join(tmpdir(), "shoppp-source-scaffold-"));
    temporaryRoots.push(destinationRoot);
    const options = {
      destinationRoot,
      label: "Atelier",
      sourceEntry: "demo-atelier-store.html",
      sourceIdentity: "atelier-template-v1",
      themeId: "atelier",
    };
    expect(await writeSourceEquivalentThemeScaffold(options)).toHaveLength(13);
    expect(await readFile(join(destinationRoot, "atelier/source-contract.ts"), "utf8")).toContain(
      "SOURCE_INTAKE_REQUIRED",
    );

    const marker = join(destinationRoot, "atelier/keep.txt");
    await writeFile(marker, "preserve");
    await expect(writeSourceEquivalentThemeScaffold(options)).rejects.toThrow(/already exists/);
    expect(await readFile(marker, "utf8")).toBe("preserve");

    const occupied = join(destinationRoot, "occupied");
    await mkdir(occupied);
    await writeFile(join(occupied, "keep.txt"), "preserve");
    await expect(
      writeSourceEquivalentThemeScaffold({ ...options, themeId: "occupied" }),
    ).rejects.toThrow(/already exists/);
    expect(
      await lstat(join(occupied, "UPSTREAM.md")).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  });
});
