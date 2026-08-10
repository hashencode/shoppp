import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreContactSourcePage = {
  id: "contact",
  route: "/contact",
  sourceEntry: "demo-fashion-store-contact.html",
  sourceSha256: "20c2fa93b6926d28e1683fe39e7acc36957bbfe4004dfec4b3772e9fdf41b668",
} as const;

export const fashionStoreContactSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "page-title", selector: "section:nth-of-type(1)" },
  { itemCount: 2, key: "locations", selector: "section:nth-of-type(2) .col-sm-6" },
  { itemCount: 2, key: "map", selector: "section:nth-of-type(2) .video-icon-box" },
  { key: "parallax", selector: "section:nth-of-type(3)" },
  { key: "form", selector: "section:nth-of-type(4) form" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreContactSourceContract = {
  locationCount: 2,
  markerCount: 2,
  requiredFieldCount: 3,
  regionOrder: fashionStoreContactSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreContactSourcePage.sourceEntry,
    sha256: fashionStoreContactSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreContactBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "observe", selector: ".fashion-contact-map" },
        source: { kind: "observe", selector: "section:nth-of-type(2) .outside-box-right-30" },
      },
      branches: [
        { id: "default", outcome: "The local map illustration and both markers are visible." },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "The source is reproduced as a local image-and-marker fallback with no remote map runtime.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "initial" },
            capture: "element",
            id: "contact-map-ready",
            implementationSelector: ".fashion-contact-map",
            sourceSelector: "section:nth-of-type(2) .outside-box-right-30",
          },
        },
      ],
      fallback: {
        outcome: "The map image and marker meaning remain visible without scripts.",
        strategy: "local-map-image",
      },
      id: "contact-map-fallback",
      initialState: "local map illustration with two markers",
      modes: ["static", "fallback"],
      outcome: "Contact location context remains visible without a remote map dependency.",
      owner: "approved-adaptation",
      region: "map",
      role: "state-control",
      sourceCandidate: "section:nth-of-type(2) .outside-box-right-30",
      sourceSelector: "section:nth-of-type(2) .outside-box-right-30",
      triggers: ["load", "resize"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-contact-form button[type='submit']" },
        source: { kind: "click", selector: "section:nth-of-type(4) form button" },
      },
      branches: [
        {
          id: "invalid",
          input: "keyboard",
          outcome: "Required, email, and phone errors focus locally.",
        },
        {
          id: "valid",
          input: "keyboard",
          outcome: "Valid values transmit nothing and show no delivery claim.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason:
          "The source PHP endpoint is unavailable and no message-delivery backend may be invented.",
      },
      evidenceStates: [{ fidelityState: "contact-form-ready" }],
      fallback: {
        outcome: "All five labeled fields and privacy copy remain readable.",
        strategy: "native-control",
      },
      id: "contact-form-validation",
      initialState: "empty contact form",
      modes: ["interaction", "fallback"],
      outcome: "Contact fields validate locally and never transmit personal data.",
      owner: "framework-adapter",
      region: "form",
      role: "state-control",
      sourceCandidate:
        "section:nth-of-type(4) form input, section:nth-of-type(4) form textarea, section:nth-of-type(4) form button",
      sourceSelector: "section:nth-of-type(4) form",
      triggers: ["click", "keyboard", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-contact",
  suppressions: [
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Telephone, email, and shared shell anchors retain native navigation semantics.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
