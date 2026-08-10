import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";
import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";

const visualTypes = [
  "fashion.hero-carousel",
  "fashion.service-strip",
  "fashion.category-tiles",
  "fashion.product-showcase",
  "fashion.promo-band",
  "fashion.collection-carousel",
  "fashion.brand-strip",
  "fashion.promise-strip",
  "fashion.magazine",
  "fashion.shop",
  "fashion.content-page",
] as const;

const fashionSectionDefinitions = [
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["navigation.primary", "focus.skip-link"],
    settings: [],
    type: "fashion.header",
  },
  ...visualTypes.map((type) => ({
    allowedBlockTypes: [],
    capabilities: [],
    settings: [],
    type,
  })),
  {
    allowedBlockTypes: [],
    capabilities: ["product.details", "product.action"],
    settings: [],
    type: "fashion.product-details",
  },
  {
    allowedBlockTypes: [],
    capabilities: ["cart.summary", "cart.error"],
    settings: [],
    type: "fashion.cart",
  },
  {
    allowedBlockTypes: [],
    capabilities: ["checkout.summary", "checkout.error"],
    settings: [],
    type: "fashion.checkout",
  },
  {
    allowedBlockTypes: ["core.link"],
    capabilities: ["legal.links"],
    settings: [],
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
    "color-accent": "#ffdf00",
    "color-ink": "#1c1c1c",
    "color-paper": "#f4f4f2",
    "color-surface": "#ffffff",
    "font-display": "Outfit, sans-serif",
    "font-ui": "Figtree, sans-serif",
    "radius-card": "0",
    "space-section": "clamp(4rem, 8vw, 8rem)",
  },
  id: "fashion",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "shoppp-theme-team",
    license: "Repository implementation with user-authorized reference assets",
    source: "local://user-supplied/demo-fashion-store.html",
  },
  supportedPageTemplates: [
    "home",
    "collection",
    "product",
    "cart",
    "checkout",
    "order",
    "policy",
    "content",
  ],
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
