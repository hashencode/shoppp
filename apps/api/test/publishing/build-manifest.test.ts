import { describe, expect, test } from "vitest";

import { buildStaticRouteManifest } from "../../src/publishing/build-manifest";

describe("storefront build manifest", () => {
  test("includes each published slug once and excludes drafts and disabled variants", () => {
    const manifest = buildStaticRouteManifest({
      collections: [
        {
          description: "Travel essentials",
          name: "Travel",
          productSlugs: ["carry-on"],
          seoDescription: "Travel essentials",
          seoTitle: "Travel",
          slug: "travel",
          status: "published",
        },
      ],
      policies: [{ description: "Returns policy", slug: "returns", title: "Returns" }],
      products: [
        {
          description: "Published product",
          collectionSlugs: ["travel"],
          media: [],
          name: "Carry-on",
          seoDescription: "Carry-on SEO",
          seoTitle: "Carry-on",
          slug: "carry-on",
          status: "published",
          variants: [
            {
              optionValues: {},
              prices: [{ amount: 12_900, currency: "USD" }],
              sku: "ACTIVE",
              status: "active",
              title: "Default",
              weightGrams: 2_900,
            },
          ],
        },
        {
          description: "Draft product",
          collectionSlugs: [],
          media: [],
          name: "Draft",
          seoDescription: "Draft SEO",
          seoTitle: "Draft",
          slug: "draft",
          status: "draft",
          variants: [
            {
              optionValues: {},
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
      "/policies/returns",
      "/products/carry-on",
    ]);
    expect(new Set(manifest.routes).size).toBe(manifest.routes.length);
    expect(manifest.redirects).toEqual([
      { from: "/products/old-carry-on", status: 301, to: "/products/carry-on" },
    ]);
  });
});
