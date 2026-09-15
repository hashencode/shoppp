import type { ThemeRegistry } from "../../../theme-engine/registry";
import FashionStoreHomeShell from "../components/FashionStoreHomeShell.vue";
import FashionStoreBrandStripSection from "../components/sections/FashionStoreBrandStripSection.vue";
import FashionStoreCategoriesSection from "../components/sections/FashionStoreCategoriesSection.vue";
import FashionStoreCollectionFeatureSection from "../components/sections/FashionStoreCollectionFeatureSection.vue";
import FashionStoreEditorialSection from "../components/sections/FashionStoreEditorialSection.vue";
import FashionStoreHeroSection from "../components/sections/FashionStoreHeroSection.vue";
import FashionStoreMarqueeSection from "../components/sections/FashionStoreMarqueeSection.vue";
import FashionStorePromotionSection from "../components/sections/FashionStorePromotionSection.vue";
import FashionStoreProductsSection from "../components/sections/FashionStoreProductsSection.vue";
import FashionStoreServicesSection from "../components/sections/FashionStoreServicesSection.vue";
import FashionStoreProductMerchandisingSection from "../components/sections/FashionStoreProductMerchandisingSection.vue";
import { themeAssets, themeRegistry as inheritedRegistry, themeRoutes } from "../registry";
import { fashionStoreSectionComposition } from "./composition";

export const themeRegistry = {
  ...inheritedRegistry,
  rendererShell: FashionStoreHomeShell,
  sectionComposition: fashionStoreSectionComposition,
  sections: {
    ...inheritedRegistry.sections,
    "fashion-store.brand-strip": FashionStoreBrandStripSection,
    "fashion-store.categories": FashionStoreCategoriesSection,
    "fashion-store.collection-feature": FashionStoreCollectionFeatureSection,
    "fashion-store.editorial": FashionStoreEditorialSection,
    "fashion-store.hero": FashionStoreHeroSection,
    "fashion-store.marquee": FashionStoreMarqueeSection,
    "fashion-store.products": FashionStoreProductsSection,
    "fashion-store.product-merchandising": FashionStoreProductMerchandisingSection,
    "fashion-store.promotion": FashionStorePromotionSection,
    "fashion-store.services": FashionStoreServicesSection,
  },
} satisfies ThemeRegistry;

export { themeAssets, themeRoutes };
export { fashionStoreSectionComposition } from "./composition";
