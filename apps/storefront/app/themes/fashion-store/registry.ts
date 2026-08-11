import "./upstream/css/vendors.min.css";
import "./upstream/css/icon.min.css";
import "./upstream/css/style.css";
import "./upstream/css/responsive.css";
import "./upstream/demos/fashion-store/fashion-store.css";
import "./integration.css";
import { defineAsyncComponent } from "vue";
import type { ThemeRegistry } from "../../theme-engine/registry";
import FashionStoreHome from "./components/FashionStoreHome.vue";
import { fashionStoreThemeRoutes } from "./page-contracts";
import { themeAssets } from "./resources";

const FashionStoreCheckoutPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreCheckoutPage.vue"),
);
const FashionStoreCartPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreCartPage.vue"),
);
const FashionStoreCollectionPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreCollectionPage.vue"),
);
const FashionStoreContentPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreContentPage.vue"),
);
const FashionStoreProductPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreProductPage.vue"),
);

export const themeRegistry = {
  blocks: {},
  sections: {
    "fashion-store.home": FashionStoreHome,
    "fashion-store.cart": FashionStoreCartPage,
    "fashion-store.checkout": FashionStoreCheckoutPage,
    "fashion-store.collection": FashionStoreCollectionPage,
    "fashion-store.content": FashionStoreContentPage,
    "fashion-store.product": FashionStoreProductPage,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeRoutes = fashionStoreThemeRoutes;
