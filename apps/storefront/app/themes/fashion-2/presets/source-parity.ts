import type { ThemePreset } from "@shoppp/contracts";

export const fashion2Preset = {
  id: "source-parity",
  label: "Source parity",
  templates: [
    {
      id: "fashion-2-home",
      pageType: "home",
      requiredCapabilities: [],
      sections: [
        {
          blocks: [],
          capabilities: [],
          id: "fashion-2-home",
          required: true,
          settings: {},
          type: "fashion-2.home",
          visible: true,
        },
      ],
    },
  ],
} as const satisfies ThemePreset;
