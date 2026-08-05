import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";
import { decorSourceContract as source } from "../source-contract";

type ProductRow = readonly [string, string, string, string, string];

function productFromRow([assetId, name, comparePrice, price, badge]: ProductRow, index: number) {
  return {
    assetId,
    badge: badge || undefined,
    category: index < 4 ? "Home decor" : "Living room",
    colors: ["Natural", "Blue", "Walnut"],
    comparePrice: comparePrice || undefined,
    description:
      "A considered home object shaped with tactile materials, balanced proportions and an easy everyday purpose.",
    name,
    price,
    sizes: ["Small", "Medium", "Large"],
    sku: `DS-${String(index + 1).padStart(4, "0")}`,
    slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
    vendor: "Decshop studio",
  };
}

const bestSellers = source.bestSellers.map(productFromRow);
const newArrivals = source.newArrivals.map(productFromRow);
const products = [...bestSellers, ...newArrivals].filter(
  (product, index, all) => all.findIndex(({ slug }) => slug === product.slug) === index,
);
const productDetailProducts = products.map((product) =>
  product.slug === "table-clock"
    ? {
        ...product,
        ...source.productDetail.product,
        colors: ["Black", "Brown", "Natural", "Sage"],
      }
    : product,
);

export const decorHomeFixtures = {
  "decor-home": {
    id: "decor-home",
    label: "Decor source-equivalent home presentation",
    pageTypes: ["home", "product"],
    viewModels: {
      header: {
        data: {
          ...source.header,
          utilityLinks: ["Customer service", "Find our store", "English"],
        },
        kind: "theme-section",
        state: "populated",
      },
      hero: {
        data: source.hero,
        kind: "theme-section",
        state: "populated",
      },
      categories: {
        data: {
          banners: source.categories.banners.map(([assetId, name, size]) => ({
            assetId,
            name,
            size,
          })),
          featured: source.categories.featured.map(([assetId, name, count]) => ({
            assetId,
            count,
            name,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      shop: {
        data: {
          ...source.shop,
          newArrivals: source.shop.newArrivals.map(productFromRow),
          products: source.shop.products.map(productFromRow),
        },
        kind: "theme-section",
        state: "populated",
      },
      products: {
        data: {
          categories: ["Best sellers", "New arrivals"],
          productGroups: [bestSellers, newArrivals],
        },
        kind: "theme-section",
        state: "populated",
      },
      product: {
        data: {
          detailOptions: source.productDetail,
          products: productDetailProducts,
          relatedProducts: bestSellers.slice(0, 4),
          relatedHeading: "Related products",
        },
        kind: "theme-section",
        state: "populated",
      },
      marquee: {
        data: { messages: source.marquee },
        kind: "theme-section",
        state: "populated",
      },
      collection: {
        data: {
          ...source.collection,
          backgroundAssetId: "decor.product-slider-bg",
          products: source.collection.products.map(([assetId, name, comparePrice, price]) => ({
            assetId,
            comparePrice,
            name,
            price,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      clients: {
        data: { items: source.clients },
        kind: "theme-section",
        state: "populated",
      },
      journal: {
        data: {
          eyebrow: source.journal.eyebrow,
          heading: source.journal.heading,
          items: source.journal.items.map(([assetId, category, date, title]) => ({
            assetId,
            category,
            date,
            title,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      services: {
        data: {
          items: source.services.map(([assetId, label, detail]) => ({
            assetId,
            detail,
            label,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      footer: {
        data: {
          ...source.footer,
          backgroundAssetId: "decor.footer-bg",
        },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
