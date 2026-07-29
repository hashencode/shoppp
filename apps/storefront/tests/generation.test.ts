import { describe, expect, test } from "bun:test";
import { catalogRelease } from "../app/generated/catalog";
import { featuredProducts } from "../app/generated/featured-products";
import manifest from "../app/generated/route-manifest.json";
import verificationCatalog from "../app/generated/verification-catalog.json";

describe("static generation manifest", () => {
  test("contains every published route exactly once in isolated modules", async () => {
    expect(new Set(manifest.routes).size).toBe(manifest.routes.length);
    for (const route of manifest.routes) {
      if (route.startsWith("/products/")) {
        const slug = route.slice("/products/".length);
        expect(verificationCatalog.products.some((product) => product.slug === slug)).toBe(true);
      }
      if (route.startsWith("/collections/")) {
        const slug = route.slice("/collections/".length);
        expect(verificationCatalog.collections.some((collection) => collection.slug === slug)).toBe(
          true,
        );
      }
    }
    expect(featuredProducts.length).toBeLessThanOrEqual(8);
    expect(catalogRelease).not.toHaveProperty("products");
  });

  test("uses permanent redirects and excludes them from successful page routes", () => {
    for (const redirect of manifest.redirects) {
      expect(redirect.status).toBe(301);
      expect(manifest.routes).not.toContain(redirect.from);
    }
  });
});
