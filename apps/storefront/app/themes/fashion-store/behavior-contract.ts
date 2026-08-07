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

const row = (behavior: ThemeBehaviorContractRow): ThemeBehaviorContractRow => behavior;

export const fashionStoreBehaviorContract = {
  behaviors: [
    row({
      actions: {
        implementation: { kind: "hover", selector: "header .nav-item.dropdown" },
        source: { kind: "hover", selector: "header .nav-item.dropdown" },
      },
      branches: [
        {
          breakpoint: ">= 992px",
          id: "desktop-hover",
          input: "mouse",
          outcome: "Shop menu is visible.",
        },
        {
          breakpoint: "< 992px",
          id: "mobile-click",
          input: "touch",
          outcome: "Shop menu is visible.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        named(
          {
            action: { kind: "navigation", menu: "Shop" },
            capture: "viewport-top",
            id: "navigation-open",
            implementationSelector: "header .navbar",
            sourceSelector: "header .navbar",
          },
          "navigation-open",
        ),
      ],
      fallback: {
        outcome: "Shop links remain visible and keyboard focusable in the navigation.",
        strategy: "native-control",
      },
      id: "header-shop-navigation",
      initialState: "closed",
      modes: ["interaction", "fallback"],
      outcome: "The Shop submenu opens and remains readable at the active breakpoint.",
      owner: "source-runtime",
      region: "header",
      role: "navigation",
      sourceCandidate:
        "header .nav-item.dropdown, header .nav-item.dropdown a, header .nav-item.dropdown .dropdown-toggle, header .navbar-toggler",
      sourceSelector: "header .nav-item.dropdown",
      triggers: ["hover", "click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "click", selector: ".header-search-form" },
        source: { kind: "click", selector: ".header-search-form" },
      },
      branches: [
        {
          id: "pointer",
          input: "mouse",
          outcome: "Search overlay opens and its input is focused.",
        },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Search overlay opens and its input is focused.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "The source leaves focus on the Search trigger; the implementation focuses the input and restores the trigger on dismissal for keyboard accessibility.",
      },
      evidenceStates: [
        named({
          action: { kind: "search" },
          capture: "viewport-top",
          id: "search-open",
          implementationSelector: ".search-form-wrapper",
          sourceSelector: ".search-form-wrapper",
        }),
      ],
      fallback: {
        outcome: "Escape closes the overlay and focus returns to Search.",
        strategy: "native-control",
      },
      id: "header-search-overlay",
      initialState: "closed",
      modes: ["interaction", "fallback"],
      outcome:
        "Activating Search opens the source-equivalent overlay and focuses the search field.",
      owner: "approved-adaptation",
      region: "header",
      role: "overlay-trigger",
      sourceCandidate:
        "a.header-search-form, .search-form-wrapper, .search-form-wrapper input, .search-form-wrapper button",
      sourceSelector: ".header-search-form",
      triggers: ["click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "hover", selector: ".header-cart" },
        source: { kind: "hover", selector: ".header-cart" },
      },
      branches: [
        {
          breakpoint: ">= 992px",
          id: "desktop-hover",
          input: "mouse",
          outcome: "Cart preview is visible.",
        },
        {
          breakpoint: "< 992px",
          id: "compact-trigger",
          input: "touch",
          outcome: "Cart trigger remains available.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        named({
          action: { kind: "cart" },
          capture: "element",
          id: "cart-open",
          implementationSelector: ".cart-item-list",
          sourceSelector: ".cart-item-list",
        }),
      ],
      fallback: {
        outcome: "Cart remains reachable without hover-only input.",
        strategy: "native-control",
      },
      id: "header-cart-preview",
      initialState: "closed",
      modes: ["interaction", "fallback"],
      outcome: "Hovering the cart reveals the source preview card without adding content.",
      owner: "source-runtime",
      region: "header",
      role: "commerce-action",
      sourceCandidate: ".header-cart, .header-cart a",
      sourceSelector: ".header-cart",
      triggers: ["hover", "focus", "click", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "keyboard", selector: ".swiper.full-screen" },
        source: { kind: "keyboard", selector: ".swiper.full-screen" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [0, 1, 2].map((index) =>
        named(
          {
            action: { index, kind: "hero" },
            capture: "element",
            id: `hero-slide-${index + 1}`,
            implementationSelector: ".swiper.full-screen",
            sourceSelector: ".swiper.full-screen",
          },
          `hero-slide-${index + 1}`,
        ),
      ),
      fallback: {
        outcome: "The first slide remains readable when motion is reduced.",
        strategy: "reduced-motion",
      },
      id: "hero-carousel",
      initialState: "slide-1",
      modes: ["static", "temporal", "interaction", "fallback"],
      outcome: "Hero slides advance and controls select the same slide on both sides.",
      owner: "source-runtime",
      region: "hero",
      role: "carousel",
      sourceCandidate: ".swiper.full-screen",
      sourceSelector: ".swiper.full-screen",
      triggers: ["load", "timer", "click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "observe", selector: ".swiper.full-screen" },
        source: { kind: "observe", selector: ".swiper.full-screen.magic-cursor" },
      },
      branches: [],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "The user explicitly rejected the source magic-cursor replacement and requires the native platform cursor to remain visible over the hero.",
      },
      evidenceStates: [{ fidelityState: "native-cursor-visible" }],
      fallback: {
        outcome: "The platform cursor remains visible without JavaScript.",
        strategy: "native-control",
      },
      id: "hero-native-cursor",
      initialState: "native-cursor-visible",
      modes: ["interaction", "fallback"],
      outcome: "Hovering the hero keeps a visible native cursor and does not obscure the carousel.",
      owner: "approved-adaptation",
      region: "hero",
      role: "state-control",
      sourceCandidate: ".swiper.full-screen.magic-cursor",
      sourceSelector: ".swiper.full-screen.magic-cursor",
      triggers: ["hover"],
    }),
    row({
      actions: {
        implementation: { kind: "hover", selector: ".shop-modern .grid-item .shop-image" },
        source: { kind: "hover", selector: ".shop-modern .grid-item .shop-image" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        named(
          {
            action: { kind: "initial" },
            capture: "element",
            id: "product-default",
            implementationSelector: ".shop-modern .grid-item .shop-image",
            sourceSelector: ".shop-modern .grid-item .shop-image",
          },
          "product-default",
        ),
        named(
          {
            action: { kind: "product-hover" },
            capture: "element",
            id: "product-hover",
            implementationSelector: ".shop-modern .grid-item .shop-image",
            sourceSelector: ".shop-modern .grid-item .shop-image",
          },
          "product-hover",
        ),
        named(
          {
            action: { kind: "product-focus" },
            capture: "element",
            id: "product-focus",
            implementationSelector: ".shop-modern .grid-item .shop-image",
            sourceSelector: ".shop-modern .grid-item .shop-image",
          },
          "product-focus",
        ),
      ],
      fallback: {
        outcome: "Product actions remain keyboard focusable.",
        strategy: "native-control",
      },
      id: "product-card-actions",
      initialState: "default",
      modes: ["static", "interaction", "fallback"],
      outcome: "Product actions appear on hover and focus without changing product copy.",
      owner: "source-runtime",
      region: "best-sellers",
      role: "commerce-action",
      sourceCandidate: ".shop-modern .grid-item .shop-image, .shop-modern .grid-item .shop-image a",
      sourceSelector: ".shop-modern .grid-item .shop-image",
      triggers: ["hover", "focus", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "keyboard", selector: ".swiper.slider-three-slide" },
        source: { kind: "keyboard", selector: ".swiper.slider-three-slide" },
      },
      branches: [
        {
          breakpoint: ">= 992px",
          id: "desktop",
          input: "mouse",
          outcome: "Multiple cards remain visible while the rail advances.",
        },
        {
          breakpoint: "< 768px",
          id: "mobile",
          input: "touch",
          outcome:
            "The rail advances by touch without stretching one card across the desktop layout.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [0, 1, 2, 3].map((index) =>
        named(
          {
            action: { index, kind: "collection" },
            capture: "element",
            id: `collection-slide-${index + 1}`,
            implementationSelector: ".swiper.slider-three-slide",
            sourceSelector: ".swiper.slider-three-slide",
          },
          `collection-slide-${index + 1}`,
        ),
      ),
      fallback: {
        outcome: "Multiple cards remain readable in a stable static rail.",
        strategy: "static-rail",
      },
      id: "new-arrival-collection-carousel",
      initialState: "slide-1",
      modes: ["static", "temporal", "interaction", "fallback"],
      outcome: "The collection presents multiple cards and advances automatically or via controls.",
      owner: "source-runtime",
      region: "collection",
      role: "carousel",
      sourceCandidate:
        ".swiper.slider-three-slide, .swiper.slider-three-slide a, .swiper.slider-three-slide .swiper-button-next, .swiper.slider-three-slide .swiper-button-prev",
      sourceSelector: ".swiper.slider-three-slide",
      triggers: ["load", "timer", "click", "keyboard", "touch", "resize"],
    }),
    row({
      actions: {
        implementation: { kind: "observe", selector: "section:nth-of-type(9)" },
        source: { kind: "observe", selector: "section:nth-of-type(9)" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        named(
          {
            action: { kind: "pause" },
            capture: "element",
            id: "marquee-paused",
            implementationSelector: "section:nth-of-type(9)",
            sourceSelector: "section:nth-of-type(9)",
          },
          "marquee-paused",
        ),
      ],
      fallback: {
        outcome: "All promotional copy remains visible without animation.",
        strategy: "reduced-motion",
      },
      id: "promotional-marquee",
      initialState: "moving",
      modes: ["temporal", "fallback"],
      outcome: "The promotional strip loops continuously.",
      owner: "source-runtime",
      region: "marquee",
      role: "continuous-motion",
      sourceCandidate: "section:nth-of-type(9) .swiper-width-auto",
      sourceSelector: "section:nth-of-type(9) .swiper-width-auto",
      triggers: ["load", "timer"],
    }),
    row({
      actions: {
        implementation: { kind: "observe", selector: ".sticky-wrap" },
        source: { kind: "observe", selector: ".sticky-wrap" },
      },
      branches: [
        {
          breakpoint: ">= 1200px",
          id: "desktop-visible",
          outcome: "The Facebook, Dribbble, Twitter, and Instagram rail is visible.",
        },
        {
          breakpoint: "< 1200px",
          id: "compact-hidden",
          outcome: "The source hides the social rail at compact widths.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "social-rail-visible" }],
      fallback: {
        outcome: "Social links remain available in the page content.",
        strategy: "normal-flow",
      },
      id: "desktop-social-rail",
      initialState: "breakpoint-controlled",
      modes: ["static", "scroll-fixed", "fallback"],
      outcome:
        "The fixed social rail follows the same desktop visibility and labels as the source.",
      owner: "source-runtime",
      region: "sticky",
      role: "fixed-control",
      sourceCandidate: ".sticky-wrap, .sticky-wrap a",
      sourceSelector: ".sticky-wrap",
      triggers: ["load", "resize"],
    }),
    row({
      actions: {
        implementation: { kind: "scroll", selector: ".scroll-progress" },
        source: { kind: "scroll", selector: ".scroll-progress" },
      },
      branches: [
        {
          breakpoint: ">= 1400px",
          id: "desktop-progress",
          outcome: "The progress point grows as document scroll increases.",
        },
        {
          breakpoint: "< 1400px",
          id: "compact-hidden",
          outcome: "The source hides the progress control at compact widths.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "scroll-progress-visible" }],
      fallback: {
        outcome: "Native document scrolling remains available.",
        strategy: "native-scroll",
      },
      id: "scroll-progress-indicator",
      initialState: "top-hidden",
      modes: ["scroll-fixed", "fallback"],
      outcome:
        "The fixed progress control becomes visible and reflects the current scroll position.",
      owner: "source-runtime",
      region: "scroll-progress",
      role: "fixed-control",
      sourceCandidate: ".scroll-progress",
      sourceSelector: ".scroll-progress",
      triggers: ["load", "scroll", "resize"],
    }),
    row({
      actions: {
        implementation: { kind: "click", selector: ".scroll-progress .scroll-top" },
        source: { kind: "click", selector: ".scroll-progress .scroll-top" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "back-to-top-complete" }],
      fallback: {
        outcome: "Users can return to the top with native scrolling.",
        strategy: "native-scroll",
      },
      id: "back-to-top-control",
      initialState: "below-fold",
      modes: ["interaction", "scroll-fixed", "fallback"],
      outcome: "Activating the progress control returns the document to the top.",
      owner: "source-runtime",
      region: "scroll-progress",
      role: "fixed-control",
      sourceCandidate: ".scroll-progress .scroll-top",
      sourceSelector: ".scroll-progress .scroll-top",
      triggers: ["click", "keyboard", "touch"],
    }),
    row({
      actions: {
        implementation: { kind: "scroll", selector: "footer" },
        source: { kind: "scroll", selector: "footer" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        named(
          {
            action: { kind: "initial" },
            capture: "element",
            id: "footer-sticky",
            implementationSelector: "footer",
            sourceSelector: "footer",
          },
          "footer-sticky",
        ),
      ],
      fallback: { outcome: "Footer content remains in document order.", strategy: "normal-flow" },
      id: "footer-sticky-reveal",
      initialState: "below-content",
      modes: ["scroll-fixed", "fallback"],
      outcome: "The sticky footer reveals at the same scroll position as the source.",
      owner: "source-runtime",
      region: "footer",
      role: "fixed-control",
      sourceCandidate: "footer.footer-dark",
      sourceSelector: "footer.footer-dark",
      triggers: ["scroll", "resize"],
    }),
  ],
  customAdapters: [],
  routeId: "fashion-store-home",
  suppressions: [
    {
      candidate: "a[href]:not([aria-controls]):not([data-bs-toggle]):not([onclick])",
      reason:
        "Plain anchors are navigation/content links covered by source link and visible-copy parity; they do not own an in-page state transition.",
    },
    {
      candidate: "footer form input:not([type=hidden]), footer form button",
      reason:
        "The source submits to a template PHP newsletter endpoint; backend delivery is outside this frontend-only reconstruction and is explicitly deferred rather than simulated.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;

export const fashionStoreNamedStateContracts = namedStatesFromBehaviorContract(
  fashionStoreBehaviorContract,
);

export const fashionStoreFidelityStatesByRegion = fidelityStatesByRegionFromBehaviorContract(
  fashionStoreBehaviorContract,
);
