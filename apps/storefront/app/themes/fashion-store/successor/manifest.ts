import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";

import { fashionStoreManifest as inheritedManifest } from "../manifest";
import { fashionStoreHomeSectionTypes } from "./composition";

const inheritedHome = inheritedManifest.componentRegistry.sections.find(
  ({ type }) => type === "fashion-store.home",
)!;
const successorHomeSettings = inheritedHome.settings.filter(
  ({ id }) => id !== "merchandising-order" && id !== "merchandising-visible",
);
const presentationSetting = (
  id: string,
  label: string,
  decorLabel: string,
  decorValue: string,
) => ({
  default: "source",
  helpText:
    "Choose a bounded Fashion-owned presentation without changing content or Commerce truth.",
  id,
  kind: "select" as const,
  label,
  options: [
    { label: "Fashion source parity", value: "source" },
    { label: decorLabel, value: decorValue },
  ],
  required: true,
});
const boundedText = (id: string, label: string, defaultValue: string) => ({
  default: defaultValue,
  helpText: "Bounded presentation copy; product membership and facts remain Catalog-owned.",
  id,
  kind: "text" as const,
  label,
  maxLength: 80,
  required: false,
});
export const homeSettingsByType = {
  "fashion-store.brand-strip": [
    presentationSetting(
      "brand-strip-presentation",
      "Brand strip presentation",
      "Continuous brand strip",
      "decor-continuous",
    ),
  ],
  "fashion-store.categories": [
    presentationSetting(
      "categories-presentation",
      "Category presentation",
      "Icon categories",
      "decor-icons",
    ),
  ],
  "fashion-store.collection-feature": [
    presentationSetting(
      "collection-presentation",
      "Collection presentation",
      "Layered collection",
      "decor-layered",
    ),
  ],
  "fashion-store.editorial": [
    presentationSetting(
      "editorial-presentation",
      "Editorial presentation",
      "Journal cards",
      "decor-journal",
    ),
  ],
  "fashion-store.marquee": [
    presentationSetting(
      "marquee-presentation",
      "Marquee presentation",
      "Reverse marquee",
      "decor-reverse",
    ),
  ],
  "fashion-store.product-merchandising": [
    boundedText("merchandising-heading", "Section heading", "Product groups"),
    boundedText("new-arrivals-label", "New arrivals label", "New arrivals"),
    boundedText("best-sellers-label", "Best sellers label", "Best sellers"),
    boundedText("featured-label", "Featured label", "Featured"),
  ],
  "fashion-store.services": [
    presentationSetting(
      "services-presentation",
      "Services presentation",
      "Compact services",
      "decor-compact",
    ),
  ],
} satisfies Readonly<Record<string, SectionDefinition["settings"]>>;
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
        settings:
          type === "fashion-store.hero"
            ? successorHomeSettings
            : (homeSettingsByType[type as keyof typeof homeSettingsByType] ?? []),
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
  presets: ["source-parity", "unified-store"],
  supportedPageTemplates: [...fashionStoreManifest.supportedPageTemplates],
  themeVersion: fashionStoreManifest.themeVersion,
} as const satisfies StorefrontThemeDescriptor;
