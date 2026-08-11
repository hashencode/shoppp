import "./upstream/revolution/css/settings.css";
import "./upstream/revolution/css/layers.css";
import "./upstream/revolution/css/navigation.css";
import "./upstream/css/vendors.min.css";
import "./upstream/css/icon.min.css";
import "./upstream/css/style.css";
import "./upstream/css/responsive.css";
import "./upstream/demos/decor-store/decor-store.css";
import "./integration.css";
import { defineComponent, h } from "vue";

import type { ThemeRegistry } from "../../theme-engine/registry";
import type { ThemeRouteContract } from "../../theme-engine/routes";
import { decorStoreHomeFixtures } from "./fixtures/home";
import { themeAssets } from "./resources";

const DecorStoreHomeShell = defineComponent({
  name: "DecorStoreHomeShell",
  setup: () => () =>
    h("main", { "data-decor-store-preview-shell": "" }, [
      h("h1", { class: "decor-store-preview-shell__title" }, "Decor Store preview shell"),
    ]),
});

export const themeRegistry = {
  blocks: {},
  sections: { "decor-store.home": DecorStoreHomeShell },
} as const satisfies ThemeRegistry;

export { themeAssets };
export const themeFixtures = decorStoreHomeFixtures;
export const themeRoutes = [
  { id: "decor-store-home", pageType: "home", path: "/", variant: "source-parity" },
] as const satisfies readonly ThemeRouteContract[];
