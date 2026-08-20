import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalCatalogReleaseSchema,
  experienceSnapshotSchema,
  storefrontThemeDescriptorSchema,
  type StorefrontThemeDescriptor,
} from "@shoppp/contracts";
import * as z from "zod";

import { storefrontThemeCatalog } from "../app/generated/theme-catalog";
import { buildCatalogSearchIndex } from "../app/theme-engine/search";

const exactHttpsOriginSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      url.origin === value
    );
  }, "Preview origin must be one exact credential-free HTTPS origin.");

const productionExperienceBuildInputSchema = z
  .object({ environment: z.literal("production") })
  .strict();
const fixturePreviewBuildInputSchema = z
  .object({
    environment: z.literal("preview"),
    expectedOrigin: exactHttpsOriginSchema,
    snapshot: experienceSnapshotSchema,
    themeId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  })
  .strict();
const previewInputIdentitySchema = z
  .object({
    catalogReleaseId: z.string().trim().min(1).max(160),
    experienceSnapshotId: z.string().trim().min(1).max(160),
    experienceVersion: z.int().positive(),
    platformContractVersion: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
    themeId: z.string().regex(/^[a-z][a-z0-9-]*$/),
    themeVersion: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  })
  .strict();
const livePreviewBuildInputSchema = z
  .object({
    catalogRelease: canonicalCatalogReleaseSchema,
    environment: z.literal("preview"),
    expectedOrigin: exactHttpsOriginSchema,
    inputIdentity: previewInputIdentitySchema,
    mediaOrigins: z
      .array(exactHttpsOriginSchema)
      .max(8)
      .refine((origins) => new Set(origins).size === origins.length, {
        message: "Preview media origins must be unique.",
      }),
    presentationMode: z.literal("live"),
    snapshot: experienceSnapshotSchema,
    themeId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  })
  .strict()
  .superRefine((input, context) => {
    const expected = {
      catalogReleaseId: input.catalogRelease.releaseId,
      experienceSnapshotId: input.snapshot.id,
      experienceVersion: input.snapshot.version,
      platformContractVersion: input.snapshot.platformContractVersion,
      themeId: input.snapshot.themeId,
      themeVersion: input.snapshot.themeVersion,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (input.inputIdentity[key as keyof typeof input.inputIdentity] !== value) {
        context.addIssue({
          code: "custom",
          message: `Live preview input identity does not match ${key}.`,
          path: ["inputIdentity", key],
        });
      }
    }
  });

export const experienceBuildInputSchema = z.union([
  productionExperienceBuildInputSchema,
  fixturePreviewBuildInputSchema,
  livePreviewBuildInputSchema,
]);

export type ExperienceBuildInput = z.infer<typeof experienceBuildInputSchema>;

export interface RenderActiveThemeOptions {
  catalog: readonly StorefrontThemeDescriptor[];
  input: ExperienceBuildInput;
  moduleAllowlist: Readonly<Record<string, string>>;
}

export interface PrepareExperienceOptions extends RenderActiveThemeOptions {
  outputPath: string;
  providerOutputPath?: string;
}

const defaultModuleAllowlist = {
  decor: "../themes/decor/registry",
  "fashion-store": "../themes/fashion-store/registry",
} as const;

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function validatedDescriptor(
  input: Extract<ExperienceBuildInput, { environment: "preview" }>,
  catalog: readonly StorefrontThemeDescriptor[],
): StorefrontThemeDescriptor {
  const descriptors = catalog.map((entry) => storefrontThemeDescriptorSchema.parse(entry));
  const descriptor = descriptors.find(({ id }) => id === input.themeId);
  if (!descriptor) {
    throw new Error(`Theme ${input.themeId} is not present in the approved theme catalog.`);
  }
  if (
    input.snapshot.themeId !== descriptor.id ||
    input.snapshot.themeVersion !== descriptor.themeVersion ||
    input.snapshot.configurationSchemaVersion !== descriptor.configurationSchemaVersion ||
    input.snapshot.platformContractVersion !== descriptor.platformContractVersion
  ) {
    throw new Error("Preview snapshot does not match the selected theme catalog descriptor.");
  }
  if (
    compareVersions(input.snapshot.platformContractVersion, descriptor.platformCompatibility.min) <
      0 ||
    compareVersions(
      input.snapshot.platformContractVersion,
      descriptor.platformCompatibility.maxExclusive,
    ) >= 0
  ) {
    throw new Error("Selected theme is not compatible with the snapshot platform version.");
  }
  const unsupportedTemplate = input.snapshot.resolvedTemplates.find(
    ({ pageType }) => !descriptor.supportedPageTemplates.includes(pageType),
  );
  if (unsupportedTemplate) {
    throw new Error(
      `Selected theme ${descriptor.id} does not support ${unsupportedTemplate.pageType} templates.`,
    );
  }
  return descriptor;
}

