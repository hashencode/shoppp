import { describe, expect, test } from "bun:test";

import { catalogFixtureEnvironment, representativeCatalog } from "./verify-catalog-scale";

describe("representative catalog fixture", () => {
  test("contains the release-contract scale with unique routes and identifiers", () => {
    const release = representativeCatalog();
    const variants = release.products.flatMap((product) => product.variants);
    expect(release.products).toHaveLength(1_000);
    expect(variants).toHaveLength(5_000);
    expect(new Set(release.products.map((product) => product.slug)).size).toBe(1_000);
    expect(new Set(variants.map((variant) => variant.id)).size).toBe(5_000);
    expect(
      release.collections.reduce((count, collection) => count + collection.productSlugs.length, 0),
    ).toBe(1_000);
  });

  test("isolates scale builds from a selected remote catalog release", () => {
    expect(catalogFixtureEnvironment("/tmp/catalog-scale.json")).toEqual({
      NUXT_CATALOG_RELEASE_FILE: "/tmp/catalog-scale.json",
      NUXT_CATALOG_RELEASE_TOKEN: "",
      NUXT_CATALOG_RELEASE_URL: "",
    });
  });
});
