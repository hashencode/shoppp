import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

import { activeThemeId, activeThemeRoutes } from "../app/generated/active-theme";
import manifest from "../app/generated/route-manifest.json";

const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".txt", ".xml"]);
const codeExtensions = new Set([".css", ".js", ".map"]);
const imageExtensions = new Set([".avif", ".jpg", ".jpeg", ".png", ".webp"]);
const forbiddenRuntime =
  /(?:contact\.php|(?:^|[/_-])crafto(?:\.min)?\.(?:css|js)|[/_-]crafto[/_-])/i;
const sourceRuntimeName =
  /(?:jquery|vendors(?:\.min)?(?:\.[A-Za-z0-9_-]+)?\.js|revslider|revolution(?:\.extension)?|themepunch)/i;
const revolutionRuntime = /(?:revslider|revolution(?:\.extension)?|themepunch)/i;
const forbiddenSourceEntrypointFile = /(?:^|[/_-])main(?:\.[A-Za-z0-9_-]+)?\.js/i;
const forbiddenSourceEntrypointCode = /(?:theme-demos-main|instagram-feed)/i;
const previewMaterial =
  /(?:grant_[A-Za-z0-9_-]+|__preview\/session|snapshot-[a-z0-9-]+\/[a-f0-9]{64})/i;

export interface SourceRuntimePolicyInput {
  activeThemeId: string;
  approvedDecorRuntimeHashes: ReadonlySet<string>;
  contents: Uint8Array;
  file: string;
}

export async function collectInitialJavaScriptAssets(
  entryAssets: Iterable<string>,
  readAsset: (asset: string) => Promise<string>,
): Promise<Set<string>> {
  const assets = new Set<string>();
  const visit = async (asset: string): Promise<void> => {
    if (assets.has(asset)) return;
    assets.add(asset);
    const source = await readAsset(asset);
    for (const match of source.matchAll(
      /\b(?:import|export)\s*(?:[^"'();]*?\sfrom\s*)?["']([^"']+\.js)["']/g,
    )) {
      const specifier = match[1]!;
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) continue;
      const dependency = new URL(specifier, `https://bundle.invalid${asset}`).pathname;
      if (dependency.startsWith("/_nuxt/")) await visit(dependency);
    }
  };
  for (const asset of entryAssets) await visit(asset);
  return assets;
}

function sha256(contents: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(contents).digest("hex");
}

export function assertSourceRuntimePolicy({
  activeThemeId: selectedThemeId,
  approvedDecorRuntimeHashes,
  contents,
  file,
}: SourceRuntimePolicyInput): string | null {
  const digest = sha256(contents);
  const isApprovedDecorRuntime = approvedDecorRuntimeHashes.has(digest);
  if (forbiddenSourceEntrypointFile.test(file)) {
    throw new Error(`Storefront output contains the excluded upstream main entrypoint in ${file}.`);
  }
  if (selectedThemeId === "decor-store") {
    if (isApprovedDecorRuntime) return digest;
    if (sourceRuntimeName.test(file)) {
      throw new Error(`decor-store output contains an unapproved source runtime in ${file}.`);
    }
    return null;
  }
  const fashionRuntimeName = /(?:jquery|vendors(?:\.min)?(?:\.[A-Za-z0-9_-]+)?\.js)/i.test(file);
  if (revolutionRuntime.test(file) || (isApprovedDecorRuntime && !fashionRuntimeName)) {
    throw new Error(
      `${selectedThemeId} output contains Decor Store Revolution runtime in ${file}.`,
    );
  }
  if (selectedThemeId !== "fashion-store" && fashionRuntimeName) {
    throw new Error(`${selectedThemeId} output contains Fashion Store source runtime in ${file}.`);
  }
  return null;
}

async function outputFiles(output: string, directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await outputFiles(output, path)));
    if (entry.isFile()) files.push(relative(output, path).split(sep).join("/"));
  }
  return files;
}

function containsInactiveTheme(
  file: string,
  contents: string,
  theme: string,
  pattern: RegExp,
): boolean {
  if (pattern.test(file)) return true;
  const extension = extname(file);
  if (codeExtensions.has(extension)) return pattern.test(contents);
  if (extension !== ".html") return false;
  const structuralMarker = new RegExp(
    `(?:class|id|data-theme)=["'][^"']*${theme}(?:[._-]|["'])`,
    "i",
  );
  return structuralMarker.test(contents);
}

