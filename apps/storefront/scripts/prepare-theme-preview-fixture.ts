import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixtureBindingSchema } from "@shoppp/contracts";
import * as z from "zod";

import { decorManifest } from "../app/themes/decor/manifest";
import { decorPreset } from "../app/themes/decor/presets/layered";
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
      kind: "approved",
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

export async function decorPreviewBuildInput(
  expectedOrigin: string,
): Promise<Extract<ExperienceBuildInput, { environment: "preview" }>> {
  const fixture = previewFixtureSchema.parse(
    JSON.parse(
      await readFile(resolve(import.meta.dir, "../fixtures/experience/decor.json"), "utf8"),
    ),
  );
  return {
    environment: "preview",
    expectedOrigin,
    snapshot: {
      approvedAt: fixture.approvedAt,
      approvedBy: fixture.approvedBy,
      bindings: fixture.bindings,
      configurationSchemaVersion: decorManifest.configurationSchemaVersion,
      experienceId: fixture.experienceId,
      id: fixture.snapshotId,
      kind: "approved",
      overrides: [],
      platformContractVersion: decorManifest.platformContractVersion,
      provenance: decorManifest.provenance,
      resolvedTemplates: decorPreset.templates,
      themeId: decorManifest.id,
      themeVersion: decorManifest.themeVersion,
      version: fixture.version,
    },
    themeId: decorManifest.id,
  };
}

async function main(): Promise<void> {
  const themeId = process.argv[2];
  if (themeId !== "fashion" && themeId !== "decor") {
    throw new Error(`Unknown fixture theme ${themeId ?? "(missing)"}.`);
  }
  const outputPath = resolve(
    import.meta.dir,
    `../fixtures/experience/.generated/${themeId}-preview-input.json`,
  );
  const input =
    themeId === "fashion"
      ? await fashionPreviewBuildInput("https://preview.example.test")
      : await decorPreviewBuildInput("https://preview.example.test");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`);
  console.log(`Prepared ${themeId} preview fixture at ${outputPath}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
