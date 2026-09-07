import type { ThemeRegistry } from "../../../theme-engine/registry";
import FashionStoreHomeShell from "../components/FashionStoreHomeShell.vue";
import FashionStoreLiveBrandStripSection from "../components/sections/FashionStoreLiveBrandStripSection.vue";
import FashionStoreLiveCategoriesSection from "../components/sections/FashionStoreLiveCategoriesSection.vue";
import FashionStoreLiveCollectionFeatureSection from "../components/sections/FashionStoreLiveCollectionFeatureSection.vue";
import FashionStoreLiveEditorialSection from "../components/sections/FashionStoreLiveEditorialSection.vue";
import FashionStoreLiveHeroSection from "../components/sections/FashionStoreLiveHeroSection.vue";
import FashionStoreLiveMarqueeSection from "../components/sections/FashionStoreLiveMarqueeSection.vue";
import FashionStoreLivePromotionSection from "../components/sections/FashionStoreLivePromotionSection.vue";
import FashionStoreLiveProductsSection from "../components/sections/FashionStoreLiveProductsSection.vue";
import FashionStoreLiveServicesSection from "../components/sections/FashionStoreLiveServicesSection.vue";
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
    "fashion-store.brand-strip": FashionStoreLiveBrandStripSection,
    "fashion-store.categories": FashionStoreLiveCategoriesSection,
    "fashion-store.collection-feature": FashionStoreLiveCollectionFeatureSection,
    "fashion-store.editorial": FashionStoreLiveEditorialSection,
    "fashion-store.hero": FashionStoreLiveHeroSection,
    "fashion-store.marquee": FashionStoreLiveMarqueeSection,
    "fashion-store.products": FashionStoreLiveProductsSection,
    "fashion-store.promotion": FashionStoreLivePromotionSection,
    "fashion-store.services": FashionStoreLiveServicesSection,
  },
} satisfies ThemeRegistry;

export { themeAssets, themeRoutes };
export { fashionStoreSectionComposition } from "./composition";
