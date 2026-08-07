import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureBindingSchema } from "@shoppp/contracts";
import * as z from "zod";

import { fashionStoreManifest } from "../app/themes/fashion-store/manifest";
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
      resolvedTemplates: fashionStorePreset.templates,
      themeId: fashionStoreManifest.id,
      themeVersion: fashionStoreManifest.themeVersion,
      version: fixture.version,
    },
    themeId: fashionStoreManifest.id,
  };
}

async function main(): Promise<void> {
  const themeId = process.argv[2];
  if (themeId !== "fashion-store") {
    throw new Error(`Unknown fixture theme ${themeId ?? "(missing)"}.`);
  }
  const outputPath = resolve(
    import.meta.dir,
    `../fixtures/experience/.generated/${themeId}-preview-input.json`,
  );
  const input = await fashionStorePreviewBuildInput("https://preview.example.test");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`);
  console.log(`Prepared ${themeId} preview fixture at ${outputPath}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
