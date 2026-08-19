import type {
  SectionDefinition,
  StorefrontThemeDescriptor,
  ThemeManifest,
} from "@shoppp/contracts";
import { coreBlockDefinitions, coreSectionDefinitions } from "../../theme-engine/core-manifest";
import { fashionStoreTemplatePageTypes } from "./page-contracts";

const text = (
  id: string,
  label: string,
  helpText: string,
  defaultValue: string,
  maxLength = 240,
) => ({
  default: defaultValue,
  helpText,
  id,
  kind: "text" as const,
  label,
  maxLength,
  required: false,
});

const boolean = (id: string, label: string, helpText: string, defaultValue: boolean) => ({
  default: defaultValue,
  helpText,
  id,
  kind: "boolean" as const,
  label,
  required: false,
});

const number = (
  id: string,
  label: string,
  helpText: string,
  defaultValue: number,
  min: number,
  max: number,
) => ({
  default: defaultValue,
  helpText,
  id,
  kind: "number" as const,
  label,
  max,
  min,
  required: false,
  step: 1,
});

const asset = (
  id: string,
  label: string,
  helpText: string,
  defaultValue: {
    alt: string;
    height: number;
    kind: "theme";
    path: string;
    width: number;
  },
) => ({
  default: defaultValue,
  helpText,
  id,
  kind: "asset" as const,
  label,
  required: false,
});

const reference = (
  kind:
    | "article-reference"
    | "collection-reference"
    | "page-reference"
    | "policy-reference"
    | "product-reference",
  id: string,
  label: string,
  helpText: string,
  required = false,
) => ({
  cardinality: "one" as const,
  helpText,
  id,
  kind,
  label,
  required,
});

const internalLink = (
  id: string,
  label: string,
  helpText: string,
  resourceKind: "article" | "collection" | "page" | "policy" | "product",
) => ({
  allowedTargets: [resourceKind],
  helpText,
  id,
  kind: "link" as const,
  label,
  required: false,
});

const externalLink = (id: string, label: string, helpText: string) => ({
  allowedTargets: ["external" as const],
  helpText,
  id,
  kind: "link" as const,
  label,
  required: false,
});

const logoAsset = {
  alt: "Fashion Store logo",
  height: 34,
  kind: "theme" as const,
  path: "assets/images/demo-fashion-store-logo-black.png",
  width: 155,
};

