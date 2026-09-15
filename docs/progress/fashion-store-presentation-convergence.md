# Fashion Store Presentation Convergence Evidence

This file retains stable evidence for FS-R5. The FS-R5 plan and product master remain the only authorities for current-unit status, blockers, and next action.

## 2026-09-15 — U1 presentation-fork characterization

### Inventory summary

- Base registries diverge for four section types: Home, Product, Collection, and Content. Cart and Checkout already resolve to the same components and remain integration-validation surfaces.
- Successor Home registries diverge for nine types: Hero, Services, Categories, Promotion, Collection Feature, Brand Strip, Products, Marquee, and Editorial. Product Merchandising already resolves to one component.
- Whole-tree selection exists in `FashionStoreHomeRoute.vue`, `FashionStoreProductRoute.vue`, and `FashionStoreContentRoute.vue`; `FashionStoreCollectionPage.vue` also branches between collection landing and product-grid implementations.
- Fixture and live Home use two context readers, while Home merchandising retains one fixture/live discriminated union. These normalization forks belong to U2 rather than to visual components.
- Existing provider-specific selectors and filename assertions are characterization debt, not target contracts. U3-U7 replace them with shared route/section identities; U8 owns the final forbidden-fork and stale-reference audit.

### Surface ownership matrix

| Surface                          | Current fork and render shapes                                                                                                                                            | Canonical presentation and field authority                                                                                                                                                                                                                                                                                                                                             | Action and state authority                                                                                                                                                                                                                | Owning unit and primary evidence                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product                          | Fixture `theme-section` selects `FashionStoreProductPage`; live `product` selects `FashionStoreLiveProductPage`.                                                          | The accepted fixture page owns structure. Catalog Release/Commerce own product identity, description, price/compare-at, media, SKU, options, variants, availability, and related published membership. Experience/theme own supporting labels and decorative content. Synthetic reviews render a truthful zero/empty state; unsupported facts hide or use an accepted empty treatment. | A neutral port owns actions: fixture records local preview intents/cart state; live retains server revalidation, cart mutation, and error authority. Gallery, lightbox, tabs, quantity, and option selection remain local UI state.       | U2 contracts, U3 rendering, U8 selector cleanup. Unit owners: product and live-commerce tests; browser owners: Product source/interaction/responsive tests and live commerce/no-JS tests.                                    |
| Shop and Collection              | Fixture `theme-section` selects the Collection landing or accepted Shop page; live `collection-grid` selects the live wrapper/catalog.                                    | `/collections` remains a landing; `/shop`, Shop variants, and `/collections/:slug` remain product grids. The fixture grid/layout is canonical. Catalog owns collection order/membership and product facts; Experience owns intro/decorative content. Fixture filters, counts, and arrival groups survive only when derivable from authoritative catalog fields.                        | Fixture filtering/carousel/intents remain local; live cards use Commerce through the neutral product action port. Empty/error/unknown collection states never borrow fixture products.                                                    | U2 contracts, U4 rendering, U8 naming cleanup. Shop, Collection, and live-commerce unit/browser owners cover routing, source geometry, filters, keyboard/touch, history, responsive, cards, and errors.                      |
| Home foundation                  | Base Home switches between a fixture monolith and a reduced live page; successor registries select paired Hero, Services, Promotion, Brand Strip, and Marquee components. | The accepted fixture structure, `FashionStoreHomeShell`, approved section order, visible-copy budget, responsive rules, and motion contracts are canonical. Experience/theme own composition, editorial copy, and decorative assets; unsupported service promises are omitted.                                                                                                         | Navigation and local motion state only. Existing Hero/marquee owners retain timer, resize, visibility, remount, and reduced-motion behavior.                                                                                              | U2 normalization, U5 rendering, U8 legacy-root cleanup. Home source/theme/service-icon and unified-Home browser tests own composition, motion, responsive, and accessibility evidence.                                       |
| Home editorial and merchandising | Paired Categories, Collection Feature, Editorial, Best Sellers, Featured Products, and Products wrappers consume different fixture/live Home envelopes.                   | Fixture layout is canonical. Catalog owns product/card facts, order, identity, R2 media, price/compare-at, options, and availability. Experience/theme own headings, section composition, editorial labels, links, and decorative imagery. Unsupported fixture counts or editorial claims do not enter live mode.                                                                      | Fixture product interactions remain local; live product cards keep Commerce authority through the neutral action port. Empty and short collections are explicit bounded states.                                                           | U2 normalization, U6 rendering, U8 cleanup. Home source, merchandising/interaction contracts, empty-state, live-commerce, and unified-Home browser tests own evidence.                                                       |
| Content and recovery             | Fixture `theme-section` selects About, FAQ, Magazine, Article, Contact, Account, or Wishlist skeletons; live `state`/`collection-grid` selects one generic live page.     | Each accepted route-specific fixture skeleton is canonical. Experience owns published heading/message/media/link content; Catalog owns Wishlist recovery products. Fixture-only timeline, Q&A, address, author, comment, and similar facts require an authoritative source or a truthful empty/hidden treatment.                                                                       | Fixture forms may remain explicit local simulations. Live Account and Contact are unavailable/non-submit without an authoritative adapter. Wishlist persistence is not invented; live recovery cards may use authorized Commerce actions. | U2 contracts, U7 rendering, U8 generic-selector cleanup. Content/information/magazine unit and browser suites plus live-commerce tests own structure, actions, fallback, navigation, accessibility, and responsive evidence. |

