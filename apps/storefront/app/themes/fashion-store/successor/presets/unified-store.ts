import type { ThemePreset } from "@shoppp/contracts";

import { fashionStorePreset } from "./source-parity";

const unifiedHomePresentationByType = {
  "fashion-store.brand-strip": { "brand-strip-presentation": "decor-continuous" },
  "fashion-store.categories": { "categories-presentation": "decor-icons" },
  "fashion-store.collection-feature": { "collection-presentation": "decor-layered" },
  "fashion-store.editorial": { "editorial-presentation": "decor-journal" },
  "fashion-store.marquee": { "marquee-presentation": "decor-reverse" },
  "fashion-store.services": { "services-presentation": "decor-compact" },
} as const;

export const fashionStoreUnifiedPreset = {
  ...fashionStorePreset,
  id: "unified-store",
  label: "Unified store",
  templates: fashionStorePreset.templates.map((template) =>
    template.pageType === "home"
      ? {
          ...template,
          sections: template.sections.map((section) => ({
            ...section,
            settings: {
              ...section.settings,
              ...(unifiedHomePresentationByType[
                section.type as keyof typeof unifiedHomePresentationByType
              ] ?? {}),
            },
          })),
        }
      : template,
  ),
} as const satisfies ThemePreset;
