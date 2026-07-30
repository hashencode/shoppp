import "./tokens.css";

import type { ThemeRegistry } from "../../theme-engine/registry";
import DecorFeature from "./components/DecorFeature.vue";
import DecorFooter from "./components/DecorFooter.vue";
import DecorHeader from "./components/DecorHeader.vue";
import DecorLayeredHero from "./components/DecorLayeredHero.vue";

export const themeRegistry = {
  blocks: {},
  sections: {
    "decor.feature": DecorFeature,
    "decor.footer": DecorFooter,
    "decor.header": DecorHeader,
    "decor.layered-hero": DecorLayeredHero,
  },
} as const satisfies ThemeRegistry;
