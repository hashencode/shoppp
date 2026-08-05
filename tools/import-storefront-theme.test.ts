import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  importStorefrontTheme,
  type StorefrontThemeSourceManifest,
} from "./import-storefront-theme";

const temporaryRoots: string[] = [];
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0h20v20H0z"/></svg>\n`;

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

async function writeFixture(
  root: string,
  path: string,
  contents: string | Uint8Array,
): Promise<void> {
  const absolutePath = join(root, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

async function fixture(): Promise<{
  destinationRoot: string;
  manifest: StorefrontThemeSourceManifest;
  manifestPath: string;
  root: string;
  source: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-theme-import-"));
  temporaryRoots.push(root);
  const source = join(root, "source");
  const destinationRoot = join(root, "themes");
  const manifestPath = join(root, "storefront-theme-source-manifest.json");
  await Promise.all([
    writeFixture(source, "fashion/hero.png", png),
    writeFixture(source, "fashion/icon.svg", safeSvg),
    writeFixture(source, ".git/config", "source metadata"),
    writeFixture(source, "dist/generated.js", "generated output"),
  ]);
  const manifest = {
    schemaVersion: 1,
    themes: [
      {
        allowlist: [
          {
            destinationPath: "assets/hero.png",
            kind: "image",
            license: "Authorized test fixture",
            sourcePath: "fashion/hero.png",
          },
          {
            destinationPath: "assets/icon.svg",
            kind: "icon",
            license: "Authorized test fixture",
            sourcePath: "fashion/icon.svg",
          },
        ],
        importedAt: null,
        importedFiles: [],
        ownershipApproval: "Fixture owner approved repository use.",
        sourceIdentity: "crafto-fixture",
        sourceRevision: "fixture-revision-1",
        themeId: "fashion",
      },
    ],
  } satisfies StorefrontThemeSourceManifest;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { destinationRoot, manifest, manifestPath, root, source };
}

describe("importStorefrontTheme", () => {
  test("fails closed before copying when ownership approval or source identity is absent", async () => {
    const value = await fixture();
    for (const missing of ["ownershipApproval", "sourceIdentity", "sourceRevision"] as const) {
      const manifest = structuredClone(value.manifest);
      manifest.themes[0]![missing] = null;

      await expect(
        importStorefrontTheme({
          destinationRoot: value.destinationRoot,
          importedAt: "2026-07-30",
          manifest,
          manifestPath: value.manifestPath,
          source: value.source,
          themeId: "fashion",
        }),
      ).rejects.toThrow(missing === "ownershipApproval" ? "ownership" : "source");
    }
    expect(
      await lstat(value.destinationRoot).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  });

  test("copies only listed assets with deterministic hashes and provenance", async () => {
    const value = await fixture();
    const sourcePaths = [
      "fashion/hero.png",
      "fashion/icon.svg",
      ".git/config",
      "dist/generated.js",
    ];
    const sourceBefore = Object.fromEntries(
      await Promise.all(
        sourcePaths.map(
          async (path) => [path, await readFile(join(value.source, path), "hex")] as const,
        ),
      ),
    );

    const first = await importStorefrontTheme({
      destinationRoot: value.destinationRoot,
      importedAt: "2026-07-30",
      manifest: value.manifest,
      manifestPath: value.manifestPath,
      source: value.source,
      themeId: "fashion",
    });
    const firstManifest = await readFile(value.manifestPath, "utf8");
    const second = await importStorefrontTheme({
      destinationRoot: value.destinationRoot,
      importedAt: "2026-07-30",
      manifest: first,
      manifestPath: value.manifestPath,
      source: value.source,
      themeId: "fashion",
    });

    expect(second).toEqual(first);
    expect(await readFile(value.manifestPath, "utf8")).toBe(firstManifest);
    expect(first.themes[0]?.importedFiles).toEqual([
      {
        bytes: png.byteLength,
        destinationPath: "assets/hero.png",
        kind: "image",
        license: "Authorized test fixture",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        sourcePath: "fashion/hero.png",
      },
      {
        bytes: Buffer.byteLength(safeSvg),
        destinationPath: "assets/icon.svg",
        kind: "icon",
        license: "Authorized test fixture",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        sourcePath: "fashion/icon.svg",
      },
    ]);
    expect(await readFile(join(value.destinationRoot, "fashion/assets/hero.png"))).toEqual(
      Buffer.from(png),
    );
    expect(await readFile(join(value.destinationRoot, "fashion/UPSTREAM.md"), "utf8")).toContain(
      "crafto-fixture",
    );
    expect(
      await lstat(join(value.destinationRoot, "fashion/.git")).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(
      await lstat(join(value.destinationRoot, "fashion/dist")).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(
      Object.fromEntries(
        await Promise.all(
          sourcePaths.map(
            async (path) => [path, await readFile(join(value.source, path), "hex")] as const,
          ),
        ),
      ),
    ).toEqual(sourceBefore);
  });

  test.each([
    ["fashion/jquery.js", "window.$ = {}"],
    ["fashion/revolution.min.js", "window.Revolution = {}"],
    ["fashion/vendor.css", ".crafto{}"],
    ["fashion/contact.php", "<?php mail('x', 'y', 'z');"],
    [".env", "SECRET=value"],
    [".DS_Store", "metadata"],
  ])("rejects prohibited or hidden source path %s", async (path, contents) => {
    const value = await fixture();
    await writeFixture(value.source, path, contents);

    await expect(
      importStorefrontTheme({
        destinationRoot: value.destinationRoot,
        importedAt: "2026-07-30",
        manifest: value.manifest,
        manifestPath: value.manifestPath,
        source: value.source,
        themeId: "fashion",
      }),
    ).rejects.toThrow(/prohibited|unlisted/i);
  });

  test("rejects unlisted additions and every source symlink", async () => {
    const value = await fixture();
    await writeFixture(value.source, "fashion/unlisted.png", png);
    await expect(
      importStorefrontTheme({
        destinationRoot: value.destinationRoot,
        importedAt: "2026-07-30",
        manifest: value.manifest,
        manifestPath: value.manifestPath,
        source: value.source,
        themeId: "fashion",
      }),
    ).rejects.toThrow("unlisted");

    await rm(join(value.source, "fashion/unlisted.png"));
    await writeFixture(value.root, "outside.png", png);
    await symlink(join(value.root, "outside.png"), join(value.source, "fashion/escape.png"));
    await expect(
      importStorefrontTheme({
        destinationRoot: value.destinationRoot,
        importedAt: "2026-07-30",
        manifest: value.manifest,
        manifestPath: value.manifestPath,
        source: value.source,
        themeId: "fashion",
      }),
    ).rejects.toThrow("symlink");
  });

  test.each([
    [
      "fashion/icon.svg",
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
      "scriptable",
    ],
    [
      "fashion/icon.svg",
      `<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.test/icon.svg#x"/></svg>`,
      "external",
    ],
    ["fashion/hero.png", safeSvg, "MIME"],
  ])("rejects unsafe or mismatched asset %s", async (path, contents, message) => {
    const value = await fixture();
    await writeFixture(value.source, path, contents);

    await expect(
      importStorefrontTheme({
        destinationRoot: value.destinationRoot,
        importedAt: "2026-07-30",
        manifest: value.manifest,
        manifestPath: value.manifestPath,
        source: value.source,
        themeId: "fashion",
      }),
    ).rejects.toThrow(new RegExp(message, "i"));
  });

  test("rejects an oversized asset before replacing existing output", async () => {
    const value = await fixture();
    await writeFixture(value.source, "fashion/hero.png", new Uint8Array(5_000_001).fill(0x41));
    await writeFixture(value.destinationRoot, "fashion/assets/existing.png", png);

    await expect(
      importStorefrontTheme({
        destinationRoot: value.destinationRoot,
        importedAt: "2026-07-30",
        manifest: value.manifest,
        manifestPath: value.manifestPath,
        source: value.source,
        themeId: "fashion",
      }),
    ).rejects.toThrow("size");
    expect(await readFile(join(value.destinationRoot, "fashion/assets/existing.png"))).toEqual(
      Buffer.from(png),
    );
  });
});
