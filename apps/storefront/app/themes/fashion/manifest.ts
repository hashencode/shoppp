import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";

import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";

const fashionSectionDefinitions = [
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["navigation.primary", "focus.skip-link"],
    settings: [],
    type: "fashion.masthead",
  },
  {
    allowedBlockTypes: ["core.action", "core.text"],
    capabilities: [],
    settings: [
      {
        default: "Objects with a point of view.",
        id: "heading",
        kind: "text",
        maxLength: 160,
        required: true,
      },
      {
        default: "A fixture-backed editorial storefront presentation.",
        id: "body",
        kind: "text",
        maxLength: 500,
        required: true,
      },
      {
        default: "left",
        id: "alignment",
        kind: "select",
        options: [
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
        ],
        required: true,
      },
    ],
    type: "fashion.editorial-hero",
  },
  {
    allowedBlockTypes: ["core.text"],
    capabilities: [],
    settings: [
      {
        default: "Material, form, and restraint.",
        id: "heading",
        kind: "text",
        maxLength: 160,
        required: true,
      },
      {
        default: "An optional editorial chapter controlled by a stable instance ID.",
        id: "body",
        kind: "text",
        maxLength: 500,
        required: true,
      },
    ],
    type: "fashion.story",
  },
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["legal.links"],
    settings: [
      {
        default: "Private fixture preview · no live commerce activity",
        id: "note",
        kind: "text",
        maxLength: 200,
        required: true,
      },
    ],
    type: "fashion.footer",
  },
] satisfies SectionDefinition[];

export const fashionManifest = {
  approvedRemoteMediaHosts: [],
  componentRegistry: {
    blocks: coreBlockDefinitions,
    sections: [...coreSectionDefinitions, ...fashionSectionDefinitions],
  },
  configurationSchemaVersion: 1,
  designTokens: {
    "color-accent": "#d8ff3e",
    "color-ink": "#171713",
    "color-paper": "#f2eee6",
    "color-surface": "#fffdf7",
    "font-display": "Georgia, Times New Roman, serif",
    "font-ui": "Inter, ui-sans-serif, system-ui, sans-serif",
    "radius-card": "1.5rem",
    "space-section": "clamp(4rem, 9vw, 9rem)",
  },
  id: "fashion",
  platformCompatibility: {
    maxExclusive: "2.0.0",
    min: "1.0.0",
  },
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "shoppp-theme-team",
    license: "Repository-owned original implementation",
    source: "internal://shoppp/themes/fashion",
  },
  supportedPageTemplates: ["home", "collection", "product", "cart", "checkout", "order", "policy"],
  themeVersion: "1.0.0",
} as const satisfies ThemeManifest;

export const fashionThemeDescriptor = {
  configurationSchemaVersion: fashionManifest.configurationSchemaVersion,
  id: fashionManifest.id,
  platformCompatibility: fashionManifest.platformCompatibility,
  platformContractVersion: fashionManifest.platformContractVersion,
  presets: ["editorial"],
  supportedPageTemplates: fashionManifest.supportedPageTemplates,
  themeVersion: fashionManifest.themeVersion,
} as const satisfies StorefrontThemeDescriptor;
