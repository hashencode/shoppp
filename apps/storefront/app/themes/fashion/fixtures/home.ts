import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";

const productNames = [
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
] as const;
const prices = [189, 289, 199, 259, 129, 219, 349, 229, 279, 319, 199, 249] as const;
const comparePrices = [200, 350, 250, 300, 160, 260, 420, 270, 330, 380, 240, 290] as const;
const products = productNames.map((name, index) => ({
  assetId: `fashion.product-${String(index + 1).padStart(2, "0")}`,
  category: index % 2 === 0 ? "Women" : "Men",
  colors: ["Ochre", "Indigo", "Sage"],
  comparePrice: `$${comparePrices[index]}.00`,
  description:
    "A relaxed everyday layer with a considered silhouette, soft hand feel and durable finish.",
  name,
  price: `$${prices[index]}.00`,
  sizes: ["S", "M", "L", "XL"],
  sku: `ML-${String(index + 1).padStart(4, "0")}`,
  slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
  vendor: index % 3 === 0 ? "Zalando" : "Mode / Life",
}));

export const fashionHomeFixtures = {
  "fashion-home": {
    id: "fashion-home",
    label: "Fashion reference-backed home presentation",
    pageTypes: ["home", "product"],
    viewModels: {
      header: {
        data: {
          announcement: "Enjoy free delivery on orders over $100.",
          brand: "Mode / Life",
          brandAssetId: "fashion.logo-black",
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
          items: [
            {
              assetId: "fashion.service-box",
              detail: "Free shipping on first order",
              label: "Free shipping",
            },
            {
              assetId: "fashion.service-return",
              detail: "Moneyback guarantee",
              label: "15 days returns",
            },
            {
              assetId: "fashion.service-payment",
              detail: "100% protected payment",
              label: "Secure payment",
            },
            {
              assetId: "fashion.service-support",
              detail: "24/7 days a week support",
              label: "Online support",
            },
          ],
        },
        kind: "theme-section",
        state: "populated",
      },
      categories: {
        data: {
          items: ["Women", "Men", "Accessories", "Kids"].map((name, index) => ({
            assetId: `fashion.banner-${String(index + 1).padStart(2, "0")}`,
            name,
          })),
        },
        kind: "theme-section",
        state: "populated",
      },
      bestsellers: {
        data: { heading: "Best seller products", products: products.slice(0, 10) },
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
      brands: {
        data: { items: ["ASOS", "CHANEL", "GUCCI", "CELINE", "adidas"] },
        kind: "theme-section",
        state: "populated",
      },
      featured: {
        data: { heading: "Featured products", products: products.slice(6, 11) },
        kind: "theme-section",
        state: "populated",
      },
      product: {
        data: {
          products,
          relatedHeading: "You may also like",
        },
        kind: "theme-section",
        state: "populated",
      },
      promises: {
        data: {
          items: [
            "Get 20% off for your first order",
            "The fashion core collection",
            "100% secure protected payment",
          ],
        },
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
