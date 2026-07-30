import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export type StorefrontThemeId = "decor" | "fashion";
export type StorefrontThemeAssetKind = "font" | "icon" | "image";

export interface StorefrontThemeSourceAsset {
  destinationPath: string;
  kind: StorefrontThemeAssetKind;
  license: string;
  sourcePath: string;
}

export interface ImportedStorefrontThemeAsset extends StorefrontThemeSourceAsset {
  bytes: number;
  sha256: string;
}

export interface StorefrontThemeSource {
  allowlist: StorefrontThemeSourceAsset[];
  importedAt: string | null;
  importedFiles: ImportedStorefrontThemeAsset[];
  ownershipApproval: string | null;
  sourceIdentity: string | null;
  sourceRevision: string | null;
  themeId: StorefrontThemeId;
}

export interface StorefrontThemeSourceManifest {
  schemaVersion: 1;
  themes: StorefrontThemeSource[];
}

export interface ImportStorefrontThemeOptions {
  destinationRoot: string;
  importedAt: string;
  manifest: StorefrontThemeSourceManifest;
  manifestPath: string;
  source: string;
  themeId: StorefrontThemeId;
}

const ignoredDirectories = new Set([
  ".git",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "playwright-report",
  "reports",
  "test-results",
]);
const prohibitedExtensions = new Set([
  ".css",
  ".htm",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".php",
  ".scss",
  ".ts",
  ".tsx",
  ".vue",
]);
const limits: Record<StorefrontThemeAssetKind, number> = {
  font: 2_000_000,
  icon: 256_000,
  image: 5_000_000,
};

function normalizedRelativePath(path: string): string {
  const normalized = normalize(path);
  if (
    !path ||
    path.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith(`..${sep}`) ||
    normalized !== path ||
    path.includes("\\")
  ) {
    throw new Error(`Unsafe theme source path: ${path || "(empty)"}`);
  }
  return path;
}

