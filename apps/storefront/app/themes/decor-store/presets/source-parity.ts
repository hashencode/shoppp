import type { ThemePreset } from "@shoppp/contracts";

export const decorStorePreset = {
  id: "source-parity",
  label: "Source parity",
  templates: [
    {
      id: "decor-store-home",
      pageType: "home",
      requiredCapabilities: [],
      sections: [
        {
          blocks: [],
          capabilities: [],
          id: "decor-store-home",
          required: true,
          settings: {},
          type: "decor-store.home",
          visible: true,
        },
      ],
    },
  ],
} as const satisfies ThemePreset;