const editorialAsset = {
  alt: "Fashion Store editorial image",
  height: 1060,
  kind: "theme" as const,
  path: "assets/images/demo-fashion-store-slider-01.jpg",
  width: 1920,
};

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
  cart: [
    text(
      "help-copy",
      "Cart help copy",
      "Optional presentation guidance shown near the cart; totals and adjustments remain locked.",
      "Need help with your cart?",
    ),
    internalLink(
      "policy-link",
      "Cart policy link",
      "Choose an approved policy destination by stable ID.",
      "policy",
    ),
  ],
  checkout: [
    text(
      "help-copy",
      "Checkout help copy",
      "Optional guidance only; shipping, tax, payment, and order facts remain locked.",
      "Secure checkout",
    ),
    internalLink(
      "policy-link",
      "Checkout policy link",
      "Choose an approved policy destination by stable ID.",
      "policy",
    ),
  ],
  collection: [
    text(
      "intro-title",
      "Intro title",
      "Bounded heading for Shop and Collection.",
      "Shop the collection",
      120,
    ),
    text(
      "intro-copy",
      "Intro copy",
      "Bounded plain text for Shop and Collection.",
      "Discover the latest edit.",
      500,
    ),
    reference(
      "collection-reference",
      "default-collection",
      "Default collection",
      "Choose one collection by stable Commerce ID; membership and product facts stay locked.",
      true,
    ),
  ],
  content: [
    ...contentPages.flatMap(([key, heading, message]) => [
      text(`${key}.heading`, `${heading} title`, `Bounded heading for ${heading}.`, heading, 120),
      text(
        `${key}.message`,
        `${heading} copy`,
        `Bounded plain text for ${heading}.`,
        message,
        1_000,
      ),
    ]),
    asset("about.image", "About image", "Choose approved Catalog media for About.", editorialAsset),
    internalLink(
      "about.link",
      "About link",
      "Choose a typed internal destination for About.",
      "page",
    ),
    internalLink("faq.link", "FAQ link", "Choose a typed internal destination for FAQ.", "page"),
    asset(
      "contact.image",
      "Contact image",
      "Choose approved Catalog media for Contact.",
      editorialAsset,
    ),
    asset("faq.image", "FAQ image", "Choose approved Catalog media for FAQ.", editorialAsset),
    internalLink(
      "contact.link",
      "Contact link",
      "Choose a typed internal Contact destination.",
      "page",
    ),
    asset(
      "magazine.image",
      "Magazine image",
      "Choose approved Catalog media for Magazine.",
      editorialAsset,
    ),
    reference(
      "article-reference",
      "magazine.featured-article",
      "Featured article",
      "Choose one existing article by stable ID; this does not create article content.",
    ),
    text(
      "order.help-copy",
      "Order help copy",
      "Optional guidance near order status; order facts remain locked.",
      "Questions about this order?",
      500,
    ),
    internalLink(
      "order.policy-link",
      "Order policy link",
      "Choose an approved policy destination by stable ID.",
      "policy",
    ),
    text(
      "policy.help-copy",
      "Policy help copy",
      "Optional presentation guidance; the Catalog-owned policy body remains locked.",
      "Questions about this policy?",
      500,
    ),
    reference(
      "policy-reference",
      "policy.document",
      "Policy document",
      "Choose one approved Catalog policy by stable ID; policy text and legal approval remain locked.",
    ),
    internalLink(
      "policy.related-link",
      "Related policy link",
      "Choose another approved policy destination by stable ID.",
      "policy",
    ),
    {
      default: "standard",
      helpText: "Choose one approved content presentation style.",
      id: "content-style",
      kind: "select" as const,
      label: "Content style",
      options: [
        { label: "Standard", value: "standard" },
        { label: "Editorial", value: "editorial" },
      ],
      required: true,
    },
  ],
  home: [
    text(
      "announcement-text",
      "Announcement text",
      "Bounded global announcement copy.",
      "Free delivery on selected orders",
      160,
    ),
    internalLink(
      "announcement-link",
      "Announcement link",
      "Optional typed destination for the announcement.",
      "page",
    ),
    boolean(
      "announcement-visible",
      "Show announcement",
      "Controls only announcement visibility.",
      true,
    ),
    asset("header-logo", "Header logo", "Choose approved media for the Header logo.", logoAsset),
    text(
      "header-contact-copy",
      "Header contact copy",
      "Bounded Header contact presentation copy.",
      "How can we help?",
      240,
    ),
    externalLink(
      "header-social-link",
      "Header social link",
      "HTTPS only; credentials are never stored.",
    ),
    internalLink(
      "header-legal-link",
      "Header legal link",
      "Choose an approved policy destination by stable ID.",
      "policy",
    ),
    reference(
      "page-reference",
      "header-highlight-page",
      "Header highlight page",
      "Choose one internal page by stable ID.",
    ),
    asset("footer-logo", "Footer logo", "Choose approved media for the Footer logo.", logoAsset),
    text(
      "footer-contact-copy",
      "Footer contact copy",
      "Bounded Footer contact presentation copy.",
      "Stay in touch.",
      240,
    ),
    externalLink(
      "footer-social-link",
      "Footer social link",
      "HTTPS only; credentials are never stored.",
    ),
    internalLink(
      "footer-legal-link",
      "Footer legal link",
      "Choose an approved policy destination by stable ID.",
      "policy",
    ),
    text("hero-eyebrow", "Hero eyebrow", "Bounded Home hero eyebrow.", "New collection", 80),
    text("hero-title", "Hero title", "Bounded Home hero title.", "Fashion for every day", 120),
    text(
      "hero-body",
      "Hero body",
      "Bounded Home hero plain text.",
      "Explore the latest edit.",
      500,
    ),
    asset(
      "hero-image",
      "Hero image",
      "Choose approved Catalog media for the Home hero.",
      editorialAsset,
    ),
    internalLink(
      "hero-primary-link",
      "Hero primary link",
      "Choose a typed internal destination.",
      "collection",
    ),
    internalLink(
      "hero-secondary-link",
      "Hero secondary link",
      "Choose a second typed internal destination.",
      "page",
    ),
    text(
      "merchandising-title",
      "Merchandising title",
      "Bounded title for Home merchandising.",
      "Featured edit",
      120,
    ),
    reference(
      "collection-reference",
      "featured-collection",
      "Featured collection",
      "Choose one collection by stable Commerce ID.",
      true,
    ),
    reference(
      "product-reference",
      "featured-product",
      "Featured product",
      "Choose one product by stable Commerce ID; price and availability stay locked.",
    ),
    boolean(
      "merchandising-visible",
      "Show merchandising",
      "Controls only the merchandising section visibility.",
      true,
    ),
    number(
      "merchandising-order",
      "Merchandising order",
      "Sets bounded section order without changing layout rules.",
      1,
      1,
      12,
    ),
  ],
  product: [
    text(
      "presentation-copy",
      "Presentation copy",
      "Bounded product-page presentation copy.",
      "Designed for everyday wear.",
      500,
    ),
    reference(
      "collection-reference",
      "related-collection",
      "Related collection",
      "Choose one related collection by stable Commerce ID; product identity and variants stay locked.",
    ),
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
