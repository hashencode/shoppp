# Fashion Store shared style ownership evidence

Date: 2026-09-03

Authority: `docs/plans/2026-09-03-1417-fix-fashion-store-shared-styles-plan.md`.
This is an evidence inventory, not an execution checkpoint or a candidate verdict. The feature
plan owns execution state; the product master owns the active pointer. FS-R9, FS-R22,
FS-KTD23/24/25/42 remain inherited authority for routes, visual parity, typed actions, and
risk-tiered verification. This local corrective work does not complete or reopen a DC or PG gate.

## Evidence boundaries

The inventory below is a source inspection of the implementation before style migration. Line
numbers identify that inspected baseline and may move during implementation. The initial inventory was source-only; runtime results are recorded below.

The previously reported browser reproduction is retained as session evidence: on the fixture
product route `/products/relaxed-corduroy-shirt`, progress was approximately 47.6% but the progress
point remained 0 px high, and the scroll button showed a dark block; Home had a transparent button
and a nonzero point height. This is a confirmed defect, not an approved visual baseline. Other
potential issues below are not claimed as runtime failures without a matching observation.

Source authority inspected:

- `apps/storefront/app/themes/fashion-store/upstream/demo-fashion-store.html` and
  `demo-fashion-store-single-product.html`: both use an anchor for the scroll control;
  the Vue Shell correctly makes the action a button under FS-KTD23.
- Theme `upstream/css/style.css`, `upstream/css/responsive.css`, and
  `upstream/demos/fashion-store/fashion-store.css`: inherited Crafto styling remains theme-owned.
  `apps/storefront/nuxt.config.ts` loads these before `integration.css`.
- `docs/progress/fashion-store-page-suite-qa.md`: the 2026-08-10 review retained shared semantic
  button fixes and shared cards. Its recorded desktop viewport was 1280 × 720; that evidence does
  not cover the scroll control's 1400 px display boundary.
- `docs/progress/fashion-store-functional-integration.md`: fixture/source parity and live
  Commerce evidence remain separate; historical full-suite success does not establish a new
  computed-style baseline for this migration.

## Component and route map

| Owner         | Uses inspected                                                                                  | Relevant boundary                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell         | Fixture Home, live Home, fixture page components, live product/content and catalog compositions | Owns cookie, sticky social, and scroll markup; body identity currently defaults to Home.                                                                                  |
| Header        | Every Shell page                                                                                | Owns navigation, SearchOverlay, and MiniCart composition; live capability flags hide unavailable search/account/wishlist controls.                                        |
| Footer        | Every Shell page                                                                                | Owns footer content and live newsletter/account visibility.                                                                                                               |
| SearchOverlay | Header when search is available                                                                 | Upstream class-driven popup styles; Shell supplies the existing `show-search-popup` body state.                                                                           |
| MiniCart      | Header                                                                                          | Both fixture and live branches use semantic buttons with `fashion-store-source-action`; same open/close implementation.                                                   |
| ProductCard   | Live Home/content/catalog, fixture Shop, Wishlist, and product recommendations                  | Has `data-fashion-store-product-card` and an existing `data-card-variant` derived from the presentation contract. Fixture Home still contains source-shaped inline cards. |

`FashionStoreHome.vue` and `FashionStoreLiveHomePage.vue` omit `body-class` and inherit the Home
default. Nonhome components explicitly clear it. The complete call-site search must include
`components/shared/FashionStoreLiveCatalog.vue` as well as `components/pages/`; inspecting only the
`pages/` directory misses a live route composition.

## Rule inventory and handling decisions

All `integration.css` references below are within
`apps/storefront/app/themes/fashion-store/`. Keep upstream files unchanged.

