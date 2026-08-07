import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreFaqSourcePage = {
  id: "faq",
  route: "/faq",
  sourceEntry: "demo-fashion-store-faq.html",
  sourceSha256: "7849b03b3b3e19beb204897d1dcc18ef2d33e525f9b6322488ee8000812ea8fa",
} as const;

export const fashionStoreFaqSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "page-title", selector: "section:nth-of-type(1)" },
  { itemCount: 6, key: "categories", selector: "section:nth-of-type(2) .nav-tabs .nav-item" },
  { itemCount: 6, key: "questions", selector: "#tab_seven1 .accordion-item" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreFaqSourceContract = {
  categoryCount: 6,
  questionsPerCategory: 6,
  regionOrder: fashionStoreFaqSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreFaqSourcePage.sourceEntry,
    sha256: fashionStoreFaqSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreFaqBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-faq-content [role='tab']" },
        source: { kind: "click", selector: "section:nth-of-type(2) .nav-tabs a" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The selected source question set is visible." },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Arrow keys move focus and select categories.",
        },
        { id: "touch", input: "touch", outcome: "Tap selects the same category." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "tab-secondary" },
            capture: "element",
            id: "faq-secondary-tab",
            implementationSelector: ".fashion-faq-content",
            sourceSelector: "section:nth-of-type(2)",
          },
        },
      ],
      fallback: {
        outcome: "All six category labels and the active question set remain readable.",
        strategy: "native-tabs",
      },
      id: "faq-category-tabs",
      initialState: "General category selected",
      modes: ["interaction", "fallback"],
      outcome: "FAQ tabs select exactly one source category without stale state.",
      owner: "framework-adapter",
      region: "categories",
      role: "state-control",
      sourceCandidate: "section:nth-of-type(2) .nav-tabs a",
      sourceSelector: "section:nth-of-type(2) .nav-tabs",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
    {
      actions: {
        implementation: {
          kind: "click",
          selector: ".fashion-faq-content .fashion-accordion-trigger",
        },
        source: { kind: "click", selector: "section:nth-of-type(2) .accordion-header a" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The selected answer opens singularly." },
        { id: "keyboard", input: "keyboard", outcome: "Enter toggles the selected answer." },
        { id: "touch", input: "touch", outcome: "Tap toggles the selected answer." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "faq-accordion-ready" }],
      fallback: {
        outcome: "Question labels and the first source answer remain visible.",
        strategy: "native-control",
      },
      id: "faq-accordion-state",
      initialState: "first question open",
      modes: ["interaction", "fallback"],
      outcome: "Each category owns one accessible accordion state.",
      owner: "framework-adapter",
      region: "questions",
      role: "state-control",
      sourceCandidate: "section:nth-of-type(2) .accordion-header a",
      sourceSelector: "section:nth-of-type(2) .accordion",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-faq",
  suppressions: [
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Shared shell anchors are covered by shared route parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
