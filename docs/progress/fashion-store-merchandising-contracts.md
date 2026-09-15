# Fashion Store Merchandising Contract Evidence

## 2026-09-13 — FS-F7-U1 activation and failure ownership

FS-F7 was activated from the retained FS-R4-U5 full-gate evidence. No expensive gate was rerun for
this documentation-only unit. The evidence below is a frozen characterization of the work intake;
the active plan and product master remain the only authorities for current and next execution state.

The retained `bun run test:fashion-store` result completed its unit stage with 52 passing tests and
its live stage with 15 passing tests, then ended the static stage with 271 passing tests, 252
intentional skips, and 13 failures. Those failures map to the six contracts below. None is an
approved exemption, threshold relaxation, or shell regression.

| Frozen contract                           | Failure count | Retained observation                                                                                                         | FS-F7 requirements |
| ----------------------------------------- | ------------: | ---------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Nested and side-specific region ownership |             2 | Source-region/visible-copy attribution crosses the successor boundary, and the marquee observer uses the wrong nested owner. | R1, R2, R4         |
| Generic motion-spec collection            |             4 | The generic Playwright matrix collects the dedicated motion spec under four unsupported general projects.                    | R3                 |
| Home mini-cart fixture truth              |             1 | The Home preview cart is correctly empty, while the Collection assertion requires a source demonstration close control.      | R5                 |
| Interaction-ledger coverage               |             1 | One report identifies 28 rendered merchandising candidates without exact outcome ownership.                                  | R8                 |
| Top-level section counting                |             4 | Four viewport cases count 19 descendant sections instead of the governed 11 top-level Home regions.                          | R2                 |
| Serious accessibility                     |             1 | Merchandising image links lack application-owned names and product-card targets fail the existing geometry gate.             | R6, R7             |

The preserved authority chain is `FS-F7 -> FS-R4-U5 -> FS-F6-U4 -> REL-Pre-DC`. FS-R4-U5 keeps its
canonical Header/Footer completion contract and blocker; FS-F6-U4 keeps its animation budgets,
focused evidence, and blocker. Activating FS-F7 changes no candidate, DC, deployment, PG, commerce,
visual, motion, accessibility, source-parity, screenshot, shell, or bundle threshold.

### Verification

- Inspected the FS-R4 U5 retained full-gate evidence and its exact 13-failure distribution.
- Inspected the FS-R4-U5 and FS-F6-U4 child checkpoints alongside the product-master pointer.
- Confirmed the six frozen contracts total 13 failures (`2 + 4 + 1 + 1 + 4 + 1`).
- Scoped governance assertions and `git diff --check` passed after the activation update.
- No runtime or test file changed, so `behavior_changed=false`; no test was added or changed.

## 2026-09-13 — FS-F7-U2 region, suite-routing, marquee, and cart contracts

U2 completed without changing the accepted Home composition, commerce truth, canonical shell, or
any visual, source-parity, motion, accessibility, screenshot, or bundle threshold. Source capture
keeps its positional selectors, while implementation capture now uses stable
`[data-home-section]` owners and excludes the nested successor merchandising body from retired
legacy Fashion body-copy authority. The structure gate separately proves eleven ordered top-level
Home owners and seven ordered nested Decor-derived regions.

The generic Fashion Playwright configuration now excludes
`fashion-store-animation-performance.spec.ts`; the dedicated configuration remains its only owner
and lists exactly the two unchanged desktop/mobile motion profiles. The marquee contract and
temporal probe retain the source's positional owner while observing the implementation through the
stable Home marquee owner. The Collection shell assertion now first proves the fresh Home cart is
empty with no remove control, performs a public product-card add action, and only then checks the
populated remove-control styling. Route-level shell trigger checks remain independent because Cart
page fixtures truthfully contain their own lines and a static preview anchor reload does not retain
Nuxt preview `useState`.

### Characterization and verification

