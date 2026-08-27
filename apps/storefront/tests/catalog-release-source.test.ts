import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { canonicalCatalogReleaseSchema } from "@shoppp/contracts";

import releaseFixture from "../fixtures/release.json";

describe("storefront catalog release source", () => {
  test("keeps the default release input compatible with the API canonical contract", () => {
    expect(canonicalCatalogReleaseSchema.safeParse(releaseFixture).success).toBe(true);
  });

  test("refuses a legacy release before generating storefront assets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shoppp-catalog-release-"));
    const source = join(directory, "legacy-release.json");
    const legacyRelease = structuredClone(releaseFixture) as Record<string, unknown>;
    delete legacyRelease.generatedAt;
    delete legacyRelease.routes;
    delete legacyRelease.schemaVersion;
    await writeFile(source, JSON.stringify(legacyRelease));

    try {
      const result = Bun.spawnSync(["bun", "scripts/prepare-release.ts"], {
        cwd: resolve(import.meta.dir, ".."),
        env: { ...process.env, NUXT_CATALOG_RELEASE_FILE: source },
        stderr: "pipe",
        stdout: "pipe",
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("generatedAt");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
