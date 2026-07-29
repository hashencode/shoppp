import type { StorefrontProduct } from "../types/catalog-release";

export const featuredProducts = [
  {
    slug: "atlas-carry-on",
    name: "Atlas Carry-on",
    description:
      "A lightweight, impact-resistant carry-on designed for long-haul travel and compact overhead bins.",
    seoTitle: "Atlas Carry-on | Shoppp",
    seoDescription:
      "Meet the Atlas Carry-on: durable shell, quiet wheels, and an international cabin-friendly profile.",
    status: "published",
    collectionSlugs: ["travel-essentials"],
    variants: [
      {
        id: "var_01J00000000000000000000000",
        sku: "ATLAS-BLK",
        title: "Black",
        status: "active",
        optionValues: { color: "Black" },
        weightGrams: 2900,
        prices: [
          { currency: "USD", amount: 12900 },
          { currency: "EUR", amount: 11900 },
        ],
      },
    ],
    media: [
      {
        src: "/media/atlas-carry-on.svg",
        alt: "Black Atlas carry-on suitcase standing upright",
        width: 1200,
        height: 1200,
      },
    ],
  },
] satisfies StorefrontProduct[];
