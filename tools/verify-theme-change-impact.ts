import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type ThemeChangeImpact =
  | { mode: "none"; themeIds: [] }
  | { mode: "themes"; themeIds: string[] }
  | { mode: "matrix"; themeIds: [] };

const ROOT = resolve(import.meta.dir, "..");
const STOREFRONT_ROOT = resolve(ROOT, "apps/storefront");
const THEME_DIRECTORY = resolve(STOREFRONT_ROOT, "app/themes");
const ZERO_SHA = /^0+$/;
const SAFE_GIT_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;

const sharedThemePaths = [
  /^apps\/storefront\/app\/(?:assets|components|composables|generated|layouts|middleware|pages|plugins|utils)\//,
  /^apps\/storefront\/e2e\/support\//,
  /^apps\/storefront\/tests\/theme-/,
  /^apps\/storefront\/(?:nuxt\.config\.ts|package\.json|playwright\.config\.ts)$/,
  /^tools\/(?:capture-(?:source-equivalence|storefront-theme|theme-)|generate-storefront-theme|import-storefront-theme|run-source-equivalence|scaffold-source-equivalent-theme|source-equivalence|storefront-(?:source-equivalence|theme-source)|theme-(?:capture|fidelity)|verify-(?:source-equivalent-themes|theme-behavior))/,
];

function normalizedPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function safeGitRef(value: string, label: string): string {
  if (!SAFE_GIT_REF.test(value)) throw new Error(`${label} contains an unsafe Git ref.`);
  return value;
}

function namedThemeForPath(path: string, themeIds: readonly string[]): string | undefined {
  if (!/^apps\/storefront\/(?:e2e\/|tests\/|playwright\.)/.test(path)) return undefined;
  return [...themeIds]
    .sort((left, right) => right.length - left.length)
    .find((themeId) => {
      const escapedThemeId = themeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|[./_-])${escapedThemeId}(?:[./_-]|$)`).test(path);
    });
}

export function classifyThemeChangeImpact(
  changedPaths: readonly string[],
  themeIds: readonly string[],
): ThemeChangeImpact {
  const knownThemeIds = [...themeIds].sort();
  const impactedThemes = new Set<string>();

  for (const rawPath of changedPaths) {
    const path = normalizedPath(rawPath);
    const themePath = path.match(/^apps\/storefront\/app\/themes\/([^/]+)\//)?.[1];
    if (themePath && !knownThemeIds.includes(themePath)) {
      throw new Error(`Theme path "${themePath}" has no matching test:<theme-id> script.`);
    }

    if (themePath) {
      impactedThemes.add(themePath);
      continue;
    }

    if (sharedThemePaths.some((pattern) => pattern.test(path))) {
      return { mode: "matrix", themeIds: [] };
    }

    const namedTheme = namedThemeForPath(path, knownThemeIds);
    if (namedTheme) impactedThemes.add(namedTheme);
  }

  if (impactedThemes.size === 0) return { mode: "none", themeIds: [] };
  return { mode: "themes", themeIds: [...impactedThemes].sort() };
}

export function commandsForThemeImpact(impact: ThemeChangeImpact): string[][] {
  if (impact.mode === "none") return [];
  if (impact.mode === "matrix") return [["bun", "run", "test:theme-matrix"]];
  return impact.themeIds.map((themeId) => [
    "bun",
    "run",
    "--cwd",
    "apps/storefront",
    `test:${themeId}`,
  ]);
}

function parseArguments(arguments_: readonly string[]): {
  base?: string;
  dryRun: boolean;
  head?: string;
} {
  let base: string | undefined;
  let head: string | undefined;
  let dryRun = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--base" || argument === "--head") {
      const value = arguments_[index + 1];
      if (!value) throw new Error(`${argument} requires a Git ref.`);
      safeGitRef(value, argument);
      if (argument === "--base") base = value;
      else head = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (head && !base) throw new Error("--head requires --base.");
  return {
    dryRun,
    ...(base ? { base } : {}),
    ...(head ? { head } : {}),
  };
}

async function git(arguments_: readonly string[]): Promise<string> {
  const child = Bun.spawn(["git", ...arguments_], {
    cwd: ROOT,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr.trim() || `git ${arguments_.join(" ")} failed`);
  return stdout.trim();
}

function lines(output: string): string[] {
  return output ? output.split("\n").filter(Boolean) : [];
}

async function localChangedPaths(): Promise<string[]> {
  const outputs = await Promise.all([
    git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ]);
  const paths = new Set(outputs.flatMap(lines));
  if (paths.size > 0) return [...paths].sort();

  try {
    return lines(await git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD^", "HEAD", "--"]));
  } catch {
    return [];
  }
}

async function changedPathsBetween(base: string, head: string): Promise<string[] | undefined> {
  if (ZERO_SHA.test(base)) return undefined;
  try {
    return lines(
      await git(["diff", "--name-only", "--diff-filter=ACMR", `${base}..${head}`, "--"]),
    );
  } catch (error) {
    console.warn(
      `[theme-impact] Could not resolve ${base}..${head}; running the full matrix instead. ${String(error)}`,
    );
    return undefined;
  }
}

async function declaredThemeIds(): Promise<string[]> {
  const [entries, packageContents] = await Promise.all([
    readdir(THEME_DIRECTORY, { withFileTypes: true }),
    readFile(resolve(STOREFRONT_ROOT, "package.json"), "utf8"),
  ]);
  const scripts =
    (JSON.parse(packageContents) as { scripts?: Record<string, string> }).scripts ?? {};
  return entries
    .filter((entry) => entry.isDirectory() && `test:${entry.name}` in scripts)
    .map((entry) => entry.name)
    .sort();
}

async function main(): Promise<void> {
  const options = parseArguments(Bun.argv.slice(2));
  const environmentBase = process.env.SHOPPP_THEME_CHECK_BASE?.trim();
  const environmentHead = process.env.SHOPPP_THEME_CHECK_HEAD?.trim();
  if (environmentBase) safeGitRef(environmentBase, "SHOPPP_THEME_CHECK_BASE");
  if (environmentHead) safeGitRef(environmentHead, "SHOPPP_THEME_CHECK_HEAD");
  const base = options.base ?? environmentBase;
  const head = options.head ?? environmentHead ?? "HEAD";
  const changedPaths = base ? await changedPathsBetween(base, head) : await localChangedPaths();
  const impact = changedPaths
    ? classifyThemeChangeImpact(changedPaths, await declaredThemeIds())
    : ({ mode: "matrix", themeIds: [] } satisfies ThemeChangeImpact);
  const commands = commandsForThemeImpact(impact);

  if (commands.length === 0) {
    console.log("[theme-impact] No theme-bearing paths changed; skipping theme browser suites.");
    return;
  }

  console.log(
    `[theme-impact] ${impact.mode === "matrix" ? "Shared theme infrastructure changed" : `Affected themes: ${impact.themeIds.join(", ")}`}.`,
  );
  for (const command of commands) {
    console.log(`[theme-impact] ${command.join(" ")}`);
    if (options.dryRun) continue;
    const child = Bun.spawn(command, {
      cwd: ROOT,
      env: process.env,
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) process.exit(exitCode);
  }
}

if (import.meta.main) await main();
