import "./tokens.css";
import type { ThemeRegistry } from "../../theme-engine/registry";
import DecorCategoryShowcase from "./components/DecorCategoryShowcase.vue";
import DecorClientStrip from "./components/DecorClientStrip.vue";
import DecorCollectionFeature from "./components/DecorCollectionFeature.vue";
import DecorFooter from "./components/DecorFooter.vue";
import DecorHeader from "./components/DecorHeader.vue";
import DecorHeroCarousel from "./components/DecorHeroCarousel.vue";
import DecorJournal from "./components/DecorJournal.vue";
import DecorMarquee from "./components/DecorMarquee.vue";
import DecorProductDetails from "./components/DecorProductDetails.vue";
import DecorProductTabs from "./components/DecorProductTabs.vue";
import DecorServiceStrip from "./components/DecorServiceStrip.vue";
import DecorShop from "./components/DecorShop.vue";
import { decorHomeFixtures } from "./fixtures/home";
import { decorThemeRoutes } from "./page-contracts";
import { themeAssets } from "./resources";

export const themeRegistry = {
  blocks: {},
  sections: {
    "decor.category-showcase": DecorCategoryShowcase,
    "decor.client-strip": DecorClientStrip,
    "decor.collection-feature": DecorCollectionFeature,
    "decor.footer": DecorFooter,
    "decor.header": DecorHeader,
    "decor.hero-carousel": DecorHeroCarousel,
    "decor.journal": DecorJournal,
    "decor.marquee": DecorMarquee,
    "decor.product-details": DecorProductDetails,
    "decor.product-tabs": DecorProductTabs,
    "decor.service-strip": DecorServiceStrip,
    "decor.shop": DecorShop,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeFixtures = decorHomeFixtures;
export const themeRoutes = decorThemeRoutes;
