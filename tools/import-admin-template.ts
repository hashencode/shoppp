import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const APPROVED_COMMIT = "fdd1935d35b1919ae6673970e8c428777c71d261";
const ALLOWED_PREFIXES = ["docs/ai/", "e2e/", "public/", "src/"];
const ALLOWED_FILES = new Set([
  ".prettierignore",
  ".prettierrc.json",
  "DESIGN.md",
  "README.md",
  "docs/testing-standards.md",
  "eslint.config.js",
  "index.html",
  "package.json",
  "playwright.config.ts",
  "postcss.config.cjs",
  "rsbuild.config.ts",
  "rstest.browser.config.ts",
  "rstest.config.ts",
  "rstest.setup.ts",
  "tailwind.config.cjs",
  "tsconfig.app.json",
  "tsconfig.json",
  "tsconfig.node.json",
]);
const EXCLUDED_PATHS = [
  ".agents/",
  ".env*",
  ".git/",
  ".gstack/",
  "AGENTS.md",
  "bun.lock",
  "coverage/",
  "dist/",
  "node_modules/",
  "playwright-report/",
  "reports/",
  "test-results/",
];

export interface AdminTemplateManifest {
  schemaVersion: 1;
  source: {
    commit: string;
    committedAt: string;
    label: string;
    ownershipAssertion: string;
    tag: string | null;
  };
  importedAt: string;
  allowlist: {
    files: string[];
    prefixes: string[];
  };
  exclusions: string[];
  files: Array<{
    path: string;
    sha256: string;
  }>;
}

export interface ImportAdminTemplateOptions {
  approvedCommit: string;
  destination: string;
  importedAt: string;
  manifestPath: string;
  ownershipAssertion: string;
  source: string;
  sourceLabel: string;
}

async function runGitText(source: string, arguments_: string[]): Promise<string> {
  const process = Bun.spawn(["git", "-C", source, ...arguments_], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`git ${arguments_.join(" ")} failed: ${stderr.trim()}`);
  }
  return stdout.trim();
}

async function readGitBlob(source: string, commit: string, path: string): Promise<Uint8Array> {
  const process = Bun.spawn(["git", "-C", source, "show", `${commit}:${path}`], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).arrayBuffer(),
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`Unable to read ${path} from ${commit}: ${stderr.trim()}`);
  }
  return new Uint8Array(stdout);
}

function isAllowed(path: string): boolean {
  return ALLOWED_FILES.has(path) || ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function assertSafeGitPath(path: string): void {
  const normalizedPath = normalize(path);
  if (
    path.startsWith("/") ||
    normalizedPath === ".." ||
    normalizedPath.startsWith(`..${sep}`) ||
    normalizedPath !== path
  ) {
    throw new Error(`Unsafe path in source tree: ${path}`);
  }
}

function hash(contents: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(contents).digest("hex");
}

function upstreamMarkdown(manifest: AdminTemplateManifest): string {
  return `# Admin Template Provenance

This application was copied from the read-only \`${manifest.source.label}\` template.

- Approved commit: \`${manifest.source.commit}\`
- Source tag: ${manifest.source.tag ? `\`${manifest.source.tag}\`` : "none"}
- Source commit time: ${manifest.source.committedAt}
- Imported on: ${manifest.importedAt}
- Ownership assertion: ${manifest.source.ownershipAssertion}
- Import policy: allowlist-only from the committed Git tree; the source worktree is never copied.
- Manifest: \`../../tools/admin-template-manifest.json\`

## Exclusions

${manifest.exclusions.map((path) => `- \`${path}\``).join("\n")}

## Local commerce adaptations

