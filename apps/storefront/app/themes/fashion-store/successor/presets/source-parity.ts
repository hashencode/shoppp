import type { ThemePreset } from "@shoppp/contracts";

import { fashionStorePreset as inheritedPreset } from "../../presets/source-parity";
import { fashionStoreHomeSections } from "../composition";

const inheritedHome = inheritedPreset.templates.find(({ pageType }) => pageType === "home")!;
const inheritedHomeSection = inheritedHome.sections[0]!;

export const fashionStorePreset = {
  ...inheritedPreset,
  templates: inheritedPreset.templates.map((template) =>
    template.pageType === "home"
      ? {
          ...template,
          sections: fashionStoreHomeSections.map(({ id, required, type }) => ({
            blocks: [],
            capabilities: [],
            id,
            required,
            settings: id === "fashion-store-home" ? inheritedHomeSection.settings : {},
            type,
            visible: true,
          })),
        }
      : template,
  ),
} as const satisfies ThemePreset;