function validateAssetDeclaration(asset: StorefrontThemeSourceAsset): void {
  const sourcePath = normalizedRelativePath(asset.sourcePath);
  const destinationPath = normalizedRelativePath(asset.destinationPath);
  if (!destinationPath.startsWith("assets/") || destinationPath === "assets/") {
    throw new Error(`Theme assets must be written below assets/: ${destinationPath}`);
  }
  if (!asset.license.trim()) {
    throw new Error(`An explicit asset license is required for ${sourcePath}.`);
  }
  const extension = extname(destinationPath).toLowerCase();
  const allowed =
    (asset.kind === "font" && extension === ".woff2") ||
    (asset.kind === "icon" && extension === ".svg") ||
    (asset.kind === "image" && [".avif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension));
  if (!allowed || extension !== extname(sourcePath).toLowerCase()) {
    throw new Error(`Unsupported kind, extension, or source/destination pair for ${sourcePath}.`);
  }
}

async function scanSource(source: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      const relativePath = relative(source, absolutePath).split(sep).join("/");
      if (entry.isSymbolicLink()) {
        throw new Error(`Theme source symlink is prohibited: ${relativePath}`);
      }
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Unsupported theme source entry: ${relativePath}`);
      }
      const extension = extname(entry.name).toLowerCase();
      if (
        entry.name.startsWith(".") ||
        prohibitedExtensions.has(extension) ||
        /(?:jquery|revolution|vendor)/i.test(entry.name)
      ) {
        throw new Error(`Prohibited theme source file: ${relativePath}`);
      }
      files.push(relativePath);
    }
  }
  await visit(source);
  return files.sort();
}

function startsWith(contents: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => contents[index] === byte);
}

function ascii(contents: Uint8Array, start: number, end: number): string {
  return new TextDecoder("ascii").decode(contents.subarray(start, end));
}

function validateSvg(contents: Uint8Array, path: string): void {
  const markup = new TextDecoder().decode(contents).trim();
  if (!/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(markup)) {
    throw new Error(`SVG MIME content is invalid for ${path}.`);
  }
  if (
    /<script|<foreignObject|<style|<!DOCTYPE|<!ENTITY|\son[a-z]+\s*=|javascript:|data:|url\s*\(/i.test(
      markup,
    )
  ) {
    throw new Error(`Scriptable SVG content is prohibited for ${path}.`);
  }
  if (/(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/)/i.test(markup)) {
    throw new Error(`External SVG references are prohibited for ${path}.`);
  }
}

function validateMime(asset: StorefrontThemeSourceAsset, contents: Uint8Array): void {
  const extension = extname(asset.sourcePath).toLowerCase();
  let valid = false;
  switch (extension) {
    case ".avif":
      valid = ascii(contents, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(contents, 8, 12));
      break;
    case ".jpeg":
    case ".jpg":
      valid = startsWith(contents, [0xff, 0xd8, 0xff]);
      break;
    case ".png":
      valid = startsWith(contents, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case ".svg":
      validateSvg(contents, asset.sourcePath);
      valid = true;
      break;
    case ".webp":
      valid = ascii(contents, 0, 4) === "RIFF" && ascii(contents, 8, 12) === "WEBP";
      break;
    case ".woff2":
      valid = ascii(contents, 0, 4) === "wOF2";
      break;
  }
  if (!valid) throw new Error(`Asset MIME does not match extension for ${asset.sourcePath}.`);
}

function sha256(contents: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(contents).digest("hex");
}

function upstreamMarkdown(source: StorefrontThemeSource): string {
  const title = source.themeId === "fashion" ? "Fashion" : "Decor";
  return `# ${title} Theme Source Provenance

- Source identity: \`${source.sourceIdentity}\`
- Source revision: \`${source.sourceRevision}\`
- Imported on: ${source.importedAt}
- Ownership approval: ${source.ownershipApproval}
- Import policy: allowlist-only binary assets; source code, vendor runtimes, global CSS, handlers, metadata, symlinks, and generated output are excluded.
- Manifest: \`../../../../../tools/storefront-theme-source-manifest.json\`

## Imported assets

${source.importedFiles
  .map(
    (file) =>
      `- \`${file.destinationPath}\` from \`${file.sourcePath}\` — ${file.license}; SHA-256 \`${file.sha256}\``,
  )
  .join("\n")}

## Local implementation

Theme templates, Vue components, CSS, and internal icon components are original reviewed repository code. No Crafto JavaScript, jQuery, Revolution Slider, PHP handler, or global vendor stylesheet is imported.
`;
}

function validateManifest(manifest: StorefrontThemeSourceManifest): void {
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported theme source manifest version.");
  if (new Set(manifest.themes.map(({ themeId }) => themeId)).size !== manifest.themes.length) {
    throw new Error("Theme source manifest IDs must be unique.");
  }
}

export async function importStorefrontTheme({
  destinationRoot,
  importedAt,
  manifest,
  manifestPath,
  source,
  themeId,
}: ImportStorefrontThemeOptions): Promise<StorefrontThemeSourceManifest> {
  validateManifest(manifest);
  const declaration = manifest.themes.find((theme) => theme.themeId === themeId);
  if (!declaration) throw new Error(`Theme source manifest does not declare ${themeId}.`);
  if (!declaration.ownershipApproval?.trim()) {
    throw new Error("A verified ownership approval is required before copying theme assets.");
  }
  if (!declaration.sourceIdentity?.trim() || !declaration.sourceRevision?.trim()) {
    throw new Error("A verified source identity and revision are required before copying assets.");
  }
  if (!importedAt.trim()) throw new Error("A deterministic import date is required.");
  declaration.allowlist.forEach(validateAssetDeclaration);
  const sourcePaths = declaration.allowlist.map(({ sourcePath }) => sourcePath);
  const destinationPaths = declaration.allowlist.map(({ destinationPath }) => destinationPath);
  if (
    new Set(sourcePaths).size !== sourcePaths.length ||
    new Set(destinationPaths).size !== destinationPaths.length
  ) {
    throw new Error("Theme source and destination allowlist paths must be unique.");
  }

  const resolvedSource = resolve(source);
  const scannedFiles = await scanSource(resolvedSource);
  const allowedPaths = new Set(sourcePaths);
  const unlisted = scannedFiles.find((path) => !allowedPaths.has(path));
  if (unlisted) throw new Error(`Theme source contains an unlisted addition: ${unlisted}`);
  const missing = sourcePaths.find((path) => !scannedFiles.includes(path));
  if (missing) throw new Error(`Allowlisted theme source asset is missing: ${missing}`);

  const importedFiles: ImportedStorefrontThemeAsset[] = [];
  const fileContents = new Map<string, Uint8Array>();
  for (const asset of [...declaration.allowlist].sort((left, right) =>
    left.destinationPath.localeCompare(right.destinationPath),
  )) {
    const contents = new Uint8Array(await readFile(join(resolvedSource, asset.sourcePath)));
    if (contents.byteLength > limits[asset.kind]) {
      throw new Error(`Theme asset exceeds the ${asset.kind} size limit: ${asset.sourcePath}`);
    }
    validateMime(asset, contents);
    fileContents.set(asset.destinationPath, contents);
    importedFiles.push({
      ...asset,
      bytes: contents.byteLength,
      sha256: sha256(contents),
    });
  }

  const nextManifest = structuredClone(manifest);
  const nextDeclaration = nextManifest.themes.find((theme) => theme.themeId === themeId)!;
  nextDeclaration.importedAt = importedAt;
  nextDeclaration.importedFiles = importedFiles;
  nextManifest.themes.sort((left, right) => left.themeId.localeCompare(right.themeId));

  const resolvedDestinationRoot = resolve(destinationRoot);
  await mkdir(resolvedDestinationRoot, { recursive: true });
  const staging = await mkdtemp(join(resolvedDestinationRoot, ".theme-import-"));
  try {
    for (const [destinationPath, contents] of fileContents) {
      const outputPath = join(staging, destinationPath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, contents);
    }
    const themeRoot = join(resolvedDestinationRoot, themeId);
    const destinationAssets = join(themeRoot, "assets");
    await mkdir(themeRoot, { recursive: true });
    await rm(destinationAssets, { force: true, recursive: true });
    await rename(join(staging, "assets"), destinationAssets);
    await writeFile(join(themeRoot, "UPSTREAM.md"), upstreamMarkdown(nextDeclaration));
    await mkdir(dirname(resolve(manifestPath)), { recursive: true });
    await writeFile(resolve(manifestPath), `${JSON.stringify(nextManifest, null, 2)}\n`);
  } finally {
    await rm(staging, { force: true, recursive: true });
  }
  return nextManifest;
}

function argumentValue(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const arguments_ = Bun.argv.slice(2);
  const source = argumentValue(arguments_, "--source");
  const themeId = argumentValue(arguments_, "--theme");
  if (
    !source ||
    (themeId !== "fashion" && themeId !== "decor") ||
    !arguments_.includes("--ownership-confirmed")
  ) {
    throw new Error(
      "Usage: bun tools/import-storefront-theme.ts --source=<path> --theme=<fashion|decor> --ownership-confirmed",
    );
  }
  const root = process.cwd();
  const manifestPath = join(root, "tools/storefront-theme-source-manifest.json");
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as StorefrontThemeSourceManifest;
  const next = await importStorefrontTheme({
    destinationRoot: join(root, "apps/storefront/app/themes"),
    importedAt: new Date().toISOString().slice(0, 10),
    manifest,
    manifestPath,
    source,
    themeId,
  });
  const imported = next.themes.find((theme) => theme.themeId === themeId)!;
  console.log(`Imported ${imported.importedFiles.length} approved ${themeId} assets.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
