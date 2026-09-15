import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../contracts/content-presentation";
import { fashionStoreAboutData } from "./about";
import { fashionStoreArticleData } from "./article";
import { fashionStoreContactData } from "./contact";
import { fashionStoreFaqData } from "./faq";
import { fashionStoreMagazineData } from "./magazine";
import { fashionStoreShopData } from "./shop";

export const fashionStoreContentData = {
  account: {
    announcement: "Enjoy FREE standard delivery on orders over $100.",
    privacyCopy:
      "Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our privacy policy.",
  },
  about: fashionStoreAboutData,
  article: fashionStoreArticleData,
  contact: fashionStoreContactData,
  faq: fashionStoreFaqData,
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
