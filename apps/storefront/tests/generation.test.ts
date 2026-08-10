import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { catalogRelease } from "../app/generated/catalog";
import { featuredProducts } from "../app/generated/featured-products";
import manifest from "../app/generated/route-manifest.json";
import verificationCatalog from "../app/generated/verification-catalog.json";
import {
  fashionStoreEnabledPageContracts,
  fashionStorePreviewRoutes,
} from "../app/themes/fashion-store/page-contracts";

describe("static generation manifest", () => {
  test("derives private preview routes only from readiness-enabled page contracts", () => {
    expect(fashionStorePreviewRoutes).toEqual(
      fashionStoreEnabledPageContracts.map(({ path }) => path),
    );
    expect(new Set(fashionStorePreviewRoutes).size).toBe(fashionStorePreviewRoutes.length);
    expect(fashionStorePreviewRoutes).toEqual([
      "/",
      "/shop",
      "/shop/no-sidebar",
      "/shop/right-sidebar",
      "/collections",
      "/products/relaxed-corduroy-shirt",
      "/cart",
      "/checkout",
      "/wishlist",
      "/account",
      "/magazine",
      "/magazine/marketing-tips-and-tricks",
      "/about",
      "/faq",
      "/contact",
    ]);
  });

  test("makes static verification and bundle budgets consume active preview routes", async () => {
    const scripts = await Promise.all(
      ["verify-static.ts", "check-bundle-budget.ts"].map((name) =>
        readFile(resolve(import.meta.dir, `../scripts/${name}`), "utf8"),
      ),
    );
    expect(scripts.every((source) => source.includes("activeThemeRoutes"))).toBe(true);
  });

  test("prerenders the platform checkout completion shell alongside theme preview routes", async () => {
    const nuxtConfig = await readFile(resolve(import.meta.dir, "../nuxt.config.ts"), "utf8");
    expect(nuxtConfig).toContain('const previewPlatformRoutes = ["/checkout/complete"]');
    expect(nuxtConfig).toContain("[...fashionStorePreviewRoutes, ...previewPlatformRoutes]");
  });

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