- Workspace package naming and root quality-gate integration.
- Cloudflare static-asset deployment configuration.
- Commerce routes, permissions, API integration, and pages added by later implementation units.
`;
}

export async function importAdminTemplate(
  options: ImportAdminTemplateOptions,
): Promise<AdminTemplateManifest> {
  if (!options.ownershipAssertion.trim()) {
    throw new Error("An ownership assertion is required before copying the admin template.");
  }

  const sourceStatusBefore = await runGitText(options.source, ["status", "--porcelain=v1"]);
  const resolvedCommit = await runGitText(options.source, [
    "rev-parse",
    `${options.approvedCommit}^{commit}`,
  ]).catch(() => "");
  if (!resolvedCommit || resolvedCommit !== options.approvedCommit) {
    throw new Error(
      `Source does not resolve the approved commit ${options.approvedCommit}; resolved ${resolvedCommit || "nothing"}.`,
    );
  }

  const treePaths = (
    await runGitText(options.source, ["ls-tree", "-r", "--name-only", resolvedCommit])
  )
    .split("\n")
    .filter(Boolean);
  const selectedPaths = treePaths.filter(isAllowed).sort();
  if (
    !selectedPaths.includes("package.json") ||
    !selectedPaths.some((path) => path.startsWith("src/"))
  ) {
    throw new Error(
      "Approved source is missing the required package.json or src/ application tree.",
    );
  }

  const tags = await runGitText(options.source, ["tag", "--points-at", resolvedCommit]);
  const committedAt = await runGitText(options.source, [
    "show",
    "-s",
    "--format=%cI",
    resolvedCommit,
  ]);
  const stagingParent = dirname(resolve(options.destination));
  await mkdir(stagingParent, { recursive: true });
  const staging = await mkdtemp(join(stagingParent, ".admin-import-"));
  const importedFiles: AdminTemplateManifest["files"] = [];

  try {
    for (const path of selectedPaths) {
      assertSafeGitPath(path);
      const contents = await readGitBlob(options.source, resolvedCommit, path);
      const outputPath = join(staging, path);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, contents);
      importedFiles.push({ path, sha256: hash(contents) });
    }

    const manifest: AdminTemplateManifest = {
      schemaVersion: 1,
      source: {
        commit: resolvedCommit,
        committedAt,
        label: options.sourceLabel,
        ownershipAssertion: options.ownershipAssertion.trim(),
        tag: tags.split("\n").filter(Boolean).sort()[0] ?? null,
      },
      importedAt: options.importedAt,
      allowlist: {
        files: [...ALLOWED_FILES].sort(),
        prefixes: [...ALLOWED_PREFIXES].sort(),
      },
      exclusions: [...EXCLUDED_PATHS],
      files: importedFiles,
    };

    await writeFile(join(staging, "UPSTREAM.md"), upstreamMarkdown(manifest));
    await rm(options.destination, { force: true, recursive: true });
    await rename(staging, options.destination);
    await mkdir(dirname(options.manifestPath), { recursive: true });
    await writeFile(options.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const sourceStatusAfter = await runGitText(options.source, ["status", "--porcelain=v1"]);
    if (sourceStatusAfter !== sourceStatusBefore) {
      throw new Error("Source repository status changed during import; refusing the result.");
    }
    return manifest;
  } catch (error) {
    await rm(staging, { force: true, recursive: true });
    throw error;
  }
}

function argumentValue(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const arguments_ = Bun.argv.slice(2);
  const source = argumentValue(arguments_, "--source");
  const ownershipConfirmed = arguments_.includes("--ownership-confirmed");
  if (!source || !ownershipConfirmed) {
    throw new Error(
      "Usage: bun tools/import-admin-template.ts --source=<path> --ownership-confirmed",
    );
  }

  const root = process.cwd();
  const previousManifest = await readFile(join(root, "tools/admin-template-manifest.json"), "utf8")
    .then((contents) => JSON.parse(contents) as AdminTemplateManifest)
    .catch(() => undefined);
  const importedAt =
    previousManifest?.source.commit === APPROVED_COMMIT
      ? previousManifest.importedAt
      : new Date().toISOString().slice(0, 10);

  const manifest = await importAdminTemplate({
    approvedCommit: APPROVED_COMMIT,
    destination: join(root, "apps/admin"),
    importedAt,
    manifestPath: join(root, "tools/admin-template-manifest.json"),
    ownershipAssertion:
      "The user supplied this template and authorized copying the approved committed revision.",
    source: resolve(source),
    sourceLabel: basename(resolve(source)),
  });
  console.log(`Imported ${manifest.files.length} files from ${manifest.source.commit}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