- Initial focused Bun run retained the expected red evidence: the implementation-region exports
  were absent and the generic config/marquee contract still used stale ownership. After repair,
  `bun test tests/fashion-store-home-source.test.ts tests/fashion-store-theme.test.ts tests/fashion-store-preview-cart.test.ts`
  passed 37 tests with 591 assertions.
- Focused browser evidence passed for source inventory (desktop), ordered Home structure (desktop,
  laptop, tablet, mobile), temporal marquee displacement (desktop), and the truthful preview-cart
  shell flow (desktop). The retained source-region screenshot/pixel thresholds also passed on
  desktop and mobile.
- `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --list --config playwright.fashion-store.config.ts`
  listed 532 generic tests with no dedicated performance spec; the dedicated config listed exactly
  its two fixed motion-profile tests.
- `bun run typecheck`, changed-file Prettier checks, and `git diff --check` passed.
- Tests inspected/changed: Home source/theme/preview-cart unit tests; acceptance source inventory;
  Theme structure/source-region checks; marquee behavior; Collection shared-shell preview-cart
  assertions; and both generic/dedicated Playwright configurations.
- `behavior_changed=false`. No Home content, product ordering, cart seeding, Header/Footer code,
  accessibility implementation, interaction ledger, or threshold changed. No U2 blocker remains.

## 2026-09-13 — FS-F7-U3 merchandising accessibility semantics

The retained fixture Axe gate initially reported `link-name` on 20 image-only links: six category
icons, ten repeated client logos, and four journal images. It also reported `target-size` on the
eight Decor product-title links: each title was 22px high and its safe space from the adjacent
same-destination image link was 21px. The image links now have names derived from their visible
category, logo, or adjacent journal title. Each Decor product card retains its full-size image link
as the single product destination and renders the repeated footer title as non-interactive text,
preserving copy, destination, and visual layout while removing the competing small target.

After those findings cleared, the unchanged contrast checks exposed twelve previously masked
serious nodes: the four visible service descriptions had 3.3:1 contrast, and the eight live product
prices had 3.34:1 contrast. Region-scoped color rules repair those application-owned descriptions
and prices without changing copy or geometry. No Axe exclusion, rule suppression, accessibility
threshold, global announcer, custom keyboard protocol, Header, Footer, interaction-ledger row, or
commerce behavior changed.

### Proof-first and verification

- Strengthened the fixture serious-accessibility test with exact accessible-name assertions for all
  20 image links and observed the expected missing-name failure before production markup changed.
- Added a focused live merchandising test and observed all 20 `aria-label` values as `null` before
  implementation. The final test verifies the exact names and destinations, real Tab order across
  those links, eight retained full-size product destinations, non-interactive repeated titles,
  document overflow, and a scoped Axe pass without exclusions.
- The focused fixture serious Axe gate passed, including the unchanged contrast phase.
- The focused live gate passed at 1440, 1024, 768, and 390px; the main 1440 live merchandising,
  source-comparison, interaction, and layout flow also passed.
- The full Fashion `test:a11y` route audits passed 6/6. Its separate product-page skip-link test
  remains red because that build does not render `#fashion-store-main`; U3's dedicated merchandising
  keyboard traversal passes, and no shell/test-routing change was made outside this unit.
- `bun run typecheck`, changed-file ESLint, and changed-file Prettier passed. `git diff --check`
  passed after the checkpoint update.
- `behavior_changed=true`: accessible names, Decor card focus targets, and service-description
  contrast changed. Copy, destinations, visual geometry, library-owned interaction behavior, and
  all governed thresholds remain unchanged. No U3 blocker or settled-decision conflict remains.

## 2026-09-13 — FS-F7-U4 outcome-specific interaction ownership

