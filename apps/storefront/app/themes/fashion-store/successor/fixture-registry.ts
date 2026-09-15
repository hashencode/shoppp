import type { ThemeRegistry } from "../../../theme-engine/registry";
import FashionStoreHomeShell from "../components/FashionStoreHomeShell.vue";
import FashionStoreBrandStripSection from "../components/sections/FashionStoreBrandStripSection.vue";
import FashionStoreFixtureCategoriesSection from "../components/sections/FashionStoreFixtureCategoriesSection.vue";
import FashionStoreFixtureCollectionFeatureSection from "../components/sections/FashionStoreFixtureCollectionFeatureSection.vue";
import FashionStoreFixtureEditorialSection from "../components/sections/FashionStoreFixtureEditorialSection.vue";
import FashionStoreHeroSection from "../components/sections/FashionStoreHeroSection.vue";
import FashionStoreMarqueeSection from "../components/sections/FashionStoreMarqueeSection.vue";
import FashionStorePromotionSection from "../components/sections/FashionStorePromotionSection.vue";
import FashionStoreFixtureProductsSection from "../components/sections/FashionStoreFixtureProductsSection.vue";
import FashionStoreServicesSection from "../components/sections/FashionStoreServicesSection.vue";
import FashionStoreProductMerchandisingSection from "../components/sections/FashionStoreProductMerchandisingSection.vue";
import {
  fixtureThemeRegistry as inheritedFixtureRegistry,
  themeFixtures,
} from "../fixture-registry";
import { fashionStoreFixtureBindingAliases, fashionStoreSectionComposition } from "./composition";

const inheritedSections = Object.fromEntries(
  Object.entries(inheritedFixtureRegistry.sections).filter(
    ([type]) => type !== "fashion-store.home",
  ),
);

export const fixtureThemeRegistry = {
  ...inheritedFixtureRegistry,
  fixtureBindingAliases: fashionStoreFixtureBindingAliases,
  rendererShell: FashionStoreHomeShell,
  sectionComposition: fashionStoreSectionComposition,
  sections: {
    ...inheritedSections,
    "fashion-store.brand-strip": FashionStoreBrandStripSection,
    "fashion-store.categories": FashionStoreFixtureCategoriesSection,
    "fashion-store.collection-feature": FashionStoreFixtureCollectionFeatureSection,
    "fashion-store.editorial": FashionStoreFixtureEditorialSection,
    "fashion-store.hero": FashionStoreHeroSection,
    "fashion-store.marquee": FashionStoreMarqueeSection,
    "fashion-store.products": FashionStoreFixtureProductsSection,
    "fashion-store.product-merchandising": FashionStoreProductMerchandisingSection,
    "fashion-store.promotion": FashionStorePromotionSection,
    "fashion-store.services": FashionStoreServicesSection,
  },
} satisfies ThemeRegistry;

export { themeFixtures };
