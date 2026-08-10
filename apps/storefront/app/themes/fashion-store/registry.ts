import "./upstream/css/vendors.min.css";
import "./upstream/css/icon.min.css";
import "./upstream/css/style.css";
import "./upstream/css/responsive.css";
import "./upstream/demos/fashion-store/fashion-store.css";
import "./integration.css";
import { defineAsyncComponent } from "vue";
import type { ThemeRegistry } from "../../theme-engine/registry";
import { fashionStoreHomeFixtures } from "./fixtures/home";
import { fashionStoreCartFixtures } from "./fixtures/pages/cart";
import { fashionStoreCheckoutFixtures } from "./fixtures/pages/checkout";
import { fashionStoreContentFixtures } from "./fixtures/pages/content";
import { fashionStoreShopFixtures } from "./fixtures/pages/shop";
import { fashionStoreProductFixtures } from "./fixtures/pages/product";
import { fashionStoreEnabledPageContracts } from "./page-contracts";
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
const FashionStoreHome = defineAsyncComponent(() => import("./components/FashionStoreHome.vue"));
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
export const themeFixtures = {
  ...fashionStoreCartFixtures,
  ...fashionStoreCheckoutFixtures,
  ...fashionStoreContentFixtures,
  ...fashionStoreHomeFixtures,
  ...fashionStoreProductFixtures,
  ...fashionStoreShopFixtures,
};
export const themeRoutes = fashionStoreEnabledPageContracts;
