import type { PreviewAction } from "../../../../theme-engine/actions";
import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";
import { fashionStoreShopData, type FashionStoreShopProduct } from "./shop";
import { fashionStoreArticleData, type FashionStoreArticleData } from "./article";
import { fashionStoreMagazineData, type FashionStoreMagazineData } from "./magazine";

export interface FashionStoreWishlistData {
  actions: {
    cart: PreviewAction;
    remove: PreviewAction;
  };
  announcement: string;
  products: readonly FashionStoreShopProduct[];
}

export interface FashionStoreAccountData {
  announcement: string;
  privacyCopy: string;
}

export interface FashionStoreContentData {
  account: FashionStoreAccountData;
  article: FashionStoreArticleData;
  magazine: FashionStoreMagazineData;
  wishlist: FashionStoreWishlistData;
}

export const fashionStoreContentData = {
  account: {
    announcement: "Enjoy FREE standard delivery on orders over $100.",
    privacyCopy:
      "Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our privacy policy.",
  },
  article: fashionStoreArticleData,
  magazine: fashionStoreMagazineData,
  wishlist: {
    actions: {
      cart: { id: "wishlist-add-cart", intent: "cart.add-preview", label: "Add to cart" },
      remove: {
        id: "wishlist-remove-product",
        intent: "wishlist.toggle-preview",
        label: "Remove product from wishlist",
      },
    },
    announcement: "Enjoy FREE standard delivery on orders over $100.",
    products: fashionStoreShopData.products.slice(0, 8),
  },
} as const satisfies FashionStoreContentData;

export const fashionStoreContentFixtures = {
  "fashion-store-content": {
    id: "fashion-store-content",
    label: "Fashion Store source-parity content pages",
    pageTypes: ["content"],
    viewModels: {
      content: { data: fashionStoreContentData, kind: "theme-section", state: "populated" },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