function productionFallbackSource(): string {
  return `// This file is generated by apps/storefront/scripts/prepare-experience.ts.
// Production fallback intentionally imports no theme package.

import type { ExperienceSnapshot } from "@shoppp/contracts";
import type { ThemeRegistry } from "../theme-engine/registry";
import type { ThemeAssetMap } from "../theme-engine/assets";
import type { ExperienceFixtureRegistry } from "../theme-engine/view-models";
import type { ThemeRouteContract } from "../theme-engine/routes";

export const activeThemeId = "production-fallback";
export const activeExperienceSnapshot: ExperienceSnapshot | null = null;
export const activeThemeRegistry = {
  blocks: {},
  sections: {},
} as const satisfies ThemeRegistry;
export const activeThemeAssets = {} as const satisfies ThemeAssetMap;
export const activeThemeFixtures = {} as const satisfies ExperienceFixtureRegistry;
export const activeThemeRoutes = [] as const satisfies readonly ThemeRouteContract[];
export const activePreviewOrigin: string | null = null;
`;
}

function renderActiveThemeModuleFromInput({
  catalog,
  input,
  moduleAllowlist,
}: RenderActiveThemeOptions): string {
  if (input.environment === "production") return productionFallbackSource();

  validatedDescriptor(input, catalog);
  const modulePath = moduleAllowlist[input.themeId];
  if (!modulePath) throw new Error(`Theme ${input.themeId} is missing from the module allowlist.`);
  if (modulePath !== `../themes/${input.themeId}/registry`) {
    throw new Error(`Theme ${input.themeId} has an unsafe module allowlist path.`);
  }

  if ("presentationMode" in input && input.presentationMode === "live") {
    return `// This file is generated by apps/storefront/scripts/prepare-experience.ts.
// The static import below is selected before Nuxt compilation.

import type { ExperienceFixtureRegistry } from "../theme-engine/view-models";
import type { ExperienceSnapshot } from "@shoppp/contracts";
import {
  themeAssets as selectedThemeAssets,
  themeRegistry as selectedThemeRegistry,
  themeRoutes as selectedThemeRoutes,
} from "${modulePath}";

export const activeThemeId = ${JSON.stringify(input.themeId)};
// prettier-ignore
export const activeExperienceSnapshot = ${JSON.stringify(input.snapshot, null, 2)} as const satisfies ExperienceSnapshot;
export const activeThemeRegistry = selectedThemeRegistry;
export const activeThemeAssets = selectedThemeAssets;
export const activeThemeFixtures = {} as const satisfies ExperienceFixtureRegistry;
export const activeThemeRoutes = selectedThemeRoutes;
export const activePreviewOrigin = ${JSON.stringify(input.expectedOrigin)};
`;
  }

  const fixtureImports =
    input.themeId === "fashion-store"
      ? `import {
  themeAssets as selectedThemeAssets,
  themeRoutes as selectedThemeRoutes,
} from "${modulePath}";
import {
  fixtureThemeRegistry as selectedThemeRegistry,
  themeFixtures as selectedThemeFixtures,
} from "../themes/fashion-store/fixture-registry";`
      : `import {
  themeAssets as selectedThemeAssets,
  themeFixtures as selectedThemeFixtures,
  themeRegistry as selectedThemeRegistry,
  themeRoutes as selectedThemeRoutes,
} from "${modulePath}";`;

  return `// This file is generated by apps/storefront/scripts/prepare-experience.ts.
// The static import below is selected before Nuxt compilation.

import type { ExperienceSnapshot } from "@shoppp/contracts";
${fixtureImports}

export const activeThemeId = ${JSON.stringify(input.themeId)};
// Preserve deterministic JSON serialization for the signed snapshot payload.
// prettier-ignore
export const activeExperienceSnapshot = ${JSON.stringify(
    input.snapshot,
    null,
    2,
  )} as const satisfies ExperienceSnapshot;
export const activeThemeRegistry = selectedThemeRegistry;
export const activeThemeAssets = selectedThemeAssets;
export const activeThemeFixtures = selectedThemeFixtures;
export const activeThemeRoutes = selectedThemeRoutes;
export const activePreviewOrigin = ${JSON.stringify(input.expectedOrigin)};
`;
}

export function renderActiveThemeModule(options: RenderActiveThemeOptions): string {
  return renderActiveThemeModuleFromInput({
    ...options,
    input: experienceBuildInputSchema.parse(options.input),
  });
}

