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
import {
  fixtureThemeRegistry as inheritedFixtureRegistry,
  themeFixtures,
} from "../fixture-registry";
import { fashionStoreFixtureBindingAliases, fashionStoreSectionComposition } from "./composition";

export const fixtureThemeRegistry = {
  ...inheritedFixtureRegistry,
  blocksOwnedBySections: true,
  fixtureBindingAliases: fashionStoreFixtureBindingAliases,
  rendererShell: FashionStoreHomeShell,
  sectionComposition: fashionStoreSectionComposition,
  sections: {
    ...inheritedFixtureRegistry.sections,
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

export { themeFixtures };
