import { readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";

export type LiveComponentBoundaryRule =
  "commerce-composable" | "commerce-contract" | "fixture-owned";

export interface LiveComponentBoundaryDiagnostic {
  file: string;
  importSpecifier: string;
  rule: LiveComponentBoundaryRule;
}

interface SourceImport {
  importSpecifier: string;
  statement: string;
}

const staticImportPattern =
  /(?:^|\n)\s*((?:import|export)\s+(?:type\s+)?(?:[^;"']*?\s+from\s+)?["']([^"']+)["'])/g;
const dynamicImportPattern = /\b(import\s*\(\s*["']([^"']+)["']\s*\))/g;

function sourceImports(source: string, pattern: RegExp): SourceImport[] {
  return [...source.matchAll(pattern)].map((match) => ({
    importSpecifier: match[2]!,
    statement: match[1]!,
  }));
}

function executableScriptSource(source: string): string {
  const scriptBlocks = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(
    (match) => match[1]!,
  );
  const script = scriptBlocks.length > 0 ? scriptBlocks.join("\n") : source;
  return script
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ")
    .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, " ");
}

export function staticImportSpecifiers(source: string): string[] {
  return sourceImports(source, staticImportPattern).map(({ importSpecifier }) => importSpecifier);
}

export function componentImportSpecifiers(source: string): string[] {
  return [
    ...staticImportSpecifiers(source),
    ...sourceImports(source, dynamicImportPattern).map(({ importSpecifier }) => importSpecifier),
  ];
}

export function diagnoseLiveComponentImports(
  file: string,
  source: string,
): LiveComponentBoundaryDiagnostic[] {
  const diagnostics: LiveComponentBoundaryDiagnostic[] = [];
  const imports = [
    ...sourceImports(source, staticImportPattern),
    ...sourceImports(source, dynamicImportPattern),
  ];

  for (const { importSpecifier, statement } of imports) {
    if (
      importSpecifier === "@shoppp/contracts" ||
      importSpecifier.startsWith("@shoppp/contracts/")
    ) {
      diagnostics.push({ file, importSpecifier, rule: "commerce-contract" });
    }
    if (/(?:^|\/)fixtures(?:\/|$)/.test(importSpecifier)) {
      diagnostics.push({ file, importSpecifier, rule: "fixture-owned" });
    }
    if (
      /(?:use-commerce-api|use-guest-cart)/.test(importSpecifier) ||
      /\b(?:useCommerceApi|useGuestCart)\b/.test(statement)
    ) {
      diagnostics.push({ file, importSpecifier, rule: "commerce-composable" });
    }
  }

  for (const match of executableScriptSource(source).matchAll(
    /\b(useCommerceApi|useGuestCart)\s*\(/g,
  )) {
    diagnostics.push({
      file,
      importSpecifier: `<auto-import:${match[1]}>`,
      rule: "commerce-composable",
    });
  }

  return diagnostics;
}

async function existingImportPath(
  importer: string,
  importSpecifier: string,
  aliases: Readonly<Record<string, string>>,
): Promise<string | null> {
  const alias = Object.entries(aliases).find(([prefix]) => importSpecifier.startsWith(prefix));
  const unresolved = alias
    ? resolve(alias[1], importSpecifier.slice(alias[0].length))
    : resolve(dirname(importer), importSpecifier);
  const candidates = extname(unresolved)
    ? [unresolved]
    : [unresolved, `${unresolved}.vue`, `${unresolved}.ts`, resolve(unresolved, "index.ts")];

  for (const candidate of candidates) {
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch {
      // The next candidate may resolve an extensionless component import.
    }
  }
  return null;
}

function isInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export async function auditLiveComponentGraph(
  componentRoot: string,
  roots: readonly string[],
  options: {
    aliases?: Readonly<Record<string, string>>;
    componentDependencyRoot?: string;
  } = {},
): Promise<LiveComponentBoundaryDiagnostic[]> {
  const pending = [...roots];
  const visited = new Set<string>();
  const diagnostics: LiveComponentBoundaryDiagnostic[] = [];

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const source = await readFile(file, "utf8");
    diagnostics.push(...diagnoseLiveComponentImports(relative(componentRoot, file), source));

    for (const importSpecifier of componentImportSpecifiers(source)) {
      if (
        !importSpecifier.startsWith(".") &&
        !Object.keys(options.aliases ?? {}).some((prefix) => importSpecifier.startsWith(prefix))
      ) {
        continue;
      }
      const importedFile = await existingImportPath(file, importSpecifier, options.aliases ?? {});
      const isThemeComponent = importedFile && isInside(componentRoot, importedFile);
      const isExternalComponent =
        importedFile?.endsWith(".vue") &&
        options.componentDependencyRoot &&
        isInside(options.componentDependencyRoot, importedFile);
      if (isThemeComponent || isExternalComponent) pending.push(importedFile!);
    }
  }

  return diagnostics.sort((left, right) =>
    `${left.file}:${left.rule}:${left.importSpecifier}`.localeCompare(
      `${right.file}:${right.rule}:${right.importSpecifier}`,
    ),
  );
}