function renderActiveExperienceModuleFromInput(input: ExperienceBuildInput): string {
  if (input.environment === "production") {
    return `// This file is generated by apps/storefront/scripts/prepare-experience.ts.
// Production fallback intentionally imports no theme or fixture package.

import type { ActiveExperienceProviderInput } from "../theme-engine/providers";

export const activeExperienceProviderInput: ActiveExperienceProviderInput = { mode: "production" };
export const activeCatalogSearchIndex = null;
export const activeFixtureRegistry = {} as const;
`;
  }
  if ("presentationMode" in input && input.presentationMode === "live") {
    const searchIndex = buildCatalogSearchIndex(input.catalogRelease);
    return `// This file is generated by apps/storefront/scripts/prepare-experience.ts.

import type { CanonicalCatalogRelease } from "@shoppp/contracts";
import type { ActiveExperienceProviderInput } from "../theme-engine/providers";
import type { CatalogSearchIndex } from "../theme-engine/search";

export const activeExperienceProviderInput: ActiveExperienceProviderInput = {
  // prettier-ignore
  identity: ${JSON.stringify(input.inputIdentity, null, 2)},
  mode: "live",
  // prettier-ignore
  release: ${JSON.stringify(input.catalogRelease, null, 2)} as const satisfies CanonicalCatalogRelease,
} as const;
// prettier-ignore
export const activeCatalogSearchIndex = ${JSON.stringify(searchIndex, null, 2)} as const satisfies CatalogSearchIndex;
export const activeFixtureRegistry = {} as const;
`;
  }
  return `// This file is generated by apps/storefront/scripts/prepare-experience.ts.

import { experienceFixtureRegistry } from "../../fixtures/experience";
import { activeThemeFixtures } from "./active-theme";
import type { ActiveExperienceProviderInput } from "../theme-engine/providers";
import { mergeExperienceFixtureRegistries } from "../theme-engine/assets";

export const activeExperienceProviderInput: ActiveExperienceProviderInput = { mode: "fixture-preview" };
export const activeCatalogSearchIndex = null;
export const activeFixtureRegistry = mergeExperienceFixtureRegistries(
  experienceFixtureRegistry,
  activeThemeFixtures,
);
`;
}

export function renderActiveExperienceModule(input: ExperienceBuildInput): string {
  return renderActiveExperienceModuleFromInput(experienceBuildInputSchema.parse(input));
}

async function prepareExperienceFromInput(options: PrepareExperienceOptions): Promise<void> {
  const rendered = renderActiveThemeModuleFromInput(options);
  await mkdir(dirname(resolve(options.outputPath)), { recursive: true });
  await writeFile(resolve(options.outputPath), rendered);
  if (options.providerOutputPath) {
    await mkdir(dirname(resolve(options.providerOutputPath)), { recursive: true });
    await writeFile(
      resolve(options.providerOutputPath),
      renderActiveExperienceModuleFromInput(options.input),
    );
  }
}

export async function prepareExperience(options: PrepareExperienceOptions): Promise<void> {
  return prepareExperienceFromInput({
    ...options,
    input: experienceBuildInputSchema.parse(options.input),
  });
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dir, "..");
  const inputPath = process.env.STOREFRONT_EXPERIENCE_FILE;
  const buildMode = process.env.STOREFRONT_BUILD_MODE ?? "production";
  let input: ExperienceBuildInput;
  if (inputPath) {
    if (buildMode !== "preview") {
      throw new Error("An experience build input is allowed only in preview build mode.");
    }
    input = experienceBuildInputSchema.parse(
      JSON.parse(await readFile(resolve(inputPath), "utf8")),
    );
    if (input.environment !== "preview") {
      throw new Error("The experience build file must declare preview environment.");
    }
  } else {
    if (buildMode === "preview") {
      throw new Error("Preview build mode requires STOREFRONT_EXPERIENCE_FILE.");
    }
    input = { environment: "production" };
  }
  if (input.environment === "production") {
    await rm(resolve(root, "public/theme-preview-generated"), { force: true, recursive: true });
  }
  await prepareExperienceFromInput({
    catalog: storefrontThemeCatalog,
    input,
    moduleAllowlist: defaultModuleAllowlist,
    outputPath: join(root, "app/generated/active-theme.ts"),
    providerOutputPath: join(root, "app/generated/active-experience.ts"),
  });
  console.log(
    input.environment === "production"
      ? "Prepared unchanged production storefront fallback."
      : `Prepared private preview for ${input.themeId} snapshot ${input.snapshot.id}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
