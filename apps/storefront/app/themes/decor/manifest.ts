import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";
import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";

const visualTypes = [
  "decor.hero-carousel",
  "decor.category-showcase",
  "decor.product-tabs",
  "decor.marquee",
  "decor.collection-feature",
  "decor.client-strip",
  "decor.journal",
  "decor.service-strip",
] as const;

const decorSectionDefinitions = [
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["navigation.primary", "focus.skip-link"],
    settings: [],
    type: "decor.header",
  },
  ...visualTypes.map((type) => ({ allowedBlockTypes: [], capabilities: [], settings: [], type })),
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["legal.links"],
    settings: [],
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
    "color-accent": "#1b63a9",
    "color-ink": "#102238",
    "color-paper": "#eaf3f7",
    "color-surface": "#ffffff",
    "font-display": "Plus Jakarta Sans, sans-serif",
    "font-ui": "Plus Jakarta Sans, sans-serif",
    "radius-card": "0",
    "space-section": "clamp(4rem, 8vw, 8rem)",
  },
  id: "decor",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "shoppp-theme-team",
    license: "Repository implementation with user-authorized reference assets",
    source: "local://user-supplied/demo-decor-store.html",
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
