import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreProductSourcePage = {
  id: "product",
  route: "/products/relaxed-corduroy-shirt",
  sourceEntry: "demo-fashion-store-single-product.html",
  sourceSha256: "9f2a5cb42d81df1505c3a911c59544eefd8a0a60e6b27791d8469fd552179f43",
} as const;

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
  behaviorContractPath: "./product.ts",
  galleryCount: 6,
  regionOrder: fashionStoreProductSourceRegions.map(({ key }) => key),
  relatedCount: 4,
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
      outcome:
        "Tabs, reviews, and the local review form preserve source interaction without transmission.",
      owner: "framework-adapter",
      region: "tabs",
      role: "state-control",
      sourceCandidate: "#tab .nav-link, #tab form",
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
