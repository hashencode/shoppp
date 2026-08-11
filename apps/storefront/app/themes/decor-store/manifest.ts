import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";

import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";

const decorStoreSectionDefinitions = [
  {
    allowedBlockTypes: [],
    capabilities: [],
    settings: [],
    type: "decor-store.home",
  },
] satisfies SectionDefinition[];

export const decorStoreManifest = {
  approvedRemoteMediaHosts: [],
  componentRegistry: {
    blocks: coreBlockDefinitions,
    sections: [...coreSectionDefinitions, ...decorStoreSectionDefinitions],
  },
  configurationSchemaVersion: 1,
  designTokens: {
    "color-accent": "#b78052",
    "color-ink": "#262b35",
    "color-paper": "#ffffff",
    "color-surface": "#f8f6f3",
    "font-display": "Plus Jakarta Sans, sans-serif",
    "font-ui": "Plus Jakarta Sans, sans-serif",
    "radius-card": "0",
    "space-section": "0",
  },
  id: "decor-store",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-08-10T00:00:00.000Z",
    approvedBy: "shoppp-theme-team",
    license: "User-authorized source-parity implementation",
    source: "local://user-supplied/demo-decor-store.html",
  },
  supportedPageTemplates: ["home"],
  themeVersion: "1.0.0",
} as const satisfies ThemeManifest;

export const decorStoreThemeDescriptor = {
  configurationSchemaVersion: decorStoreManifest.configurationSchemaVersion,
  id: decorStoreManifest.id,
  platformCompatibility: decorStoreManifest.platformCompatibility,
  platformContractVersion: decorStoreManifest.platformContractVersion,
  presets: ["source-parity"],
  supportedPageTemplates: [...decorStoreManifest.supportedPageTemplates],
  themeVersion: decorStoreManifest.themeVersion,
} as const satisfies StorefrontThemeDescriptor;
