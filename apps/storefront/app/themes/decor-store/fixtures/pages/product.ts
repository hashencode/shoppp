import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";
import { decorStoreShopData } from "./shop";

export const decorStoreProductData = {
  announcement: decorStoreShopData.announcement,
  colors: ["Natural", "Black", "Walnut"],
  description:
    "A minimalist wooden chair shaped for everyday comfort, with a clean silhouette and durable natural finish.",
  gallery: ["front", "side", "detail", "room"],
  name: "Minimalist wooden chair",
  price: 23,
  related: decorStoreShopData.products.slice(0, 4),
  tabs: ["Description", "Additional information", "Shipping and return", "Reviews (3)"],
} as const;

export const decorStoreWishlistData = {
  announcement: decorStoreShopData.announcement,
  items: decorStoreShopData.products.slice(0, 7),
} as const;

export const decorStoreProductFixtures = {
  "decor-store-product": {
    id: "decor-store-product",
    label: "Decor Store source-parity Product",
    pageTypes: ["product"],
    viewModels: {
      product: {
        data: { product: decorStoreProductData },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
  "decor-store-content": {
    id: "decor-store-content",
    label: "Decor Store source-parity content pages",
    pageTypes: ["content"],
    viewModels: {
      content: {
        data: { wishlist: decorStoreWishlistData },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
