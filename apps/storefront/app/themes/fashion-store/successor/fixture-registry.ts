import type { ThemeRegistry } from "../../../theme-engine/registry";
import FashionStoreHomeShell from "../components/FashionStoreHomeShell.vue";
import FashionStoreFixtureBrandStripSection from "../components/sections/FashionStoreFixtureBrandStripSection.vue";
import FashionStoreFixtureCategoriesSection from "../components/sections/FashionStoreFixtureCategoriesSection.vue";
import FashionStoreFixtureCollectionFeatureSection from "../components/sections/FashionStoreFixtureCollectionFeatureSection.vue";
import FashionStoreFixtureEditorialSection from "../components/sections/FashionStoreFixtureEditorialSection.vue";
import FashionStoreFixtureHeroSection from "../components/sections/FashionStoreFixtureHeroSection.vue";
import FashionStoreFixtureMarqueeSection from "../components/sections/FashionStoreFixtureMarqueeSection.vue";
import FashionStoreFixturePromotionSection from "../components/sections/FashionStoreFixturePromotionSection.vue";
import FashionStoreFixtureProductsSection from "../components/sections/FashionStoreFixtureProductsSection.vue";
import FashionStoreFixtureServicesSection from "../components/sections/FashionStoreFixtureServicesSection.vue";
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
    "fashion-store.brand-strip": FashionStoreFixtureBrandStripSection,
    "fashion-store.categories": FashionStoreFixtureCategoriesSection,
    "fashion-store.collection-feature": FashionStoreFixtureCollectionFeatureSection,
    "fashion-store.editorial": FashionStoreFixtureEditorialSection,
    "fashion-store.hero": FashionStoreFixtureHeroSection,
    "fashion-store.marquee": FashionStoreFixtureMarqueeSection,
    "fashion-store.products": FashionStoreFixtureProductsSection,
    "fashion-store.product-merchandising": FashionStoreProductMerchandisingSection,
    "fashion-store.promotion": FashionStoreFixturePromotionSection,
    "fashion-store.services": FashionStoreFixtureServicesSection,
  },
} satisfies ThemeRegistry;

export { themeFixtures };
