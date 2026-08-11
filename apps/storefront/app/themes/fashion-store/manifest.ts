import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";
import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";
import { fashionStoreTemplatePageTypes } from "./page-contracts";

const text = (id: string, defaultValue: string, maxLength = 240) => ({
  default: defaultValue,
  id,
  kind: "text" as const,
  maxLength,
  required: false,
});

const reference = (kind: "collection-reference" | "product-reference", id: string) => ({
  id,
  kind,
  required: true,
});

const contentPages = [
  ["wishlist", "Wishlist", "Saved wishlists are not available yet."],
  ["account", "Account unavailable", "Customer accounts are not available yet."],
  ["magazine", "Magazine", "Stories from the latest collection."],
  ["magazine.marketing-tips-and-tricks", "Marketing tips and tricks", "Editorial story."],
  ["about", "About us", "Learn more about this store."],
  ["faq", "Frequently asked questions", "Helpful answers from our team."],
  ["contact", "Contact information", "Merchant contact details will appear here."],
] as const;

const settingsByPageType = {
  cart: [text("help-copy", "Need help with your cart?")],
  checkout: [text("help-copy", "Secure checkout")],
  collection: [
    text("intro-title", "Shop the collection"),
    text("intro-copy", "Discover the latest edit."),
    reference("collection-reference", "featured-collection"),
  ],
  content: [
    ...contentPages.flatMap(([key, heading, message]) => [
      text(`${key}.heading`, heading, 120),
      text(`${key}.message`, message, 1_000),
    ]),
    {
      default: {
        alt: "Fashion Store logo",
        height: 56,
        kind: "theme" as const,
        path: "assets/images/fashion-store-logo.svg",
        width: 180,
      },
      id: "brand-logo",
      kind: "asset" as const,
      required: false,
    },
    {
      default: { kind: "route" as const, path: "/policies/privacy" },
      id: "legal-link",
      kind: "link" as const,
      required: false,
    },
    {
      default: "standard",
      id: "content-style",
      kind: "select" as const,
      options: [
        { label: "Standard", value: "standard" },
        { label: "Editorial", value: "editorial" },
      ],
      required: true,
    },
  ],
  home: [
    text("hero-eyebrow", "New collection", 80),
    text("hero-title", "Fashion for every day", 120),
    text("hero-body", "Explore the latest edit.", 500),
    reference("collection-reference", "featured-collection"),
  ],
  product: [
    text("presentation-copy", "Designed for everyday wear.", 500),
    reference("product-reference", "featured-product"),
  ],
} satisfies Record<(typeof fashionStoreTemplatePageTypes)[number], SectionDefinition["settings"]>;

const fashionStoreSectionDefinitions = [
  ...fashionStoreTemplatePageTypes.map((pageType) => ({
    allowedBlockTypes: [],
    capabilities: [],
    settings: settingsByPageType[pageType],
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
