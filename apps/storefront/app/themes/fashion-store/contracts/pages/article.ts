import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreArticleSourcePage = {
  id: "article",
  route: "/magazine/marketing-tips-and-tricks",
  sourceEntry: "demo-fashion-store-blog-single-creative.html",
  sourceSha256: "48c7213781db41be93fe6ec46611995f308e3fef93bfef596a15fb8b01ad5c3a",
} as const;

export const fashionStoreArticleSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "article-title", selector: "section:nth-of-type(1)" },
  { itemCount: 3, key: "article-media", selector: "section.py-0 img.w-100" },
  { key: "article-body", selector: "section:nth-of-type(3)" },
  { key: "article-quote", selector: "section:nth-of-type(5)" },
  { key: "article-conclusion", selector: "section:nth-of-type(7)" },
  { key: "author-share", selector: "section.half-section" },
  { itemCount: 3, key: "related", selector: "section.bg-very-light-gray .grid-item" },
  {
    itemCount: 4,
    key: "comments",
    selector: ".blog-comment > li, .blog-comment .child-comment > li",
  },
  { key: "comment-form", selector: "#comments form" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreArticleSourceContract = {
  commentCount: 4,
  mediaCount: 3,
  relatedCount: 3,
  regionOrder: fashionStoreArticleSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreArticleSourcePage.sourceEntry,
    sha256: fashionStoreArticleSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreArticleBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-article-related .card-title" },
        source: { kind: "click", selector: ".bg-very-light-gray .card-title" },
      },
      branches: [
        {
          id: "pointer",
          input: "mouse",
          outcome: "Related content resolves the declared article route at top.",
        },
        { id: "keyboard", input: "keyboard", outcome: "Enter resolves the same article route." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "initial" },
            capture: "element",
            id: "article-body-ready",
            implementationSelector: ".fashion-article-body",
            sourceSelector: "section:nth-of-type(3)",
          },
        },
      ],
      fallback: {
        outcome: "Tags, author posts, and related links remain native links.",
        strategy: "native-link",
      },
      id: "article-content-navigation",
      initialState: "article route at top",
      modes: ["interaction", "fallback"],
      outcome: "Article internal destinations preserve content variant and scroll ownership.",
      owner: "nuxt-routing",
      region: "related",
      role: "navigation",
      sourceCandidate: ".tag-cloud a, .btn-link, .bg-very-light-gray .card-title",
      sourceSelector: "section.half-section, section.bg-very-light-gray",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-article-share a" },
        source: { kind: "click", selector: ".social-icon-style-04 a" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "The external destination is retained safely." },
        {
          id: "keyboard",
          input: "keyboard",
          outcome: "Share links remain focusable with external semantics.",
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "article-share-ready" }],
      fallback: {
        outcome: "Five external share destinations remain labeled.",
        strategy: "native-link",
      },
      id: "article-external-sharing",
      initialState: "five external share links visible",
      modes: ["interaction", "fallback"],
      outcome: "Share affordances preserve source external destinations with opener protection.",
      owner: "browser-navigation",
      region: "author-share",
      role: "navigation",
      sourceCandidate: ".social-icon-style-04 a",
      sourceSelector: "section.half-section .social-icon-style-04",
      triggers: ["click", "keyboard", "touch", "focus"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-article-comment-form button" },
        source: { kind: "click", selector: "#comments form button" },
      },
      branches: [
        {
          id: "invalid",
          input: "keyboard",
          outcome: "Native required and email validation focuses invalid input.",
        },
        {
          id: "valid",
          input: "keyboard",
          outcome: "Valid values remain local with no request or success claim.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "The source PHP comment endpoint is unavailable and no delivery backend may be invented.",
      },
      evidenceStates: [{ fidelityState: "article-comments-ready" }],
      fallback: {
        outcome: "Four comments and the labeled form remain readable.",
        strategy: "native-control",
      },
      id: "article-comment-validation",
      initialState: "four comments and empty comment form",
      modes: ["interaction", "fallback"],
      outcome: "Comment presentation validates locally and transmits nothing.",
      owner: "framework-adapter",
      region: "comment-form",
      role: "state-control",
      sourceCandidate: "#comments input, #comments textarea, #comments button",
      sourceSelector: "#comments form",
      triggers: ["click", "keyboard", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-article",
  suppressions: [
    {
      candidate: ".btn-reply, .likes-count",
      reason: "Source hash and placeholder controls retain local navigation/presentation.",
    },
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Shell anchors are covered by shared route parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
