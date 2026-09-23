import "./critical.css";
import "./styles/vendor.css";
import "./upstream/css/style.css";
import "./upstream/css/responsive.css";
import "./upstream/demos/fashion-store/fashion-store.css";
import "./integration.css";
import "./decor-home-source.css";
import type { ThemeRegistry } from "../../theme-engine/registry";
import { fashionStoreCompositionAdapter } from "./composition";
import FashionStoreShell from "./components/shared/FashionStoreShell.vue";
import { fashionStorePageSections } from "./page-registry";
import { fashionStoreThemeRoutes } from "./page-contracts";
import { themeAssets } from "./resources";

export const themeRegistry = {
  blocks: {},
  blocksOwnedBySections: true,
  composition: fashionStoreCompositionAdapter,
  platformShell: FashionStoreShell,
  sections: fashionStorePageSections,
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeRoutes = fashionStoreThemeRoutes;
