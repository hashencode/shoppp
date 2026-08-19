import type { ThemeAcceptanceMode } from "../../../e2e/support/theme-behavior-contract";

export interface DecorStoreSourceItemInventory {
  count: number;
  id: string;
  selector: string;
  sourcePattern: RegExp;
}

export interface DecorStoreSourceRegion {
  inventorySelector: string;
  itemInventories: readonly DecorStoreSourceItemInventory[];
  key: string;
  selector: string;
  sourceAnchor: string;
  sourceLines: `${number}-${number}`;
}

export const decorStoreCanonicalViewports = [
  { height: 1_000, id: "desktop", width: 1_440 },
  { height: 900, id: "laptop", width: 1_024 },
  { height: 1_024, id: "tablet", width: 768 },
  { height: 844, id: "mobile", width: 390 },
] as const;

export const decorStoreSecondarySourceRegions = [{ id: "page", selector: "body" }] as const;

export interface DecorStorePlaceholderAdaptation {
  claimExclusion: "image-content";
  localAsset: "decor-store.images-decor-store-placeholder";
  sourceDimensions: `${number}x${number}`;
}

export interface DecorStoreSecondaryPageSourceContract {
  buttonCount: number;
  comparisonViewports: readonly [1440, 1024, 768, 390];
  formCount: number;
  id:
    | "shop-left"
    | "shop-none"
    | "shop-right"
    | "collection"
    | "product"
    | "wishlist"
    | "cart"
    | "checkout"
    | "account"
    | "blog"
    | "article"
    | "about"
    | "faq"
    | "contact";
  inputCount: number;
  interactions: readonly string[];
  placeholderAdaptations: readonly DecorStorePlaceholderAdaptation[];
  regions: readonly string[];
  sectionCount: number;
  sourceEntry: `demo-decor-store-${string}.html`;
}

const sharedSecondaryInteractions = [
  "header-navigation",
  "mobile-navigation",
  "search-overlay",
  "mini-cart-overlay",
  "cookie-dismissal",
  "scroll-progress",
] as const;

const placeholderAdaptations = (
  dimensions: readonly `${number}x${number}`[],
): readonly DecorStorePlaceholderAdaptation[] =>
  dimensions.map((sourceDimensions) => ({
    claimExclusion: "image-content",
    localAsset: "decor-store.images-decor-store-placeholder",
    sourceDimensions,
  }));

const secondaryPageSourceContract = (
  value: Omit<
    DecorStoreSecondaryPageSourceContract,
    "comparisonViewports" | "interactions" | "placeholderAdaptations"
  > & {
    interactions: readonly string[];
    placeholderDimensions: readonly `${number}x${number}`[];
  },
): DecorStoreSecondaryPageSourceContract => ({
  ...value,
  comparisonViewports: [1440, 1024, 768, 390],
  interactions: [...sharedSecondaryInteractions, ...value.interactions],
  placeholderAdaptations: placeholderAdaptations(value.placeholderDimensions),
});

const shellPlaceholderDimensions = ["170x165", "55x20", "580x175", "580x240", "600x700"] as const;

