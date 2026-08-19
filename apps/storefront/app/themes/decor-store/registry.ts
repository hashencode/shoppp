import "./upstream/revolution/css/settings.css";
import "./upstream/revolution/css/layers.css";
import "./upstream/revolution/css/navigation.css";
import "./upstream/css/vendors.min.css";
import "./upstream/css/icon.min.css";
import "./upstream/css/style.css";
import "./upstream/css/responsive.css";
import "./upstream/demos/decor-store/decor-store.css";
import "./integration.css";
import { defineAsyncComponent } from "vue";
import type { ThemeRegistry } from "../../theme-engine/registry";
import DecorStoreHome from "./components/DecorStoreHome.vue";
import { decorStoreHomeFixtures } from "./fixtures/home";
import { decorStoreProductFixtures } from "./fixtures/pages/product";
import { decorStoreSecondaryShellFixtures } from "./fixtures/pages/shell";
import { decorStoreShopFixtures } from "./fixtures/pages/shop";
import { decorStoreEnabledPageContracts } from "./page-contracts";
import { themeAssets } from "./resources";

const DecorStoreSecondaryPage = defineAsyncComponent(
  () => import("./components/pages/DecorStoreSecondaryPage.vue"),
);

export const themeRegistry = {
  blocks: {},
  sections: {
    "decor-store.home": DecorStoreHome,
    "decor-store.cart": DecorStoreSecondaryPage,
    "decor-store.checkout": DecorStoreSecondaryPage,
    "decor-store.collection": DecorStoreSecondaryPage,
    "decor-store.content": DecorStoreSecondaryPage,
    "decor-store.product": DecorStoreSecondaryPage,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeFixtures = {
  ...decorStoreHomeFixtures,
  ...decorStoreProductFixtures,
  ...decorStoreSecondaryShellFixtures,
  ...decorStoreShopFixtures,
};
export const themeRoutes = decorStoreEnabledPageContracts;
