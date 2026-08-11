import {
  fidelityStatesByRegionFromBehaviorContract,
  namedStatesFromBehaviorContract,
  type NamedStateContract,
  type ThemeBehaviorContract,
  type ThemeBehaviorContractRow,
  type ThemeBehaviorEvidenceState,
} from "../../../e2e/support/theme-behavior-contract";

const named = (state: NamedStateContract, fidelityState?: string): ThemeBehaviorEvidenceState => ({
  ...(fidelityState ? { fidelityState } : {}),
  namedState: state,
});
const row = (value: ThemeBehaviorContractRow): ThemeBehaviorContractRow => value;

export const decorStoreBehaviorContract = {
  behaviors: [
    row({
      actions: {
        implementation: { kind: "hover", selector: ".header-language" },
        source: { kind: "hover", selector: ".header-language" },
      },
      branches: [
        {
          breakpoint: ">= 768px",
          id: "desktop-pointer",
          input: "mouse",
          outcome: "Language choices are visible.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        named(
          {
            action: { kind: "language" },
            capture: "element",
            id: "header-language-open",
            implementationSelector: ".language-dropdown",
            sourceSelector: ".language-dropdown",
          },
          "header-language-open",
        ),
      ],
      fallback: {
        outcome: "The current language remains readable without persistence.",
        strategy: "truthful-local",
      },
      id: "header-language",
      initialState: "closed",
      modes: ["interaction", "fallback"],
      outcome: "Hover, focus, or touch exposes the source language list without navigation.",
      owner: "framework-adapter",
      region: "header",
      role: "state-control",
      sourceCandidate: ".header-language, .header-language a, .language-dropdown a",
      sourceSelector: ".header-language",
      triggers: ["hover", "focus", "click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "click", selector: ".navbar-toggler, .dropdown-toggle" },
        source: { kind: "click", selector: ".navbar-toggler, .dropdown-toggle" },
      },
      branches: [
        {
          breakpoint: ">= 992px",
          id: "desktop-menu",
          input: "mouse",
          outcome: "The Shop mega menu is visible.",
        },
        {
          breakpoint: "< 992px",
          id: "mobile-menu",
          input: "touch",
          outcome: "The mobile navigation is visible.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        named(
          {
            action: { kind: "navigation", menu: "Shop" },
            capture: "viewport-top",
            id: "header-menu-open",
            implementationSelector: "header .dropdown-menu",
            sourceSelector: "header .dropdown-menu",
          },
          "header-menu-open",
        ),
        { fidelityState: "mobile-menu-open" },
      ],
      fallback: {
        outcome: "Navigation links remain keyboard and touch reachable.",
        strategy: "native-control",
      },
      id: "header-navigation",
      initialState: "closed",
      modes: ["interaction", "fallback"],
      outcome: "Desktop and mobile menus open, dismiss, resize, and retain focus order.",
      owner: "framework-adapter",
      region: "header",
      role: "navigation",
      sourceCandidate:
        "header .nav-item.dropdown, header .dropdown-toggle, header .navbar-toggler, #navbarNav",
      sourceSelector: "header .nav-item.dropdown, header .navbar-toggler",
      triggers: ["hover", "click", "keyboard", "touch", "resize"],
    }),
    row({
      actions: {
        implementation: { kind: "click", selector: ".header-search-form" },
        source: { kind: "click", selector: ".header-search-form" },
      },
      branches: [
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Search opens, focuses input, and restores focus on dismissal.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "Nuxt owns the truthful search intent while Decor preserves the source overlay and focus lifecycle.",
      },
      evidenceStates: [
        named(
          {
            action: { kind: "search" },
            capture: "viewport-top",
            id: "header-search-open",
            implementationSelector: ".search-form-wrapper",
            sourceSelector: ".search-form-wrapper",
          },
          "header-search-open",
        ),
      ],
      fallback: {
        outcome: "Search remains a labelled native form control.",
        strategy: "native-control",
      },
      id: "header-search",
      initialState: "closed",
      modes: ["interaction", "fallback"],
      outcome: "Search opens and dismisses without an unexpected route or request.",
      owner: "framework-adapter",
      region: "header",
      role: "overlay-trigger",
      sourceCandidate:
        ".header-search-form, .search-form-wrapper, .search-form-wrapper input, .search-form-wrapper button",
      sourceSelector: ".header-search-form",
      triggers: ["click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "hover", selector: ".header-cart" },
        source: { kind: "hover", selector: ".header-cart" },
      },
      branches: [],
      disposition: {
        kind: "approved-adaptation",
        reason: "Commerce mutations emit existing typed intents and never call source backends.",
      },
      evidenceStates: [
        named(
          {
            action: { kind: "cart" },
            capture: "element",
            id: "header-cart-open",
            implementationSelector: ".cart-item-list",
            sourceSelector: ".cart-item-list",
          },
          "header-cart-open",
        ),
      ],
      fallback: {
        outcome: "Account and cart destinations remain usable links.",
        strategy: "native-link",
      },
      id: "header-commerce",
      initialState: "closed",
      modes: ["interaction", "fallback"],
      outcome: "Cart preview and account/cart intents preserve source-visible presentation.",
      owner: "framework-adapter",
      region: "header",
      role: "commerce-action",
      sourceCandidate: ".header-cart, .header-account, .header-cart a, .header-account a",
      sourceSelector: ".header-cart",
      triggers: ["hover", "focus", "click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "observe", selector: "#decor-store-slider" },
        source: { kind: "observe", selector: "#decor-store-slider" },
      },
      branches: decorStoreHeroBranches(),
      disposition: { kind: "reproduced" },
      evidenceStates: [
        { fidelityState: "initial" },
        ...[0, 1, 2].map((index) =>
          named(
            {
              action: { index, kind: "hero" },
              capture: "element",
              id: `hero-slide-${index + 1}`,
              implementationSelector: "#decor-store-slider",
              sourceSelector: "#decor-store-slider",
            },
            `hero-slide-${index + 1}`,
          ),
        ),
        { fidelityState: "hero-transition" },
        { fidelityState: "reduced-motion" },
        { fidelityState: "hero-dependency-failure" },
      ],
      fallback: {
        outcome: "A stable readable slide remains when motion is reduced or Revolution fails.",
        strategy: "stable-first-slide",
      },
      id: "hero-revolution",
      initialState: "slide-1-readable-before-runtime",
      modes: ["static", "temporal", "interaction", "fallback"],
      outcome:
        "Exactly one Revolution instance shows all three slides, deterministic transition geometry, teardown, and clean remount.",
      owner: "source-runtime",
      region: "hero",
      role: "carousel",
      sourceCandidate:
        "#decor-store-slider, #decor-store-slider a, #decor-store-slider [role=button]",
      sourceSelector: "#decor-store-slider",
      triggers: ["load", "timer", "click", "keyboard", "touch", "resize"],
    }),
    row({
      actions: {
        implementation: {
          kind: "click",
          selector: "section:nth-of-type(3) [data-bs-toggle='tab']",
        },
        source: { kind: "click", selector: "section:nth-of-type(3) [data-bs-toggle='tab']" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        { fidelityState: "product-tab-best-sellers" },
        named(
          {
            action: { kind: "tab-secondary" },
            capture: "element",
            id: "product-tab-new-arrivals",
            implementationSelector: "section:nth-of-type(3) .tab-content",
            sourceSelector: "section:nth-of-type(3) .tab-content",
          },
          "product-tab-new-arrivals",
        ),
      ],
      fallback: {
        outcome: "The default product panel renders in source order without JavaScript.",
        strategy: "default-panel",
      },
      id: "product-tabs",
      initialState: "best-sellers",
      modes: ["static", "interaction", "fallback"],
      outcome: "Tabs expose the correct eight-card panel and preserve focus.",
      owner: "framework-adapter",
      region: "products",
      role: "state-control",
      sourceCandidate: "section:nth-of-type(3) [data-bs-toggle='tab']",
      sourceSelector: "section:nth-of-type(3) [data-bs-toggle='tab']",
      triggers: ["click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "hover", selector: "section:nth-of-type(3) .shop-box" },
        source: { kind: "hover", selector: "section:nth-of-type(3) .shop-box" },
      },
      branches: [],
      disposition: {
        kind: "approved-adaptation",
        reason: "Source product actions map to existing routes or typed storefront intents.",
      },
      evidenceStates: [
        named(
          {
            action: { kind: "product-hover" },
            capture: "element",
            id: "product-card-hover",
            implementationSelector: "section:nth-of-type(3) .shop-box",
            sourceSelector: "section:nth-of-type(3) .shop-box",
          },
          "product-card-hover",
        ),
      ],
      fallback: {
        outcome: "Product names, prices, images, and destinations remain visible and focusable.",
        strategy: "native-link",
      },
      id: "product-card-actions",
      initialState: "actions-hidden",
      modes: ["static", "interaction", "fallback"],
      outcome: "Hover, focus, and touch expose the source action set without invented copy.",
      owner: "framework-adapter",
      region: "products",
      role: "commerce-action",
      sourceCandidate: "section:nth-of-type(3) .shop-box a, section:nth-of-type(3) .shop-hover a",
      sourceSelector: "section:nth-of-type(3) .shop-box",
      triggers: ["hover", "focus", "click", "keyboard", "touch"],
    }),
    motionRow(
      "promotional-marquee",
      "promotional-marquee",
      "section:nth-of-type(4) .swiper",
      "promotional-marquee-moving",
      "pause",
    ),
    motionRow(
      "collection-carousel",
      "collection-carousel",
      "section:nth-of-type(5) .swiper",
      "collection-moving",
      "collection",
    ),
    motionRow(
      "client-marquee",
      "client-marquee",
      "section:nth-of-type(6) .swiper",
      "client-marquee-moving",
      "client-pause",
    ),
    row({
      actions: {
        implementation: { kind: "click", selector: ".cookie-message [data-accept-btn]" },
        source: { kind: "click", selector: ".cookie-message [data-accept-btn]" },
      },
      branches: [],
      disposition: {
        kind: "approved-adaptation",
        reason: "Cookie dismissal is truthful local state with no invented durable persistence.",
      },
      evidenceStates: [{ fidelityState: "cookie-visible" }, { fidelityState: "cookie-dismissed" }],
      fallback: {
        outcome: "The notice remains readable when JavaScript is unavailable.",
        strategy: "static-notice",
      },
      id: "cookie-notice",
      initialState: "visible",
      modes: ["interaction", "scroll-fixed", "fallback"],
      outcome: "Accept and reject dismiss only the notice without a network request.",
      owner: "framework-adapter",
      region: "cookie",
      role: "state-control",
      sourceCandidate: ".cookie-message, .cookie-message a, .cookie-message [data-accept-btn]",
      sourceSelector: ".cookie-message",
      triggers: ["click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "scroll", selector: ".sticky-wrap" },
        source: { kind: "scroll", selector: ".sticky-wrap" },
      },
      branches: [
        {
          breakpoint: ">= 1200px",
          id: "desktop",
          outcome: "Sticky social links are visible at the source threshold.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "sticky-visible" }],
      fallback: {
        outcome: "Social destinations remain available in the footer.",
        strategy: "duplicate-destination",
      },
      id: "sticky-social",
      initialState: "responsive-hidden",
      modes: ["scroll-fixed", "fallback"],
      outcome: "The rail appears only at source breakpoints and leaves no state after teardown.",
      owner: "source-runtime",
      region: "sticky",
      role: "fixed-control",
      sourceCandidate: ".sticky-wrap, .sticky-wrap a",
      sourceSelector: ".sticky-wrap",
      triggers: ["load", "scroll", "resize"],
    }),
    row({
      actions: {
        implementation: { kind: "scroll", selector: ".scroll-progress" },
        source: { kind: "scroll", selector: ".scroll-progress" },
      },
      branches: [
        {
          breakpoint: ">= 1400px",
          id: "desktop",
          outcome: "Progress grows monotonically and the control returns to top.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "scroll-progress-visible" }],
      fallback: { outcome: "The document remains normally scrollable.", strategy: "native-scroll" },
      id: "scroll-progress",
      initialState: "hidden-at-top",
      modes: ["interaction", "scroll-fixed", "fallback"],
      outcome: "Progress reflects scroll and activation returns to top without routing.",
      owner: "source-runtime",
      region: "scroll-progress",
      role: "fixed-control",
      sourceCandidate: ".scroll-progress, .scroll-progress .scroll-top",
      sourceSelector: ".scroll-progress",
      triggers: ["scroll", "click", "keyboard", "touch"],
    }),
  ],
  customAdapters: [],
  routeId: "decor-store-home",
  suppressions: [
    {
      candidate: "a[href]:not([data-bs-toggle]):not([role=button])",
      reason:
        "Plain links are fully inventoried by structural link/copy parity and route-intent mapping; they do not own an in-page state transition.",
    },
    {
      candidate: "footer form input:not([type=hidden]), footer form button",
      reason:
        "The source PHP newsletter endpoint is prohibited; presentation remains truthful with no fake submission or success state.",
    },
  ],
  themeId: "decor-store",
} as const satisfies ThemeBehaviorContract;

function decorStoreHeroBranches() {
  return [
    {
      breakpoint: ">= 1240px",
      id: "desktop",
      input: "mouse" as const,
      outcome: "Grid is 1220 by 900.",
    },
    {
      breakpoint: "1024-1239px",
      id: "laptop",
      input: "keyboard" as const,
      outcome: "Grid is 1024 by 1000.",
    },
    {
      breakpoint: "481-1023px",
      id: "tablet",
      input: "touch" as const,
      outcome: "Grid is 778 by 960.",
    },
    {
      breakpoint: "<= 480px",
      id: "mobile",
      input: "touch" as const,
      outcome: "Grid is 480 by 720.",
    },
  ];
}

function motionRow(
  id: string,
  region: string,
  selector: string,
  state: string,
  actionKind: "client-pause" | "collection" | "pause",
): ThemeBehaviorContractRow {
  const action =
    actionKind === "collection"
      ? ({ index: 1, kind: actionKind } as const)
      : ({ kind: actionKind } as const);
  return row({
    actions: {
      implementation: { kind: "observe", selector },
      source: { kind: "observe", selector },
    },
    branches: [],
    disposition: { kind: "reproduced" },
    evidenceStates: [
      named(
        {
          action,
          capture: "element",
          id: state,
          implementationSelector: selector,
          sourceSelector: selector,
        },
        state,
      ),
      { fidelityState: `${state}-reduced-motion` },
    ],
    fallback: {
      outcome: "All items remain readable in source order and automatic movement stops.",
      strategy: "static-track",
    },
    id,
    initialState: "first-item-visible",
    modes: ["static", "temporal", "interaction", "fallback"],
    outcome: "Visible track position changes over time, pauses appropriately, and remounts once.",
    owner: "source-runtime",
    region,
    role: actionKind === "collection" ? "carousel" : "continuous-motion",
    sourceCandidate: `${selector}, ${selector} a, ${selector} [role=button]`,
    sourceSelector: selector,
    triggers: ["load", "timer", "focus", "touch", "resize"],
  });
}

export const decorStoreNamedStateContracts = namedStatesFromBehaviorContract(
  decorStoreBehaviorContract,
);
export const decorStoreFidelityStatesByRegion = fidelityStatesByRegionFromBehaviorContract(
  decorStoreBehaviorContract,
);
