import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

export type StorefrontThemeId = "decor" | "fashion" | "fashion-2";
export type StorefrontThemeAssetKind =
  "font" | "icon" | "image" | "markup" | "stylesheet" | "visual-runtime";

export interface StorefrontThemeSourceAsset {
  destinationPath: string;
  expectedSha256?: string;
  kind: StorefrontThemeAssetKind;
  license: string;
  supplementalSourcePath?: string;
  sourcePath: string;
}

export interface ImportedStorefrontThemeAsset extends StorefrontThemeSourceAsset {
  bytes: number;
  sha256: string;
}

export interface StorefrontThemeSource {
  allowlist: StorefrontThemeSourceAsset[];
  behaviorReferences?: {
    execution: "adapter-reference-only" | "excluded-side-effect";
    lineEnd: number;
    lineStart: number;
    path: string;
    purpose: string;
  }[];
  closedSourceDirectories?: string[];
  ignoredCssReferences?: Record<string, string[]>;
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
  repositoryRoot?: string;
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
  font: 4_000_000,
  icon: 256_000,
  image: 5_000_000,
  markup: 2_000_000,
  stylesheet: 2_000_000,
  "visual-runtime": 5_000_000,
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

function validateAssetDeclaration(
  asset: StorefrontThemeSourceAsset,
  themeId: StorefrontThemeId,
): void {
  const sourcePath = normalizedRelativePath(asset.sourcePath);
  const destinationPath = normalizedRelativePath(asset.destinationPath);
  const isSourceImplementation = themeId === "fashion-2";
  if (isSourceImplementation) {
    if (destinationPath !== `upstream/${sourcePath}`) {
      throw new Error(
        `Fashion 2 must preserve its source-relative path below upstream/: ${destinationPath}`,
      );
    }
    if (!/^[a-f0-9]{64}$/.test(asset.expectedSha256 ?? "")) {
      throw new Error(`Fashion 2 requires an expected SHA-256 hash for ${sourcePath}.`);
    }
    if (asset.supplementalSourcePath) normalizedRelativePath(asset.supplementalSourcePath);
  } else if (!destinationPath.startsWith("assets/") || destinationPath === "assets/") {
    throw new Error(`Theme assets must be written below assets/: ${destinationPath}`);
  }
  if (!asset.license.trim()) {
    throw new Error(`An explicit asset license is required for ${sourcePath}.`);
  }
  const extension = extname(destinationPath).toLowerCase();
  const allowed = isSourceImplementation
    ? (asset.kind === "font" && [".eot", ".svg", ".ttf", ".woff", ".woff2"].includes(extension)) ||
      (asset.kind === "icon" && extension === ".svg") ||
      (asset.kind === "image" && [".avif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension)) ||
      (asset.kind === "markup" && [".htm", ".html"].includes(extension)) ||
      (asset.kind === "stylesheet" && extension === ".css") ||
      (asset.kind === "visual-runtime" && extension === ".js")
    : (asset.kind === "font" && extension === ".woff2") ||
      (asset.kind === "icon" && extension === ".svg") ||
      (asset.kind === "image" && [".avif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension));
  if (!allowed || extension !== extname(sourcePath).toLowerCase()) {
    throw new Error(`Unsupported kind, extension, or source/destination pair for ${sourcePath}.`);
  }
}

async function scanLegacyBinarySource(source: string): Promise<string[]> {
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

async function assertRegularSourceFile(source: string, path: string): Promise<void> {
  const segments = normalizedRelativePath(path).split("/");
  let current = resolve(source);
  for (const segment of segments) {
    current = join(current, segment);
    let entry;
    try {
      entry = await lstat(current);
    } catch {
      throw new Error(`Allowlisted theme source asset is missing: ${path}`);
    }
    if (entry.isSymbolicLink()) throw new Error(`Theme source symlink is prohibited: ${path}`);
  }
  const entry = await lstat(current);
  if (!entry.isFile()) throw new Error(`Unsupported theme source entry: ${path}`);
}

async function sourceFilePath(
  source: string,
  repositoryRoot: string,
  asset: StorefrontThemeSourceAsset,
): Promise<string> {
  const root = asset.supplementalSourcePath ? repositoryRoot : source;
  const path = asset.supplementalSourcePath ?? asset.sourcePath;
  await assertRegularSourceFile(root, path);
  return join(resolve(root), path);
}

async function assertClosedSourceDirectories(
  source: string,
  declaration: StorefrontThemeSource,
): Promise<void> {
  const allowedPaths = new Set(declaration.allowlist.map(({ sourcePath }) => sourcePath));
  for (const declaredDirectory of declaration.closedSourceDirectories ?? []) {
    const directory = normalizedRelativePath(declaredDirectory);
    const absoluteDirectory = resolve(source, directory);
    if (relative(resolve(source), absoluteDirectory).startsWith("..")) {
      throw new Error(`Unsafe closed source directory: ${directory}`);
    }
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Theme source symlink is prohibited: ${path}`);
      if (!entry.isFile()) throw new Error(`Unsupported closed source entry: ${path}`);
      if (entry.name.startsWith(".")) {
        throw new Error(`Prohibited hidden source file in closed directory: ${path}`);
      }
      if (!allowedPaths.has(path)) {
        throw new Error(`Closed theme source contains an unlisted executable or asset: ${path}`);
      }
    }
  }
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

function validateSvgFont(contents: Uint8Array, path: string): void {
  const markup = new TextDecoder().decode(contents).trim();
  if (!/<svg[\s>]/i.test(markup) || !/<font[\s>]/i.test(markup)) {
    throw new Error(`SVG font content is invalid for ${path}.`);
  }
  if (
    /<script|<foreignObject|\son[a-z]+\s*=|javascript:|data:/i.test(markup) ||
    /(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/)/i.test(markup)
  ) {
    throw new Error(`Scriptable SVG font content is prohibited for ${path}.`);
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
      if (asset.kind === "font") validateSvgFont(contents, asset.sourcePath);
      else validateSvg(contents, asset.sourcePath);
      valid = true;
      break;
    case ".css":
    case ".htm":
    case ".html":
    case ".js":
      new TextDecoder("utf-8", { fatal: true }).decode(contents);
      valid = true;
      break;
    case ".eot":
      valid = contents.byteLength >= 4;
      break;
    case ".ttf":
      valid = startsWith(contents, [0x00, 0x01, 0x00, 0x00]) || ascii(contents, 0, 4) === "OTTO";
      break;
    case ".woff":
      valid = ascii(contents, 0, 4) === "wOFF";
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

function validateStylesheetReferences(
  asset: StorefrontThemeSourceAsset,
  contents: Uint8Array,
  sourcePaths: ReadonlySet<string>,
  ignoredReferences: Readonly<Record<string, readonly string[]>>,
): void {
  if (asset.kind !== "stylesheet") return;
  const stylesheet = new TextDecoder().decode(contents);
  for (const match of stylesheet.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const reference = match[1]!.trim();
    if (
      !reference ||
      reference.startsWith("data:") ||
      reference.startsWith("http://") ||
      reference.startsWith("https://") ||
      reference.startsWith("//") ||
      reference.startsWith("#")
    )
      continue;
    const resolvedReference = posix.normalize(
      posix.join(posix.dirname(asset.sourcePath), reference.split(/[?#]/)[0]!),
    );
    if (ignoredReferences[asset.sourcePath]?.includes(reference)) continue;
    if (!sourcePaths.has(resolvedReference)) {
      throw new Error(
        `CSS reference ${reference} from ${asset.sourcePath} is missing from the Fashion 2 allowlist.`,
      );
    }
  }
}

function sha256(contents: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(contents).digest("hex");
}

function upstreamMarkdown(source: StorefrontThemeSource): string {
  const title =
    source.themeId === "fashion-2"
      ? "Fashion 2"
      : source.themeId === "fashion"
        ? "Fashion"
        : "Decor";
  if (source.themeId === "fashion-2") {
    return `# ${title} Theme Source Provenance

- Source identity: \`${source.sourceIdentity}\`
- Source revision: \`${source.sourceRevision}\`
- Imported on: ${source.importedAt}
- Ownership approval: ${source.ownershipApproval}
- Import policy: hash-pinned Fashion 2 source implementation; source-relative paths are preserved below \`upstream/\`.
- Manifest: \`../../../../../tools/storefront-theme-source-manifest.json\`

## Runtime boundary

The pinned vendor files provide reviewed visual runtime capabilities. \`js/main.js\` is retained as a line-addressable behavioral reference and is not executed as the application entry point. Nuxt owns rendering, routing, fixture data, and commerce actions; the Fashion 2 adapter may initialize only reviewed visual behavior and must dispose it on unmount.

${(source.behaviorReferences ?? [])
  .map(
    ({ execution, lineEnd, lineStart, path, purpose }) =>
      `- \`${path}:${lineStart}-${lineEnd}\` — ${execution}: ${purpose}`,
  )
  .join("\n")}

## Upstream optional references

${
  Object.entries(source.ignoredCssReferences ?? {})
    .flatMap(([stylesheet, references]) =>
      references.map(
        (reference) =>
          `- \`${stylesheet}\` references \`${reference}\`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.`,
      ),
    )
    .join("\n") || "- None."
}

## Imported files

${source.importedFiles
  .map(
    (file) =>
      `- \`${file.destinationPath}\` from \`${file.sourcePath}\` — ${file.kind}; ${file.license}; SHA-256 \`${file.sha256}\``,
  )
  .join("\n")}
`;
  }
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
  repositoryRoot = process.cwd(),
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
  declaration.allowlist.forEach((asset) => validateAssetDeclaration(asset, themeId));
  const sourcePaths = declaration.allowlist.map(({ sourcePath }) => sourcePath);
  const destinationPaths = declaration.allowlist.map(({ destinationPath }) => destinationPath);
  if (
    new Set(sourcePaths).size !== sourcePaths.length ||
    new Set(destinationPaths).size !== destinationPaths.length
  ) {
    throw new Error("Theme source and destination allowlist paths must be unique.");
  }

  const resolvedSource = resolve(source);
  const allowedPaths = new Set(sourcePaths);
  if (themeId === "fashion-2") {
    await Promise.all(
      declaration.allowlist.map((asset) =>
        sourceFilePath(resolvedSource, resolve(repositoryRoot), asset),
      ),
    );
    await assertClosedSourceDirectories(resolvedSource, declaration);
  } else {
    const scannedFiles = await scanLegacyBinarySource(resolvedSource);
    const unlisted = scannedFiles.find((path) => !allowedPaths.has(path));
    if (unlisted) throw new Error(`Theme source contains an unlisted addition: ${unlisted}`);
    const missing = sourcePaths.find((path) => !scannedFiles.includes(path));
    if (missing) throw new Error(`Allowlisted theme source asset is missing: ${missing}`);
  }

  const importedFiles: ImportedStorefrontThemeAsset[] = [];
  const fileContents = new Map<string, Uint8Array>();
  for (const asset of [...declaration.allowlist].sort((left, right) =>
    left.destinationPath.localeCompare(right.destinationPath),
  )) {
    const contents = new Uint8Array(
      await readFile(
        themeId === "fashion-2"
          ? await sourceFilePath(resolvedSource, resolve(repositoryRoot), asset)
          : join(resolvedSource, asset.sourcePath),
      ),
    );
    if (contents.byteLength > limits[asset.kind]) {
      throw new Error(`Theme asset exceeds the ${asset.kind} size limit: ${asset.sourcePath}`);
    }
    validateMime(asset, contents);
    const digest = sha256(contents);
    if (themeId === "fashion-2" && digest !== asset.expectedSha256) {
      throw new Error(`Fashion 2 source hash mismatch: ${asset.sourcePath}`);
    }
    validateStylesheetReferences(
      asset,
      contents,
      allowedPaths,
      declaration.ignoredCssReferences ?? {},
    );
    fileContents.set(asset.destinationPath, contents);
    importedFiles.push({
      ...asset,
      bytes: contents.byteLength,
      sha256: digest,
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
    const destinationSubtree = themeId === "fashion-2" ? "upstream" : "assets";
    const destinationAssets = join(themeRoot, destinationSubtree);
    await mkdir(themeRoot, { recursive: true });
    await rm(destinationAssets, { force: true, recursive: true });
    await rename(join(staging, destinationSubtree), destinationAssets);
    await writeFile(join(themeRoot, "UPSTREAM.md"), upstreamMarkdown(nextDeclaration));
    await mkdir(dirname(resolve(manifestPath)), { recursive: true });
    await writeFile(
      resolve(manifestPath),
      await format(JSON.stringify(nextManifest), { parser: "json" }),
    );
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
    (themeId !== "fashion" && themeId !== "decor" && themeId !== "fashion-2") ||
    !arguments_.includes("--ownership-confirmed")
  ) {
    throw new Error(
      "Usage: bun tools/import-storefront-theme.ts --source=<path> --theme=<fashion|decor|fashion-2> --ownership-confirmed",
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
