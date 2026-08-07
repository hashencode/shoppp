import type { ThemePreset } from "@shoppp/contracts";
import { fashionStoreTemplatePageTypes } from "../page-contracts";

export const fashionStorePreset = {
  id: "source-parity",
  label: "Source parity",
  templates: fashionStoreTemplatePageTypes.map((pageType) => ({
    id: `fashion-store-${pageType}`,
    pageType,
    requiredCapabilities: [],
    sections: [
      {
        blocks: [],
        capabilities: [],
        id: `fashion-store-${pageType}`,
        required: true,
        settings: {},
        type: `fashion-store.${pageType}`,
        visible: true,
      },
    ],
  })),
} as const satisfies ThemePreset;
