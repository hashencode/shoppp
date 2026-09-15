import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

type FashionStoreProductRegionTreatment = "hidden" | "populated" | "source-shaped-empty";

interface FashionStoreProductRegionLedgerEntry {
  adaptation?: string;
  allowedTreatments: readonly FashionStoreProductRegionTreatment[];
  dataOwner: string;
  forbiddenWhenUnavailable?: readonly string[];
  geometryAnchors: readonly {
    classes: readonly string[];
    viewport: "all" | "desktop" | "mobile";
  }[];
  id: string;
  implementationEvidence: readonly string[];
  implementationSelector: string;
  sourceClasses: readonly string[];
  sourceEvidence: readonly string[];
  sourceSelector: string;
}

export const fashionStoreProductSourcePage = {
  baselineComponentCommit: "f3be48b38cd265ae16a65394431901e1f4b1cd5b",
  baselineComponentSha256: "9788cad519037756258d65691152b97f1b5aacfc6a07f1245302dc7c97dd2060",
  id: "product",
  route: "/products/relaxed-corduroy-shirt",
  sourceEntry: "demo-fashion-store-single-product.html",
  sourceSha256: "9f2a5cb42d81df1505c3a911c59544eefd8a0a60e6b27791d8469fd552179f43",
} as const;

export const fashionStoreProductRegionLedger = [
  {
    allowedTreatments: ["populated"],
    dataOwner: "route shell and Catalog product name",
    geometryAnchors: [
      { classes: ["ps-45px", "pe-45px"], viewport: "desktop" },
      { classes: ["sm-ps-15px", "sm-pe-15px"], viewport: "mobile" },
    ],
    id: "breadcrumb-shell",
    implementationEvidence: [
      '<div class="row align-items-center">',
      'class="col-12 breadcrumb breadcrumb-style-01 fs-14"',
    ],
    implementationSelector:
      ".top-space-margin > .container-fluid > .row.align-items-center > .col-12.breadcrumb",
    sourceClasses: ["container-fluid", "row", "align-items-center", "col-12"],
    sourceEvidence: [
      '<div class="row align-items-center">',
      '<div class="col-12 breadcrumb breadcrumb-style-01 fs-14">',
    ],
    sourceSelector:
      "section:nth-of-type(1) > .container-fluid > .row.align-items-center > .col-12.breadcrumb",
  },
  {
    allowedTreatments: ["populated"],
    dataOwner: "Catalog media and product presentation",
    geometryAnchors: [
      { classes: ["col-lg-7", "pe-50px"], viewport: "desktop" },
      { classes: ["md-pe-15px", "md-mb-40px"], viewport: "mobile" },
    ],
    id: "gallery-product-info-columns",
    implementationEvidence: [
      'class="col-lg-7 pe-50px md-pe-15px md-mb-40px fashion-product-gallery"',
      'class="col-12 col-lg-5 product-info"',
    ],
    implementationSelector: ".fashion-product-detail > .container > .row",
    sourceClasses: ["col-lg-7", "pe-50px", "md-pe-15px", "md-mb-40px", "col-lg-5"],
    sourceEvidence: [
      '<div class="col-lg-7 pe-50px md-pe-15px md-mb-40px">',
      '<div class="col-12 col-lg-5 product-info">',
    ],
    sourceSelector: "section:nth-of-type(2) > .container > .row",
  },
  {
    adaptation:
      "Color option names use source-shaped text chips because current Catalog/Commerce presentation data has no authoritative swatch colors; names are never converted into inferred CSS colors.",
    allowedTreatments: ["populated"],
    dataOwner: "Catalog identity, price, description, SKU, options, and variants",
    geometryAnchors: [
      { classes: ["d-block", "d-sm-flex", "mb-15px"], viewport: "all" },
      { classes: ["mb-20px", "mb-35px"], viewport: "all" },
    ],
    id: "product-summary-and-options",
    implementationEvidence: [
      'class="d-block d-sm-flex align-items-center mb-15px"',
      'class="d-flex align-items-center"',
      "'mb-35px' : 'mb-20px'",
    ],
    implementationSelector: ".product-info",
    sourceClasses: ["d-sm-flex", "align-items-center", "shop-color", "shop-size"],
    sourceEvidence: [
      '<div class="d-block d-sm-flex align-items-center mb-15px">',
      '<div class="d-flex align-items-center mb-20px">',
      '<div class="d-flex align-items-center mb-35px">',
    ],
    sourceSelector: ".product-info",
  },
  {
    allowedTreatments: ["populated"],
    dataOwner: "Commerce actions and Experience control labels",
    geometryAnchors: [{ classes: ["row", "mb-20px", "col-auto"], viewport: "all" }],
    id: "product-actions",
    implementationEvidence: [
      'class="row mb-20px fashion-product-secondary-actions"',
      'class="col-auto icon-with-text-style-08"',
      'class="feature-box feature-box-left-icon-middle d-inline-flex align-middle"',
    ],
    implementationSelector: ".product-info .fashion-product-secondary-actions",
    sourceClasses: ["row", "col-auto", "icon-with-text-style-08", "feature-box"],
    sourceEvidence: [
      '<div class="row mb-20px">',
      '<div class="col-auto icon-with-text-style-08">',
      '<div class="feature-box feature-box-left-icon-middle d-inline-flex align-middle">',
    ],
    sourceSelector: ".product-info > .row.mb-20px",
  },
  {
    allowedTreatments: ["hidden", "populated"],
    dataOwner: "Experience/theme assurance content",
    forbiddenWhenUnavailable: [
      "Estimated delivery:",
      "Free shipping & returns:",
      "Guarantee safe and secure checkout",
      "Category:",
      "Tags:",
    ],
    geometryAnchors: [{ classes: ["mb-20px", "mb-15px"], viewport: "all" }],
    id: "assurance-and-taxonomy",
    implementationEvidence: [],
    implementationSelector: ".product-info [data-product-assurance]",
    sourceClasses: ["icon-with-text-style-08", "bg-very-light-gray", "border-radius-4px"],
    sourceEvidence: [
      "Estimated delivery:",
      "Free shipping & returns:",
      "Guarantee safe and secure checkout",
      "Category:",
      "Tags:",
    ],
    sourceSelector: ".product-info",
  },
  {
    allowedTreatments: ["populated"],
    dataOwner: "shared Product presentation and framework tab adapter",
    geometryAnchors: [
      { classes: ["pt-4"], viewport: "desktop" },
      { classes: ["sm-pt-40px", "xs-mb-8"], viewport: "mobile" },
    ],
    id: "tab-composition",
    implementationEvidence: [
      '<div class="row">',
      '<div class="col-12 tab-style-04">',
      '<span class="tab-border bg-dark-gray">',
      '<div class="mb-5 h-1px w-100 bg-extra-medium-gray sm-mt-10px xs-mb-8">',
      '<div class="tab-content">',
      'class="tab-pane fade in fashion-product-tab-panel"',
    ],
    implementationSelector: "#tab > .container > .row > .col-12.tab-style-04",
    sourceClasses: ["row", "col-12", "tab-style-04", "tab-border", "tab-content", "tab-pane"],
    sourceEvidence: [
      '<div class="col-12 tab-style-04">',
      '<span class="tab-border bg-dark-gray">',
      '<div class="mb-5 h-1px w-100 bg-extra-medium-gray sm-mt-10px xs-mb-8">',
      '<div class="tab-content">',
      '<div class="tab-pane fade in active show" id="tab_five1">',
    ],
    sourceSelector: "#tab > .container > .row > .col-12.tab-style-04",
  },
  {
    allowedTreatments: ["populated", "source-shaped-empty"],
    dataOwner: "Catalog description plus Experience/theme editorial composition",
    geometryAnchors: [
      { classes: ["col-lg-6"], viewport: "desktop" },
      { classes: ["md-mb-40px", "col-md-8"], viewport: "mobile" },
    ],
    id: "description-panel",
    implementationEvidence: ['class="row align-items-center justify-content-center"'],
    implementationSelector: "#product-panel-description > .row.align-items-center",
    sourceClasses: ["row", "align-items-center", "justify-content-center", "col-lg-6"],
    sourceEvidence: [
      '<div class="row align-items-center justify-content-center">',
      '<div class="col-lg-6 md-mb-40px">',
      '<div class="col-lg-6 col-md-8">',
    ],
    sourceSelector: "#tab_five1 > .row.align-items-center",
  },
  {
    allowedTreatments: ["populated", "source-shaped-empty"],
    dataOwner: "Catalog specifications when published",
    geometryAnchors: [{ classes: ["row", "m-0"], viewport: "all" }],
    id: "information-panel",
    implementationEvidence: ['data-product-region-state="information"'],
    implementationSelector: "#product-panel-information [data-product-region-state='information']",
    sourceClasses: ["row", "m-0", "bg-very-light-gray"],
    sourceEvidence: ['<div class="tab-pane fade in" id="tab_five2">', '<div class="row m-0">'],
    sourceSelector: "#tab_five2 > .row.m-0",
  },
  {
    allowedTreatments: ["populated", "source-shaped-empty"],
    dataOwner: "published shipping and return policy",
    geometryAnchors: [
      { classes: ["col-md-6"], viewport: "desktop" },
      { classes: ["sm-mb-30px"], viewport: "mobile" },
    ],
    id: "shipping-panel",
    implementationEvidence: ['data-product-region-state="shipping"'],
    implementationSelector: "#product-panel-shipping [data-product-region-state='shipping']",
    sourceClasses: ["row", "col-md-6", "last-paragraph-no-margin", "sm-mb-30px"],
    sourceEvidence: [
      '<div class="tab-pane fade in" id="tab_five3">',
      '<div class="col-12 col-md-6 last-paragraph-no-margin sm-mb-30px">',
    ],
    sourceSelector: "#tab_five3 > .row",
  },
  {
    allowedTreatments: ["populated", "source-shaped-empty"],
    dataOwner: "published review capability",
    forbiddenWhenUnavailable: ["25,000+", "2,488 Reviews", "Average customer ratings"],
    geometryAnchors: [{ classes: ["row", "align-items-center"], viewport: "all" }],
    id: "reviews-panel",
    implementationEvidence: ['data-product-region-state="reviews"'],
    implementationSelector: "#product-panel-reviews [data-product-region-state='reviews']",
    sourceClasses: ["row", "align-items-center", "mb-6", "sm-mb-10"],
    sourceEvidence: [
      '<div class="tab-pane fade in" id="tab_five4">',
      '<div class="row align-items-center mb-6 sm-mb-10">',
    ],
    sourceSelector: "#tab_five4 > .row.align-items-center",
  },
  {
    allowedTreatments: ["hidden", "populated"],
    dataOwner: "Catalog related products",
    geometryAnchors: [
      { classes: ["grid-4col", "md-grid-3col"], viewport: "desktop" },
      { classes: ["sm-grid-2col", "xs-grid-1col"], viewport: "mobile" },
    ],
    id: "related-heading-and-grid",
    implementationEvidence: [
      '<span class="text-highlight fw-600"',
      '<span class="bg-base-color h-5px bottom-2px">',
      'class="shop-modern shop-wrapper grid grid-4col md-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"',
    ],
    implementationSelector: ".fashion-product-related > .container",
    sourceClasses: ["text-highlight", "bg-base-color", "grid-4col", "sm-grid-2col"],
    sourceEvidence: [
      '<span class="text-highlight fw-600">products<span class="bg-base-color h-5px bottom-2px"></span></span>',
      '<ul class="shop-modern shop-wrapper grid grid-4col md-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center">',
    ],
    sourceSelector: "section:nth-of-type(4) > .container",
  },
] as const satisfies readonly FashionStoreProductRegionLedgerEntry[];

