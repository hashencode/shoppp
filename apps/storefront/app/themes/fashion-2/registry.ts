import "./upstream/css/vendors.min.css";
import "./upstream/css/icon.min.css";
import "./upstream/css/style.css";
import "./upstream/css/responsive.css";
import "./upstream/demos/fashion-store/fashion-store.css";
import "./integration.css";
import type { ThemeRegistry } from "../../theme-engine/registry";
import Fashion2Home from "./components/Fashion2Home.vue";
import { fashion2HomeFixtures } from "./fixtures/home";
import { themeAssets } from "./resources";

export const themeRegistry = {
  blocks: {},
  sections: {
    "fashion-2.home": Fashion2Home,
  },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeFixtures = fashion2HomeFixtures;
