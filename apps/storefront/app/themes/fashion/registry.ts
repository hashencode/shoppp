import "./tokens.css";
import type { ThemeRegistry } from "../../theme-engine/registry";
import FashionBrandStrip from "./components/FashionBrandStrip.vue";
import FashionCart from "./components/FashionCart.vue";
import FashionCategoryTiles from "./components/FashionCategoryTiles.vue";
import FashionCheckout from "./components/FashionCheckout.vue";
import FashionCollectionCarousel from "./components/FashionCollectionCarousel.vue";
import FashionContentPage from "./components/FashionContentPage.vue";
import FashionFooter from "./components/FashionFooter.vue";
import FashionHeader from "./components/FashionHeader.vue";
import FashionHeroCarousel from "./components/FashionHeroCarousel.vue";
import FashionMagazine from "./components/FashionMagazine.vue";
import FashionProductDetails from "./components/FashionProductDetails.vue";
import FashionProductShowcase from "./components/FashionProductShowcase.vue";
import FashionPromoBand from "./components/FashionPromoBand.vue";
import FashionPromiseStrip from "./components/FashionPromiseStrip.vue";
import FashionServiceStrip from "./components/FashionServiceStrip.vue";
import FashionShop from "./components/FashionShop.vue";
import { fashionHomeFixtures } from "./fixtures/home";
import { themeAssets } from "./resources";

export const themeRegistry = {
  blocks: {},
  sections: {
    "fashion.brand-strip": FashionBrandStrip,
    "fashion.cart": FashionCart,
    "fashion.category-tiles": FashionCategoryTiles,
    "fashion.checkout": FashionCheckout,
    "fashion.collection-carousel": FashionCollectionCarousel,
    "fashion.content-page": FashionContentPage,
    "fashion.footer": FashionFooter,
    "fashion.header": FashionHeader,
    "fashion.hero-carousel": FashionHeroCarousel,
    "fashion.magazine": FashionMagazine,
    "fashion.product-details": FashionProductDetails,
    "fashion.product-showcase": FashionProductShowcase,
    "fashion.promo-band": FashionPromoBand,
    "fashion.promise-strip": FashionPromiseStrip,
    "fashion.service-strip": FashionServiceStrip,
    "fashion.shop": FashionShop,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeFixtures = fashionHomeFixtures;
