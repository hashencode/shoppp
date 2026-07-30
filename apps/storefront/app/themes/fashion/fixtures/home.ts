import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";

const products = Array.from({ length: 12 }, (_, index) => ({
  assetId: `fashion.product-${String(index + 1).padStart(2, "0")}`,
  name: [
    "Textured sweater",
    "Traveller shirt",
    "Crewneck sweatshirt",
    "Skinny trousers",
    "Everyday tee",
    "Relaxed overshirt",
    "Tailored jacket",
    "Pleated skirt",
    "Modern cardigan",
    "Minimal dress",
    "Soft knit polo",
    "Wide-leg trouser",
  ][index],
  price: `$${[189, 289, 199, 259, 129, 219, 349, 229, 279, 319, 199, 249][index]}`,
}));

export const fashionHomeFixtures = {
  "fashion-home": {
    id: "fashion-home",
    label: "Fashion reference-backed home presentation",
    pageTypes: ["home"],
    viewModels: {
      header: {
        data: {
          announcement: "Enjoy free delivery on orders over $100.",
          brand: "Mode / Life",
          navigation: ["Home", "Shop", "Collection", "Magazine", "Pages", "Contact"],
        },
        kind: "theme-section",
        state: "populated",
      },
      hero: {
        data: {
          slides: [
            {
              assetId: "fashion.slider-01",
              eyebrow: "Discount on selected collection",
              heading: "Women's collection",
            },
            {
              assetId: "fashion.slider-02",
              eyebrow: "The edit for a new season",
              heading: "Men's collection",
            },
            {
              assetId: "fashion.slider-03",
              eyebrow: "Modern layers, easy silhouettes",
              heading: "Street collection",
            },
          ],
        },
        kind: "theme-section",
        state: "populated",
      },
      services: {
        data: {
          items: ["Free shipping over $130", "Easy 30-day returns", "Secure protected payment", "Friendly support"],
        },
        kind: "theme-section",
        state: "populated",
      },
      categories: {
        data: {
          items: ["Women", "Men", "Accessories", "Outerwear", "Dresses", "Shoes"].map((name, index) => ({
            assetId: `fashion.menu-category-${String(index + 1).padStart(2, "0")}`,
            name,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      bestsellers: {
        data: { heading: "Best seller products", products: products.slice(0, 8) },
        kind: "theme-section",
        state: "populated",
      },
      promotion: {
        data: { code: "FW25", message: "Take an extra 25% discount on our favorite dress styles." },
        kind: "theme-section",
        state: "populated",
      },
      collection: {
        data: {
          heading: "New arrival collection",
          items: ["Ethnic wear", "Dress materials", "Western wear", "Loungewear"].map(
            (name, index) => ({
              assetId: `fashion.collection-slider-${String(index + 1).padStart(2, "0")}`,
              name,
            }),
          ),
        },
        kind: "theme-section",
        state: "populated",
      },
      featured: {
        data: { heading: "Featured products", products: products.slice(4) },
        kind: "theme-section",
        state: "populated",
      },
      magazine: {
        data: {
          heading: "Fashion magazine",
          items: [
            ["fashion.blog-01", "A confident guide to the season's newest shapes"],
            ["fashion.blog-02", "How to build a wardrobe with staying power"],
            ["fashion.blog-06", "The accessories defining a modern uniform"],
            ["fashion.blog-07", "Four fresh ways to wear soft tailoring"],
          ].map(([assetId, title]) => ({ assetId, title })),
        },
        kind: "theme-section",
        state: "populated",
      },
      footer: {
        data: {
          brand: "Mode / Life",
          columns: {
            Categories: ["Women", "Men", "Accessories", "Shoes", "Dresses"],
            Information: ["About us", "Contact us", "Terms & conditions", "Shipping & delivery"],
            "Quick links": ["My account", "Orders tracking", "Our store", "Size guide"],
          },
        },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
