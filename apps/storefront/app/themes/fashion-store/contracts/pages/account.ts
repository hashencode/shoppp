import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";

export const fashionStoreAccountSourcePage = {
  id: "account",
  route: "/account",
  sourceEntry: "demo-fashion-store-account.html",
  sourceSha256: "1b7c1cc83c0f224f8f95dec2ded2246a9ebcc52a7011acd3d5afcfdd4248da62",
} as const;

export const fashionStoreAccountSourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { key: "page-title", selector: "section:nth-of-type(1)" },
  { key: "login", selector: "section:nth-of-type(2) .contact-form-style-04" },
  { key: "register", selector: "section:nth-of-type(2) .box-shadow-extra-large" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const;

export const fashionStoreAccountSourceContract = {
  formCount: 2,
  regionOrder: fashionStoreAccountSourceRegions.map(({ key }) => key),
  source: {
    entry: fashionStoreAccountSourcePage.sourceEntry,
    sha256: fashionStoreAccountSourcePage.sourceSha256,
  },
} as const;

export const fashionStoreAccountBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-account-login button" },
        source: { kind: "click", selector: ".contact-form-style-04 form button" },
      },
      branches: [
        {
          id: "invalid",
          input: "keyboard",
          outcome: "Native validation focuses the first invalid field.",
        },
        {
          id: "valid",
          input: "keyboard",
          outcome: "Valid values stay local with no success claim or request.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "No authentication backend is approved for this preview.",
      },
      evidenceStates: [{ fidelityState: "account-ready" }],
      fallback: {
        outcome: "All login controls remain labeled and keyboard operable.",
        strategy: "native-control",
      },
      id: "account-login-validation",
      initialState: "empty login fields and unchecked remember control",
      modes: ["interaction", "fallback"],
      outcome: "Login presentation validates locally and never transmits credentials.",
      owner: "framework-adapter",
      region: "login",
      role: "state-control",
      sourceCandidate: ".contact-form-style-04 input, .contact-form-style-04 button",
      sourceSelector: "section:nth-of-type(2) .contact-form-style-04",
      triggers: ["click", "keyboard", "focus"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: ".fashion-account-register button" },
        source: { kind: "click", selector: ".box-shadow-extra-large form button" },
      },
      branches: [
        {
          id: "invalid",
          input: "keyboard",
          outcome: "Required and email constraints remain native.",
        },
        {
          id: "valid",
          input: "keyboard",
          outcome: "Valid values produce no request, account, or success claim.",
        },
      ],
      disposition: {
        kind: "approved-adaptation",
        reason: "Registration remains nontransmitting without an auth owner.",
      },
      evidenceStates: [
        {
          namedState: {
            action: { kind: "initial" },
            capture: "element",
            id: "account-forms-ready",
            implementationSelector: ".fashion-account-forms",
            sourceSelector: "section:nth-of-type(2) .row",
          },
        },
      ],
      fallback: {
        outcome: "The registration copy and controls remain readable in source order.",
        strategy: "native-control",
      },
      id: "account-register-validation",
      initialState: "empty registration fields",
      modes: ["interaction", "fallback"],
      outcome: "Registration validates locally and never transmits personal data.",
      owner: "framework-adapter",
      region: "register",
      role: "state-control",
      sourceCandidate: ".box-shadow-extra-large input, .box-shadow-extra-large button",
      sourceSelector: "section:nth-of-type(2) .box-shadow-extra-large",
      triggers: ["click", "keyboard", "focus"],
    },
  ],
  customAdapters: [],
  routeId: "fashion-store-account",
  suppressions: [
    {
      candidate: "a[href='#']",
      reason: "Password recovery and privacy links remain nontransmitting source placeholders.",
    },
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason: "Shell anchors are covered by shared route parity.",
    },
  ],
  themeId: "fashion-store",
} as const satisfies ThemeBehaviorContract;