### Behavior and state ledger

- Every affected family retains direct load, client navigation, Back/Forward restoration, remount, no-JavaScript, populated, empty, unavailable, malformed/error, desktop, and mobile coverage.
- Product and merchandising retain hover, focus, click, keyboard, touch, price/inventory refresh, retry, cart synchronization, gallery/lightbox, and option-combination coverage.
- Home retains load, scroll, timer, resize, visibility, reduced-motion, carousel/marquee, combined profile, and isolated profile coverage.
- Content retains accordion, tabs, pagination, form validation, local-simulation truth, focus restoration, and unavailable-action coverage.
- Shared Header, Footer, Shell, ProductCard, Gallery, MiniCart, Cart, and Checkout remain their existing owners and are regression surfaces, not new provider forks.

### Baseline evidence and disposition

- `fashion-store-theme.test.ts`, `fashion-store-home-source.test.ts`, and `fashion-store-live-commerce.test.ts`: 45 passed, 0 failed.
- Representative fixture browser baseline across Collection, Content, Product, and all three Shop variants: 44 passed, 26 project-inapplicable skips, 0 failed on desktop/mobile projects.
- Focused live browser baseline: 15 passed, 0 failed, including grouped options, cart/checkout, failure recovery, no-JavaScript, Home, and collection/Product presentation.
- Every identified fork is assigned to U2-U7, with U8 owning final compatibility, name, selector, and reverse-reference cleanup. R7-R10 and KTD1/KTD5 settle every observed field/action gap; no unresolved authority or route-semantic blocker remains.

## 2026-09-15 — U2 shared contracts and drift gates

### Outcome

- Fixture and live Product inputs now normalize into one validated Fashion presentation shape with stable Catalog identity required for live data, neutral control descriptors, truthful optional-region policy, bounded related product cards, and no preview-specific intent in serializable render data.
- The Product action boundary is one provider-neutral injected port. Fixture/local simulation and live Commerce revalidation remain adapter responsibilities for U3; shared presentation contracts contain no Commerce DTO or provider-mode selector.
- Composer Product output includes at most eight published related products from the selected Catalog Release collection membership. It reuses the existing product index and stops once the bounded result is full.
- Home sections have one neutral context resolver. Shared merchandising output contains normalized Fashion card presentations and no provider mode or raw fixture/live product union; the existing Decor Home consumer uses a named transitional reader until its U6 migration.
- Registry drift checks compare the union of section types, so a changed component identity or a mapping missing from either side fails. A boundary audit freezes the exact U3-U7 migration allowlist for whole-tree kind switches, duplicate contexts, raw provider unions, and direct action selection.

### Verification