| Rule group in inspected baseline                                                                                          | Correct owner and affected routes                                   | Evidence / classification                                                                                                                                                                                                                                                                                                                    | Minimal handling                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integration.css:554–564`, Home `.scroll-progress .scroll-top` reset and `.scroll-point` height                           | Shell; every route using it                                         | Confirmed missing internal style outside Home. Upstream `style.css:2931–2977` supplies position, difference blending, a 60 px line, and point width, but no point height or semantic-button reset. Runtime already writes `--fashion-store-scroll-progress` (`runtime/capabilities.ts:67`).                                                  | Move only the reset and height expression to Shell-owned scoped rules. Preserve runtime, DOM semantics, and display breakpoint.                                                                                                                                             |
| `FashionStoreShell.vue:28` default `bodyClass: "fashion-store-home"`                                                      | Page identity, not shared component default                         | Confirmed implicit Home identity; current internal pages avoid it by supplying an empty value.                                                                                                                                                                                                                                               | Use a neutral Shell default; explicitly identify fixture and live Home. Audit all call sites together, including live catalog. Do not put Home identity on inner pages.                                                                                                     |
| `integration.css:30–37`, `[data-fashion-store-header] .fashion-store-source-action`                                       | Header's own action buttons; MiniCart's trigger and remove buttons  | Shared anchor-to-button compatibility reset already applies on every route. Descendant matching also reaches MiniCart internals.                                                                                                                                                                                                             | Keep reset equivalent; colocate Header-owned rules and give MiniCart its own reset if moving to scoped styles. Header scoped selectors alone must not accidentally stop reaching MiniCart descendants.                                                                      |
| `integration.css:39–51`, common cart padding and close target; `:450–455`, Home cart padding                              | MiniCart with an explicit Home presentation variant                 | Common left padding is 18 px; Home overrides it to 14 px. Upstream fashion CSS:42 uses 18 px for an **anchor**, with 12/10 px responsive anchor rules at :193/:211; those do not match the Vue button. Existing Home 14 px is a retained adaptation, not justified as an upstream universal value. Remove targets retain 32 px minimum size. | Preserve 14 px Home versus 18 px nonhome initially, including current responsive outcome, via a narrow explicit variant passed through Header. Do not silently normalize to either number or copy anchor breakpoints to buttons. Capture computed geometry before changing. |
| `integration.css:417–455`, `:593–596`, `:633–637`, `:661–664`: Home navbar line-height/padding, container and row gutters | Header internals with Home variant; page content owns its own grids | Home 15 px container/row normalization also matches Header dropdown grids. Navbar container restores 45 px, 35 px at ≤1199, and 0 at ≤991; upstream `style.css:6822` and `responsive.css:18905/:19649` establish the same source gutter pattern. At tablet Home navbar adds 15 px side padding.                                              | Preserve exact current Header geometry using explicit Home scope inside the component. Narrow page grid normalization so it no longer indirectly repairs shared descendants. Do not apply Home grid rules to all pages.                                                     |
| `integration.css:458–460`, `:633–637`, `:755–757`; common Header rules at :1561, :1571, :1639                             | Header top offset; page owns content clearance                      | Both copies use top 40 px desktop / 41 px tablet / 0 phone with `!important`; global Header rules already provide the same offsets. Shop-specific header selector at :370 has a weaker non-important desktop rule.                                                                                                                           | Candidate duplicate removal after matched geometry checks. Keep page hero/top-space margins separate; removing a Header copy does not authorize removing page content clearance.                                                                                            |
| `integration.css:627–629`, `:655–657`, `:687–689`: Home footer margins                                                    | Home page's placement of Footer                                     | Explicit tiny external offsets: −0.203125 px at 992–1199, +0.015625 px at 768–991, −0.109375 px at ≥1200. These are not necessary Footer internals, and their exact historical rationale was not established by this source read.                                                                                                            | Preserve as page-level external placement. Can use a named root class on the Footer selected by Home. Do not spread offsets to inner pages or delete them as noise.                                                                                                         |
| `integration.css:422–441` Home container/row normalization as applied inside Footer                                       | Footer internal layout, Home variant                                | Upstream base grid also uses ±15 px (`style.css:170–180`), but page-qualified selector has greater specificity and can override nested utility layouts. Declaration equality is not proof of visual equivalence.                                                                                                                             | If narrowing page rules, preserve Home Footer internals with an explicit variant first. Compare footer regions before removing repeated rules.                                                                                                                              |
| `integration.css:1753–1763`, `.footer-dark …` color/opacity adaptations                                                   | Footer on every route                                               | Common adaptation is already not Home-dependent; `#a8a8a8 !important` affects links, contact text, placeholder and legal text. Upstream demo stylesheet provides general Footer design.                                                                                                                                                      | Retain or move exactly into Footer scope; do not change colors as part of ownership work. Live visibility flags remain intact.                                                                                                                                              |
| `integration.css:406–409`, Home `button.sr-only`                                                                          | Fixture Home hero prelude                                           | Actual matching buttons are `FashionStoreHome.vue:166–175` slide controls. Shared Search/Shell/Card use hidden **spans or paragraphs**, not these buttons.                                                                                                                                                                                   | Keep local to fixture Home/prelude. It is not a shared-button reset to globalize.                                                                                                                                                                                           |
| `integration.css:411–415`, Home button/link `:focus-visible`; `:468–471` pointer cursor                                   | Theme/page policy and owned shared controls                         | Home rules reach Header, Search, MiniCart, Footer, cookie and scroll controls. Upstream `style.css:155` removes focus outlines globally; nonhome shared controls do not automatically receive this Home restoration. This is a source-backed candidate keyboard gap; runtime appearance remains unverified.                                  | Check focused shared controls on Home and an inner page. Preserve the existing Home appearance; fix any reproducible missing cue narrowly at the owning component. Do not create a new global focus system, extra announcements, or keyboard protocol.                      |
| `integration.css:53–57` product-card hover button reset and `:400–404` Home duplicate                                     | ProductCard versus fixture Home's inline cards                      | Identical reset declarations overlap on live Home shared cards. Fixture Home contains 15 inline `.shop-hover` groups without the component's data attribute, so its Home reset still has actual users.                                                                                                                                       | Give shared cards their own reset; retain a narrowed fixture-Home reset for inline source markup. Do not delete the Home rule wholesale or refactor fixture composition solely to remove this duplication.                                                                  |
| `integration.css:318–354`, common card action state / focus-within / coarse-pointer rules                                 | ProductCard action visibility; Shop's `actions-open` layout         | Shared rules already work independent of Home. `.shop-modern` context expresses the existing display pattern; Shop-specific `actions-open` rules are page/runtime state, not proven missing shared styles.                                                                                                                                   | Preserve behavior and existing card variants. Any colocation must retain ancestor-dependent `.shop-modern` matching and Shop state semantics; do not mechanically scope selectors that need a parent outside the SFC.                                                       |
| `integration.css:1140–1145`, Shop/Wishlist card Add-to-cart typography                                                    | Existing card presentation difference                               | 24 px line height and 500 weight apply to Shop/Wishlist, not recommendations or Home. Existing ProductCard has a presentation variant contract; this read did not establish that the difference is a defect.                                                                                                                                 | Preserve as an explicit existing presentation difference if touching it; otherwise leave outside minimal migration. No new purchase/action behavior.                                                                                                                        |
| `integration.css:736–740`, `:763–766`, Home large buttons                                                                 | Home content adaptation; potentially matching MiniCart descendants  | Upstream demo CSS:84/:97/:200 has equivalent Home button values, but the much stronger upstream `.header-cart-icon .header-cart .cart-item-list .cart-total .btn.btn-large` (`style.css:19067`) sets 14 px and 11 px 20 px. Selector matching alone does **not** establish a MiniCart geometry difference.                                   | Keep page content rule. If narrowing it, check computed MiniCart font/padding first; do not invent a cart variant for a declaration that loses the cascade.                                                                                                                 |
| Search trigger min-target rule `integration.css:1739–1751`; upstream search popup rules                                   | SearchOverlay, every route where available                          | Popup close and search submit already receive transparent backgrounds and no border from upstream `style.css:8891–8928`. Search uses the existing Shell-managed open body class, not Home identity.                                                                                                                                          | Retain inherited popup styling and focus/open/close implementation. Trigger minimum 24 px target can move to its component if appropriate; check focused close/submit cues separately. No wholesale search rewrite is warranted.                                            |
| Cookie/sticky styles inherited from upstream; no Home cookie-specific reset                                               | Shell, every route                                                  | Cookie uses standard `.btn` classes; source `style.css:2921` owns fixed geometry and responsive CSS owns mobile layout. Existing Shell explicitly controls visibility.                                                                                                                                                                       | Keep upstream inheritance and existing behavior; verify cookie visible/dismissed states when neutralizing Shell identity. Do not introduce a new cookie UI or storage policy.                                                                                               |
| Home section-index selectors, hero, collections, marquee, product-slice and reduced-motion blocks                         | Home content and its existing fallback policy                       | `section:nth-of-type(4/8/10)`, collection track geometry, fractional grid offsets, animations, and Home content button typography reproduce this page's composition.                                                                                                                                                                         | Keep page-owned; not evidence that all theme CSS should become scoped. Preserve existing no-JS and reduced-motion strategy.                                                                                                                                                 |

