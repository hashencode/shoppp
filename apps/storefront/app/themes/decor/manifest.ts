import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";

import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";

const decorSectionDefinitions = [
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["navigation.primary", "focus.skip-link"],
    settings: [],
    type: "decor.header",
  },
  {
    allowedBlockTypes: ["core.action", "core.text"],
    capabilities: [],
    settings: [
      {
        default: "Rooms made for real life.",
        id: "heading",
        kind: "text",
        maxLength: 160,
        required: true,
      },
      {
        default: "A layered fixture presentation shaped with native CSS.",
        id: "body",
        kind: "text",
        maxLength: 500,
        required: true,
      },
      {
        default: "clay",
        id: "palette",
        kind: "select",
        options: [
          { label: "Clay", value: "clay" },
          { label: "Sage", value: "sage" },
        ],
        required: true,
      },
    ],
    type: "decor.layered-hero",
  },
  {
    allowedBlockTypes: ["core.text"],
    capabilities: [],
    settings: [
      {
        default: "Form follows feeling.",
        id: "heading",
        kind: "text",
        maxLength: 160,
        required: true,
      },
      {
        default: "A quiet composition for fixture-backed editorial content.",
        id: "body",
        kind: "text",
        maxLength: 500,
        required: true,
      },
    ],
    type: "decor.feature",
  },
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["legal.links"],
    settings: [
      {
        default: "Private fixture preview · presentation only",
        id: "note",
        kind: "text",
        maxLength: 200,
        required: true,
      },
    ],
    type: "decor.footer",
  },
] satisfies SectionDefinition[];

export const decorManifest = {
  approvedRemoteMediaHosts: [],
  componentRegistry: {
    blocks: coreBlockDefinitions,
    sections: [...coreSectionDefinitions, ...decorSectionDefinitions],
  },
  configurationSchemaVersion: 1,
  designTokens: {
    "color-accent": "#d56f4b",
    "color-ink": "#18352f",
    "color-paper": "#f1e5d3",
    "color-surface": "#fbf5ea",
    "font-display": "Georgia, Times New Roman, serif",
    "font-ui": "Inter, ui-sans-serif, system-ui, sans-serif",
    "radius-card": "0.25rem",
    "space-section": "clamp(4rem, 8vw, 8rem)",
  },
  id: "decor",
  platformCompatibility: {
    maxExclusive: "2.0.0",
    min: "1.0.0",
  },
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "shoppp-theme-team",
    license: "Repository-owned original implementation",
    source: "internal://shoppp/themes/decor",
  },
  supportedPageTemplates: ["home", "collection", "product", "cart", "checkout", "order", "policy"],
  themeVersion: "1.0.0",
} as const satisfies ThemeManifest;

export const decorThemeDescriptor = {
  configurationSchemaVersion: decorManifest.configurationSchemaVersion,
  id: decorManifest.id,
  platformCompatibility: decorManifest.platformCompatibility,
  platformContractVersion: decorManifest.platformContractVersion,
  presets: ["layered"],
  supportedPageTemplates: decorManifest.supportedPageTemplates,
  themeVersion: decorManifest.themeVersion,
} as const satisfies StorefrontThemeDescriptor;
