import type { ThemePreset } from "@shoppp/contracts";
import { decorStoreTemplatePageTypes } from "../page-contracts";

export const decorStorePreset = {
  id: "source-parity",
  label: "Source parity",
  templates: decorStoreTemplatePageTypes.map((pageType) => ({
    id: `decor-store-${pageType}`,
    pageType,
    requiredCapabilities: [],
    sections: [
      {
        blocks: [],
        capabilities: [],
        id: `decor-store-${pageType}`,
        required: true,
        settings: {},
        type: `decor-store.${pageType}`,
        visible: true,
      },
    ],
  })),
} as const satisfies ThemePreset;