export const decorStoreSecondaryPageSourceContracts = [
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 2,
    id: "shop-left",
    inputCount: 3,
    interactions: ["filter-accordion", "sort", "pagination", "product-card-hover"],
    placeholderDimensions: [...shellPlaceholderDimensions, "30x30"],
    regions: ["shell-header", "page-title", "filter-sidebar", "product-grid", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-shop.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 2,
    id: "shop-none",
    inputCount: 3,
    interactions: ["sort", "pagination", "product-card-hover"],
    placeholderDimensions: shellPlaceholderDimensions,
    regions: ["shell-header", "page-title", "product-grid", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-no-sidebar.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 2,
    id: "shop-right",
    inputCount: 3,
    interactions: ["filter-accordion", "sort", "pagination", "product-card-hover"],
    placeholderDimensions: [...shellPlaceholderDimensions, "30x30"],
    regions: ["shell-header", "page-title", "product-grid", "filter-sidebar", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-right-sidebar.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 2,
    id: "collection",
    inputCount: 3,
    interactions: ["collection-card-hover"],
    placeholderDimensions: [...shellPlaceholderDimensions, "600x585"],
    regions: ["shell-header", "page-title", "collection-grid", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-collections.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 7,
    formCount: 3,
    id: "product",
    inputCount: 12,
    interactions: [
      "product-gallery",
      "product-options",
      "quantity",
      "product-tabs",
      "wishlist-toggle",
      "review-form-inert",
    ],
    placeholderDimensions: [
      ...shellPlaceholderDimensions,
      "1045x489",
      "1190x500",
      "140x140",
      "200x200",
      "500x570",
      "600x650",
      "682x480",
    ],
    regions: [
      "shell-header",
      "product-gallery",
      "product-summary",
      "product-tabs",
      "related-products",
      "shell-footer",
    ],
    sectionCount: 4,
    sourceEntry: "demo-decor-store-single-product.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 2,
    id: "wishlist",
    inputCount: 3,
    interactions: ["wishlist-remove", "wishlist-product-navigation"],
    placeholderDimensions: shellPlaceholderDimensions,
    regions: ["shell-header", "page-title", "wishlist-table", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-wishlist.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 10,
    formCount: 2,
    id: "cart",
    inputCount: 12,
    interactions: ["cart-quantity", "cart-remove", "coupon-form-inert", "checkout-navigation"],
    placeholderDimensions: shellPlaceholderDimensions,
    regions: ["shell-header", "page-title", "cart-table", "cart-summary", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-cart.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 3,
    id: "checkout",
    inputCount: 31,
    interactions: ["login-panel", "coupon-panel", "billing-fields-inert", "payment-options-inert"],
    placeholderDimensions: shellPlaceholderDimensions,
    regions: ["shell-header", "page-title", "billing", "order-summary", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-checkout.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 6,
    formCount: 4,
    id: "account",
    inputCount: 11,
    interactions: ["account-tabs", "login-form-inert", "register-form-inert"],
    placeholderDimensions: shellPlaceholderDimensions,
    regions: ["shell-header", "page-title", "account-tabs", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-account.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 2,
    id: "blog",
    inputCount: 3,
    interactions: ["article-navigation", "blog-pagination"],
    placeholderDimensions: [...shellPlaceholderDimensions, "600x445"],
    regions: ["shell-header", "page-title", "article-grid", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-blog.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 5,
    formCount: 3,
    id: "article",
    inputCount: 6,
    interactions: ["share-links", "comment-form-inert"],
    placeholderDimensions: [
      ...shellPlaceholderDimensions,
      "1190x700",
      "125x125",
      "130x130",
      "600x445",
      "750x950",
    ],
    regions: ["shell-header", "article-hero", "article-body", "author", "comments", "shell-footer"],
    sectionCount: 10,
    sourceEntry: "demo-decor-store-blog-single-classic.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 2,
    id: "about",
    inputCount: 3,
    interactions: ["about-carousel"],
    placeholderDimensions: [
      ...shellPlaceholderDimensions,
      "1000x611",
      "164x164",
      "1920x1100",
      "195x50",
      "500x610",
      "600x756",
    ],
    regions: ["shell-header", "page-title", "story", "carousel", "clients", "shell-footer"],
    sectionCount: 5,
    sourceEntry: "demo-decor-store-about.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 4,
    formCount: 2,
    id: "faq",
    inputCount: 3,
    interactions: ["faq-accordion"],
    placeholderDimensions: shellPlaceholderDimensions,
    regions: ["shell-header", "page-title", "faq-accordion", "shell-footer"],
    sectionCount: 2,
    sourceEntry: "demo-decor-store-faq.html",
  }),
  secondaryPageSourceContract({
    buttonCount: 5,
    formCount: 3,
    id: "contact",
    inputCount: 6,
    interactions: ["contact-form-inert", "map-static"],
    placeholderDimensions: [...shellPlaceholderDimensions, "1000x560"],
    regions: [
      "shell-header",
      "page-title",
      "contact-details",
      "contact-form",
      "map",
      "shell-footer",
    ],
    sectionCount: 4,
    sourceEntry: "demo-decor-store-contact.html",
  }),
] as const satisfies readonly DecorStoreSecondaryPageSourceContract[];

export const decorStoreAcceptanceModes = [
  "static",
  "temporal",
  "interaction",
  "scroll-fixed",
  "fallback",
] as const satisfies readonly ThemeAcceptanceMode[];

export const decorStoreSourceRegions = [
  {
    inventorySelector: "header.header-with-topbar",
    itemInventories: [
      {
        count: 1,
        id: "desktop-navigation",
        selector: "#navbarNav",
        sourcePattern: /id="navbarNav"/g,
      },
      {
        count: 1,
        id: "mobile-navigation",
        selector: ".navbar-toggler",
        sourcePattern: /class="navbar-toggler float-start"/g,
      },
    ],
    key: "header",
    selector: "header.header-with-topbar",
    sourceAnchor: '<header class="header-with-topbar">',
    sourceLines: "30-309",
  },
  {
    inventorySelector: "body > section:nth-of-type(1)",
    itemInventories: [
      {
        count: 3,
        id: "hero-slides",
        selector: "#decor-store-slider > ul > li",
        sourcePattern: /data-index="rs-\d+"/g,
      },
    ],
    key: "hero",
    selector: "#decor-store-slider",
    sourceAnchor: 'id="decor-store-slider"',
    sourceLines: "310-1462",
  },
  {
    inventorySelector: "body > section:nth-of-type(2)",
    itemInventories: [
      {
        count: 6,
        id: "category-cards",
        selector: ".categories-style-01",
        sourcePattern: /categories-style-01 text-center/g,
      },
      {
        count: 3,
        id: "promotion-cards",
        selector: ".filter-content .grid-item",
        sourcePattern: /shop-box position-relative overflow-hidden/g,
      },
    ],
    key: "featured-categories",
    selector: "body > section:nth-of-type(2)",
    sourceAnchor: "Featured categories",
    sourceLines: "1463-1603",
  },
  {
    inventorySelector: "body > section:nth-of-type(3)",
    itemInventories: [
      {
        count: 2,
        id: "product-tabs",
        selector: "[data-bs-toggle='tab']",
        sourcePattern: /data-bs-toggle="tab"/g,
      },
      {
        count: 16,
        id: "product-cards",
        selector: ".shop-box.pb-25px",
        sourcePattern: /shop-box pb-25px/g,
      },
    ],
    key: "products",
    selector: "body > section:nth-of-type(3)",
    sourceAnchor: "Best sellers",
    sourceLines: "1604-1982",
  },
  {
    inventorySelector: "body > section:nth-of-type(4)",
    itemInventories: [
      {
        count: 6,
        id: "promotion-messages",
        selector: ".swiper-slide",
        sourcePattern:
          /Pay with multiple credit cards|Get offer up to 50% on modern furniture|Free shipping for orders over \$130/g,
      },
    ],
    key: "promotional-marquee",
    selector: "body > section:nth-of-type(4)",
    sourceAnchor: "Pay with multiple credit cards",
    sourceLines: "1983-2024",
  },
  {
    inventorySelector: "body > section:nth-of-type(5)",
    itemInventories: [
      {
        count: 3,
        id: "collection-products",
        selector: ".swiper-slide",
        sourcePattern: /swiper-slide cover-background h-100 text-center/g,
      },
    ],
    key: "collection-carousel",
    selector: "body > section:nth-of-type(5)",
    sourceAnchor: 'Lounge <span class="fw-700">collection</span>',
    sourceLines: "2025-2092",
  },
  {
    inventorySelector: "body > section:nth-of-type(6)",
    itemInventories: [
      {
        count: 8,
        id: "client-logos",
        selector: ".swiper-slide",
        sourcePattern: /demo-decor-store-client-\d\d\.png/g,
      },
    ],
    key: "client-marquee",
    selector: "body > section:nth-of-type(6)",
    sourceAnchor: "clients-style-08",
    sourceLines: "2093-2144",
  },
  {
    inventorySelector: "body > section:nth-of-type(7)",
    itemInventories: [
      {
        count: 4,
        id: "journal-cards",
        selector: ".blog-wrapper .grid-item",
        sourcePattern: /<!-- start blog item -->/g,
      },
    ],
    key: "journal",
    selector: "body > section:nth-of-type(7)",
    sourceAnchor: "The decor article",
    sourceLines: "2145-2215",
  },
  {
    inventorySelector: "body > section:nth-of-type(8)",
    itemInventories: [
      {
        count: 4,
        id: "service-cards",
        selector: ".icon-with-text-style-08",
        sourcePattern: /icon-with-text-style-08 text-center/g,
      },
    ],
    key: "services",
    selector: "body > section:nth-of-type(8)",
    sourceAnchor: "Free return & exchange",
    sourceLines: "2216-2275",
  },
  {
    inventorySelector: "footer.footer-dark",
    itemInventories: [],
    key: "footer",
    selector: "footer.footer-dark",
    sourceAnchor: '<footer class="footer-dark',
    sourceLines: "2276-2368",
  },
  {
    inventorySelector: ".cookie-message",
    itemInventories: [],
    key: "cookie",
    selector: ".cookie-message",
    sourceAnchor: 'id="cookies-model"',
    sourceLines: "2369-2385",
  },
  {
    inventorySelector: ".sticky-wrap",
    itemInventories: [],
    key: "sticky",
    selector: ".sticky-wrap",
    sourceAnchor: 'class="sticky-wrap',
    sourceLines: "2386-2415",
  },
  {
    inventorySelector: ".scroll-progress",
    itemInventories: [],
    key: "scroll-progress",
    selector: ".scroll-progress",
    sourceAnchor: 'class="scroll-progress',
    sourceLines: "2416-2423",
  },
] as const satisfies readonly DecorStoreSourceRegion[];

export const decorStoreSourceRegionOrder = decorStoreSourceRegions.map(({ key }) => key);

export const decorStoreSourceActions = [
  {
    count: 244,
    id: "anchors",
    ownership:
      "Classified by the behavior ledger as navigation, external destination, overlay/state trigger, commerce intent, or truthful local/absent action.",
    selector: "a[href]",
  },
  {
    count: 4,
    id: "buttons",
    ownership: "Mobile navigation, search submission, and source form controls.",
    selector: "button",
  },
  {
    count: 2,
    id: "inputs",
    ownership: "Search and newsletter presentation; no PHP request or invented success state.",
    selector: "input:not([type=hidden])",
  },
] as const;

export const decorStoreAbsenceContract = {
  allowedVisibleDifferenceCount: 0,
  comparisonFailures: [
    "source-only-visible-copy",
    "implementation-only-visible-copy",
    "changed-visible-copy",
    "missing-or-reordered-region",
    "remote-or-broken-resource",
    "analytics-or-tracking-request",
    "php-request",
    "console-error",
    "duplicate-runtime-instance",
    "post-unmount-owned-residue",
    "cross-theme-import",
  ],
  waiverTarget: 0,
} as const;

export const decorStoreSourceContract = {
  acceptanceModes: decorStoreAcceptanceModes,
  absenceContract: decorStoreAbsenceContract,
  assetInventory: "tools/storefront-theme-source-manifest.json#decor-store",
  assertionFacets: [
    "inventory",
    "geometry",
    "typography",
    "runtime",
    "timing",
    "focus",
    "accessibility",
    "overflow",
    "images",
    "console",
    "network",
    "teardown",
    "remount",
    "isolation",
    "performance",
  ],
  behaviorContractPath: "./behavior-contract.ts",
  canonicalViewports: decorStoreCanonicalViewports,
  checkpoints: [
    "header-hero-card",
    "first-timed-body-behavior",
    "desktop-complete",
    "mobile-fallback-complete",
  ],
  copyInventory: {
    budget: 0,
    evidence: "complete visible-text-node capture by region and named state",
    normalization: "whitespace-only",
  },
  forbiddenResources: [
    "remote-fonts",
    "remote-images",
    "analytics",
    "tracking",
    "php",
    "js/main.js execution",
    "inactive particles add-on",
  ],
  homeSectionCount: 8,
  htmlClassAfterHydration: "js",
  regionOrder: decorStoreSourceRegionOrder,
  secondaryPages: decorStoreSecondaryPageSourceContracts,
  scriptOrder: [
    "js/jquery.js",
    "js/vendors.min.js",
    "revolution/js/jquery.themepunch.tools.min.js",
    "revolution/js/jquery.themepunch.revolution.min.js",
    "revolution/js/extensions/revolution.extension.actions.min.js",
    "revolution/js/extensions/revolution.extension.layeranimation.min.js",
    "revolution/js/extensions/revolution.extension.navigation.min.js",
    "revolution/js/extensions/revolution.extension.slideanims.min.js",
    "inline:#decor-store-slider",
  ],
  sourceEntry: "demo-decor-store.html",
  sourceEntrySha256: "90a907f8ed8280da25da0248d4a6ae0d7ef3fd73f96d09afd6aa980a266e9271",
  stylesheetOrder: [
    "revolution/css/settings.css",
    "revolution/css/layers.css",
    "revolution/css/navigation.css",
    "css/vendors.min.css",
    "css/icon.min.css",
    "css/style.css",
    "css/responsive.css",
    "demos/decor-store/decor-store.css",
  ],
} as const;
