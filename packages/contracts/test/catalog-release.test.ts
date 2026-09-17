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

  test("round-trips ordered option definitions while keeping unchanged schema-v2 releases readable", () => {
    const historical = canonicalCatalogReleaseSchema.parse(canonicalRelease);
    expect(historical.products[0]).not.toHaveProperty("optionDefinitions");

    const withDefinitions = structuredClone(canonicalRelease) as unknown as CanonicalCatalogRelease;
    withDefinitions.products[0]!.optionDefinitions = [
      {
        name: "Color",
        presentation: "color",
        values: [
          { label: "Blue", swatch: "#5881bf" },
          { label: "Green", swatch: "#87a968" },
        ],
      },
      { name: "Size", presentation: "text", values: [{ label: "M" }, { label: "XL" }] },
    ];
    withDefinitions.products[0]!.variants[0]!.optionValues = { Color: "Blue", Size: "M" };
    withDefinitions.products[0]!.variants.push({
      ...structuredClone(withDefinitions.products[0]!.variants[0]!),
      id: "var_01JOPTIONDEFINITION000000002",
      optionValues: { Color: "Green", Size: "XL" },
      sku: "ATLAS-GREEN-XL",
      title: "Green / XL",
    });

    expect(
      canonicalCatalogReleaseSchema.parse(withDefinitions).products[0]!.optionDefinitions,
    ).toEqual(withDefinitions.products[0]!.optionDefinitions);
    for (const swatch of ["blue", "#fff", "#5881bfff", "linear-gradient(red, blue)"]) {
      const invalid = structuredClone(withDefinitions);
      invalid.products[0]!.optionDefinitions![0]!.values[0]!.swatch = swatch;
      expect(canonicalCatalogReleaseSchema.safeParse(invalid).success).toBe(false);
    }
  });

  test("round-trips Product presentation while historical schema-v2 releases remain claim-free", () => {
    const historical = canonicalCatalogReleaseSchema.parse(canonicalRelease);
    expect(historical.products[0]).not.toHaveProperty("presentation");

    const withPresentation = structuredClone(
      canonicalRelease,
    ) as unknown as CanonicalCatalogRelease;
    withPresentation.products[0]!.media = [
      {
        alt: "Carry-on detail",
        height: 1200,
        id: "med_01J00000000000000000000000",
        src: "/media/carry-on.webp",
        width: 900,
      },
    ];
    withPresentation.products[0]!.presentation = {
      brand: "Shoppp",
      defaultVariantId: "var_01J00000000000000000000000",
      detail: {
        body: "Built for frequent travel.",
        bullets: ["Durable shell", "Quiet wheels"],
        eyebrow: "Travel better",
        heading: "Designed for the journey",
      },
      detailMediaId: "med_01J00000000000000000000000",
      reviewDisplay: {
        averageRating: 4.8,
        count: 165,
        entries: [
          {
            author: "Published reviewer",
            date: "06 April 2023",
            text: "A published review snapshot entry.",
          },
        ],
        provenance: "catalog release test",
        updatedAt: "2026-09-16T00:00:00.000Z",
      },
      specifications: [
        { label: "Material", value: "Recycled polycarbonate" },
        { label: "Capacity", value: "38 L" },
      ],
    };

    expect(canonicalCatalogReleaseSchema.parse(withPresentation).products[0]!.presentation).toEqual(
      withPresentation.products[0]!.presentation,
    );
    const withApprovedReviews = structuredClone(withPresentation);
    withApprovedReviews.products[0]!.presentation!.reviewDisplay = {
      averageRating: 4,
      count: 2,
      entries: [
        {
          author: "Alex",
          date: "2026-09-17",
          id: crypto.randomUUID(),
          rating: 5,
          text: "A useful review.",
        },
        {
          author: "Sam",
          date: "2026-09-17",
          id: crypto.randomUUID(),
          rating: 3,
          text: "A second review.",
        },
      ],
      provenance: "approved-customer-reviews",
      ratingBands: [0, 0, 1, 0, 1],
      updatedAt: "2026-09-17T00:00:00.000Z",
    };
    expect(canonicalCatalogReleaseSchema.safeParse(withApprovedReviews).success).toBe(true);
    withApprovedReviews.products[0]!.presentation!.reviewDisplay!.ratingBands = [0, 0, 0, 0, 2];
    expect(canonicalCatalogReleaseSchema.safeParse(withApprovedReviews).success).toBe(false);
    for (const invalid of [
      {
        ...withPresentation.products[0]!.presentation,
        defaultVariantId: "var_01J00000000000000000000099",
      },
      {
        ...withPresentation.products[0]!.presentation,
        detailMediaId: "med_01J00000000000000000000099",
      },
      {
        ...withPresentation.products[0]!.presentation,
        specifications: [
          { label: "Material", value: "One" },
          { label: "material", value: "Two" },
        ],
      },
      {
        ...withPresentation.products[0]!.presentation,
        reviewDisplay: {
          averageRating: 5,
          count: 0,
          entries: [],
          provenance: "invalid zero-count rating",
          updatedAt: "2026-09-16T00:00:00.000Z",
        },
      },
    ]) {
      const release = structuredClone(withPresentation);
      release.products[0]!.presentation = invalid;
      expect(canonicalCatalogReleaseSchema.safeParse(release).success).toBe(false);
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
