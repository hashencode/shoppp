import "./upstream/css/vendors.min.css";
import "./upstream/css/icon.min.css";
import "./upstream/css/style.css";
import "./upstream/css/responsive.css";
import "./upstream/demos/fashion-store/fashion-store.css";
import "./integration.css";
import type { ThemeRegistry } from "../../theme-engine/registry";
import FashionStoreHome from "./components/FashionStoreHome.vue";
import FashionStoreShopPage from "./components/pages/FashionStoreShopPage.vue";
import { fashionStoreHomeFixtures } from "./fixtures/home";
import { fashionStoreShopFixtures } from "./fixtures/pages/shop";
import { fashionStoreEnabledPageContracts } from "./page-contracts";
import { themeAssets } from "./resources";

export const themeRegistry = {
  blocks: {},
  sections: {
    "fashion-store.home": FashionStoreHome,
    "fashion-store.collection": FashionStoreShopPage,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeFixtures = { ...fashionStoreHomeFixtures, ...fashionStoreShopFixtures };
export const themeRoutes = fashionStoreEnabledPageContracts;
