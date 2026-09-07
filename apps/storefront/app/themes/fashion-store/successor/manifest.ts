import type { StorefrontThemeDescriptor, ThemeManifest } from "@shoppp/contracts";

import { fashionStoreManifest as inheritedManifest } from "../manifest";
import { fashionStoreHomeSectionTypes } from "./composition";

const inheritedHome = inheritedManifest.componentRegistry.sections.find(
  ({ type }) => type === "fashion-store.home",
)!;
const successorHomeSettings = inheritedHome.settings.filter(
  ({ id }) => id !== "merchandising-order",
);
export const fashionStoreManifest = {
  ...inheritedManifest,
  componentRegistry: {
    ...inheritedManifest.componentRegistry,
    sections: [
      ...inheritedManifest.componentRegistry.sections.filter(
        ({ type }) => type !== "fashion-store.home",
      ),
      ...fashionStoreHomeSectionTypes.map((type) => ({
        ...inheritedHome,
        settings: type === "fashion-store.hero" ? successorHomeSettings : [],
        type,
      })),
    ],
  },
} as const satisfies ThemeManifest;

export const fashionStoreThemeDescriptor = {
  configurationSchemaVersion: fashionStoreManifest.configurationSchemaVersion,
  id: fashionStoreManifest.id,
  platformCompatibility: fashionStoreManifest.platformCompatibility,
  platformContractVersion: fashionStoreManifest.platformContractVersion,
  presets: ["source-parity"],
  supportedPageTemplates: [...fashionStoreManifest.supportedPageTemplates],
  themeVersion: fashionStoreManifest.themeVersion,
} as const satisfies StorefrontThemeDescriptor;
