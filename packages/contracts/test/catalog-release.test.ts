import { describe, expect, test } from "bun:test";

import {
  canonicalCatalogReleaseSchema,
  catalogReleaseDigestInput,
  catalogReleaseSupportsStableReferences,
  parseCatalogRelease,
  resolveStableCatalogReference,
  type CanonicalCatalogRelease,
} from "../src/catalog";

const canonicalRelease = {
  collections: [
    {
      description: "Travel essentials",
      id: "col_01J00000000000000000000000",
      name: "Travel",
      productIds: ["prd_01J00000000000000000000000"],
      productSlugs: ["carry-on"],
      seoDescription: "Travel essentials",
      seoTitle: "Travel",
      slug: "travel",
      status: "published",
    },
  ],
  generatedAt: "2026-08-11T00:00:00.000Z",
  policies: [
    {
      description: "Shipping disclosure",
      effectiveDate: "2026-08-11",
      sections: [{ body: "Shipping body", heading: "Shipping" }],
      slug: "shipping",
      title: "Shipping policy",
    },
  ],
  products: [
    {
      collectionIds: ["col_01J00000000000000000000000"],
      collectionSlugs: ["travel"],
      description: "Published product",
      id: "prd_01J00000000000000000000000",
      media: [],
      name: "Carry-on",
      seoDescription: "Carry-on SEO",
      seoTitle: "Carry-on",
      slug: "carry-on",
      status: "published",
      variants: [
        {
          id: "var_01J00000000000000000000000",
          optionValues: {},
          prices: [{ amount: 12_900, currency: "USD" }],
          sku: "ACTIVE",
          status: "active",
          title: "Default",
          weightGrams: 2_900,
        },
      ],
    },
  ],
  redirects: [{ from: "/products/old-carry-on", status: 301, to: "/products/carry-on" }],
  releaseId: "release-001",
  routes: ["/", "/collections/travel", "/products/carry-on"],
  schemaVersion: 2,
  site: {
    defaultCurrency: "USD",
    freshnessHours: 24,
    name: "Shoppp",
    origin: "https://shop.example.test",
  },
} as const;

describe("catalog release contracts", () => {
  test("reads an ID-less legacy release but excludes it from stable live selection", () => {
    const legacy = {
      ...canonicalRelease,
      collections: canonicalRelease.collections.map(
        ({ id: _id, productIds: _ids, ...value }) => value,
      ),
      products: canonicalRelease.products.map(
        ({ collectionIds: _ids, id: _id, ...value }) => value,
      ),
      schemaVersion: 1,
    };

    const parsed = parseCatalogRelease(legacy);

    expect(parsed.compatibility).toBe("legacy");
    expect(catalogReleaseSupportsStableReferences(parsed.release)).toBe(false);
    expect(() =>
      resolveStableCatalogReference(parsed.release, {
        id: "prd_01J00000000000000000000000",
        kind: "product",
      }),
    ).toThrow("canonical");
  });

  test("preserves canonical IDs through parsing, digest input, and resource resolution", () => {
    const parsed = canonicalCatalogReleaseSchema.parse(canonicalRelease);
    const reparsed = canonicalCatalogReleaseSchema.parse(
      JSON.parse(catalogReleaseDigestInput(parsed)),
    );

    expect(reparsed.products[0]?.id).toBe("prd_01J00000000000000000000000");
    expect(reparsed.collections[0]?.id).toBe("col_01J00000000000000000000000");
    expect(
      resolveStableCatalogReference(reparsed, {
        id: "prd_01J00000000000000000000000",
        kind: "product",
      }),
    ).toMatchObject({ id: "prd_01J00000000000000000000000", slug: "carry-on" });
  });

  test("accepts optional compare-at pricing and keeps historical schema-v2 releases readable", () => {
    expect(
      canonicalCatalogReleaseSchema.parse(canonicalRelease).products[0]?.variants[0]?.prices[0]
        ?.compareAtAmount,
    ).toBeUndefined();

    const saleRelease = structuredClone(canonicalRelease) as unknown as CanonicalCatalogRelease;
    saleRelease.products[0]!.variants[0]!.prices[0] = {
      amount: 12_900,
      compareAtAmount: 15_000,
      currency: "USD",
    };
    expect(
      canonicalCatalogReleaseSchema.parse(saleRelease).products[0]?.variants[0]?.prices[0],
    ).toEqual({ amount: 12_900, compareAtAmount: 15_000, currency: "USD" });

    for (const compareAtAmount of [12_900, 12_899, -1, 15_000.5]) {
      const invalid = structuredClone(saleRelease);
      invalid.products[0]!.variants[0]!.prices[0]!.compareAtAmount = compareAtAmount;
      expect(canonicalCatalogReleaseSchema.safeParse(invalid).success).toBe(false);
    }
  });

  test("rejects duplicate identities, slug collisions, malformed money, and unknown fields", () => {
    const invalidCases = [
      {
        ...canonicalRelease,
        products: [canonicalRelease.products[0], canonicalRelease.products[0]],
      },
      {
        ...canonicalRelease,
        products: [
          canonicalRelease.products[0],
          {
            ...canonicalRelease.products[0],
            id: "prd_01J00000000000000000000001",
          },
        ],
      },
      {
        ...canonicalRelease,
        products: [
          {
            ...canonicalRelease.products[0],
            variants: [
              {
                ...canonicalRelease.products[0].variants[0],
                prices: [{ amount: 129.99, currency: "USD" }],
              },
            ],
          },
        ],
      },
      {
        ...canonicalRelease,
        collections: [{ ...canonicalRelease.collections[0], productIds: [] }],
      },
      { ...canonicalRelease, databaseStatus: "approved" },
    ];

    for (const invalid of invalidCases) {
      expect(canonicalCatalogReleaseSchema.safeParse(invalid).success).toBe(false);
    }
  });

  test("rejects unpaired canonical membership IDs and slugs", () => {
    const invalidCases = [
      {
        ...canonicalRelease,
        products: [
          {
            ...canonicalRelease.products[0],
            collectionSlugs: ["travel", "unpaired-collection"],
          },
        ],
      },
      {
        ...canonicalRelease,
        collections: [
          {
            ...canonicalRelease.collections[0],
            productSlugs: ["carry-on", "unpaired-product"],
          },
        ],
      },
    ];

    for (const invalid of invalidCases) {
      expect(canonicalCatalogReleaseSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
