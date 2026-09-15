import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export interface FashionStorePresentationBoundaryFinding {
  file: string;
  rule:
    | "direct-provider-action-selection"
    | "duplicate-provider-context"
    | "provider-kind-layout-switch"
    | "raw-provider-union";
}

const rules: ReadonlyArray<{
  pattern: RegExp;
  rule: FashionStorePresentationBoundaryFinding["rule"];
}> = [
  {
    pattern: /viewModel\.kind\s*===\s*["'](?:home|product|state|collection-grid)["']/,
    rule: "provider-kind-layout-switch",
  },
  {
    pattern:
      /FashionStoreLegacyProductCard\s*\|\s*PresentationProductCard|discriminatedUnion\(["']mode["']/,
    rule: "raw-provider-union",
  },
  {
    pattern:
      /liveProduct\.value\s*\?|if\s*\(\s*!?liveProduct\.value|runtimeCommerce[^\n]+previewCart/,
    rule: "direct-provider-action-selection",
  },
];

export function diagnoseFashionStorePresentationBoundary(
  file: string,
  source: string,
): FashionStorePresentationBoundaryFinding[] {
  const findings: FashionStorePresentationBoundaryFinding[] = [];
  if (/^(?:fixture|live)-home-section-context\.ts$/.test(basename(file))) {
    findings.push({ file, rule: "duplicate-provider-context" });
  }
  for (const { pattern, rule } of rules) {
    if (pattern.test(source)) findings.push({ file, rule });
  }
  return findings;
}

export async function auditFashionStorePresentationBoundary(
  appRoot: string,
  files: readonly string[],
): Promise<FashionStorePresentationBoundaryFinding[]> {
  return (
    await Promise.all(
      files.map(async (file) =>
        diagnoseFashionStorePresentationBoundary(
          file,
          await readFile(resolve(appRoot, file), "utf8"),
        ),
      ),
    )
  ).flat();
}

function registryModules(source: string): Map<string, string> {
  const modulesBySymbol = new Map<string, string>();
  for (const match of source.matchAll(/^import\s+(\w+)\s+from\s+["']([^"']+\.vue)["'];/gm)) {
    modulesBySymbol.set(match[1]!, match[2]!);
  }
  for (const match of source.matchAll(
    /const\s+(\w+)\s*=\s*defineAsyncComponent\(\s*\(\)\s*=>\s*import\(["']([^"']+\.vue)["']\)/g,
  )) {
    modulesBySymbol.set(match[1]!, match[2]!);
  }
  return new Map(
    [...source.matchAll(/^\s*["'](fashion-store\.[^"']+)["']\s*:\s*(\w+),/gm)].flatMap((match) => {
      const module = modulesBySymbol.get(match[2]!);
      return module ? [[match[1]!, module] as const] : [];
    }),
  );
}

export function divergentFashionStoreRegistryTypes(
  liveSource: string,
  fixtureSource: string,
): string[] {
  const live = registryModules(liveSource);
  const fixture = registryModules(fixtureSource);
  return [...new Set([...live.keys(), ...fixture.keys()])]
    .filter((type) => fixture.get(type) !== live.get(type))
    .sort();
}

export function requireFashionStoreRegistryIdentity(
  liveSource: string,
  fixtureSource: string,
): void {
  const divergent = divergentFashionStoreRegistryTypes(liveSource, fixtureSource);
  if (divergent.length > 0) {
    throw new Error(`Fashion Store registries diverge for: ${divergent.join(", ")}.`);
  }
}
