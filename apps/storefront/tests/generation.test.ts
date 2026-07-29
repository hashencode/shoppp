import { describe, expect, test } from "bun:test";
import { catalogRelease } from "../app/generated/catalog";
import manifest from "../app/generated/route-manifest.json";

describe("static generation manifest", () => {
  test("contains every published route exactly once", () => {
    expect(new Set(manifest.routes).size).toBe(manifest.routes.length);
    for (const product of catalogRelease.products) {
      expect(manifest.routes.filter((route) => route === `/products/${product.slug}`)).toHaveLength(
        1,
      );
      expect(product.status).toBe("published");
    }
    for (const collection of catalogRelease.collections) {
      expect(
        manifest.routes.filter((route) => route === `/collections/${collection.slug}`),
      ).toHaveLength(1);
      expect(collection.status).toBe("published");
    }
  });

  test("uses permanent redirects and excludes them from successful page routes", () => {
    for (const redirect of manifest.redirects) {
      expect(redirect.status).toBe(301);
      expect(manifest.routes).not.toContain(redirect.from);
    }
  });
});