## Runtime baselines needed to decide equivalence

The implementation owner must retain matched before/after observations; this inventory supplies
no substitute for those results.

- At 1440 × 900, 768 × 1024, and 390 × 844, capture Header and Footer regions on Home, the named
  product route, and a representative Shop route. Include computed Header/navbar/container
  gutters, cart-trigger padding, and footer external margin. Include 1024 px only if migrating
  the distinct 992–1199 rule group requires resolving an uncovered difference.
- Capture an open fixture MiniCart and focused search controls on Home and an inner page;
  measure cart CTA font size/padding before assuming the Home large-button rule wins.
- Inspect a shared card in live Home and in Shop/recommendations, plus one fixture Home inline
  card. Preserve actual hover, keyboard and coarse-pointer action states; static hidden controls
  cannot establish the reset worked.
- Reproduce the scroll failure before repair at ≥1400 px; then capture transparent button and
  nonzero/increasing point height in scroll-fixed mode on Home and product. Verify 1399/1400
  display boundary, return-to-top without URL change, and route reuse.
- Check direct load and Home → Product → Shop → Home plus history navigation for body identity,
  style retention and transient state cleanup. Confirm live hidden capability controls stay
  hidden and cookie dismissal remains usable. Use real live evidence for any live Commerce
  claim; fixture checks only establish the fixture lane.

