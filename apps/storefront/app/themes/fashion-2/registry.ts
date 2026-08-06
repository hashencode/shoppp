import { defineComponent, h } from "vue";

import type { ThemeRegistry } from "../../theme-engine/registry";
import type { ExperienceFixtureRegistry } from "../../theme-engine/view-models";

const Fashion2HomePlaceholder = defineComponent({
  name: "Fashion2HomePlaceholder",
  setup: () => () =>
    h("main", { class: "fashion-2-home", "data-fashion-2-placeholder": "true" }, [
      h("h1", "Fashion 2 source parity preview"),
    ]),
});

export const themeRegistry = {
  blocks: {},
  sections: {
    "fashion-2.home": Fashion2HomePlaceholder,
  },
} as const satisfies ThemeRegistry;

export const themeAssets = {} as const;
export const themeFixtures = {
  "fashion-2-home": {
    id: "fashion-2-home",
    label: "Fashion 2 source-parity home placeholder",
    pageTypes: ["home"],
    viewModels: {
      home: {
        data: {},
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
