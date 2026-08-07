import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreMagazineSourcePage = {
  id: "magazine",
  route: "/magazine",
  sourceEntry: "demo-fashion-store-magazine.html",
  sourceSha256: "86283e48d94e8cd9de658b258690ad3a1b0f8b08b2c796e5a59f961d63a6e7fe",
} as const;

export const fashionStoreMagazineSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "page-title", selector: "section:nth-of-type(1)" },
  { itemCount: 12, key: "posts", selector: "section:nth-of-type(2) .grid-item" },
  { key: "pagination", selector: "section:nth-of-type(2) .pagination" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreMagazineSourceContract = {
  cardCount: 12,
  paginationActive: "02",
  regionOrder: fashionStoreMagazineSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreMagazineSourcePage.sourceEntry,
    sha256: fashionStoreMagazineSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreMagazineBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "hover", selector: ".fashion-magazine-grid .grid-item" },
        source: { kind: "hover", selector: ".blog-classic .grid-item" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The source image zoom state is visible." },
        { id: "keyboard", input: "keyboard", outcome: "Focus exposes equivalent card emphasis." },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "Source hover emphasis is also exposed by focus-within for keyboard parity.",
      },
      evidenceStates: [{ fidelityState: "magazine-ready" }],
      fallback: {
        outcome: "All twelve cards remain readable in source order.",
        strategy: "static-grid",
      },
      id: "magazine-card-state",
      initialState: "twelve editorial cards visible",
      modes: ["interaction", "fallback"],
      outcome: "Editorial cards preserve source image emphasis for pointer and keyboard.",
      owner: "approved-adaptation",
      region: "posts",
      role: "navigation",
      sourceCandidate: ".blog-classic .grid-item a",
      sourceSelector: "section:nth-of-type(2) .grid-item",
      triggers: ["hover", "focus", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-magazine-grid .card-title" },
        source: { kind: "click", selector: ".blog-classic .card-title" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The declared article route opens at top." },
        { id: "keyboard", input: "keyboard", outcome: "Enter opens the same article route." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "initial" },
            capture: "element",
            id: "magazine-grid-ready",
            implementationSelector: ".fashion-magazine-grid",
            sourceSelector: "section:nth-of-type(2) .blog-classic",
          },
        },
      ],
      fallback: {
        outcome: "Article hrefs remain visible and keyboard operable.",
        strategy: "native-link",
      },
      id: "magazine-article-navigation",
      initialState: "index route at top",
      modes: ["interaction", "fallback"],
      outcome: "Every editorial card resolves the declared article content variant.",
      owner: "nuxt-routing",
      region: "posts",
      role: "navigation",
      sourceCandidate: ".blog-classic .card-title, .blog-image a",
      sourceSelector: "section:nth-of-type(2) .blog-classic",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-magazine-pagination .page-link" },
        source: { kind: "click", selector: ".pagination .page-link" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The source active page remains 02." },
        { id: "keyboard", input: "keyboard", outcome: "Pagination controls remain focusable." },
      ],
      disposition: {
        kind: "explicitly-deferred",
        reason:
          "The source uses placeholder links and no editorial pagination backend is available.",
      },
      evidenceStates: [{ fidelityState: "magazine-pagination-ready" }],
      fallback: {
        outcome: "Pages 01 through 04 and active 02 remain visible.",
        strategy: "static-control",
      },
      id: "magazine-pagination-presentation",
      initialState: "page 02 active",
      modes: ["interaction", "fallback"],
      outcome: "Pagination preserves source presentation without claiming unavailable data.",
      owner: "framework-adapter",
      region: "pagination",
      role: "state-control",
      sourceCandidate: ".pagination .page-link",
      sourceSelector: "section:nth-of-type(2) .pagination",
      triggers: ["click", "keyboard", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-magazine",
  suppressions: [
    {
      candidate: ".categories-text, .blog-date",
      reason: "Source metadata placeholder anchors remain non-navigating presentation.",
    },
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Shell anchors are covered by shared route parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
