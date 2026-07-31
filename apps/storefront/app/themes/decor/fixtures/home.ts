import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";

const productRows: readonly (readonly [string, string, string, string | undefined])[] = [
  ["decor.product-01", "Table clock", "$23.00", "$30.00"],
  ["decor.product-14", "Wood stool", "$54.00", undefined],
  ["decor.product-12", "Ceramic mug", "$15.00", "$20.00"],
  ["decor.product-05", "Decorative plants", "$35.00", "$40.00"],
  ["decor.product-06", "Ceramic pot", "$23.00", undefined],
  ["decor.product-13", "Ceramic plate", "$15.00", "$20.00"],
  ["decor.product-09", "Ceramic container", "$35.00", undefined],
  ["decor.product-10", "Design wall clock", "$19.00", "$25.00"],
];
const products = productRows.map(([assetId, name, price, comparePrice], index) => ({
  assetId,
  category: index < 4 ? "Home decor" : "Living room",
  colors: ["Natural", "Blue", "Walnut"],
  comparePrice,
  description:
    "A considered home object shaped with tactile materials, balanced proportions and an easy everyday purpose.",
  name,
  price,
  sizes: ["Small", "Medium", "Large"],
  sku: `DS-${String(index + 1).padStart(4, "0")}`,
  slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
  vendor: "Decshop studio",
}));

export const decorHomeFixtures = {
  "decor-home": {
    id: "decor-home",
    label: "Decor reference-backed home presentation",
    pageTypes: ["home", "product"],
    viewModels: {
      header: {
        data: {
          announcement: "Free delivery on orders over €120.",
          brand: "decshop",
          brandAssetId: "decor.logo-black",
          navigation: ["Home", "Shop", "Collections", "Pages", "Journal", "Contact"],
        },
        kind: "theme-section",
        state: "populated",
      },
      hero: {
        data: {
          slides: [
            {
              accentAssetId: "decor.slider-01-img-02",
              assetId: "decor.slider-01-img-01",
              heading: "Corby sofas",
              mobileAccentAssetId: "decor.slider-01-accent-mobile",
              mobileAssetId: "decor.slider-01-mobile",
              price: "$199.00",
            },
            {
              accentAssetId: "decor.slider-02-img-05",
              assetId: "decor.slider-02-img-04",
              heading: "Nordic chairs",
              price: "$149.00",
            },
            {
              accentAssetId: "decor.slider-03-img-08",
              assetId: "decor.slider-03-img-07",
              heading: "Calm corners",
              price: "$229.00",
            },
          ],
        },
        kind: "theme-section",
        state: "populated",
      },
      categories: {
        data: {
          banners: [
            ["decor.main-banner-01", "Wooden classic table", "large"],
            ["decor.main-banner-02", "Pottery products", "small"],
            ["decor.main-banner-03", "Florence compact", "small"],
          ].map(([assetId, name, size]) => ({ assetId, name, size })),
          featured: [
            ["decor.icon-01", "Lamp", "02"],
            ["decor.icon-03", "Stool", "03"],
            ["decor.icon-02", "Chair", "05"],
            ["decor.icon-10", "Cabinet", "03"],
            ["decor.icon-04", "Light", "08"],
            ["decor.icon-05", "Sofa", "04"],
          ].map(([assetId, name, count]) => ({ assetId, count, name })),
        },
        kind: "theme-section",
        state: "populated",
      },
      products: {
        data: { categories: ["Best sellers", "New arrivals"], products },
        kind: "theme-section",
        state: "populated",
      },
      product: {
        data: {
          products,
          relatedHeading: "Related products",
        },
        kind: "theme-section",
        state: "populated",
      },
      marquee: {
        data: { message: "Original design · natural materials · made for everyday living" },
        kind: "theme-section",
        state: "populated",
      },
      collection: {
        data: {
          bannerAssetId: "decor.banner-04",
          heading: "Lounge collection",
          products: [
            ["decor.product-slider-01", "Wooden cabinet"],
            ["decor.product-slider-02", "Modern chair"],
            ["decor.product-slider-03", "Classic stools"],
          ].map(([assetId, name]) => ({ assetId, name })),
        },
        kind: "theme-section",
        state: "populated",
      },
      clients: {
        data: {
          items: Array.from(
            { length: 5 },
            (_, index) => `decor.client-${String(index + 1).padStart(2, "0")}`,
          ),
        },
        kind: "theme-section",
        state: "populated",
      },
      journal: {
        data: {
          heading: "Ideas for considered living",
          items: [
            ["decor.blog-07", "Rooms that make space for the way you live"],
            ["decor.blog-08", "Warm neutrals and the new natural palette"],
            ["decor.blog-04", "Small rituals that make a house feel like home"],
            ["decor.blog-03", "A practical guide to collected interiors"],
          ].map(([assetId, title]) => ({ assetId, title })),
        },
        kind: "theme-section",
        state: "populated",
      },
      services: {
        data: {
          items: [
            ["decor.icon-06", "Free shipping", "Free return & exchange"],
            ["decor.icon-07", "Store locator", "Find nearest store"],
            ["decor.icon-08", "Secure payment", "100% secure method"],
            ["decor.icon-09", "Online support", "24/7 support center"],
          ].map(([assetId, label, detail]) => ({ assetId, detail, label })),
        },
        kind: "theme-section",
        state: "populated",
      },
      footer: {
        data: {
          brand: "decshop",
          brandAssetId: "decor.logo-white",
          columns: {
            Categories: ["Bed room", "Living room", "Lighting", "Fabric sofas"],
            Information: ["About us", "Contact us", "FAQs", "Payment"],
            Account: ["My account", "Orders", "Checkout", "Wishlist"],
          },
          payments: Array.from(
            { length: 4 },
            (_, index) => `decor.payment-icon-${String(index + 1).padStart(2, "0")}`,
          ),
        },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
