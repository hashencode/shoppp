import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalCatalogReleaseSchema, fixtureBindingSchema } from "@shoppp/contracts";
import * as z from "zod";

import { fashionStoreManifest } from "../app/themes/fashion-store/successor/manifest";
import { fashionStoreEnabledPageContracts } from "../app/themes/fashion-store/page-contracts";
import { publicPaymentBrands } from "../app/theme-engine/view-models";
import { fashionStorePreset } from "../app/themes/fashion-store/successor/presets/source-parity";
import {
  applyFashionStoreHomeComposition,
  parseFashionStoreHomeDevelopmentProfile,
} from "../app/themes/fashion-store/successor/home-development-profile";
import type { ExperienceBuildInput } from "./prepare-experience";

const previewFixtureSchema = z
  .object({
    approvedAt: z.iso.datetime(),
    approvedBy: z.string().trim().min(1).max(120),
    bindings: z.array(fixtureBindingSchema).max(100),
    experienceId: z.string().regex(/^[a-z][a-z0-9-]*$/),
    productPaymentBrands: z
      .array(z.enum(publicPaymentBrands))
      .max(publicPaymentBrands.length)
      .default([]),
    snapshotId: z.string().regex(/^[a-z][a-z0-9-]*$/),
    version: z.int().positive(),
  })
  .strict();

interface PreviewThemeDescriptor {
  fixturePath: string;
  manifest: typeof fashionStoreManifest;
  pageTypes: ReadonlySet<string>;
  templates: typeof fashionStorePreset.templates;
}

const previewThemeDescriptors = {
  "fashion-store": {
    fixturePath: "../fixtures/experience/fashion-store.json",
    manifest: fashionStoreManifest,
    pageTypes: new Set(fashionStoreEnabledPageContracts.map(({ pageType }) => pageType)),
    templates: fashionStorePreset.templates,
  },
} as const satisfies Record<string, PreviewThemeDescriptor>;

type PreviewThemeId = keyof typeof previewThemeDescriptors;

export async function themePreviewBuildInput(
  themeId: PreviewThemeId,
  expectedOrigin: string,
): Promise<Extract<ExperienceBuildInput, { environment: "preview" }>> {
  const descriptor = previewThemeDescriptors[themeId];
  const fixture = previewFixtureSchema.parse(
    JSON.parse(await readFile(resolve(import.meta.dir, descriptor.fixturePath), "utf8")),
  );
  const catalogRelease = canonicalCatalogReleaseSchema.parse(
    JSON.parse(await readFile(resolve(import.meta.dir, "../fixtures/release.json"), "utf8")),
  );
  return {
    catalogRelease,
    environment: "preview",
    expectedOrigin,
    snapshot: {
      approvedAt: fixture.approvedAt,
      approvedBy: fixture.approvedBy,
      bindings: fixture.bindings,
      configurationSchemaVersion: descriptor.manifest.configurationSchemaVersion,
      experienceId: fixture.experienceId,
      id: fixture.snapshotId,
      kind: "approved",
      overrides: [],
      platformContractVersion: descriptor.manifest.platformContractVersion,
      provenance: descriptor.manifest.provenance,
      resolvedTemplates: descriptor.templates
        .filter(({ pageType }) => descriptor.pageTypes.has(pageType))
        .map((template) =>
          template.pageType === "product"
            ? {
                ...template,
                sections: template.sections.map((section) => ({
                  ...section,
                  settings: {
                    ...section.settings,
                    ...Object.fromEntries(
                      fixture.productPaymentBrands.map((brand) => [`payment-brand-${brand}`, true]),
                    ),
                  },
                })),
              }
            : template,
        ),
      themeId: descriptor.manifest.id,
      themeVersion: descriptor.manifest.themeVersion,
      version: fixture.version,
    },
    themeId: descriptor.manifest.id,
  };
}

export const fashionStorePreviewBuildInput = (expectedOrigin: string) =>
  themePreviewBuildInput("fashion-store", expectedOrigin);

async function main(): Promise<void> {
  const themeId = process.argv[2];
  if (!themeId || !(themeId in previewThemeDescriptors)) {
    throw new Error(`Unknown fixture theme ${themeId ?? "(missing)"}.`);
  }
  const outputPath = resolve(
    import.meta.dir,
    `../fixtures/experience/.generated/${themeId}-preview-input.json`,
  );
  const input = await themePreviewBuildInput(
    themeId as PreviewThemeId,
    "https://preview.example.test",
  );
  if (themeId === "fashion-store") {
    const profile = parseFashionStoreHomeDevelopmentProfile(
      process.env.STOREFRONT_FASHION_HOME_PROFILE,
    );
    const home = input.snapshot.resolvedTemplates.find(({ pageType }) => pageType === "home");
    if (!home) throw new Error("Fashion preview requires a Home template.");
    applyFashionStoreHomeComposition(home, profile.composition);
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`);
  console.log(`Prepared ${themeId} preview fixture at ${outputPath}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
