import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

interface ScaffoldOptions {
  label: string;
  sourceEntry: string;
  sourceIdentity: string;
  themeId: string;
}

interface WriteScaffoldOptions extends ScaffoldOptions {
  destinationRoot: string;
}

const ROOT = resolve(import.meta.dir, "..");
const SAFE_THEME_ID = /^[a-z][a-z0-9-]*$/;

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function componentName(themeId: string): string {
  return themeId
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
}

function componentTemplate(name: string, element: "footer" | "header" | "section"): string {
  return `<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
</script>

<template>
  <${element} class="${name.toLowerCase()}-source-intake" data-source-intake-required="true" />
</template>
`;
}

export function buildSourceEquivalentThemeScaffold(options: ScaffoldOptions): Map<string, string> {
  const themeId = required(options.themeId, "theme ID");
  if (!SAFE_THEME_ID.test(themeId)) throw new Error("expected a lowercase theme ID");
  const label = required(options.label, "theme label");
  const sourceEntry = required(options.sourceEntry, "source entry");
  const sourceIdentity = required(options.sourceIdentity, "source identity");
  const name = componentName(themeId);
  const symbolPrefix = `${themeId.split("-")[0]}${themeId
    .split("-")
    .slice(1)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("")}`;
  const sourceContractName = `${symbolPrefix}SourceContract`;
  const sourceRegionsName = `${symbolPrefix}SourceRegions`;
  const behaviorContractName = `${symbolPrefix}BehaviorContract`;
  const acceptanceAdaptersName = `${symbolPrefix}AcceptanceAdapters`;
  const sourceEntryLiteral = JSON.stringify(sourceEntry);
  const sourceProvenanceLiteral = JSON.stringify(`local://${sourceIdentity}/${sourceEntry}`);

  return new Map([
    [
      "acceptance-adapter.ts",
      `// Add selectors/actions here only when the shared behavior probes cannot express a source behavior.
// Every custom adapter requires a reason in behavior-contract.ts.
export const ${acceptanceAdaptersName} = {} as const;
`,
    ],
    [
      "source-equivalence-policy.fragment.json",
      `${JSON.stringify(
        {
          acceptanceAdapterExport: acceptanceAdaptersName,
          acceptanceAdapterPath: `apps/storefront/app/themes/${themeId}/acceptance-adapter.ts`,
          behaviorContractExport: behaviorContractName,
          behaviorContractPath: `apps/storefront/app/themes/${themeId}/behavior-contract.ts`,
          id: themeId,
          sourceContractPath: `apps/storefront/app/themes/${themeId}/source-contract.ts`,
          sourceFirstHero: "SOURCE_INTAKE_REQUIRED",
          sourceRegionsExport: sourceRegionsName,
        },
        null,
        2,
      )}\n`,
    ],
    [
      "behavior-contract.ts",
      `import type { ThemeBehaviorContract } from "../../../e2e/support/theme-behavior-contract";

export const ${behaviorContractName} = {
  behaviors: [],
  customAdapters: [],
  routeId: "${themeId}-home",
  suppressions: [],
  themeId: "${themeId}",
} as const satisfies ThemeBehaviorContract;
`,
    ],
    [
      "behavior-contract.test.ts",
      `import { describe, test } from "bun:test";
import { assertThemeBehaviorContractComplete } from "../../../e2e/support/theme-behavior-contract";
import { ${behaviorContractName} } from "./behavior-contract";
import { ${sourceContractName} } from "./source-contract";

describe("${themeId} behavior contract", () => {
  test("covers every source-derived behavior before registration", () => {
    assertThemeBehaviorContractComplete(
      ${behaviorContractName},
      ${sourceContractName}.regions.map((region) => region.id),
    );
  });
});
`,
    ],
    [
      "UPSTREAM.md",
      `# ${label} source intake

- Source identity: \`${sourceIdentity}\`
- Entry document: \`${sourceEntry}\`
- Equivalence scope: declare before implementation
- Source revision: record the immutable revision or digest
- Ownership approval: record the approving owner

The original HTML, contributing shared/demo/responsive styles, runtime initialization, fonts,
icons, and assets are authoritative. Screenshots are verification evidence only.

Do not register this package until the source contract, asset provenance, state matrix, responsive
matrix, focused tests, and visual evidence are complete. Do not paste unreviewed runtime or global
styles into the application.
`,
    ],
    [`components/${name}Footer.vue`, componentTemplate(name, "footer")],
    [`components/${name}Header.vue`, componentTemplate(name, "header")],
    [`components/${name}Hero.vue`, componentTemplate(name, "section")],
    [
      "fixtures/home.ts",
      `// Populate only from the source contract; do not use placeholder copy or substitute media.
export const ${themeId.replaceAll("-", "_")}HomeFixtures = {} as const;
`,
    ],
    [
      "manifest.ts",
      `import type { ThemeManifest } from "@shoppp/contracts";

export const ${themeId.replaceAll("-", "_")}Manifest = {
  configurationSchemaVersion: 1,
  designTokens: {},
  id: "${themeId}",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "SOURCE_INTAKE_REQUIRED",
    approvedBy: "SOURCE_INTAKE_REQUIRED",
    license: "SOURCE_INTAKE_REQUIRED",
    source: ${sourceProvenanceLiteral},
  },
  supportedPageTemplates: ["home", "collection", "product", "cart", "checkout", "order", "policy"],
  themeVersion: "0.1.0",
} as const satisfies ThemeManifest;
`,
    ],
    [
      "presets/source-equivalent.ts",
      `import type { ThemePreset } from "@shoppp/contracts";

// Add every source-visible section in document order, then add the complete platform route set.
export const ${themeId.replaceAll("-", "_")}SourceEquivalentPreset = {
  id: "source-equivalent",
  label: "Source equivalent",
  templates: [],
} as const satisfies ThemePreset;
`,
    ],
    [
      "registry.ts",
      `import "./tokens.css";
import type { ThemeRegistry } from "../../theme-engine/registry";
import ${name}Footer from "./components/${name}Footer.vue";
import ${name}Header from "./components/${name}Header.vue";
import ${name}Hero from "./components/${name}Hero.vue";
import { ${themeId.replaceAll("-", "_")}HomeFixtures } from "./fixtures/home";
import { themeAssets } from "./resources";

export const themeRegistry = {
  blocks: {},
  sections: {
    "${themeId}.footer": ${name}Footer,
    "${themeId}.header": ${name}Header,
    "${themeId}.hero": ${name}Hero,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeFixtures = ${themeId.replaceAll("-", "_")}HomeFixtures;
`,
    ],
    [
      "resources.ts",
      `import { validateThemeAssets } from "../../theme-engine/assets";

// Import only provenance-reviewed local assets and preserve source identity and intrinsic size.
export const themeAssets = validateThemeAssets("${themeId}", {});
`,
    ],
    [
      "source-contract.ts",
      `export const ${sourceRegionsName}: { id: string; selector: string }[] = [];

export const ${sourceContractName} = {
  sources: {
    demoCss: "SOURCE_INTAKE_REQUIRED",
    html: ${sourceEntryLiteral},
    responsiveCss: "SOURCE_INTAKE_REQUIRED",
    sharedCss: "SOURCE_INTAKE_REQUIRED",
    runtimeInitialization: "SOURCE_INTAKE_REQUIRED",
  },
  regions: ${sourceRegionsName},
  visibleCopy: [] as string[],
  links: [] as { label: string; target: string }[],
  assets: [] as { id: string; intrinsicHeight: number; intrinsicWidth: number; sourcePath: string }[],
  fonts: [] as { family: string; roles: string[]; weights: number[] }[],
  computedStyles: [] as { property: string; selector: string; value: string }[],
  geometry: [] as { selector: string; state: string }[],
  interactionStates: [] as { event: string; expectedState: string; id: string }[],
  motionStates: [] as { durationMs: number; easing: string; id: string }[],
  responsiveStates: [] as { height: number; id: string; width: number }[],
  runtimeDiagnostics: ["console-errors", "failed-requests", "broken-images", "overflow"],
} as const;
`,
    ],
    [
      "source-contract.test.ts",
      `import { describe, expect, test } from "bun:test";
import { ${sourceContractName} } from "./source-contract";

describe("${themeId} source contract", () => {
  test("is complete before the theme is registered", () => {
    expect(Object.values(${sourceContractName}.sources)).not.toContain("SOURCE_INTAKE_REQUIRED");
    expect(${sourceContractName}.regions.length).toBeGreaterThan(0);
    expect(${sourceContractName}.visibleCopy.length).toBeGreaterThan(0);
    expect(${sourceContractName}.links.length).toBeGreaterThan(0);
    expect(${sourceContractName}.assets.length).toBeGreaterThan(0);
    expect(${sourceContractName}.fonts.length).toBeGreaterThan(0);
    expect(${sourceContractName}.computedStyles.length).toBeGreaterThan(0);
    expect(${sourceContractName}.geometry.length).toBeGreaterThan(0);
    expect(${sourceContractName}.interactionStates.length).toBeGreaterThan(0);
    expect(${sourceContractName}.motionStates.length).toBeGreaterThan(0);
    expect(${sourceContractName}.runtimeDiagnostics.length).toBeGreaterThan(0);
    expect(${sourceContractName}.responsiveStates.map(({ id }) => id)).toEqual([
      "desktop",
      "laptop",
      "tablet",
      "mobile",
    ]);
  });
});
`,
    ],
    ["source-equivalence-waivers.json", '{\n  "schemaVersion": 1,\n  "waivers": []\n}\n'],
    [
      "tokens.css",
      `/* Source-derived declarations only. Keep all selectors scoped to this theme package. */
:root {
  /* Add verified font, color, spacing, and motion tokens after source extraction. */
}
`,
    ],
  ]);
}