export const fashionStoreProductSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "breadcrumb", selector: "section:nth-of-type(1)" },
  { itemCount: 6, key: "gallery", selector: ".product-image-slider .gallery-box" },
  { key: "product-info", selector: ".product-info" },
  { itemCount: 4, key: "tabs", selector: "#tab .nav-tabs .nav-item" },
  { itemCount: 4, key: "related-products", selector: "section:nth-of-type(4) .grid-item" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreProductSourceContract = {
  baselineComponentCommit: fashionStoreProductSourcePage.baselineComponentCommit,
  baselineComponentSha256: fashionStoreProductSourcePage.baselineComponentSha256,
  behaviorContractPath: "./product.ts",
  galleryCount: 6,
  regionOrder: fashionStoreProductSourceRegions.map(({ key }) => key),
  relatedCount: 4,
  regionLedger: fashionStoreProductRegionLedger,
  sourceSha256: fashionStoreProductSourcePage.sourceSha256,
} as const;

export const fashionStoreProductBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "click", selector: ".product-image-thumb button" },
        source: { kind: "click", selector: ".product-image-thumb .swiper-slide" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The selected gallery image is active." },
        { id: "keyboard", input: "keyboard", outcome: "Arrow keys change the active image." },
        { id: "touch", input: "touch", outcome: "Swipe and thumbnail taps change the image." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        {
          namedState: {
            action: { index: 1, kind: "product-gallery" },
            capture: "element",
            id: "product-gallery-slide-2",
            implementationSelector: ".fashion-product-gallery .row.overflow-hidden",
            sourceSelector: ".col-lg-7 .row.overflow-hidden",
          },
        },
      ],
      fallback: {
        outcome: "Every source image remains readable in thumbnail order.",
        strategy: "static-stack",
      },
      id: "product-gallery",
      initialState: "first product image active",
      modes: ["temporal", "interaction", "fallback"],
      outcome:
        "The product gallery and thumbnail track animate for 300ms, autoplay every 2000ms, expose no source-absent arrows, and open the source-composed keyboard-operable image view.",
      owner: "framework-adapter",
      region: "gallery",
      role: "carousel",
      sourceCandidate:
        ".product-image-slider, .product-image-thumb, [data-group='lightbox-gallery']",
      sourceSelector: ".product-image-slider",
      triggers: ["timer", "click", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-product-options input" },
        source: { kind: "click", selector: ".shop-color input, .shop-size input" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The chosen option is selected once." },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "The chosen option is focused and selected.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        {
          namedState: {
            action: { group: "size", kind: "product-option", value: "M" },
            capture: "element",
            id: "product-size-m",
            implementationSelector: ".product-info .shop-size",
            sourceSelector: ".product-info .shop-size",
          },
        },
      ],
      fallback: {
        outcome: "Native radio inputs retain option labels.",
        strategy: "native-control",
      },
      id: "product-options",
      initialState: "first color and size selected",
      modes: ["interaction", "fallback"],
      outcome: "Color, size, and quantity expose source selected, focus, and bounded states.",
      owner: "framework-adapter",
      region: "product-info",
      role: "state-control",
      sourceCandidate: ".shop-color, .shop-size, .quantity",
      sourceSelector: ".product-info",
      triggers: ["click", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".btn-cart" },
        source: { kind: "click", selector: ".btn-cart" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "One typed guest-cart add is dispatched." },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Enter dispatches one typed guest-cart add.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "Nuxt guest-cart ownership replaces the source anchor mutation and navigation handler.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "product-focus" },
            capture: "element",
            id: "product-wishlist-focus",
            implementationSelector: ".product-info .wishlist",
            sourceSelector: ".product-info .wishlist",
          },
        },
      ],
      fallback: {
        outcome: "Product, selected options, and cart label remain readable.",
        strategy: "native-control",
      },
      id: "product-commerce-actions",
      initialState: "cart and wishlist actions idle",
      modes: ["interaction", "fallback"],
      outcome:
        "Cart and wishlist actions reach typed framework owners without upstream business mutation.",
      owner: "nuxt-commerce",
      region: "product-info",
      role: "commerce-action",
      sourceCandidate: ".btn-cart, .wishlist",
      sourceSelector: ".product-info",
      triggers: ["click", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: "#tab [role='tab']" },
        source: { kind: "click", selector: "#tab .nav-link" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The chosen source tab panel is visible." },
        { id: "keyboard", input: "keyboard", outcome: "Arrow keys move and activate tabs." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "product-tab", tab: "reviews" },
            capture: "element",
            id: "product-reviews-tab",
            implementationSelector: "#tab",
            sourceSelector: "#tab",
          },
        },
      ],
      fallback: {
        outcome: "All tab headings and panel copy remain in DOM order.",
        strategy: "static-stack",
      },
      id: "product-tabs-reviews",
      initialState: "description tab active",
      modes: ["interaction", "fallback"],
      outcome: "Product information tabs preserve the accepted interaction without transmission.",
      owner: "framework-adapter",
      region: "tabs",
      role: "state-control",
      sourceCandidate: "#tab .nav-link",
      sourceSelector: "#tab",
      triggers: ["click", "keyboard", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-product",
  suppressions: [
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Plain source anchors are covered by route, copy, and absence parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
