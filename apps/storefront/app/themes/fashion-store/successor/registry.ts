import type { ThemeRegistry } from "../../../theme-engine/registry";
import FashionStoreHomeShell from "../components/FashionStoreHomeShell.vue";
import FashionStoreBrandStripSection from "../components/sections/FashionStoreBrandStripSection.vue";
import FashionStoreLiveCategoriesSection from "../components/sections/FashionStoreLiveCategoriesSection.vue";
import FashionStoreLiveCollectionFeatureSection from "../components/sections/FashionStoreLiveCollectionFeatureSection.vue";
import FashionStoreLiveEditorialSection from "../components/sections/FashionStoreLiveEditorialSection.vue";
import FashionStoreHeroSection from "../components/sections/FashionStoreHeroSection.vue";
import FashionStoreMarqueeSection from "../components/sections/FashionStoreMarqueeSection.vue";
import FashionStorePromotionSection from "../components/sections/FashionStorePromotionSection.vue";
import FashionStoreLiveProductsSection from "../components/sections/FashionStoreLiveProductsSection.vue";
import FashionStoreServicesSection from "../components/sections/FashionStoreServicesSection.vue";
import FashionStoreProductMerchandisingSection from "../components/sections/FashionStoreProductMerchandisingSection.vue";
import { themeAssets, themeRegistry as inheritedRegistry, themeRoutes } from "../registry";
import { fashionStoreSectionComposition } from "./composition";

const inheritedSections = Object.fromEntries(
  Object.entries(inheritedRegistry.sections).filter(([type]) => type !== "fashion-store.home"),
);

export const themeRegistry = {
  ...inheritedRegistry,
  rendererShell: FashionStoreHomeShell,
  sectionComposition: fashionStoreSectionComposition,
  sections: {
    ...inheritedSections,
    "fashion-store.brand-strip": FashionStoreBrandStripSection,
    "fashion-store.categories": FashionStoreLiveCategoriesSection,
    "fashion-store.collection-feature": FashionStoreLiveCollectionFeatureSection,
    "fashion-store.editorial": FashionStoreLiveEditorialSection,
    "fashion-store.hero": FashionStoreHeroSection,
    "fashion-store.marquee": FashionStoreMarqueeSection,
    "fashion-store.products": FashionStoreLiveProductsSection,
    "fashion-store.product-merchandising": FashionStoreProductMerchandisingSection,
    "fashion-store.promotion": FashionStorePromotionSection,
    "fashion-store.services": FashionStoreServicesSection,
  },
} satisfies ThemeRegistry;

export { themeAssets, themeRoutes };
export { fashionStoreSectionComposition } from "./composition";
