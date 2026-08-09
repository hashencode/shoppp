import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreCartSourcePage = {
  id: "cart",
  route: "/cart",
  sourceEntry: "demo-fashion-store-cart.html",
  sourceSha256: "fe60f6a7e897350e927a7b222eb8ea6c21c1598712a6784380eeeb487d8eca51",
} as const;

export const fashionStoreCartSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "breadcrumb", selector: "section:nth-of-type(1)" },
  { itemCount: 3, key: "cart-lines", selector: ".cart-products tbody tr" },
  { key: "cart-controls", selector: "section:nth-of-type(2) .row.mt-20px" },
  { key: "cart-totals", selector: ".total-price-table" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreCartSourceContract = {
  lineCount: 3,
  regionOrder: fashionStoreCartSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreCartSourcePage.sourceEntry,
    sha256: fashionStoreCartSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreCartBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "click", selector: ".cart-products .qty-plus" },
        source: { kind: "click", selector: ".cart-products .qty-plus" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "One cart quantity update is dispatched." },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "The focused quantity control dispatches one update.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "The existing guest-cart owner replaces source-only quantity field mutation.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { index: 0, kind: "cart-quantity" },
            capture: "element",
            id: "cart-first-line-quantity-2",
            implementationSelector: ".cart-products",
            sourceSelector: ".cart-products",
          },
        },
      ],
      fallback: {
        outcome: "Cart lines and native quantity controls remain readable.",
        strategy: "native-control",
      },
      id: "cart-line-mutations",
      initialState: "three populated source cart lines",
      modes: ["interaction", "fallback"],
      outcome: "Quantity and removal dispatch once through the guest-cart owner.",
      owner: "nuxt-commerce",
      region: "cart-lines",
      role: "commerce-action",
      sourceCandidate: ".cart-products .product-remove, .cart-products .quantity",
      sourceSelector: ".cart-products",
      triggers: ["click", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".calculate-shipping-title" },
        source: { kind: "click", selector: ".calculate-shipping-title" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The calculator opens and closes." },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Enter opens the calculator and preserves focus.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "cart-shipping" },
            capture: "element",
            id: "cart-shipping-open",
            implementationSelector: ".calculate-shipping",
            sourceSelector: ".calculate-shipping",
          },
        },
      ],
      fallback: {
        outcome: "Shipping fields remain in source order without a delivery claim.",
        strategy: "native-control",
      },
      id: "cart-shipping-calculator",
      initialState: "shipping calculator collapsed",
      modes: ["interaction", "fallback"],
      outcome: "The calculator validates locally before typed shipping quote dispatch.",
      owner: "nuxt-commerce",
      region: "cart-totals",
      role: "state-control",
      sourceCandidate:
        ".calculate-shipping-title, #shipping-accordion input, #shipping-accordion select",
      sourceSelector: ".calculate-shipping",
      triggers: ["click", "keyboard", "focus"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".apply-coupon-btn" },
        source: { kind: "click", selector: ".apply-coupon-btn" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "Coupon validation remains local." },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Enter validates without submitting personal data.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "No coupon service is approved; the source control retains local validation only.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "cart-coupon" },
            capture: "element",
            id: "cart-coupon-invalid",
            implementationSelector: ".coupon-code-panel",
            sourceSelector: ".coupon-code-panel",
          },
        },
      ],
      fallback: {
        outcome: "Coupon, empty, update, and checkout controls remain readable links or buttons.",
        strategy: "native-control",
      },
      id: "cart-local-controls",
      initialState: "coupon input empty and checkout destination available",
      modes: ["interaction", "fallback"],
      outcome: "Source demo controls do not submit to template endpoints or invent success.",
      owner: "framework-adapter",
      region: "cart-controls",
      role: "state-control",
      sourceCandidate: ".coupon-code-panel, .apply-coupon-btn",
      sourceSelector: ".coupon-code-panel",
      triggers: ["click", "keyboard", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-cart",
  suppressions: [
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Plain source anchors are covered by route, copy, and absence parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
