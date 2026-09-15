import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalCatalogReleaseSchema } from "@shoppp/contracts";

import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { experienceBuildInputSchema } from "../scripts/prepare-experience";
import {
  createFashionStoreLiveBuildInput,
  createFashionStoreLiveChildEnvironment,
  createFashionStoreLiveD1Command,
  fetchFashionStoreCatalogRelease,
  parseFashionStoreLiveD1Output,
  resolveFashionStoreLiveDevelopmentConfig,
} from "../scripts/dev-fashion-store-live";

const apiOrigin = "https://shoppp-api-fashion-staging.hashencode.workers.dev";
const storefrontOrigin = "https://shoppp-storefront-fashion-preview.hashencode.workers.dev";
const buildManifestToken = "build-token-that-is-at-least-32-characters";

describe("Fashion Store live local development", () => {
  test("targets only Fashion staging and derives the active shopper release", () => {
    expect(
      resolveFashionStoreLiveDevelopmentConfig(
        { BUILD_MANIFEST_TOKEN: buildManifestToken, FASHION_STORE_LIVE_DEV_PORT: "3445" },
        "fashion-store-live-2026-09-13-v1",
      ),
    ).toEqual({
      apiOrigin,
      buildManifestToken,
      port: 3445,
      releaseId: "fashion-store-live-2026-09-13-v1-shopper-release",
      storefrontOrigin,
    });
    expect(resolveFashionStoreLiveDevelopmentConfig({}, "fashion-store-live-v2")).toEqual({
      apiOrigin,
      buildManifestToken: null,
      port: 3435,
      releaseId: "fashion-store-live-v2-shopper-release",
      storefrontOrigin,
    });
    expect(() =>
      resolveFashionStoreLiveDevelopmentConfig(
        { BUILD_MANIFEST_TOKEN: "too-short" },
        "fashion-store-live-2026-09-13-v1",
      ),
    ).toThrow("at least 32 characters");
    expect(() =>
      resolveFashionStoreLiveDevelopmentConfig(
        { BUILD_MANIFEST_TOKEN: buildManifestToken, FASHION_STORE_LIVE_DEV_PORT: "70000" },
        "fashion-store-live-2026-09-13-v1",
      ),
    ).toThrow("FASHION_STORE_LIVE_DEV_PORT");
  });

  test("reads the release from Fashion test D1 when no build credential is available", async () => {
    const release = canonicalCatalogReleaseSchema.parse(
      JSON.parse(await readFile(resolve(import.meta.dir, "../fixtures/release.json"), "utf8")),
    );
    const command = createFashionStoreLiveD1Command(release.releaseId);
    const parsed = parseFashionStoreLiveD1Output(
      JSON.stringify([{ results: [{ manifest_json: JSON.stringify(release) }], success: true }]),
      release.releaseId,
    );

    expect(command).toContain("shoppp-fashion-staging");
    expect(command).toContain("--remote");
    expect(command).toContain("fashion-staging");
    expect(command.join(" ")).toContain("SELECT manifest_json FROM catalog_releases");
    expect(parsed.releaseId).toBe(release.releaseId);
    expect(() => createFashionStoreLiveD1Command("release' OR 1=1")).toThrow(
      "lowercase letters, digits, and hyphens",
    );
  });

  test("fetches and validates the exact authenticated staging release", async () => {
    const release = canonicalCatalogReleaseSchema.parse(
      JSON.parse(await readFile(resolve(import.meta.dir, "../fixtures/release.json"), "utf8")),
    );
    const config = {
      apiOrigin,
      buildManifestToken,
      port: 3435,
      releaseId: release.releaseId,
      storefrontOrigin,
    } as const;
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const fetched = await fetchFashionStoreCatalogRelease(config, async (input, init) => {
      requests.push({ init, url: String(input) });
      return Response.json(release);
    });

    expect(fetched.releaseId).toBe(release.releaseId);
    expect(requests).toEqual([
      {
        init: expect.objectContaining({
          headers: { Authorization: `Bearer ${buildManifestToken}` },
          signal: expect.any(AbortSignal),
        }),
        url: `${apiOrigin}/build/catalog/releases/${release.releaseId}`,
      },
    ]);
  });

  test("preserves D1 release IDs and declares remote media origins", async () => {
    const [fixtureInput, catalogRelease] = await Promise.all([
      fashionStorePreviewBuildInput("https://preview.example.test"),
      readFile(resolve(import.meta.dir, "../fixtures/release.json"), "utf8").then((source) =>
        canonicalCatalogReleaseSchema.parse(JSON.parse(source)),
      ),
    ]);
    catalogRelease.products[0].media[0].src =
      "https://pub-fashion-media.r2.dev/catalog/fashion-store/product.jpg";
    const input = createFashionStoreLiveBuildInput(fixtureInput, catalogRelease);
    const collection = catalogRelease.collections.find(({ status }) => status === "published");
    const product = catalogRelease.products.find(
      ({ status, variants }) =>
        status === "published" && variants.some((variant) => variant.status === "active"),
    );

    expect(experienceBuildInputSchema.parse(input)).toEqual(input);
    expect(input.catalogRelease.collections[0]?.id).toBe(catalogRelease.collections[0]?.id);
    expect(input.catalogRelease.products[0]?.id).toBe(catalogRelease.products[0]?.id);
    expect(input.mediaOrigins).toContain("https://pub-fashion-media.r2.dev");
    expect(input.snapshot.bindings).toEqual([
      expect.objectContaining({ reference: { id: collection.id, kind: "collection" } }),
      expect.objectContaining({ reference: { id: collection.id, kind: "collection" } }),
      expect.objectContaining({ reference: { id: product.id, kind: "product" } }),
    ]);
  });

  test("keeps the build token out of the Nuxt child process", () => {
    const child = createFashionStoreLiveChildEnvironment(
      {
        BUILD_MANIFEST_TOKEN: "build-token",
        NUXT_CATALOG_RELEASE_TOKEN: "legacy-token",
        PATH: "/usr/bin",
      },
      {
        apiOrigin,
        buildManifestToken: "build-token",
        port: 3435,
        releaseId: "release-1",
        storefrontOrigin,
      },
      { experienceFile: "/tmp/experience.json", releaseFile: "/tmp/release.json" },
    );

    expect(child.BUILD_MANIFEST_TOKEN).toBeUndefined();
    expect(child.NUXT_CATALOG_RELEASE_TOKEN).toBeUndefined();
    expect(child.API_PROXY_CATALOG_RELEASE_ID).toBe("release-1");
    expect(child.API_PROXY_STOREFRONT_ORIGIN).toBe(storefrontOrigin);
    expect(child.API_PROXY_TARGET).toBe(apiOrigin);
    expect(child.NUXT_CATALOG_RELEASE_FILE).toBe("/tmp/release.json");
    expect(child.STOREFRONT_EXPERIENCE_FILE).toBe("/tmp/experience.json");
    expect(child.STOREFRONT_BUILD_MODE).toBe("preview");
    expect(child.STOREFRONT_FASHION_HOME_PROFILE).toBe("combined");
  });

  test("wires the release and trusted storefront origin into the Nuxt API proxy", async () => {
    const config = await readFile(resolve(import.meta.dir, "../nuxt.config.ts"), "utf8");

    expect(config).toContain("Origin: process.env.API_PROXY_STOREFRONT_ORIGIN");
    expect(config).toContain(
      '"X-Preview-Catalog-Release": process.env.API_PROXY_CATALOG_RELEASE_ID',
    );
  });
});
