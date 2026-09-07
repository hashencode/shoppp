import type { ThemePreset } from "@shoppp/contracts";

import { fashionStorePreset as inheritedPreset } from "../../presets/source-parity";
import { fashionStoreHomeSections } from "../composition";
import { homeSettingsByType } from "../manifest";

const inheritedHome = inheritedPreset.templates.find(({ pageType }) => pageType === "home")!;
const inheritedHomeSection = inheritedHome.sections[0]!;

function homeSectionDefaults(type: string): Readonly<Record<string, unknown>> {
  const definitions = homeSettingsByType[type as keyof typeof homeSettingsByType] ?? [];
  return Object.fromEntries(definitions.map(({ default: value, id }) => [id, value]));
}

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
            settings:
              id === "fashion-store-home"
                ? inheritedHomeSection.settings
                : homeSectionDefaults(type),
            type,
            visible: type !== "fashion-store.product-merchandising",
          })),
        }
      : template,
  ),
} as const satisfies ThemePreset;