## Minimal migration recommendation

Repair Shell's two scroll rules first. Make Home identity explicit, preserving page-only grids
and fallback rules. Move necessary shared-button/reset rules to their owners; use a narrow Home
presentation variant only where source inspection or matched runtime evidence demonstrates an
existing difference. Retain Home's external footer offsets as page placement. Keep upstream
theme styles, existing semantics, visual runtime and Commerce behavior unchanged. Deduplicate
only proven equivalents, and record focused visual/interaction outcomes alongside this inventory.

## Baseline browser evidence

The implementation run captured Header, open MiniCart, visible ProductCard (where present), and
Footer regions on Home, Product, and Collections at 1440×1000, 768×1024, and 390×844.
Artifacts: `apps/storefront/test-results/shared-styles-before/` (local, ignored).
All nine appearance/interaction cases passed. With normal motion the desktop Home progress
case passed, while Product and Collections failed on the exact expected defect: scroll button
background was `rgb(239, 239, 239)` instead of transparent. Tablet/mobile preserved hidden rails.
Total: 16 passed, 2 expected defect failures. No screenshot baseline was rewritten.

## Implementation decisions

- Shell owns the scroll reset and height in scoped CSS; its default is now `variant="page"`.
  Fixture/live Home explicitly select `variant="home"`; all 15 explicit empty-body-class callers
  were migrated, including LiveCatalog. The dynamic platform Shell caller in `app/StorefrontExperience.vue`
  also drops its obsolete empty `body-class` attribute. Header/Footer receive a narrow `homeLayout` flag and
  MiniCart retains 14 px Home / 18 px inner-page trigger padding.
- Header owns its reset, Home gutters and common breakpoint offsets. Footer owns Home internal
  gutters and existing contrast adjustments. Page-level grid normalization excludes Header/Footer
  descendants; the tiny external Footer placement offsets remain page-owned.
- MiniCart, SearchOverlay and shared ProductCard own their existing control resets/target sizing.
  Fixture Home retains its inline-card reset, excluding shared cards. Existing ProductCard
  ancestor-dependent display states and upstream styles remain unchanged.
- The potential focus gap was disproved: the new focused-search assertion passes Home, Product
  and Collections before migration. `app/assets/css/main.css` supplies the nonhome 3 px solid
  focus outline; Home deliberately retains its 2 px theme adaptation. No custom focus behavior
  or new accessibility protocol was added.
- Scroll regression turned green on all three desktop routes after the two-rule repair. The
  subsequent representative appearance/interaction/progress run passed all 18 cases across
  desktop, tablet and mobile. Storefront typecheck and 18 relevant source/capture/live boundary
  unit tests also passed. Detailed retained comparison and route results follow below.

## Retained verification evidence