The stabilized post-U3 Home fingerprint contains exactly 28 retained merchandising candidates:
two product-group tabs, eight cards with cart, wishlist, and quick-view controls, and two
collection-carousel arrows. Region-scoped semantic rows now separate local tab selection, cart
mutation, unavailable wishlist and quick-view utilities, and previous/next carousel movement.
The existing shared product-card navigation row remains the sole owner of product links. No
blanket Home-button selector, component markup, Header/Footer behavior, visual design, commerce
truth, accessibility behavior, or quality threshold changed.

### Proof-first and verification

- The retained rendered-ledger failure reproduced all 28 candidates with zero matching rows: two
  tab buttons, 24 card actions, and two collection controls. A new focused unit assertion for the
  six mutually exclusive outcome families then failed with an empty result before the interaction
  contract implementation changed.
- `bun test tests/fashion-store-interaction-contract.test.ts tests/fashion-store-theme.test.ts`
  passed 33 tests with 1,477 assertions after repair.
- The full interaction-ledger specification passed across desktop, laptop, tablet, and mobile: 9
  passed and 3 intentional non-desktop no-JavaScript skips. It proves the exact 28-candidate
  fingerprint, exact-one ownership for every rendered route candidate, and reverse coverage with no
  stale semantic row.
- Focused Theme behavior evidence passed five desktop tests covering pointer and keyboard tab
  selection, retained product navigation, preview-cart mutation, unavailable wishlist/quick-view
  behavior, bidirectional collection controls, responsive drag isolation, and reduced-motion
  movement truth.
- Tests inspected/changed: `fashion-store-interaction-contract.test.ts`,
  `fashion-store-interaction-ledger.spec.ts`, and `fashion-store-theme.spec.ts`; existing behavior
  evidence and product-card navigation tests were retained and exercised.
- `behavior_changed=false` for rendered storefront behavior: U4 changes semantic ownership and
  verification only. No settled-decision conflict or U4 blocker remains; U5 owns the full gate.

## 2026-09-13 — FS-F7-U5 full verification and handback

FS-F7 completed after every gate in its Verification Contract passed. The full gate exposed two
stale post-U3 assertions during verification: the live-commerce keyboard path still focused the
removed repeated Decor product-title link instead of the retained full-size product image link,
and the isolated Home width test incorrectly applied the body source-container width to the
independently canonical Footer shell. Both corrections are test-only and now assert the accepted
link semantics and shared-shell width owner. No Header/Footer implementation, commerce truth,
visual design, Axe configuration, motion budget, comparator, or quality threshold changed.

### Verification

- Focused Bun contracts: 46 passed, 0 failed, with 1,691 assertions across Home source, theme,
  preview-cart, and interaction-contract owners.
- Focused static browser owners: 171 passed, 77 intentional viewport-owner skips, 0 failed across
  the acceptance slice, Theme, behavior contract, Collection, and interaction ledger.
- Focused live merchandising: 4 passed, 0 failed across the four owned viewports.
- `bun run test:a11y`: 8 passed, 0 failed. The previously observed Product skip-link failure did
  not reproduce; `#fashion-store-main` was present, and no Axe exclusion, rule suppression, or
  threshold change was added.
- `bun run test:perf:motion`: 2 passed, 0 failed for the unchanged desktop and mobile profiles.
- Final `bun run test:fashion-store`: 53 Bun tests and 15 live-commerce tests passed; the generic
  static matrix passed 288 with 252 intentional skips; combined and isolated unified Home each
  passed 12 with 12 intentional skips; all fifteen behavior-report verifiers passed.
- The first two full-gate attempts were retained as characterization for the two stale assertions
  above. Each assertion received a focused passing rerun before the final complete gate exited 0.
- `bun run typecheck` passed. Changed-file ESLint completed with 0 errors; the CSS path produced
  only ESLint's expected no-matching-configuration warning. Changed-file Prettier and
  `git diff --check` passed after the governance update.
