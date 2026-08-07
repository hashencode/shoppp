import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreCheckoutSourcePage = {
  id: "checkout",
  route: "/checkout",
  sourceEntry: "demo-fashion-store-checkout.html",
  sourceSha256: "372be1838b010706fd7f03981f4844bb21b5f1dd0978fa7444f8be8daaf38d0b",
} as const;

export const fashionStoreCheckoutSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "breadcrumb", selector: "section:nth-of-type(1)" },
  { key: "helper-controls", selector: "section:nth-of-type(2) .row:first-child" },
  { key: "billing", selector: "section:nth-of-type(2) .col-lg-7" },
  { itemCount: 3, key: "order-summary", selector: ".your-order-table tr.product" },
  { itemCount: 4, key: "payment", selector: ".checkout-accordion .heading" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreCheckoutSourceContract = {
  lineCount: 3,
  paymentCount: 4,
  regionOrder: fashionStoreCheckoutSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreCheckoutSourcePage.sourceEntry,
    sha256: fashionStoreCheckoutSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreCheckoutBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "click", selector: "#fashion-create-account" },
        source: { kind: "click", selector: "#create_account_checkbox" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The account field opens locally." },
        { id: "keyboard", input: "keyboard", outcome: "Space opens the account field." },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "No credential backend is approved; optional account data remains local only.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "checkout-account" },
            capture: "element",
            id: "checkout-account-open",
            implementationSelector: ".fashion-checkout-billing",
            sourceSelector: "section:nth-of-type(2) .col-lg-7",
          },
        },
      ],
      fallback: {
        outcome: "Billing, account, alternate shipping, and notes remain readable in form order.",
        strategy: "native-control",
      },
      id: "checkout-dependent-fields",
      initialState: "optional account and alternate shipping fields collapsed",
      modes: ["interaction", "fallback"],
      outcome: "Dependent fields toggle without transmitting personal or credential data.",
      owner: "framework-adapter",
      region: "billing",
      role: "state-control",
      sourceCandidate: ".create-account, .different-address, input, select, textarea",
      sourceSelector: "section:nth-of-type(2) .col-lg-7",
      triggers: ["click", "keyboard", "focus"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".checkout-accordion input" },
        source: { kind: "click", selector: ".checkout-accordion input" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The chosen payment detail opens." },
        { id: "keyboard", input: "keyboard", outcome: "Arrow keys choose a payment detail." },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "Payment rows preserve source presentation while the existing secure checkout session remains the only progression owner.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "checkout-payment", payment: "paypal" },
            capture: "element",
            id: "checkout-payment-paypal",
            implementationSelector: ".checkout-accordion",
            sourceSelector: ".checkout-accordion",
          },
        },
      ],
      fallback: {
        outcome: "All payment labels and descriptions remain in source order.",
        strategy: "static-stack",
      },
      id: "checkout-payment-accordion",
      initialState: "Direct bank transfer detail open",
      modes: ["interaction", "fallback"],
      outcome: "Payment presentation is operable without introducing a provider integration.",
      owner: "framework-adapter",
      region: "payment",
      role: "state-control",
      sourceCandidate: ".checkout-accordion input, .checkout-accordion .collapse",
      sourceSelector: ".checkout-accordion",
      triggers: ["click", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-checkout-submit" },
        source: { kind: "click", selector: ".your-order-box .btn" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "One checkout session is requested." },
        { id: "keyboard", input: "keyboard", outcome: "Enter requests one checkout session." },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "The existing Shoppp checkout session and challenge replace source placeholder navigation.",
      },
      evidenceStates: [{ fidelityState: "checkout-ready" }],
      fallback: {
        outcome: "The order summary, terms, and Place order control remain readable.",
        strategy: "native-control",
      },
      id: "checkout-session-progression",
      initialState: "populated cart and unaccepted terms",
      modes: ["interaction", "fallback"],
      outcome: "A valid checkout advances exactly once through the host-owned session.",
      owner: "nuxt-commerce",
      region: "order-summary",
      role: "commerce-action",
      sourceCandidate: ".your-order-box input, .your-order-box .btn",
      sourceSelector: ".your-order-box",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-checkout",
  suppressions: [
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Plain anchors are covered by route, copy, and absence parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
