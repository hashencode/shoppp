import type {
  BlockDefinition,
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";

import { fashionStoreManifest as inheritedManifest } from "../manifest";
import { fashionStoreHomeSectionTypes } from "./composition";

const inheritedHome = inheritedManifest.componentRegistry.sections.find(
  ({ type }) => type === "fashion-store.home",
)!;
export const successorHomeSettings = [
  ...inheritedHome.settings.filter(
    ({ id }) =>
      id !== "merchandising-order" &&
      id !== "merchandising-visible" &&
      id !== "header-logo" &&
      id !== "footer-logo",
  ),
  {
    default: "primary",
    helpText:
      "Select a named Logo variant owned by Store Identity; the Theme stores no Logo media.",
    id: "identity-logo-variant",
    kind: "select" as const,
    label: "Logo variant",
    options: ["primary", "light", "dark", "compact"].map((value) => ({ label: value, value })),
    required: true,
  },
  {
    default: 140,
    helpText: "Control Logo presentation width without changing its shared source.",
    id: "identity-logo-width",
    kind: "number" as const,
    label: "Logo width",
    max: 320,
    min: 48,
    required: true,
    step: 1,
  },
  {
    default: "center",
    helpText: "Choose the Theme-owned Logo placement.",
    id: "identity-logo-placement",
    kind: "select" as const,
    label: "Logo placement",
    options: ["start", "center", "end"].map((value) => ({ label: value, value })),
    required: true,
  },
  {
    default: 0,
    helpText: "Add bounded spacing around the shared Logo.",
    id: "identity-logo-spacing",
    kind: "number" as const,
    label: "Logo spacing",
    max: 80,
    min: 0,
    required: true,
    step: 1,
  },
  {
    default: true,
    helpText: "Show the shared Logo in this Theme.",
    id: "identity-logo-visible",
    kind: "boolean" as const,
    label: "Show Logo",
    required: true,
  },
  {
    default: true,
    helpText: "Show the same shared Logo variant on mobile.",
    id: "identity-logo-mobile-visible",
    kind: "boolean" as const,
    label: "Show Logo on mobile",
    required: true,
  },
] satisfies SectionDefinition["settings"];
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
const requiredText = (id: string, label: string, defaultValue: string, maxLength = 160) => ({
  default: defaultValue,
  helpText: "Bounded merchant-authored presentation copy.",
  id,
  kind: "text" as const,
  label,
  maxLength,
  required: true,
});
const themeMedia = (path: string, alt: string) => ({
  alt,
  height: 900,
  kind: "theme" as const,
  path,
  width: 900,
});
const themeAsset = (
  id: string,
  label: string,
  path: string,
  alt: string,
  paths: readonly string[] = [path],
) => ({
  default: themeMedia(path, alt),
  helpText: "Theme-owned marketing media from the approved Fashion package.",
  id,
  kind: "asset" as const,
  label,
  required: true,
  themeOptions: paths.map((optionPath, index) => ({
    label: `${label} ${index + 1}`,
    value: themeMedia(optionPath, optionPath === path ? alt : `${alt} ${index + 1}`),
  })),
});
const variant = (values: readonly string[]) => ({
  default: values[0]!,
  helpText: "Select the bounded Fashion presentation variant.",
  id: "variant",
  kind: "select" as const,
  label: "Variant",
  options: values.map((value) => ({ label: value, value })),
  required: true,
});
const resourceReference = (
  id: string,
  label: string,
  kind: "article-reference" | "collection-reference",
) => ({
  helpText: "Select a stable resource from the exact candidate Release.",
  id,
  kind,
  label,
  required: false,
});

export const fashionStoreBlockDefinitions = [
  {
    capabilities: [],
    settings: [
      requiredText("title", "Title", "Featured style"),
      requiredText("price", "Price copy", "$189.00", 40),
      themeAsset(
        "pattern-desktop",
        "Desktop pattern",
        "assets/hero/fashion-store-decor-hero-03-pattern-desktop.jpg",
        "Hero desktop pattern",
        [1, 2, 3].map(
          (index) => `assets/hero/fashion-store-decor-hero-0${index}-pattern-desktop.jpg`,
        ),
      ),
      themeAsset(
        "pattern-mobile",
        "Mobile pattern",
        "assets/hero/fashion-store-decor-hero-03-pattern-mobile.jpg",
        "Hero mobile pattern",
        [1, 2, 3].map(
          (index) => `assets/hero/fashion-store-decor-hero-0${index}-pattern-mobile.jpg`,
        ),
      ),
      themeAsset(
        "product-image",
        "Product image",
        "assets/hero/fashion-store-decor-hero-03-product.png",
        "Hero product",
        [1, 2, 3].map((index) => `assets/hero/fashion-store-decor-hero-0${index}-product.png`),
      ),
      themeAsset(
        "thumbnail",
        "Thumbnail",
        "assets/hero/fashion-store-decor-hero-03-thumb.jpg",
        "Hero thumbnail",
        [1, 2, 3].map((index) => `assets/hero/fashion-store-decor-hero-0${index}-thumb.jpg`),
      ),
      {
        default: "aqua",
        helpText: "Choose a bounded Hero background color.",
        id: "background-color",
        kind: "select" as const,
        label: "Background color",
        options: ["mist", "peach", "aqua"].map((value) => ({ label: value, value })),
        required: true,
      },
      {
        default: "black",
        helpText: "Choose a bounded readable Hero foreground color.",
        id: "foreground-color",
        kind: "select" as const,
        label: "Foreground color",
        options: ["ink", "black", "white"].map((value) => ({ label: value, value })),
        required: true,
      },
      resourceReference("destination", "Destination", "collection-reference"),
    ],
    type: "fashion-store.hero-slide",
  },
  {
    capabilities: [],
    settings: [
      requiredText("title", "Title", "Service"),
      requiredText("description", "Description", "Service description"),
      variant(["package", "credit-card", "refresh-cw", "phone"]),
    ],
    type: "fashion-store.service",
  },
  {
    capabilities: [],
    settings: [
      requiredText("name", "Name", "Category"),
      themeAsset(
        "image",
        "Image",
        "assets/images/demo-fashion-store-banner-01.jpg",
        "Category",
        [1, 2, 3, 4].map((index) => `assets/images/demo-fashion-store-banner-0${index}.jpg`),
      ),
      resourceReference("collection", "Collection", "collection-reference"),
    ],
    type: "fashion-store.category",
  },
  {
    capabilities: [],
    settings: [
      requiredText("message", "Message", "New-season pieces are available now."),
      requiredText("label", "Link label", "Shop the collection", 80),
      resourceReference("collection", "Collection", "collection-reference"),
    ],
    type: "fashion-store.promotion-item",
  },
  {
    capabilities: [],
    settings: [
      requiredText("name", "Brand name", "Brand"),
      themeAsset(
        "image",
        "Logo",
        "assets/images/logo-asos.svg",
        "Brand",
        ["asos", "chanel", "gucci", "celine", "adidas"].map(
          (name) => `assets/images/logo-${name}.svg`,
        ),
      ),
    ],
    type: "fashion-store.brand",
  },
  {
    capabilities: [],
    settings: [requiredText("message", "Message", "New arrivals")],
    type: "fashion-store.marquee-item",
  },
  {
    capabilities: [],
    settings: [
      requiredText("title", "Title", "Editorial story"),
      themeAsset(
        "image",
        "Image",
        "assets/images/demo-fashion-store-blog-01.jpg",
        "Editorial story",
        [1, 2, 6, 7].map((index) => `assets/images/demo-fashion-store-blog-0${index}.jpg`),
      ),
      resourceReference("article", "Article", "article-reference"),
    ],
    type: "fashion-store.editorial-card",
  },
] satisfies BlockDefinition[];

const blockPolicyBySectionType: Readonly<
  Record<string, { blockType: string; min: number; max: number }>
> = {
  "fashion-store.hero": { blockType: "fashion-store.hero-slide", min: 1, max: 5 },
  "fashion-store.services": { blockType: "fashion-store.service", min: 0, max: 4 },
  "fashion-store.categories": { blockType: "fashion-store.category", min: 0, max: 6 },
  "fashion-store.promotion": { blockType: "fashion-store.promotion-item", min: 0, max: 1 },
  "fashion-store.brand-strip": { blockType: "fashion-store.brand", min: 0, max: 8 },
  "fashion-store.marquee": { blockType: "fashion-store.marquee-item", min: 0, max: 12 },
  "fashion-store.editorial": { blockType: "fashion-store.editorial-card", min: 0, max: 4 },
};
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
    blocks: [...inheritedManifest.componentRegistry.blocks, ...fashionStoreBlockDefinitions],
    sections: [
      ...inheritedManifest.componentRegistry.sections.filter(
        ({ type }) => type !== "fashion-store.home",
      ),
      ...fashionStoreHomeSectionTypes.map((type) => ({
        ...inheritedHome,
        allowedBlockTypes: blockPolicyBySectionType[type]
          ? [blockPolicyBySectionType[type]!.blockType]
          : [],
        blockRules: blockPolicyBySectionType[type] ? [blockPolicyBySectionType[type]!] : [],
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
