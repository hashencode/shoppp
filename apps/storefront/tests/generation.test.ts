import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { catalogRelease } from "../app/generated/catalog";
import { featuredProducts } from "../app/generated/featured-products";
import manifest from "../app/generated/route-manifest.json";
import verificationCatalog from "../app/generated/verification-catalog.json";
import {
  fashionStoreEnabledPageContracts,
  fashionStoreThemeRoutes,
  fashionStorePreviewRoutes,
} from "../app/themes/fashion-store/page-contracts";
import {
  resolveThemeRoute,
  staticThemeRoutePaths,
  themeRoutePaths,
} from "../app/theme-engine/routes";

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
    expect(scripts.every((source) => source.includes("themeRoutePaths"))).toBe(true);
    expect(staticThemeRoutePaths(fashionStoreThemeRoutes)).toEqual(fashionStorePreviewRoutes);
  });

  test("prerenders the platform checkout completion shell alongside theme preview routes", async () => {
    const nuxtConfig = await readFile(resolve(import.meta.dir, "../nuxt.config.ts"), "utf8");
    expect(nuxtConfig).toContain('const previewPlatformRoutes = ["/checkout/complete"]');
    expect(nuxtConfig).toContain("themeRoutePaths(fashionStoreThemeRoutes");
    expect(nuxtConfig).toContain("livePreviewInput.catalogRelease");
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

  test("exports live catalog families without changing exact fixture preview routes", async () => {
    const release = {
      collections: [
        {
          description: "Live collection",
          id: "col_01JGENERATIONCOLLECTION001",
          name: "Live collection",
          productIds: ["prod_01JGENERATIONPRODUCT00001"],
          productSlugs: ["release-only-product"],
          seoDescription: "Live collection",
          seoTitle: "Live collection",
          slug: "release-only-collection",
          status: "published",
        },
      ],
      generatedAt: "2026-08-11T00:00:00.000Z",
      policies: [
        {
          description: "Policy",
          effectiveDate: "2026-08-11",
          sections: [{ body: "Policy", heading: "Policy" }],
          slug: "privacy",
          title: "Privacy",
        },
      ],
      products: [
        {
          collectionIds: ["col_01JGENERATIONCOLLECTION001"],
          collectionSlugs: ["release-only-collection"],
          description: "Live product",
          id: "prod_01JGENERATIONPRODUCT00001",
          media: [],
          name: "Live product",
          seoDescription: "Live product",
          seoTitle: "Live product",
          slug: "release-only-product",
          status: "published",
          variants: [
            {
              id: "var_01JGENERATIONVARIANT000001",
              optionValues: { size: "M" },
              prices: [{ amount: 1000, currency: "USD" }],
              sku: "LIVE-M",
              status: "active",
              title: "Medium",
              weightGrams: 100,
            },
          ],
        },
      ],
      redirects: [],
      releaseId: "release-generation-live",
      routes: ["/", "/collections/release-only-collection", "/products/release-only-product"],
      schemaVersion: 2,
      site: {
        defaultCurrency: "USD",
        freshnessHours: 24,
        name: "Generation",
        origin: "https://shop.example.test",
      },
    } as const;

    expect(resolveThemeRoute("/", fashionStoreThemeRoutes)).toMatchObject({ id: "home" });
    expect(
      resolveThemeRoute("/products/release-only-product", fashionStoreThemeRoutes, release),
    ).toMatchObject({ id: "catalog-product" });
    expect(
      resolveThemeRoute("/collections/release-only-collection", fashionStoreThemeRoutes, release),
    ).toMatchObject({ id: "catalog-collection" });
    expect(fashionStorePreviewRoutes).not.toContain("/products/:slug");
    expect(fashionStorePreviewRoutes).not.toContain("/collections/:slug");

    expect(
      resolveThemeRoute(
        "/products/relaxed-corduroy-shirt",
        fashionStoreThemeRoutes,
        release,
        "live",
      ),
    ).toBeUndefined();
    expect(
      resolveThemeRoute(
        "/products/relaxed-corduroy-shirt",
        fashionStoreThemeRoutes,
        undefined,
        "fixture-preview",
      )?.id,
    ).toBe("product");
    expect(themeRoutePaths(fashionStoreThemeRoutes, "live", release)).toEqual([
      "/",
      "/shop",
      "/shop/no-sidebar",
      "/shop/right-sidebar",
      "/collections",
      "/cart",
      "/checkout",
      "/wishlist",
      "/account",
      "/magazine",
      "/magazine/marketing-tips-and-tricks",
      "/about",
      "/faq",
      "/contact",
      "/products/release-only-product",
      "/collections/release-only-collection",
    ]);

    const registry = await readFile(
      resolve(import.meta.dir, "../app/themes/fashion-store/registry.ts"),
      "utf8",
    );
    expect(registry).toContain("export const themeRoutes = fashionStoreThemeRoutes");
  });
});
