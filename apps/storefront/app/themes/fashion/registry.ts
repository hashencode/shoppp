import "./tokens.css";
import type { ThemeRegistry } from "../../theme-engine/registry";
import FashionBrandStrip from "./components/FashionBrandStrip.vue";
import FashionCategoryTiles from "./components/FashionCategoryTiles.vue";
import FashionCollectionCarousel from "./components/FashionCollectionCarousel.vue";
import FashionFooter from "./components/FashionFooter.vue";
import FashionHeader from "./components/FashionHeader.vue";
import FashionHeroCarousel from "./components/FashionHeroCarousel.vue";
import FashionMagazine from "./components/FashionMagazine.vue";
import FashionProductShowcase from "./components/FashionProductShowcase.vue";
import FashionPromoBand from "./components/FashionPromoBand.vue";
import FashionPromiseStrip from "./components/FashionPromiseStrip.vue";
import FashionServiceStrip from "./components/FashionServiceStrip.vue";
import { fashionHomeFixtures } from "./fixtures/home";
import { themeAssets } from "./resources";

export const themeRegistry = {
  blocks: {},
  sections: {
    "fashion.brand-strip": FashionBrandStrip,
    "fashion.category-tiles": FashionCategoryTiles,
    "fashion.collection-carousel": FashionCollectionCarousel,
    "fashion.footer": FashionFooter,
    "fashion.header": FashionHeader,
    "fashion.hero-carousel": FashionHeroCarousel,
    "fashion.magazine": FashionMagazine,
    "fashion.product-showcase": FashionProductShowcase,
    "fashion.promo-band": FashionPromoBand,
    "fashion.promise-strip": FashionPromiseStrip,
    "fashion.service-strip": FashionServiceStrip,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeFixtures = fashionHomeFixtures;
