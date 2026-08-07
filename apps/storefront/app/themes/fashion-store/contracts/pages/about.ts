import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreAboutSourcePage = {
  id: "about",
  route: "/about",
  sourceEntry: "demo-fashion-store-about.html",
  sourceSha256: "4672c84511fd86b8f3466e1d5cac52a49be7d03b09bd2d0804782171da0dec6d",
} as const;

export const fashionStoreAboutSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "page-title", selector: "section:nth-of-type(1)" },
  { key: "hero", selector: "section:nth-of-type(2)" },
  { key: "story", selector: "section:nth-of-type(3)" },
  { itemCount: 6, key: "carousel", selector: "section:nth-of-type(4) .swiper-slide img" },
  { itemCount: 4, key: "timeline", selector: "section:nth-of-type(5) .feature-box" },
  { key: "mission", selector: "section:nth-of-type(6)" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreAboutSourceContract = {
  accordionCount: 3,
  carouselImageCount: 6,
  timelineCount: 4,
  regionOrder: fashionStoreAboutSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreAboutSourcePage.sourceEntry,
    sha256: fashionStoreAboutSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreAboutBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "wait", selector: ".fashion-about-carousel" },
        source: { kind: "wait", selector: "section:nth-of-type(4) .swiper" },
      },
      branches: [
        {
          id: "timer",
          outcome: "The source-ordered carousel advances after its two-second delay.",
        },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Arrow keys select the adjacent source image.",
        },
        { id: "touch", input: "touch", outcome: "A swipe selects the adjacent source image." },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "A scoped Vue carousel replaces the unapproved global Swiper runtime.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "initial" },
            capture: "element",
            id: "about-carousel-ready",
            implementationSelector: ".fashion-about-carousel",
            sourceSelector: "section:nth-of-type(4) .swiper",
          },
        },
      ],
      fallback: {
        outcome: "All six source images remain visible and ordered with motion disabled.",
        strategy: "static-carousel",
      },
      id: "about-carousel-motion",
      initialState: "first carousel image active",
      modes: ["temporal", "interaction", "fallback"],
      outcome: "The About carousel advances, responds to input, and tears down with the page.",
      owner: "framework-adapter",
      region: "carousel",
      role: "carousel",
      sourceCandidate: "section:nth-of-type(4) .swiper",
      sourceSelector: "section:nth-of-type(4) .swiper",
      triggers: ["timer", "keyboard", "touch", "focus"],
    },
    {
      actions: {
        implementation: {
          kind: "click",
          selector: ".fashion-about-mission .fashion-accordion-trigger",
        },
        source: { kind: "click", selector: "#accordion-style-02 .accordion-header a" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The selected mission answer opens." },
        { id: "keyboard", input: "keyboard", outcome: "Enter toggles the same answer." },
        { id: "touch", input: "touch", outcome: "Tap toggles the same answer." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "about-accordion-ready" }],
      fallback: {
        outcome: "All three mission questions remain visible with the first answer open.",
        strategy: "native-control",
      },
      id: "about-accordion-state",
      initialState: "first mission answer open",
      modes: ["interaction", "fallback"],
      outcome: "Mission accordion state is local, accessible, and singular.",
      owner: "framework-adapter",
      region: "mission",
      role: "state-control",
      sourceCandidate: "#accordion-style-02 .accordion-header a",
      sourceSelector: "#accordion-style-02",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-about",
  suppressions: [
    {
      candidate: ".clients-style-08 a",
      reason: "Source client-logo hash links are retained as non-navigating presentation.",
    },
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Shared shell anchors are covered by shared route parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
