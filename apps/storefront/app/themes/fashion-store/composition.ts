import type { ThemeCompositionAdapter } from "../../theme-engine/composition";
import { buildFashionStoreMerchandisingGroups } from "./contracts/home-merchandising";
import { fashionStoreEditorDestinations, fashionStoreReferenceHref } from "./editor-destinations";

export const fashionStoreCompositionAdapter = {
  destinations: fashionStoreEditorDestinations,
  home: {
    featuredCollectionSettingId: "featured-collection",
    featuredProductSettingId: "featured-product",
    sectionData({ home, sectionType }) {
      const featuredProduct = home.featuredProduct
        ? home.products.find(({ productId }) => productId === home.featuredProduct?.productId)
        : undefined;
      return sectionType === "fashion-store.product-merchandising"
        ? {
            merchandising: {
              groups: buildFashionStoreMerchandisingGroups(home.products, featuredProduct),
              mode: "live",
            },
          }
        : {};
    },
    sectionType: "fashion-store.home",
  },
  referenceHref: fashionStoreReferenceHref,
} as const satisfies ThemeCompositionAdapter;