export async function writeSourceEquivalentThemeScaffold(
  options: WriteScaffoldOptions,
): Promise<string[]> {
  const destination = resolve(options.destinationRoot, options.themeId);
  const files = buildSourceEquivalentThemeScaffold(options);
  const written: string[] = [];
  try {
    await mkdir(destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(`theme destination already exists: ${destination}`, { cause: error });
    throw error;
  }
  try {
    for (const [relativePath, contents] of files) {
      const path = resolve(destination, relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, contents, { flag: "wx" });
      written.push(path);
    }
  } catch (error) {
    await rm(destination, { force: true, recursive: true });
    throw error;
  }
  return written;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      destination: { default: "apps/storefront/app/themes", type: "string" },
      label: { type: "string" },
      "source-entry": { type: "string" },
      "source-identity": { type: "string" },
      theme: { type: "string" },
    },
    strict: true,
  });
  const written = await writeSourceEquivalentThemeScaffold({
    destinationRoot: resolve(ROOT, values.destination),
    label: required(values.label ?? "", "theme label"),
    sourceEntry: required(values["source-entry"] ?? "", "source entry"),
    sourceIdentity: required(values["source-identity"] ?? "", "source identity"),
    themeId: required(values.theme ?? "", "theme ID"),
  });
  console.log(`Created ${written.length} source-intake files.`);
}

if (import.meta.main) await main();
