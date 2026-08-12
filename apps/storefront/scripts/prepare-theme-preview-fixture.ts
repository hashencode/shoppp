import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureBindingSchema } from "@shoppp/contracts";
import * as z from "zod";

import { decorManifest } from "../app/themes/decor/manifest";
import { decorThemeRoutes } from "../app/themes/decor/page-contracts";
import { decorPreset } from "../app/themes/decor/presets/layered";
import { fashionStoreManifest } from "../app/themes/fashion-store/manifest";
import { fashionStoreEnabledPageContracts } from "../app/themes/fashion-store/page-contracts";
import { fashionStorePreset } from "../app/themes/fashion-store/presets/source-parity";
import type { ExperienceBuildInput } from "./prepare-experience";

const previewFixtureSchema = z
  .object({
    approvedAt: z.iso.datetime(),
    approvedBy: z.string().trim().min(1).max(120),
    bindings: z.array(fixtureBindingSchema).max(100),
    experienceId: z.string().regex(/^[a-z][a-z0-9-]*$/),
    snapshotId: z.string().regex(/^[a-z][a-z0-9-]*$/),
    version: z.int().positive(),
  })
  .strict();

interface PreviewThemeDescriptor {
  fixturePath: string;
  manifest: typeof decorManifest | typeof fashionStoreManifest;
  pageTypes: ReadonlySet<string>;
  templates: typeof decorPreset.templates | typeof fashionStorePreset.templates;
}

const previewThemeDescriptors = {
  decor: {
    fixturePath: "../fixtures/experience/decor.json",
    manifest: decorManifest,
    pageTypes: new Set(decorThemeRoutes.map(({ pageType }) => pageType)),
    templates: decorPreset.templates,
  },
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
  return {
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
      resolvedTemplates: descriptor.templates.filter(({ pageType }) =>
        descriptor.pageTypes.has(pageType),
      ),
      themeId: descriptor.manifest.id,
      themeVersion: descriptor.manifest.themeVersion,
      version: fixture.version,
    },
    themeId: descriptor.manifest.id,
  };
}

export const decorPreviewBuildInput = (expectedOrigin: string) =>
  themePreviewBuildInput("decor", expectedOrigin);

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
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`);
  console.log(`Prepared ${themeId} preview fixture at ${outputPath}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
