import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureBindingSchema } from "@shoppp/contracts";
import * as z from "zod";

import { fashionManifest } from "../app/themes/fashion/manifest";
import { fashionPreset } from "../app/themes/fashion/presets/editorial";
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

export async function fashionPreviewBuildInput(
  expectedOrigin: string,
): Promise<Extract<ExperienceBuildInput, { environment: "preview" }>> {
  const fixture = previewFixtureSchema.parse(
    JSON.parse(
      await readFile(resolve(import.meta.dir, "../fixtures/experience/fashion.json"), "utf8"),
    ),
  );
  return {
    environment: "preview",
    expectedOrigin,
    snapshot: {
      approvedAt: fixture.approvedAt,
      approvedBy: fixture.approvedBy,
      bindings: fixture.bindings,
      configurationSchemaVersion: fashionManifest.configurationSchemaVersion,
      experienceId: fixture.experienceId,
      id: fixture.snapshotId,
      overrides: [],
      platformContractVersion: fashionManifest.platformContractVersion,
      provenance: fashionManifest.provenance,
      resolvedTemplates: fashionPreset.templates,
      themeId: fashionManifest.id,
      themeVersion: fashionManifest.themeVersion,
      version: fixture.version,
    },
    themeId: fashionManifest.id,
  };
}

async function main(): Promise<void> {
  const themeId = process.argv[2];
  if (themeId !== "fashion") {
    throw new Error(`Unknown fixture theme ${themeId ?? "(missing)"}.`);
  }
  const outputPath = resolve(
    import.meta.dir,
    `../fixtures/experience/.generated/${themeId}-preview-input.json`,
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(await fashionPreviewBuildInput("https://preview.example.test"), null, 2)}\n`,
  );
  console.log(`Prepared ${themeId} preview fixture at ${outputPath}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