- Contract/provider/composer/live-commerce owners: 68 passed, 0 failed.
- Registry identity and missing-mapping gate: 1 passed, 0 failed.
- Storefront `nuxt typecheck`, affected-file ESLint, and `git diff --check`: passed.
- Simplification applied three reuse fixes, four quality fixes, and one efficiency fix. No substantive finding remains. The regex-based source audit is intentionally a migration guard rather than a semantic parser; U8 retains reverse-reference and complete runtime/test evidence as the final enforcement backstop.
- The complete package-registry file retains one pre-existing generated-mode-sensitive assertion: checked-in live `active-theme.ts` correctly omits the fixture registry while that old assertion expects a fixture import. The new registry gate passes independently, and U2 does not change generated-mode selection.

## 2026-09-15 — U3 shared Product presentation

### Outcome

- Fixture and live registries now resolve `fashion-store.product` directly to one `FashionStoreProductPage.vue`; the route-level kind switch and reduced live Product page are deleted.
- The accepted fixture Product structure now consumes one normalized presentation and one neutral action port. Fixture cart/wishlist intents stay local, while live revalidates current price, inventory, variants, SKU, and cart input before mutation and reports unavailable or failed outcomes without false success.
- Unsupported ratings, review counts, specifications, and shipping claims use the agreed zero/empty treatment. Safe live media accepts HTTPS and true root-relative paths while rejecting protocol-relative origins.
- Related products derive from published Catalog collection membership when no explicit related binding exists. Normalized card controls retain fixture quick actions without treating media shape as a provider signal; live cards without verifiable direct-purchase data navigate to Product instead of writing a preview cart.
- Product identity changes reset option, quantity, gallery, tab, status, and counters. The action port reads the current reactive presentation and stale revalidation responses are discarded; a Product-to-Product SPA navigation and Back traversal now prove that state does not leak.

### Verification

- Focused Product, provider, Commerce, composer, runtime, boundary, and schema tests: 84 passed, 0 failed after simplification.
- Fixture Product browser: 17 passed with 13 viewport-specific skips in the complete focused run; the two source-structure desktop/mobile cases passed after neutral card-control refinement. The earlier pre-simplification run passed 19 with 13 skips.
- Live Commerce browser: the pre-simplification suite passed 15/15; after simplification the Product option/cart/no-JavaScript/SPA/Back scenario passed with the remaining 14 scenarios unchanged and previously green in the same review run.
- Preview production build, `nuxt typecheck`, affected ESLint, Prettier, repository import boundaries, and `git diff --check`: passed. Generated/public artifacts were restored to the committed remote-live state.
- Existing Nuxt conditional layout/page and renderer `instance` warnings remain unchanged. The generated-mode-sensitive package-registry assertion remains assigned to U8.

## 2026-09-15 — U4 shared Shop and Collection presentation

### Outcome

- Fixture and live inputs normalize into one Fashion-owned catalog presentation before rendering. `/collections` remains a category landing, while `/shop`, its layout variants, and `/collections/:slug` use the accepted Shop grid and shared ProductCard.
- Fixture filters, counts, arrivals, pagination, preview actions, and source imagery remain deterministic. Live uses Catalog collection membership, R2 media, prices, compare-at labels, and purchase routing, and omits filters, arrivals, and pagination when the selected release cannot authoritatively supply them.
- Both registries resolve `fashion-store.collection` to `FashionStoreCollectionPage.vue`. The live-only Collection wrapper and reduced catalog component are deleted, and tests no longer preserve provider-specific component identities.
- Presentation changes reset filter, page, and arrival state. Direct navigation and `/collections → /collections/:slug → /shop → Back` traversal retain route semantics without fixture fallback or stale state.

### Verification

- Focused catalog, ProductCard, registry, provider, and boundary suites: 50 passed, 0 failed after simplification.
- Fixture Collection and Shop browser suite: 25 passed with 23 viewport-specific skips; after unified-card refinement, the four affected desktop geometry/filter/action cases passed, including the regression that exposed and fixed legacy-field reads in the local cart branch.
- Live Commerce browser suite passed 15/15 before final contract simplification; the new dedicated landing/detail/Shop/history scenario passed again after normalization. Existing Nuxt conditional layout/page and renderer `instance` warnings remain unchanged.
- Storefront `nuxt typecheck`, affected ESLint, Prettier, repository import boundaries, and `git diff --check` passed. Generated/public artifacts were restored to the committed remote-live state.

## 2026-09-15 — U5 shared foundational Home presentation

### Outcome

