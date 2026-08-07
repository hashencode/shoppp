import type { ThemePreset } from "@shoppp/contracts";

export const fashionStorePreset = {
  id: "source-parity",
  label: "Source parity",
  templates: [
    {
      id: "fashion-store-home",
      pageType: "home",
      requiredCapabilities: [],
      sections: [
        {
          blocks: [],
          capabilities: [],
          id: "fashion-store-home",
          required: true,
          settings: {},
          type: "fashion-store.home",
          visible: true,
        },
      ],
    },
  ],
} as const satisfies ThemePreset;