- `bun run build` passed with production fallback preparation, Nuxt generation, static
  finalization, and Wrangler dry-run packaging. The following `bun run verify:static` passed for
  10 indexable routes and 4 private commerce shells. An earlier verifier invocation correctly
  rejected the preview output left by the browser suite; rebuilding production output resolved
  the input-state mismatch without code changes.
- `bun test tools/verify-theme-change-impact.test.ts` passed 7 tests. The impact verifier dry-run
  selected `bun run test:theme-matrix` because the accumulated dirty tree contains shared theme
  infrastructure; this records the required conservative scope without taking ownership of DC3
  cross-template regression.

### Behavior changed

`behavior_changed=false` for U5. The unit changed only two verification assertions and governance
records. FS-F7 returned the product pointer only to FS-R4-U5; FS-F6-U4, REL, candidate, DC,
deployment, and PG state remain unchanged. No blocker remains in FS-F7.

## 2026-09-13 — Post-completion quality pass

Six reviewed simplification findings were applied without reopening FS-F7 or changing the active
`REL-Pre-DC` pointer. The Hero now pauses, plays, and reverts only its owned GSAP timeline rather
than sleeping or waking the process-wide ticker. The shared product-card runtime axis is named by
its actual surface (`catalog` or `home-merchandising`) instead of the retired Fashion/Decor split,
and the matching DOM, CSS, contract, and test selectors use `data-product-surface`. Live Home's
product-details anchor remains visually identical but is owned only by the existing product-route
navigation row; the fixture quick-view button and the stabilized 28-candidate fixture ledger are
unchanged. The obsolete Home-only Header contract and three unused category markers were removed.
The idle-trace RunTask metric now sorts activity intervals once and uses a monotonic sweep, while
preserving the exact fully-contained page-activity definition.

Two lower-value findings remain deliberately skipped: deriving both source-order declarations and
consolidating the local visually-hidden rule. Either would expand declaration-order or shared-style
dependencies without improving the accepted behavior.

### Verification

- Proof-first focused tests reproduced the former global-ticker, retired surface-axis, and
  quick-view selector ownership before the implementation changed.
- Focused Bun contracts passed 60 tests with 1,837 assertions across theme, live-commerce, Home
  source, interaction, and motion owners.
- The static interaction ledger passed 9 tests with 3 intentional viewport skips and retained its
  exact 28-candidate fingerprint. The fixture Home outcome test passed once with 3 intentional
  non-desktop skips.
- The live Home merchandising flow passed at 1440, 1024, 768, and 390px. It verifies the retained
  three-control geometry and animation while the details anchor has no quick-view marker and shares
  the same product destination as the primary image link.
- The dedicated motion gate passed both fixed profiles. Desktop and mobile retained green frame,
  paint, layerize, RunTask, and offscreen-owner budgets under the optimized trace query.
- Storefront typecheck, changed-file ESLint, changed-file Prettier, and `git diff --check` passed.
  The full Fashion gate was not rerun because the completed full-gate baseline was followed by
  focused coverage of every changed runtime, selector, contract, and performance surface.

`behavior_changed=true` only for internal ownership: unrelated GSAP users are no longer affected by
Hero suspension, and live product navigation is no longer mislabeled as unavailable quick-view.
Visible design, shopper outcomes, card geometry, fixture candidate count, motion metrics, Header,
Footer, commerce truth, candidate state, DC, deployment, and PG state are unchanged.

## 2026-09-13 — Formal review follow-up

The standalone review receipt `20260913-180027-d8b5be45` identified three substantive issues and
two delivery-state observations. The implementation issues are resolved: spatial screenshot
tolerance now compares both directions so a shifted pixel remains tolerated while deleted source
detail is still counted; live choose-options links are pure product navigation and no longer carry
the cart-action marker; and the active REL checkpoint now names the same deferred Home
configuration/immutable-Preview blocker already owned by the product master. The two observations
about untracked files remain non-findings for this local, deliberately uncommitted handoff; no file
was staged or committed.