- `fashion-store-shared-style-comparison.json`: 44 component regions and 12 computed geometry
  records matched the original implementation across 1440×1000, 1024×900, 768×1024, and 390×844.
  All dimensions matched and all changed-pixel ratios were zero at the existing channel tolerance 16. This includes Home/inner-page cart padding and CTA size, Header gutters, Footer geometry,
  and actual Header/open MiniCart/ProductCard/Footer PNGs. No approved source baseline changed.
- Passed screenshot artifacts were initially buffered in the reporter. The baseline was therefore
  recaptured from exact original HEAD production bytes, with final edits backed up and restored
  byte-for-byte. A mobile Product Footer taller than its viewport exposed an offscreen fixed skip
  link in locator capture; matching viewport height to the entire Footer removed that capture
  artifact. The corrected mobile pair is retained separately and supersedes that single pair.
- All 15 route-contract entries passed shared-shell smoke at desktop/tablet/mobile: 45 cases.
  Initial Home assertions incorrectly assumed eager reduced-motion hydration; the corrected check
  activates Search before checking the single runtime, preserving the established deferred policy.
- Home → Product → Collections → Home and browser back/back/forward/forward passed with correct
  body identity, one runtime, transparent scroll controls, accurate progress, and no horizontal
  overflow. Fixture anchors use native document navigation; the test preserves that behavior.
  It does not impose a new client-navigation contract or use navigation-entry count as proof of SPA.
- The 1399/1400 px boundary at 900 px height passed. Three desktop scroll routes passed again on
  the final migrated implementation; the existing no-JavaScript native-browse recovery check passed.
  Existing reduced-motion readable-content and mobile-menu focus-restoration checks passed.
- In the user's Chrome Product tab, scrollY 1003.5 of 2107 corresponded to a 28.5703125 px point
  on its 60 px rail (47.6%); computed button background was transparent. The real screenshot
  showed the expected text and thin progress rail with no solid rectangle.
- Simplification review completed reuse/quality/efficiency lenses. No changes were needed:
  the suggested generic search probe has a different timing/error/URL-check contract, while local
  assertions remain clear; PNG/geometry files are intentionally retained for planned regional
  comparison, so suggestions to omit or buffer those artifacts were not adopted.

- Live verification passed five selected cases across the final runs: Home sections/cards through
  keyboard/pointer/touch and responsive boundaries; build-local search/client navigation and Back;
  unsupported-route truthfulness; MiniCart/cart-page synchronization; Cart/Checkout without JS.
  Home explicitly retains its identity/14 px cart padding and inner pages use the neutral/18 px
  variant. The initial Home-only assertion mistakenly targeted the styled Add-to-cart CTA instead
  of the reset-only hover actions; correcting the test target preserved upstream styling.
- Live startup first stopped at Nuxt's existing-dev lock. The original fixture server was stopped
  for sequential execution and restored at `http://127.0.0.1:3435/`; no lock bypass was used.
  Both generated selection files match their original saved bytes, including user formatting WIP.
- Live development logs still contain upstream missing source-map notices, conditional
  NuxtPage/NuxtLayout notices, and the existing section `instance` attribute warning through
  fragment-root compositions. This repair does not change those input/fallthrough behaviors or
  claim a warning-free framework build. The obsolete `body-class` platform-shell argument was
  removed as part of the API migration.
- Storefront typecheck, changed Vue/TypeScript ESLint, Prettier, 18 focused unit tests (201
  assertions), import-boundary validation, and whitespace checks passed. CSS uses Prettier;
  the repository's ESLint configuration does not match CSS files.

## Review and delivery receipt

Code review completed: `shoppp-20260903-shared-styles`, artifact root
`/tmp/ce-code-review/shoppp-20260903-shared-styles`, verdict Ready to merge, zero actionable findings.
Correctness, project standards, testing, maintainability, adversarial and learnings lenses completed;
no different-family local executable was available, so the documented local adversarial fallback
was used. Two test-policy suggestions were independently rejected against the actual plan/standards.
The obsolete dynamic Shell argument found during review was removed.

The final nine representative fixture control cases passed again with ongoing assertions for
MiniCart transparency/Home-versus-page padding and visible focused card-action resets. The original
Product preview is restored in Chrome on port 3435 in fixture mode with a transparent scroll button.
Local delivery excludes generated selection WIP and all concurrent Admin edits. No PR, deployment,
full historical U8 replay, DC or PG execution was performed by this correction.
