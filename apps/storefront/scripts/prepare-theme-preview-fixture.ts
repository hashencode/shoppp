import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureBindingSchema } from "@shoppp/contracts";
import * as z from "zod";

import { decorStoreManifest } from "../app/themes/decor-store/manifest";
import { decorStoreEnabledPageContracts } from "../app/themes/decor-store/page-contracts";
import { decorStorePreset } from "../app/themes/decor-store/presets/source-parity";
import { decorStoreRuntimeSourceOrder } from "../app/themes/decor-store/resources";
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

export async function fashionStorePreviewBuildInput(
  expectedOrigin: string,
): Promise<Extract<ExperienceBuildInput, { environment: "preview" }>> {
  const fixture = previewFixtureSchema.parse(
    JSON.parse(
      await readFile(resolve(import.meta.dir, "../fixtures/experience/fashion-store.json"), "utf8"),
    ),
  );
  const enabledPageTypes = new Set(
    fashionStoreEnabledPageContracts.map(({ pageType }) => pageType),
  );
  return {
    environment: "preview",
    expectedOrigin,
    snapshot: {
      approvedAt: fixture.approvedAt,
      approvedBy: fixture.approvedBy,
      bindings: fixture.bindings,
      configurationSchemaVersion: fashionStoreManifest.configurationSchemaVersion,
      experienceId: fixture.experienceId,
      id: fixture.snapshotId,
      kind: "approved",
      overrides: [],
      platformContractVersion: fashionStoreManifest.platformContractVersion,
      provenance: fashionStoreManifest.provenance,
      resolvedTemplates: fashionStorePreset.templates.filter(({ pageType }) =>
        enabledPageTypes.has(pageType),
      ),
      themeId: fashionStoreManifest.id,
      themeVersion: fashionStoreManifest.themeVersion,
      version: fixture.version,
    },
    themeId: fashionStoreManifest.id,
  };
}

export async function decorStorePreviewBuildInput(
  expectedOrigin: string,
): Promise<Extract<ExperienceBuildInput, { environment: "preview" }>> {
  const fixture = previewFixtureSchema.parse(
    JSON.parse(
      await readFile(resolve(import.meta.dir, "../fixtures/experience/decor-store.json"), "utf8"),
    ),
  );
  const enabledPageTypes = new Set(decorStoreEnabledPageContracts.map(({ pageType }) => pageType));
  return {
    environment: "preview",
    expectedOrigin,
    snapshot: {
      approvedAt: fixture.approvedAt,
      approvedBy: fixture.approvedBy,
      bindings: fixture.bindings,
      configurationSchemaVersion: decorStoreManifest.configurationSchemaVersion,
      experienceId: fixture.experienceId,
      id: fixture.snapshotId,
      kind: "approved",
      overrides: [],
      platformContractVersion: decorStoreManifest.platformContractVersion,
      provenance: decorStoreManifest.provenance,
      resolvedTemplates: decorStorePreset.templates.filter(({ pageType }) =>
        enabledPageTypes.has(pageType),
      ),
      themeId: decorStoreManifest.id,
      themeVersion: decorStoreManifest.themeVersion,
      version: fixture.version,
    },
    themeId: decorStoreManifest.id,
  };
}

async function main(): Promise<void> {
  const themeId = process.argv[2];
  if (themeId !== "fashion-store" && themeId !== "decor-store") {
    throw new Error(`Unknown fixture theme ${themeId ?? "(missing)"}.`);
  }
  const outputPath = resolve(
    import.meta.dir,
    `../fixtures/experience/.generated/${themeId}-preview-input.json`,
  );
  const generatedResources = resolve(import.meta.dir, "../public/theme-preview-generated");
  await rm(generatedResources, { force: true, recursive: true });
  if (themeId === "decor-store") {
    await Promise.all(
      decorStoreRuntimeSourceOrder.map(async (sourcePath) => {
        const destination = resolve(generatedResources, "decor-store", sourcePath);
        await mkdir(dirname(destination), { recursive: true });
        await cp(
          resolve(import.meta.dir, "../app/themes/decor-store/upstream", sourcePath),
          destination,
        );
      }),
    );
  }
  const input =
    themeId === "decor-store"
      ? await decorStorePreviewBuildInput("https://preview.example.test")
      : await fashionStorePreviewBuildInput("https://preview.example.test");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`);
  console.log(`Prepared ${themeId} preview fixture at ${outputPath}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
