import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";

const products = [
  ["decor.product-01", "Table clock", "$129"],
  ["decor.product-03", "Ceramic vase", "$89"],
  ["decor.product-05", "Decorative plants", "$69"],
  ["decor.product-06", "Ceramic pot", "$74"],
  ["decor.product-09", "Ceramic container", "$99"],
  ["decor.product-10", "Design wall clock", "$149"],
  ["decor.product-12", "Ceramic mug", "$42"],
  ["decor.product-13", "Ceramic plate", "$58"],
  ["decor.product-14", "Wood stool", "$179"],
  ["decor.product-15", "Organic vessel", "$96"],
].map(([assetId, name, price]) => ({ assetId, name, price }));

export const decorHomeFixtures = {
  "decor-home": {
    id: "decor-home",
    label: "Decor reference-backed home presentation",
    pageTypes: ["home"],
    viewModels: {
      header: {
        data: {
          announcement: "Free delivery on orders over €120.",
          brand: "Fieldhouse",
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
          items: ["Living room", "Bed room", "Lighting", "Fabrics sofa", "Kitchen", "Decor"].map(
            (name, index) => ({
              assetId: `decor.menu-category-${String(index + 1).padStart(2, "0")}`,
              name,
            }),
          ),
        },
        kind: "theme-section",
        state: "populated",
      },
      products: {
        data: { categories: ["New arrivals", "Best sellers", "Featured"], products },
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
          heading: "A lounge collection shaped for slow afternoons",
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
          items: Array.from({ length: 5 }, (_, index) => `decor.client-${String(index + 1).padStart(2, "0")}`),
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
            ["decor.icon-06", "Free delivery"],
            ["decor.icon-07", "Money-back guarantee"],
            ["decor.icon-08", "Secure payment"],
            ["decor.icon-09", "Friendly support"],
          ].map(([assetId, label]) => ({ assetId, label })),
        },
        kind: "theme-section",
        state: "populated",
      },
      footer: {
        data: {
          brand: "Fieldhouse",
          columns: {
            Categories: ["Bed room", "Living room", "Lighting", "Fabric sofas"],
            Information: ["About us", "Contact us", "FAQs", "Payment"],
            Account: ["My account", "Orders", "Checkout", "Wishlist"],
          },
          payments: Array.from({ length: 4 }, (_, index) => `decor.payment-icon-${String(index + 1).padStart(2, "0")}`),
        },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
