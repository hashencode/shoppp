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
const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><defs><clipPath id="card"><rect width="20" height="20"/></clipPath></defs><g clip-path="url(#card)"><path d="M0 0h20v20H0z"/></g></svg>\n`;

function sha256(contents: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(contents).digest("hex");
}

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

async function fashionStoreFixture(): Promise<{
  destinationRoot: string;
  manifest: StorefrontThemeSourceManifest;
  manifestPath: string;
  root: string;
  source: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-fashion-store-import-"));
  temporaryRoots.push(root);
  const source = join(root, "source");
  const destinationRoot = join(root, "themes");
  const manifestPath = join(root, "storefront-theme-source-manifest.json");
  const html =
    '<!doctype html><link rel="stylesheet" href="css/theme.css"><img src="images/hero.png">\n';
  const css =
    '@font-face{font-family:Exact;src:url("../fonts/exact.woff2")} .hero{background:url("../images/hero.png")}\n';
  const runtime = "window.CraftoVisual = {};\n";
  const font = new Uint8Array([0x77, 0x4f, 0x46, 0x32]);
  await Promise.all([
    writeFixture(source, "demo-fashion-store.html", html),
    writeFixture(source, "css/theme.css", css),
    writeFixture(source, "demos/fashion-store/fashion-store.css", ".fashion{}\n"),
    writeFixture(source, "fonts/exact.woff2", font),
    writeFixture(source, "images/hero.png", png),
    writeFixture(source, "js/vendors.min.js", runtime),
  ]);
  const license = "Authorized Fashion Store test source";
  const allowlist = [
    ["demo-fashion-store.html", "markup", html],
    ["css/theme.css", "stylesheet", css],
    ["demos/fashion-store/fashion-store.css", "stylesheet", ".fashion{}\n"],
    ["fonts/exact.woff2", "font", font],
    ["images/hero.png", "image", png],
    ["js/vendors.min.js", "visual-runtime", runtime],
  ].map(([sourcePath, kind, contents]) => ({
    destinationPath: `upstream/${sourcePath}`,
    expectedSha256: sha256(contents as string | Uint8Array),
    kind,
    license,
    sourcePath,
  }));
  const manifest = {
    schemaVersion: 1,
    themes: [
      {
        allowlist,
        closedSourceDirectories: ["demos/fashion-store"],
        importedAt: null,
        importedFiles: [],
        ownershipApproval: "Fixture owner approved Fashion Store source reuse.",
        sourceIdentity: "local://fixture/demo-fashion-store.html",
        sourceRevision: "fixture-fashion-store-revision-1",
        themeId: "fashion-store",
      },
    ],
  } as StorefrontThemeSourceManifest;
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

describe("Fashion Store source implementation import", () => {
  test("verifies pinned hashes and preserves the source-relative tree", async () => {
    const value = await fashionStoreFixture();

    const imported = await importStorefrontTheme({
      destinationRoot: value.destinationRoot,
      importedAt: "2026-08-06",
      manifest: value.manifest,
      manifestPath: value.manifestPath,
      source: value.source,
      themeId: "fashion-store",
    });

    expect(imported.themes[0]?.importedFiles).toHaveLength(6);
    expect(
      await readFile(join(value.destinationRoot, "fashion-store/upstream/css/theme.css"), "utf8"),
    ).toContain("../fonts/exact.woff2");
    expect(
      await readFile(join(value.destinationRoot, "fashion-store/UPSTREAM.md"), "utf8"),
    ).toMatch(/hash-pinned|main\.js|visual runtime/i);
  });

  test("copies a hash-pinned local font supplement when the package references a remote font", async () => {
    const value = await fashionStoreFixture();
    const font = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x01]);
    await writeFixture(value.root, "repository/fonts/remote-source.woff2", font);
    value.manifest.themes[0]!.allowlist.push({
      destinationPath: "upstream/fonts/remote-source.woff2",
      expectedSha256: sha256(font),
      kind: "font",
      license: "Authorized local copy of source-referenced remote font",
      sourcePath: "fonts/remote-source.woff2",
      supplementalSourcePath: "fonts/remote-source.woff2",
    });

    await importStorefrontTheme({
      destinationRoot: value.destinationRoot,
      importedAt: "2026-08-06",
      manifest: value.manifest,
      manifestPath: value.manifestPath,
      repositoryRoot: join(value.root, "repository"),
      source: value.source,
      themeId: "fashion-store",
    });

    expect(
      await readFile(
        join(value.destinationRoot, "fashion-store/upstream/fonts/remote-source.woff2"),
      ),
    ).toEqual(Buffer.from(font));
  });

  test("appends newly pinned files without replacing or re-reading existing source assets", async () => {
    const value = await fashionStoreFixture();
    const first = await importStorefrontTheme({
      destinationRoot: value.destinationRoot,
      importedAt: "2026-08-06",
      manifest: value.manifest,
      manifestPath: value.manifestPath,
      source: value.source,
      themeId: "fashion-store",
    });
    await writeFixture(value.source, "css/theme.css", ".source-drift{}\n");
    await writeFixture(value.source, "images/detail.png", png);
    first.themes[0]!.allowlist.push({
      destinationPath: "upstream/images/detail.png",
      expectedSha256: sha256(png),
      kind: "image",
      license: "Authorized Fashion Store test source",
      sourcePath: "images/detail.png",
    });

    const appended = await importStorefrontTheme({
      appendOnly: true,
      destinationRoot: value.destinationRoot,
      importedAt: "2026-08-07",
      manifest: first,
      manifestPath: value.manifestPath,
      source: value.source,
      themeId: "fashion-store",
    });

    expect(appended.themes[0]?.importedFiles).toHaveLength(7);
    expect(
      await readFile(join(value.destinationRoot, "fashion-store/upstream/css/theme.css"), "utf8"),
    ).not.toContain("source-drift");
    expect(
      await readFile(join(value.destinationRoot, "fashion-store/upstream/images/detail.png")),
    ).toEqual(Buffer.from(png));
  });

  test("fails before copying on a changed hash, missing dependency, or symlink", async () => {
    const changed = await fashionStoreFixture();
    await writeFixture(changed.source, "css/theme.css", ".changed{}\n");
    await expect(
      importStorefrontTheme({
        destinationRoot: changed.destinationRoot,
        importedAt: "2026-08-06",
        manifest: changed.manifest,
        manifestPath: changed.manifestPath,
        source: changed.source,
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/hash/i);

    const missing = await fashionStoreFixture();
    await rm(join(missing.source, "images/hero.png"));
    await expect(
      importStorefrontTheme({
        destinationRoot: missing.destinationRoot,
        importedAt: "2026-08-06",
        manifest: missing.manifest,
        manifestPath: missing.manifestPath,
        source: missing.source,
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/missing/i);

    const linked = await fashionStoreFixture();
    await rm(join(linked.source, "images/hero.png"));
    await writeFixture(linked.root, "outside.png", png);
    await symlink(join(linked.root, "outside.png"), join(linked.source, "images/hero.png"));
    await expect(
      importStorefrontTheme({
        destinationRoot: linked.destinationRoot,
        importedAt: "2026-08-06",
        manifest: linked.manifest,
        manifestPath: linked.manifestPath,
        source: linked.source,
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/symlink/i);
  });

  test("rejects unsafe declarations, unresolved CSS URLs, and closed-scope additions", async () => {
    const unsafe = await fashionStoreFixture();
    unsafe.manifest.themes[0]!.allowlist[0]!.sourcePath = "../escape.html";
    await expect(
      importStorefrontTheme({
        destinationRoot: unsafe.destinationRoot,
        importedAt: "2026-08-06",
        manifest: unsafe.manifest,
        manifestPath: unsafe.manifestPath,
        source: unsafe.source,
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/unsafe/i);

    const unresolved = await fashionStoreFixture();
    const css = '.hero{background:url("../images/missing.png")}\n';
    await writeFixture(unresolved.source, "css/theme.css", css);
    unresolved.manifest.themes[0]!.allowlist[1]!.expectedSha256 = sha256(css);
    await expect(
      importStorefrontTheme({
        destinationRoot: unresolved.destinationRoot,
        importedAt: "2026-08-06",
        manifest: unresolved.manifest,
        manifestPath: unresolved.manifestPath,
        source: unresolved.source,
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/CSS.*missing|missing.*CSS/i);

    const addition = await fashionStoreFixture();
    await writeFixture(addition.source, "demos/fashion-store/unlisted.js", "alert(1)\n");
    await expect(
      importStorefrontTheme({
        destinationRoot: addition.destinationRoot,
        importedAt: "2026-08-06",
        manifest: addition.manifest,
        manifestPath: addition.manifestPath,
        source: addition.source,
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/unlisted|executable/i);
  });
});
