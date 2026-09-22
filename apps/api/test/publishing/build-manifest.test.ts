import { describe, expect, test } from "vitest";

import { buildStaticRouteManifest } from "../../src/publishing/build-manifest";

describe("storefront build manifest", () => {
  test("includes each published slug once and excludes drafts and disabled variants", () => {
    const manifest = buildStaticRouteManifest({
      collections: [
        {
          description: "Travel essentials",
          id: "col_01J00000000000000000000000",
          name: "Travel",
          productIds: [
            "prd_01J00000000000000000000009",
            "prd_01J00000000000000000000000",
            "prd_01J00000000000000000000001",
          ],
          productSlugs: ["carry-on", "draft"],
          seoDescription: "Travel essentials",
          seoTitle: "Travel",
          slug: "travel",
          status: "published",
        },
      ],
      policies: ["privacy", "returns", "shipping", "terms"].map((slug) => ({
        description: `${slug} disclosure`,
        effectiveDate: "2026-07-30",
        sections: [{ body: `${slug} policy body`, heading: `${slug} details` }],
        slug,
        title: `${slug} policy`,
      })),
      products: [
        {
          collectionIds: ["col_01J00000000000000000000009", "col_01J00000000000000000000000"],
          description: "Published product",
          collectionSlugs: ["travel"],
          id: "prd_01J00000000000000000000000",
          media: [
            {
              alt: "Carry-on detail",
              height: 1200,
              id: "med_01J00000000000000000000000",
              src: "https://media.example.test/carry-on.webp",
              width: 900,
            },
          ],
          name: "Carry-on",
          optionDefinitions: [
            {
              name: "Color",
              presentation: "color",
              values: [{ label: "Blue", swatch: "#5881bf" }],
            },
          ],
          presentation: {
            brand: "Shoppp",
            defaultVariantId: "var_01J00000000000000000000000",
            detail: {
              body: "Built for frequent travel.",
              bullets: ["Durable shell"],
              heading: "Designed for the journey",
            },
            detailMediaId: "med_01J00000000000000000000000",
            specifications: [{ label: "Capacity", value: "38 L" }],
          },
          seoDescription: "Carry-on SEO",
          seoTitle: "Carry-on",
          slug: "carry-on",
          status: "published",
          variants: [
            {
              optionValues: { Color: "Blue" },
              id: "var_01J00000000000000000000000",
              prices: [{ amount: 12_900, compareAtAmount: 15_000, currency: "USD" }],
              sku: "ACTIVE",
              status: "active",
              title: "Default",
              weightGrams: 2_900,
            },
            {
              id: "var_01J00000000000000000000002",
              optionValues: {},
              prices: [{ amount: 1, currency: "USD" }],
              sku: "DISABLED",
              status: "disabled",
              title: "Disabled",
              weightGrams: 500,
            },
          ],
        },
        {
          collectionIds: [],
          description: "Draft product",
          collectionSlugs: [],
          id: "prd_01J00000000000000000000001",
          media: [],
          name: "Draft",
          optionDefinitions: [],
          seoDescription: "Draft SEO",
          seoTitle: "Draft",
          slug: "draft",
          status: "draft",
          variants: [
            {
              optionValues: {},
              id: "var_01J00000000000000000000001",
              prices: [{ amount: 9_900, currency: "USD" }],
              sku: "DRAFT",
              status: "active",
              title: "Default",
              weightGrams: 500,
            },
          ],
        },
      ],
      redirects: [{ from: "/products/old-carry-on", to: "/products/carry-on" }],
      releaseId: "release-001",
      site: {
        defaultCurrency: "USD",
        freshnessHours: 24,
        name: "Shoppp",
        origin: "https://shop.example.test",
      },
    });

    expect(manifest.routes).toEqual([
      "/",
      "/collections/travel",
      "/policies/privacy",
      "/policies/returns",
      "/policies/shipping",
      "/policies/terms",
      "/products/carry-on",
    ]);
    expect(new Set(manifest.routes).size).toBe(manifest.routes.length);
    expect(manifest.redirects).toEqual([
      { from: "/products/old-carry-on", status: 301, to: "/products/carry-on" },
    ]);
    expect(manifest.products[0]?.variants.map((variant) => variant.sku)).toEqual(["ACTIVE"]);
    expect(manifest.products[0]?.variants[0]?.prices).toEqual([
      { amount: 12_900, compareAtAmount: 15_000, currency: "USD" },
    ]);
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.products[0]).toMatchObject({
      collectionIds: ["col_01J00000000000000000000000"],
      optionDefinitions: [
        {
          name: "Color",
          presentation: "color",
          values: [{ label: "Blue", swatch: "#5881bf" }],
        },
      ],
      id: "prd_01J00000000000000000000000",
      presentation: {
        brand: "Shoppp",
        defaultVariantId: "var_01J00000000000000000000000",
        detailMediaId: "med_01J00000000000000000000000",
        specifications: [{ label: "Capacity", value: "38 L" }],
      },
    });
    expect(manifest.collections[0]).toMatchObject({
      id: "col_01J00000000000000000000000",
      productIds: ["prd_01J00000000000000000000000"],
      productSlugs: ["carry-on"],
    });
  });
});
