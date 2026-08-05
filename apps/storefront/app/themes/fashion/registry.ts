import "./tokens.css";

import type { ThemeRegistry } from "../../theme-engine/registry";
import FashionEditorialHero from "./components/FashionEditorialHero.vue";
import FashionFooter from "./components/FashionFooter.vue";
import FashionMasthead from "./components/FashionMasthead.vue";
import FashionStory from "./components/FashionStory.vue";

export const themeRegistry = {
  blocks: {},
  sections: {
    "fashion.editorial-hero": FashionEditorialHero,
    "fashion.footer": FashionFooter,
    "fashion.masthead": FashionMasthead,
    "fashion.story": FashionStory,
  },
} as const satisfies ThemeRegistry;
