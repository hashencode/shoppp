import type { ThemeCompositionAdapter } from "../../theme-engine/composition";
import {
  fashionStoreEditorDestinations,
  fashionStoreReferenceHref,
} from "./editor-destinations";

export const fashionStoreCompositionAdapter = {
  destinations: fashionStoreEditorDestinations,
  home: {
    featuredCollectionSettingId: "featured-collection",
    featuredProductSettingId: "featured-product",
    sectionType: "fashion-store.home",
  },
  referenceHref: fashionStoreReferenceHref,
} as const satisfies ThemeCompositionAdapter;
