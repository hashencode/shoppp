import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreCollectionSourcePage = {
  id: "collection",
  route: "/collections",
  sourceEntry: "demo-fashion-store-collection.html",
  sourceSha256: "66f7ef2c07925577063efb4a60355857f2a70af0cff1955648ec2ba1401e2f1d",
} as const;

export const fashionStoreCollectionSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "page-title", selector: "section:nth-of-type(1)" },
  { itemCount: 6, key: "category-grid", selector: "section:nth-of-type(2) .categories-style-02" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreCollectionSourceContract = {
  cardCount: 6,
  regionOrder: fashionStoreCollectionSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreCollectionSourcePage.sourceEntry,
    sha256: fashionStoreCollectionSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreCollectionBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "hover", selector: ".categories-style-02" },
        source: { kind: "hover", selector: ".categories-style-02" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The card lifts by the source distance." },
        { id: "keyboard", input: "keyboard", outcome: "Focus exposes the same card state." },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "The source hover lift is also exposed by focus-within for keyboard parity.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "collection-card" },
            capture: "element",
            id: "collection-card-focus",
            implementationSelector: ".fashion-collection-grid .categories-style-02:first-child",
            sourceSelector: "section:nth-of-type(2) .categories-style-02:first-child",
          },
        },
      ],
      fallback: {
        outcome: "Cards remain readable and linked without lift motion.",
        strategy: "reduced-motion",
      },
      id: "collection-card-state",
      initialState: "cards rest in source grid position",
      modes: ["interaction", "fallback"],
      outcome: "Pointer and keyboard expose the source category-card emphasis.",
      owner: "approved-adaptation",
      region: "category-grid",
      role: "navigation",
      sourceCandidate: ".categories-style-02, .categories-style-02 a",
      sourceSelector: "section:nth-of-type(2) .categories-style-02",
      triggers: ["hover", "focus", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".categories-style-02 a" },
        source: { kind: "click", selector: ".categories-style-02 a" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The Shop destination opens." },
        { id: "keyboard", input: "keyboard", outcome: "Enter opens the Shop destination." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "collection-ready" }],
      fallback: {
        outcome: "Every category image, count, label, and Shop link remains readable in order.",
        strategy: "native-control",
      },
      id: "collection-category-navigation",
      initialState: "six editorial category cards visible",
      modes: ["interaction", "fallback"],
      outcome: "A category card navigates through Nuxt to the source Shop destination.",
      owner: "nuxt-routing",
      region: "category-grid",
      role: "navigation",
      sourceCandidate: ".categories-style-02 a",
      sourceSelector: "section:nth-of-type(2) .categories-style-02",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-collection",
  suppressions: [
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Shell anchors are covered by shared route, copy, and absence parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
