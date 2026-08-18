import "./upstream/css/vendors.min.css";
import "./upstream/css/icon.min.css";
import "./upstream/css/style.css";
import "./upstream/css/responsive.css";
import "./upstream/demos/fashion-store/fashion-store.css";
import "./integration.css";
import { defineAsyncComponent } from "vue";
import type { ThemeRegistry } from "../../theme-engine/registry";
import { fashionStoreCompositionAdapter } from "./composition";
import FashionStoreLiveHomePage from "./components/FashionStoreLiveHomePage.vue";
import FashionStoreShell from "./components/shared/FashionStoreShell.vue";
import { fashionStoreThemeRoutes } from "./page-contracts";
import { themeAssets } from "./resources";

const FashionStoreCheckoutPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreCheckoutPage.vue"),
);
const FashionStoreCartPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreCartPage.vue"),
);
const FashionStoreCollectionPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreLiveCollectionPage.vue"),
);
const FashionStoreContentPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreLiveContentPage.vue"),
);
const FashionStoreProductPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreLiveProductPage.vue"),
);

export const themeRegistry = {
  blocks: {},
  composition: fashionStoreCompositionAdapter,
  platformShell: FashionStoreShell,
  sections: {
    "fashion-store.home": FashionStoreLiveHomePage,
    "fashion-store.cart": FashionStoreCartPage,
    "fashion-store.checkout": FashionStoreCheckoutPage,
    "fashion-store.collection": FashionStoreCollectionPage,
    "fashion-store.content": FashionStoreContentPage,
    "fashion-store.product": FashionStoreProductPage,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeRoutes = fashionStoreThemeRoutes;