Post-fix verification passed: the screenshot, interaction, and motion contract group passed 20
tests with 1,170 assertions; combined live Home passed 12 with 12 intentional skips; the static
interaction ledger passed 9 with 3 intentional skips; dedicated motion passed both fixed profiles;
and the complete Fashion Store gate passed 53 unit tests, 15 live-Commerce tests, the 540 static
matrix, both Home matrices, and all 15 behavior reports. Typecheck, accessibility 8/8, production
build, static verification, impact tests 7/7, Prettier, and `git diff --check` also passed. The
product pointer remains `REL-Pre-DC`; candidate, DC, deployment, and PG state remain unchanged.

## 2026-09-13 — Formal re-review closure

The follow-up receipt `20260913-185659-083f8c17` found two remaining authority-boundary issues.
Both are resolved without reopening FS-F7 or changing the accepted UI. Home merchandising product
actions now use a dedicated `home-merchandising-product-actions` behavior row tied to the actual
Decor source family `.tab-style-04 .shop-boxed`; the legacy Fashion `.shop-modern` row remains
separate. The new row records the approved preview-cart adaptation, truthful unavailable wishlist
and quick-view outcomes, removal of the duplicate title link, and static/interaction/fallback
evidence. The shared carousel no longer intercepts left/right keydown events; its existing
focus-scoped Swiper Keyboard module is again the sole owner of standard arrow-key behavior.

Focused contract tests passed 40/40 with 1,560 assertions. Exact browser index checks passed for
Home, Shop, and About, and the interaction ledger retained its exact 28-candidate fingerprint with
9 passes and 3 intentional viewport skips. After adding the new behavior ID to the existing
evidence recorder, the complete Fashion Store gate passed again: 53 Bun tests, 15 live-Commerce
tests, 288 static-matrix passes with 252 intentional skips, both Home profiles at 12 passes with 12
intentional skips, and all fifteen behavior verifiers (including 69 Home behavior-mode records).
Root typecheck, accessibility 8/8, production build, static verification, impact-selector tests
7/7, impact dry-run, changed-file Prettier, and `git diff --check` passed. The product pointer
remains `REL-Pre-DC`; candidate, DC, deployment, and PG state remain unchanged.

The final current-tree review also found the same keyboard-ownership issue in Home's dedicated
collection carousel. That carousel now enables and disables Swiper Keyboard with its focus region
and no longer intercepts left/right keydown events itself. The live regression checks the exact
next slide index, so duplicate movement from two keyboard owners would fail instead of merely
passing because the index changed. Storefront typecheck passed; the focused theme and motion
contracts passed 31 tests with 425 assertions; the focused live Home flow passed at all four
viewports; both complete Home matrices passed with 12 passes and 12 intentional skips each; and
the dedicated desktop/mobile motion gate passed both profiles. Visible design and shopper
outcomes remain unchanged.

The receipt `20260913-202324-11300698` then confirmed one evidence-model defect: semantic
`reducedMotion` outcomes reused the no-JavaScript fallback sentence even though JavaScript-backed
controls remain operable when motion is reduced. The interaction-contract helper now keeps
`noJs` on the declared fallback. Non-temporal behavior uses its interactive reduced-motion
outcome, temporal behavior uses its static fallback, and both collection arrows override that
default with exact immediate-transition/autoplay-paused wording. Exact assertions cover all six
Home merchandising rows and the eight rows belonging to the five other temporal behavior IDs.
Focused theme/interaction tests passed 34 tests with 1,523 assertions, storefront typecheck
passed, and the rendered interaction ledger passed 9 checks with 3 intentional viewport skips,
including its desktop no-JavaScript recovery audit and exact 28-candidate fingerprint. The final
current-tree receipt `20260913-closure-final/review.json` returned `Ready` with zero findings after
10 focused review tests, 1,146 assertions, typecheck, and `git diff --check`. This changes retained
contract truth only; runtime UI and product state remain unchanged.
