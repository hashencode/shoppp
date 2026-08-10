import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";
import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";
import { fashionStoreTemplatePageTypes } from "./page-contracts";

const fashionStoreSectionDefinitions = [
  ...fashionStoreTemplatePageTypes.map((pageType) => ({
    allowedBlockTypes: [],
    capabilities: [],
    settings: [],
    type: `fashion-store.${pageType}`,
  })),
] satisfies SectionDefinition[];

export const fashionStoreManifest = {
  approvedRemoteMediaHosts: [],
  componentRegistry: {
    blocks: coreBlockDefinitions,
    sections: [...coreSectionDefinitions, ...fashionStoreSectionDefinitions],
  },
  configurationSchemaVersion: 1,
  designTokens: {
    "color-accent": "#000000",
    "color-ink": "#232323",
    "color-paper": "#ffffff",
    "color-surface": "#ffffff",
    "font-display": "Outfit, sans-serif",
    "font-ui": "Figtree, sans-serif",
    "radius-card": "0",
    "space-section": "0",
  },
  id: "fashion-store",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-08-06T00:00:00.000Z",
    approvedBy: "shoppp-theme-team",
    license: "User-authorized source-parity implementation",
    source: "local://user-supplied/demo-fashion-store.html",
  },
  supportedPageTemplates: [...fashionStoreTemplatePageTypes],
  themeVersion: "1.0.0",
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