function embeddedCode(contents: string): string {
  return [...contents.matchAll(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>|<link\b[^>]*>/gi)]
    .map(([match]) => match)
    .join("\n");
}

async function approvedDecorRuntimeHashes(): Promise<Set<string>> {
  const sourceManifest = JSON.parse(
    await readFile(
      resolve(import.meta.dir, "../../../tools/storefront-theme-source-manifest.json"),
      "utf8",
    ),
  ) as {
    themes: { importedFiles: { kind: string; sha256: string }[]; themeId: string }[];
  };
  const decorStore = sourceManifest.themes.find(({ themeId }) => themeId === "decor-store");
  if (!decorStore) throw new Error("Decor Store source manifest is missing.");
  const hashes = decorStore.importedFiles
    .filter(({ kind }) => kind === "visual-runtime")
    .map(({ sha256: digest }) => digest);
  if (hashes.length !== 8 || new Set(hashes).size !== hashes.length) {
    throw new Error("Decor Store audited runtime manifest must contain eight unique hashes.");
  }
  return new Set(hashes);
}

async function main(): Promise<void> {
  const output = resolve(import.meta.dir, "../.output/public");
  const representativeRoutes =
    activeThemeId === "fashion-store" || activeThemeId === "decor-store"
      ? activeThemeRoutes.map(({ path }) => path)
      : [
          "/",
          manifest.routes.find((route) => route.startsWith("/collections/")),
          manifest.routes.find((route) => route.startsWith("/products/")),
        ].filter((route): route is string => Boolean(route));
  const outputPath = (route: string) =>
    route === "/" ? resolve(output, "index.html") : resolve(output, route.slice(1), "index.html");
  const initialJavaScriptBudgets = {
    default: 200 * 1024,
    "decor-store": 200 * 1024,
    "fashion-store": 300 * 1024,
  } as const;
  const budget =
    initialJavaScriptBudgets[activeThemeId as keyof typeof initialJavaScriptBudgets] ??
    initialJavaScriptBudgets.default;

  for (const route of representativeRoutes) {
    const html = await readFile(outputPath(route), "utf8");
    const entryAssets = new Set(
      [...html.matchAll(/(?:href|src)="(\/_nuxt\/[^"]+\.js)"/g)].map((match) => match[1]!),
    );
    if (entryAssets.size === 0)
      throw new Error(`${route} did not reference an initial JavaScript bundle.`);
    const assets = await collectInitialJavaScriptAssets(entryAssets, (asset) =>
      readFile(resolve(output, asset.slice(1)), "utf8"),
    );
    let totalGzip = 0;
    for (const asset of assets) {
      totalGzip += gzipSync(await readFile(resolve(output, asset.slice(1)))).byteLength;
    }
    if (totalGzip > budget) {
      throw new Error(`${route} initial JavaScript ${totalGzip} bytes gzip exceeds ${budget}.`);
    }
    console.log(`${route} initial JavaScript budget passed: ${totalGzip} / ${budget} bytes gzip.`);
  }

  const [files, approvedHashes] = await Promise.all([
    outputFiles(output, output),
    approvedDecorRuntimeHashes(),
  ]);
  const inactiveThemes =
    activeThemeId === "decor-store"
      ? ["fashion-store"]
      : activeThemeId === "fashion-store"
        ? ["decor-store"]
        : ["decor-store", "fashion-store"];
  const inactiveThemePatterns = inactiveThemes.map(
    (theme) =>
      [
        theme,
        new RegExp(
          `(?:themes(?:/|%2f|[._-])${theme}|data-${theme}|${theme}[._-](?:home|preview|source-parity|fonts|images|js|revolution))`,
          "i",
        ),
      ] as const,
  );
  const seenDecorRuntimeHashes = new Set<string>();

  for (const file of files) {
    if (extname(file) === ".php" || forbiddenRuntime.test(file)) {
      throw new Error(`Storefront output contains a prohibited upstream runtime in ${file}.`);
    }
    const bytes = new Uint8Array(await readFile(resolve(output, file)));
    const approvedRuntimeHash = assertSourceRuntimePolicy({
      activeThemeId,
      approvedDecorRuntimeHashes: approvedHashes,
      contents: bytes,
      file,
    });
    if (approvedRuntimeHash) seenDecorRuntimeHashes.add(approvedRuntimeHash);
    if (!textExtensions.has(extname(file))) continue;
    const contents = new TextDecoder().decode(bytes);
    const runtimeSurface = codeExtensions.has(extname(file))
      ? contents
      : extname(file) === ".html"
        ? embeddedCode(contents)
        : "";
    if (forbiddenRuntime.test(runtimeSurface)) {
      throw new Error(`Storefront output contains a prohibited upstream runtime in ${file}.`);
    }
    if (forbiddenSourceEntrypointCode.test(runtimeSurface)) {
      throw new Error(
        `Storefront output contains the excluded upstream main entrypoint in ${file}.`,
      );
    }
    if (revolutionRuntime.test(runtimeSurface) && activeThemeId !== "decor-store") {
      throw new Error(
        `${activeThemeId} output contains Decor Store Revolution runtime in ${file}.`,
      );
    }
    if (/fonts\.(?:googleapis|gstatic)\.com/i.test(runtimeSurface)) {
      throw new Error(`Storefront output contains an external font request in ${file}.`);
    }
    if (
      extname(file) === ".html" &&
      /<link\b(?=[^>]*\brel=["']prefetch["'])(?=[^>]*\bas=["']image["'])[^>]*>/i.test(contents)
    ) {
      throw new Error(`Storefront output eagerly prefetches non-critical images in ${file}.`);
    }
    for (const [inactiveTheme, pattern] of inactiveThemePatterns) {
      if (containsInactiveTheme(file, contents, inactiveTheme, pattern)) {
        throw new Error(
          `${activeThemeId} output contains inactive ${inactiveTheme} theme code or assets in ${file}.`,
        );
      }
    }
    if (activeThemeId === "production-fallback" && previewMaterial.test(contents)) {
      throw new Error(
        `Production storefront output contains preview artifact or credential material in ${file}.`,
      );
    }
  }

  if (activeThemeId === "fashion-store") {
    const themedImages = files.filter(
      (file) =>
        imageExtensions.has(extname(file).toLowerCase()) &&
        file.toLowerCase().includes("demo-fashion-store"),
    );
    if (themedImages.length < 10) {
      throw new Error(`${activeThemeId} output is missing its selected reference image set.`);
    }
    if (
      !files.some((file) => extname(file) === ".woff2" && /(?:figtree|outfit)-latin/i.test(file))
    ) {
      throw new Error(`${activeThemeId} output is missing its selected self-hosted font.`);
    }
    for (const runtime of [/jquery/i, /vendors\.min/i]) {
      if (!files.some((file) => extname(file) === ".js" && runtime.test(file))) {
        throw new Error(`fashion-store output is missing approved source runtime ${runtime}.`);
      }
    }
    const outputText = (
      await Promise.all(
        files
          .filter((file) => textExtensions.has(extname(file)))
          .map((file) => readFile(resolve(output, file), "utf8")),
      )
    ).join("\n");
    for (const marker of [
      "data-fashion-store-source-parity",
      "data-fashion-store-visual-runtime",
    ]) {
      if (!outputText.includes(marker)) {
        throw new Error(`fashion-store output is missing required isolation marker ${marker}.`);
      }
    }
  } else if (activeThemeId === "decor-store") {
    if (seenDecorRuntimeHashes.size !== approvedHashes.size) {
      throw new Error(
        "decor-store output is missing part of its audited Revolution dependency closure.",
      );
    }
    if (
      !files.some((file) => extname(file) === ".woff2" && /plus-jakarta-sans-latin/i.test(file))
    ) {
      throw new Error("decor-store output is missing its selected self-hosted font.");
    }
  } else {
    const previewFont = /(?:figtree|outfit|plus-jakarta-sans)-latin/i;
    if (files.some((file) => previewFont.test(file))) {
      throw new Error("Production fallback contains a preview theme font.");
    }
  }

  console.log(`Selected-theme output isolation passed for ${activeThemeId}.`);
}

if (import.meta.main) await main();
