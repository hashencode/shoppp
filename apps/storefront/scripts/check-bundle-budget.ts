import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { activeThemeId } from "../app/generated/active-theme";
import manifest from "../app/generated/route-manifest.json";

const output = resolve(import.meta.dir, "../.output/public");
const representativeRoutes = [
  "/",
  manifest.routes.find((route) => route.startsWith("/collections/")),
  manifest.routes.find((route) => route.startsWith("/products/")),
].filter((route): route is string => Boolean(route));
const outputPath = (route: string) =>
  route === "/" ? resolve(output, "index.html") : resolve(output, route.slice(1), "index.html");
const budget = 200 * 1024;
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".txt", ".xml"]);
const codeExtensions = new Set([".css", ".js", ".map"]);
const imageExtensions = new Set([".avif", ".jpg", ".jpeg", ".png", ".webp"]);

async function outputFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await outputFiles(path)));
    if (entry.isFile()) files.push(relative(output, path).split(sep).join("/"));
  }
  return files;
}

for (const route of representativeRoutes) {
  const html = await readFile(outputPath(route), "utf8");
  const assets = new Set(
    [...html.matchAll(/(?:href|src)="(\/_nuxt\/[^"]+\.js)"/g)].map((match) => match[1]!),
  );
  if (assets.size === 0)
    throw new Error(`${route} did not reference an initial JavaScript bundle.`);
  let totalGzip = 0;
  for (const asset of assets) {
    totalGzip += gzipSync(await readFile(resolve(output, asset.slice(1)))).byteLength;
  }
  if (totalGzip > budget) {
    throw new Error(`${route} initial JavaScript ${totalGzip} bytes gzip exceeds ${budget}.`);
  }
  console.log(`${route} initial JavaScript budget passed: ${totalGzip} / ${budget} bytes gzip.`);
}

const files = await outputFiles(output);
const prohibitedRuntime =
  /(?:jquery|revolution(?:\.min)?\.js|revslider|contact\.php|(?:^|[/_-])crafto(?:\.min)?\.(?:css|js)|[/_-]crafto[/_-])/i;
const inactiveThemes =
  activeThemeId === "fashion"
    ? ["decor"]
    : activeThemeId === "decor"
      ? ["fashion"]
      : ["decor", "fashion"];
const inactiveThemePatterns = inactiveThemes.map(
  (theme) => [theme, new RegExp(`${theme}(?:[./_-]|%2f)`, "i")] as const,
);
const previewMaterial =
  /(?:grant_[A-Za-z0-9_-]+|__preview\/session|snapshot-[a-z0-9-]+\/[a-f0-9]{64})/i;

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

for (const file of files) {
  if (extname(file) === ".php" || prohibitedRuntime.test(file)) {
    throw new Error(`Storefront output contains a prohibited upstream runtime in ${file}.`);
  }
  if (!textExtensions.has(extname(file))) continue;
  const contents = await readFile(resolve(output, file), "utf8");
  const runtimeSurface = codeExtensions.has(extname(file))
    ? contents
    : extname(file) === ".html"
      ? embeddedCode(contents)
      : "";
  if (prohibitedRuntime.test(runtimeSurface)) {
    throw new Error(`Storefront output contains a prohibited upstream runtime in ${file}.`);
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

if (activeThemeId === "fashion" || activeThemeId === "decor") {
  const themedImages = files.filter(
    (file) =>
      imageExtensions.has(extname(file).toLowerCase()) &&
      file.toLowerCase().includes(`demo-${activeThemeId}-store`),
  );
  const expectedFont =
    activeThemeId === "fashion" ? /(?:figtree|outfit)-latin/i : /plus-jakarta-sans-latin/i;
  if (themedImages.length < 10) {
    throw new Error(`${activeThemeId} output is missing its selected reference image set.`);
  }
  if (!files.some((file) => extname(file) === ".woff2" && expectedFont.test(file))) {
    throw new Error(`${activeThemeId} output is missing its selected self-hosted font.`);
  }
} else {
  const previewFont = /(?:figtree|outfit|plus-jakarta-sans)-latin/i;
  if (files.some((file) => previewFont.test(file))) {
    throw new Error("Production fallback contains a preview theme font.");
  }
}

console.log(`Selected-theme output isolation passed for ${activeThemeId}.`);