- Fixture and live successor registries now resolve Hero, Services, Promotion, Brand Strip, and Marquee to the same neutral components. The ten provider-specific component files and the two provider-specific Home context readers are removed.
- One Home foundation resolver normalizes fixture and live services, promotion, brands, and marquee content without leaking provider selection into the components. Live keeps truthful collection routing and omits the fixture-only promotion code; both modes retain the accepted fixture structure and visual classes.
- Hero continues to use the established shared Decor-derived motion owner. Marquee retains viewport, document-visibility, reduced-motion, remount, and teardown behavior without introducing a second timer or motion implementation.
- A registry-identity assertion now freezes the five converged mappings while U6-owned editorial and merchandising sections remain explicitly paired.

### Verification

- Focused Home source, registry, service-icon, provider-boundary, and live-commerce suites: 64 passed, 0 failed.
- Combined and isolated Home browser profiles each passed 12 applicable cases with 12 viewport-specific skips, covering desktop/mobile, normal/reduced-motion, composition, route behavior, and approved presentations.
- Motion/performance browser evidence passed 2/2 across desktop DPR2 and mobile DPR3. Visible Hero budgets remained within thresholds; offscreen and reduced-motion samples recorded zero animation frames and zero layer/paint lifecycle work.
- Storefront typecheck, affected lint/format, repository boundary, and diff checks completed before commit. Generated/public artifacts were restored to the committed remote-live state; existing Nuxt conditional layout/page and renderer `instance` warnings remain unchanged.

## 2026-09-15 — U6 Home editorial and merchandising implementation checkpoint

### Outcome

- Fixture and live successor registries now resolve Categories, Collection Feature, Editorial, Best Sellers, Featured Products, Products, and Product Merchandising through shared components and normalized Home contracts. Twelve paired provider-specific components are removed.
- Live product cards retain Catalog identities, R2 media, current/compare-at prices, purchase routing, truthful empty/error states, and runtime Commerce actions; fixture cards retain local preview actions. Editorial/theme content no longer borrows fixture-only counts, dates, authors, or sale claims in live mode.
- The shared carousel now pauses autoplay outside the viewport and exposes its semantic slide count. This removed the reproducible offscreen Swiper animation leak; offscreen and reduced-idle performance samples now report zero effective work.

### Verification and open gate

- Focused Home/registry/Commerce tests, Storefront typecheck, live Home/Commerce browser coverage, fixture desktop/responsive critical paths, and combined/isolated Home matrices passed. Paired component names and the legacy merchandising reader are absent from runtime source.
- U6 is not complete: the unchanged dedicated motion/performance gate remains red on visible-Hero Layerize and RunTask budgets after convergence. A clean exported U5 control measured 200.665 ms Layerize and 1298.672 ms RunTask in the same environment; current U6 desktop samples repeatedly measured roughly 566–711 ms Layerize and 1459–1828 ms RunTask. The control itself narrowly missed only RunTask in that sample, while U6 reproducibly adds a material Layerize regression.
- Thresholds were not changed. Temporary visibility, containment, transition, and component-family isolation probes were removed after they failed to identify a safe production fix. The next action remains U6.3 profiling and optimization; U7 has not started.

## 2026-09-15 — U6 motion gate closure

### Outcome

- Trace diagnostics isolated the regression to GSAP writing eight Hero layer styles on every animation frame. With the larger converged Home mounted, those writes forced Chromium to rebuild the full page layer tree each frame; the cost was not caused by a long layout task or by background carousel motion.
- GSAP remains the Hero lifecycle and timing owner, including completion, pause/resume, teardown, and runtime-load failure fallback. Opacity, translate, and scale interpolation now runs through compositor-backed Web Animations, preserving the existing layer order, delays, durations, easing intent, and static final state without main-thread style writes on every frame.
- No content is hidden or delayed, no performance threshold changed, and the earlier carousel viewport suspension remains intact.

### Verification

