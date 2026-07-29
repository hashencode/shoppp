import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx", ".vue"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".nuxt",
  ".output",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;
const DOMAIN_FRAMEWORKS = [
  "@cloudflare/workers-types",
  "@nuxt",
  "@rsbuild",
  "@vue",
  "hono",
  "nuxt",
  "react",
  "react-dom",
  "stripe",
  "vue",
];

export type BoundaryRule = "browser-no-database" | "domain-framework-neutral";

export interface BoundaryDiagnostic {
  file: string;
  importSpecifier: string;
  rule: BoundaryRule;
  message: string;
}

function matchesPackage(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

function isInside(path: string, segment: string): boolean {
  return path === segment || path.startsWith(`${segment}${sep}`);
}

function resolvesIntoDatabase(file: string, specifier: string, root: string): boolean {
  if (matchesPackage(specifier, "@shoppp/db")) {
    return true;
  }

  if (!specifier.startsWith(".")) {
    return false;
  }

  const resolvedImport = resolve(dirname(file), specifier);
  const databaseRoot = resolve(root, "packages/db");
  return resolvedImport === databaseRoot || resolvedImport.startsWith(`${databaseRoot}${sep}`);
}

function importsFramework(specifier: string): boolean {
  return DOMAIN_FRAMEWORKS.some((framework) => matchesPackage(specifier, framework));
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
      }
      return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
    }),
  );
  return nested.flat();
}

function importedSpecifiers(source: string): string[] {
  return Array.from(source.matchAll(IMPORT_PATTERN), (match) => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier))
    .sort();
}

export async function checkBoundaries(root = process.cwd()): Promise<BoundaryDiagnostic[]> {
  const files = await sourceFiles(root);
  const diagnostics: BoundaryDiagnostic[] = [];

  for (const file of files) {
    const relativeFile = relative(root, file);
    const contents = await readFile(file, "utf8");

    for (const importSpecifier of importedSpecifiers(contents)) {
      if (
        (isInside(relativeFile, join("apps", "storefront")) ||
          isInside(relativeFile, join("apps", "admin"))) &&
        resolvesIntoDatabase(file, importSpecifier, root)
      ) {
        diagnostics.push({
          file: relativeFile,
          importSpecifier,
          rule: "browser-no-database",
          message:
            "Browser applications must use API contracts instead of importing database code.",
        });
      }

      if (isInside(relativeFile, join("packages", "domain")) && importsFramework(importSpecifier)) {
        diagnostics.push({
          file: relativeFile,
          importSpecifier,
          rule: "domain-framework-neutral",
          message: "The domain package must remain independent of application frameworks.",
        });
      }
    }
  }

  return diagnostics.sort((left, right) =>
    `${left.file}:${left.importSpecifier}`.localeCompare(`${right.file}:${right.importSpecifier}`),
  );
}

async function main(): Promise<void> {
  const diagnostics = await checkBoundaries();
  if (diagnostics.length === 0) {
    console.log("Import boundaries passed.");
    return;
  }

  for (const diagnostic of diagnostics) {
    console.error(
      `${diagnostic.file}: ${diagnostic.rule}: ${diagnostic.message} Imported "${diagnostic.importSpecifier}".`,
    );
  }
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
