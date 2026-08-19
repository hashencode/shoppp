import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { CanonicalCatalogRelease } from "@shoppp/contracts";

import {
  buildCatalogSearchIndex,
  resolveCatalogSearchState,
  searchCatalogIndex,
} from "../app/theme-engine/search";

const release = {
  collections: [
    {
      description: "Travel essentials",
      id: "col_01JSEARCH00000000000000001",
      name: "Travel",
      productIds: ["prd_01JSEARCH00000000000000001"],
      productSlugs: ["atlas-carry-on"],
      seoDescription: "Travel essentials",
      seoTitle: "Travel",
      slug: "travel",
      status: "published",
    },
  ],
  generatedAt: "2026-08-13T00:00:00.000Z",
  policies: [],
  products: [
    {
      collectionIds: ["col_01JSEARCH00000000000000001"],
      collectionSlugs: ["travel"],
      description: "Lightweight cabin luggage",
      id: "prd_01JSEARCH00000000000000001",
      media: [],
      name: "Atlas Carry-on",
      seoDescription: "Atlas luggage",
      seoTitle: "Atlas Carry-on",
      slug: "atlas-carry-on",
      status: "published",
      variants: [
        {
          id: "var_01JSEARCH00000000000000001",
          optionValues: {},
          prices: [{ amount: 12_900, currency: "USD" }],
          sku: "ATLAS",
          status: "active",
          title: "Default",
          weightGrams: 2_900,
        },
      ],
    },
  ],
  redirects: [],
  releaseId: "release-search-a",
  routes: ["/", "/collections/travel", "/products/atlas-carry-on"],
  schemaVersion: 2,
  site: {
    defaultCurrency: "USD",
    freshnessHours: 24,
    name: "Fashion Store",
    origin: "https://shop.example.test",
  },
} satisfies CanonicalCatalogRelease;

describe("build-local Catalog search", () => {
  test("indexes only published stable resources with canonical destinations", () => {
    const index = buildCatalogSearchIndex(release);
    expect(index.releaseId).toBe(release.releaseId);
    expect(index.entries).toEqual([
      expect.objectContaining({
        href: "/collections/travel",
        id: release.collections[0].id,
        kind: "collection",
      }),
      expect.objectContaining({
        href: "/products/atlas-carry-on",
        id: release.products[0].id,
        kind: "product",
      }),
    ]);
    expect(searchCatalogIndex(index, "atlas")).toEqual([
      {
        href: "/products/atlas-carry-on",
        id: release.products[0].id,
        kind: "product",
        label: "Atlas Carry-on",
      },
    ]);
    expect(searchCatalogIndex(index, "   ")).toEqual([]);
    expect(searchCatalogIndex(index, "travel", 0)).toEqual([]);
    expect(resolveCatalogSearchState(index, "atlas")).toEqual({
      results: [
        {
          href: "/products/atlas-carry-on",
          id: release.products[0].id,
          kind: "product",
          label: "Atlas Carry-on",
        },
      ],
      status: "results",
    });
    expect(resolveCatalogSearchState(index, "missing")).toEqual({ results: [], status: "empty" });
    expect(resolveCatalogSearchState(null, "atlas")).toEqual({
      results: [],
      status: "unavailable",
    });

    const unavailableRelease: CanonicalCatalogRelease = {
      ...release,
      collections: [{ ...release.collections[0], status: "archived" }],
      products: [
        {
          ...release.products[0],
          status: "draft",
          variants: [{ ...release.products[0].variants[0], status: "disabled" }],
        },
      ],
    };
    expect(buildCatalogSearchIndex(unavailableRelease).entries).toEqual([]);
  });

  test("does not issue a runtime query and declares all search outcomes", async () => {
    const [engineSource, overlaySource, experienceSource] = await Promise.all([
      readFile(resolve(import.meta.dir, "../app/theme-engine/search.ts"), "utf8"),
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/shared/FashionStoreSearchOverlay.vue",
        ),
        "utf8",
      ),
      readFile(resolve(import.meta.dir, "../app/StorefrontExperience.vue"), "utf8"),
    ]);
    expect(engineSource).not.toMatch(/\$fetch|\bfetch\s*\(|useCommerceApi/);
    expect(experienceSource).toContain("activeCatalogSearchIndex");
    expect(experienceSource).not.toContain("buildCatalogSearchIndex");
    expect(overlaySource).toContain("catalogSearchIndexKey");
    expect(overlaySource).toContain('status: "loading"');
    expect(overlaySource).toContain("@keydown.down.prevent");
    expect(overlaySource).toContain("@keydown.up.prevent");
    expect(overlaySource).toContain("@keydown.enter.prevent");
    expect(overlaySource).toContain('@input="resetSearchResults"');
  });

  test("renders a truthful no-JavaScript browse and transaction fallback", async () => {
    const shell = await readFile(
      resolve(
        import.meta.dir,
        "../app/themes/fashion-store/components/shared/FashionStoreShell.vue",
      ),
      "utf8",
    );
    expect(shell).toContain('<noscript v-html="noScriptMarkup" />');
    expect(shell).toContain("Shopping actions require JavaScript");
    expect(shell).toContain("Browse the published catalog");
  });
});