- Focused Hero/motion contract tests: 32 passed, 0 failed; Storefront typecheck passed.
- Hero desktop/mobile browser regression: 12 passed, 6 viewport-inapplicable skips, 0 failed. Static first paint, accepted layer choreography, offscreen pause/resume, native Swiper threshold/lazy preload, no-JavaScript, source timing, complete-cycle remount, and GSAP-load fallback remain green.
- The unchanged full motion/performance matrix passed 2/2. Desktop medians were 37.768 ms Layerize, 169.3 ms paint lifecycle, and 916.9 ms RunTask; mobile medians were 40.992 ms, 96.329 ms, and 663.414 ms respectively, against 250/250/1200 ms limits. Both offscreen and reduced-idle controls recorded zero Layerize, paint lifecycle, and effective page-activity RunTask work.
- U6 is complete. The next Fashion convergence unit is U7; the product master keeps `ADM-LIST-U5` active and advances only the preserved Fashion return pointer to `FS-R5-U7`.

## 2026-09-15 — U7 shared content and recovery presentation

### Outcome

- Fixture and live registries now resolve `fashion-store.content` directly to one `FashionStoreContentPage.vue`. The generic live content page and provider-kind route wrapper are deleted.
- About, FAQ, Magazine, Article, Contact, Account, and Wishlist data shapes now belong to a provider-neutral content presentation contract. Fixture implementations satisfy that contract; route components no longer inspect raw presentation unions.
- Structured fixture content retains each accepted route-specific information architecture and local-only interactions. Live unavailable routes use the same canonical route owner with truthful headings, messages, exits, and no simulated Account or Contact submission.
- Live Wishlist recovery renders published Catalog products through the shared ProductCard contract. Direct navigation, SPA navigation, browser Back restoration, and no-JavaScript output retain route identity without fixture content leakage or stale local state.
- Carousel viewport suspension is opt-in and enabled only for the converged Home collection feature. This preserves the independently governed About carousel autoplay contract while retaining U6's offscreen Home performance behavior.

### Verification

- Focused content, information, magazine, registry, live-commerce, and motion owners: 71 passed, 0 failed; Storefront typecheck, affected ESLint, Prettier, repository import boundaries, and diff checks passed.
- Fixture content/information/magazine browser matrix: 26 applicable cases passed, 20 project-inapplicable cases skipped, 0 failed across desktop/mobile projects.
- The focused live unsupported-content and Wishlist recovery scenario passed with accessibility, SPA return, browser Back, and no-JavaScript assertions. The complete live suite passed 16/16 during U7 implementation.
- The unchanged full motion/performance matrix remained green after scoping offscreen carousel suspension to Home: desktop measured 38.998 ms Layerize, 111.966 ms paint lifecycle, and 671.844 ms RunTask; mobile measured 43.642 ms, 91.444 ms, and 620.067 ms. Offscreen and reduced-idle controls remained zero.
- U7 is complete. The next Fashion convergence unit is U8; the product master keeps `ADM-LIST-U6` active and advances only the preserved Fashion return pointer to `FS-R5-U8`.

## 2026-09-15 — U8 final convergence and governed handback

### Outcome

- Fixture and live registries now import one shared async page registry, so Cart, Checkout, Collection, Content, and Product use exact component identity across both providers. Home remains the canonical decomposed section sequence.
- The retired whole-Home component, route dispatcher, and live Home page are deleted. Provider-specific visual filenames, the old live-home readiness selector, and the duplicate fixture/live Decor Home model aliases are absent from the active component graph.
- Product review behavior and named-state/evidence expectations now match the rendered contract. Carousel probes explicitly establish viewport and hover readiness, preventing offscreen pause behavior from creating timing-only test drift.

### Verification

- Focused registry, interaction, provider, fixture-boundary, and Fashion contract suites passed 70/70 after simplification; Storefront typecheck, affected ESLint, formatting, import boundaries, theme catalog verification, and source-equivalence policy/tests passed.
- The complete live Commerce matrix passed 16/16. The complete fixture browser matrix passed 288 applicable cases with 252 intentional viewport/profile skips; all fifteen page behavior reports verified. Combined and isolated Home profiles each passed 12 applicable cases with 12 intentional skips.
- Accessibility passed 8/8. The unchanged motion/performance gate passed 2/2 on desktop DPR2 and mobile DPR3 with zero effective offscreen and reduced-idle work. Mobile Lighthouse route budgets passed after one transient Home retry.
- `FS-R5-U1` through `FS-R5-U8` are complete. Authority returns to the preserved `REL-Pre-DC` tail without freezing a candidate or advancing DC, deployment, or PG state.
