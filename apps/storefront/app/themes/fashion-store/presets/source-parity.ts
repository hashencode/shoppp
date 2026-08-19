import type { ThemePreset } from "@shoppp/contracts";
import { fashionStoreTemplatePageTypes } from "../page-contracts";

const editableDefaults = {
  cart: { "help-copy": "Need help with your cart?" },
  checkout: { "help-copy": "Secure checkout" },
  collection: {
    "intro-copy": "Discover the latest edit.",
    "intro-title": "Shop the collection",
  },
  content: {
    "about.heading": "About us",
    "about.message": "Learn more about this store.",
    "account.heading": "Account unavailable",
    "account.message": "Customer accounts are not available yet.",
    "contact.heading": "Contact information",
    "contact.message": "Merchant contact details will appear here.",
    "content-style": "standard",
    "faq.heading": "Frequently asked questions",
    "faq.message": "Helpful answers from our team.",
    "magazine.heading": "Magazine",
    "magazine.marketing-tips-and-tricks.heading": "Marketing tips and tricks",
    "magazine.marketing-tips-and-tricks.message": "Editorial story.",
    "magazine.message": "Stories from the latest collection.",
    "wishlist.heading": "Wishlist",
    "wishlist.message": "Saved wishlists are not available yet.",
  },
  home: {
    "hero-body": "Explore the latest edit.",
    "hero-eyebrow": "New collection",
    "hero-title": "Fashion for every day",
  },
  product: { "presentation-copy": "Designed for everyday wear." },
} as const;

export const fashionStorePreset = {
  id: "source-parity",
  label: "Source parity",
  templates: fashionStoreTemplatePageTypes.map((pageType) => ({
    id: `fashion-store-${pageType}`,
    pageType,
    requiredCapabilities: [],
    sections: [
      {
        blocks: [],
        capabilities: [],
        id: `fashion-store-${pageType}`,
        required: true,
        settings: editableDefaults[pageType],
        type: `fashion-store.${pageType}`,
        visible: true,
      },
    ],
  })),
} as const satisfies ThemePreset;
