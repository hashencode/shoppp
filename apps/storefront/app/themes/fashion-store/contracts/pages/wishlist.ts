import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreWishlistSourcePage = {
  id: "wishlist",
  route: "/wishlist",
  sourceEntry: "demo-fashion-store-wishlist.html",
  sourceSha256: "b1531a70ce47ae1f79da4026ad918b8796582c4fdb1b2e852454b5306a3e13fc",
} as const;

export const fashionStoreWishlistSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "page-title", selector: "section:nth-of-type(1)" },
  { itemCount: 8, key: "products", selector: "section:nth-of-type(2) .grid-item" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreWishlistSourceContract = {
  productCount: 8,
  regionOrder: fashionStoreWishlistSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreWishlistSourcePage.sourceEntry,
    sha256: fashionStoreWishlistSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreWishlistBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-wishlist-add" },
        source: { kind: "click", selector: ".shop-buttons-wrap .add-to-cart" },
      },
      branches: [
        {
          id: "pointer",
          input: "mouse",
          outcome: "The product is added through the guest cart owner.",
        },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Enter dispatches the same typed cart intent.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "The source product link is backed by the existing typed guest-cart adapter.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "product-hover" },
            capture: "element",
            id: "wishlist-first-product-actions",
            implementationSelector: ".fashion-wishlist-grid .grid-item",
            sourceSelector: "section:nth-of-type(2) .grid-item",
          },
        },
      ],
      fallback: {
        outcome: "Product destinations and prices remain readable.",
        strategy: "native-control",
      },
      id: "wishlist-product-actions",
      initialState: "eight source products visible",
      modes: ["interaction", "fallback"],
      outcome: "Products retain source destinations and dispatch typed cart additions.",
      owner: "nuxt-commerce",
      region: "products",
      role: "commerce-action",
      sourceCandidate: ".shop-buttons-wrap .add-to-cart, .shop-footer a",
      sourceSelector: "section:nth-of-type(2) .grid-item",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-wishlist-remove" },
        source: { kind: "click", selector: ".icon-feather-heart-on" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The selected card is removed locally." },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Focus moves to the next available removal control.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "Wishlist persistence is unavailable; source-like removal is deterministic local theme state.",
      },
      evidenceStates: [{ fidelityState: "wishlist-ready" }],
      fallback: {
        outcome: "The populated eight-item baseline is restored on reload.",
        strategy: "static-stack",
      },
      id: "wishlist-local-removal",
      initialState: "eight source products visible",
      modes: ["interaction", "fallback"],
      outcome: "A wishlist card can be removed without auth or persistence claims.",
      owner: "framework-adapter",
      region: "products",
      role: "state-control",
      sourceCandidate: ".icon-feather-heart-on",
      sourceSelector: "section:nth-of-type(2) .grid-item",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-wishlist",
  suppressions: [
    {
      candidate: ".shop-hover a[title='Quick shop']",
      reason: "Quick shop resolves to the source product destination.",
    },
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Shell anchors are covered by shared route parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
