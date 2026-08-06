import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";
import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";

const fashion2SectionDefinitions = [
  {
    allowedBlockTypes: [],
    capabilities: [],
    settings: [],
    type: "fashion-2.home",
  },
] satisfies SectionDefinition[];

export const fashion2Manifest = {
  approvedRemoteMediaHosts: [],
  componentRegistry: {
    blocks: coreBlockDefinitions,
    sections: [...coreSectionDefinitions, ...fashion2SectionDefinitions],
  },
  configurationSchemaVersion: 1,
  designTokens: {
    "color-accent": "#000000",
    "color-ink": "#232323",
    "color-paper": "#ffffff",
    "color-surface": "#ffffff",
    "font-display": "Arial, sans-serif",
    "font-ui": "Arial, sans-serif",
    "radius-card": "0",
    "space-section": "0",
  },
  id: "fashion-2",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-08-06T00:00:00.000Z",
    approvedBy: "shoppp-theme-team",
    license: "User-authorized source-parity implementation",
    source: "local://user-supplied/demo-fashion-store.html",
  },
  supportedPageTemplates: ["home"],
  themeVersion: "1.0.0",
} as const satisfies ThemeManifest;

export const fashion2ThemeDescriptor = {
  configurationSchemaVersion: fashion2Manifest.configurationSchemaVersion,
  id: fashion2Manifest.id,
  platformCompatibility: fashion2Manifest.platformCompatibility,
  platformContractVersion: fashion2Manifest.platformContractVersion,
  presets: ["source-parity"],
  supportedPageTemplates: fashion2Manifest.supportedPageTemplates,
  themeVersion: fashion2Manifest.themeVersion,
} as const satisfies StorefrontThemeDescriptor;
