import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { canonicalCatalogReleaseSchema } from "@shoppp/contracts";

import releaseFixture from "../fixtures/release.json";

describe("storefront catalog release source", () => {
  test("keeps the default release input compatible with the API canonical contract", () => {
    expect(canonicalCatalogReleaseSchema.safeParse(releaseFixture).success).toBe(true);
  });

  test("precomposes compact product modules without shipping the full release", async () => {
    const [preparationSource, loaderSource] = await Promise.all([
      readFile(resolve(import.meta.dir, "../scripts/prepare-release.ts"), "utf8"),
      readFile(resolve(import.meta.dir, "../app/utils/catalog-loader.server.ts"), "utf8"),
    ]);

    expect(preparationSource).toContain("const viewModel = composeProductPageModel");
    expect(preparationSource).toContain("releaseId: release.releaseId");
    expect(preparationSource).toContain("satisfies StorefrontProductPage");
    expect(loaderSource).not.toContain("generatedCatalogRelease");
    expect(loaderSource).not.toContain("theme-engine/composer");
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

  test("refuses a private schema-v3 candidate before deployment preparation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shoppp-private-candidate-"));
    const source = join(directory, "private-candidate.json");
    const candidate = {
      ...structuredClone(releaseFixture),
      content: [],
      environment: "development",
      identity: {
        faviconAssetId: null,
        id: "identity.primary",
        logoAssets: [],
        seo: {},
        socialShareAssetId: null,
        storefrontName: "Shoppp",
        tagline: "",
        version: 1,
      },
      navigation: [],
      purpose: "private-preview",
      routeOutput: releaseFixture.routes,
      schemaVersion: 3,
      sourceVersionVector: [
        {
          digest: "a".repeat(64),
          id: "identity.primary",
          kind: "store-identity",
          version: 1,
        },
      ],
    };
    await writeFile(source, JSON.stringify(candidate));
    try {
      const result = Bun.spawnSync(["bun", "scripts/prepare-release.ts"], {
        cwd: resolve(import.meta.dir, ".."),
        env: { ...process.env, NUXT_CATALOG_RELEASE_FILE: source },
        stderr: "pipe",
        stdout: "pipe",
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("catalog_candidate_private");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
