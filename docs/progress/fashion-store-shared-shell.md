# Fashion Store Shared Shell Evidence

This file retains focused evidence for FS-R4. Execution status, current-unit ownership, blockers, and next action remain authoritative only in the FS-R4 plan and the product master pointer.

## 2026-09-13 — U1 activation and characterization

### Outcome

- FS-R4 was activated and U1 completed without changing runtime behavior.
- The product master pointer now names FS-R4-U2. The preserved parallel checkpoint remains FS-F6-U4; its six blockers are unchanged and are not claimed by this plan.
- `fashion-store` already has one shared Header and Footer component owner, but current inputs select two materially different presentations. The discrepancy observed between Home and internal routes is therefore real, not a second component implementation.

### Render and configuration ownership

- Home templates use `ThemeRenderer` with `successor/registry.ts`'s `rendererShell: FashionStoreHomeShell`. `FashionStoreHomeShell` delegates to `FashionStoreShell` and currently passes profile-selected Header layout/background props.
- Template-owned product/content/cart/checkout routes also enter through `ThemeRenderer` and the same registry, but only Home composition receives the renderer-owned Home shell. Their page components retain their existing body ownership.
- Platform routes (`/checkout/complete`, `/orders/*`, `/policies/*`) are mounted by `StorefrontExperience.vue` through `themeRegistry.platformShell`; `registry.ts` binds that owner to `FashionStoreShell`.
- `FashionStoreShell` is the sole Header/Footer composition owner. It obtains Header and Footer configuration from the injected `storefrontPresentationShellKey` unless an explicit configuration is supplied. No route-owned shell content copy was found.

### Current pre-refactor presentation baseline

- Home passes the three-axis development profile into `FashionStoreShell`. The accepted default resolves to the historical `decor` Header layout plus `transparent-overlay` background.
- Shared-shell callers without those props fall back to the historical `fashion` layout plus `solid` background.
- Header structure is shared, but its active layout classes control logo source and accessible label, font family/weight, centered versus edge-aligned navigation, labeled actions, and mini-cart spacing.
- Accepted Home desktop geometry is owned by the current Home modifier: 96px minimum navbar height at `>=992px`, 45px outer navigation gutters above 1199px, 35px gutters at `<=1199px`, a logo constrained to 167px by 36px, and 17px/600 navigation text. At `<=991px`, transparent Home falls back to a white 80px-minimum navbar for readability.
- Header surface classes independently own absolute transparent overlay versus solid white flow placement.
- `FashionStoreMiniCart.homeLayout` changes the Header cart trigger's left padding from 18px to 14px and is currently derived from the Header's historical layout value.
- `FashionStoreFooter.homeLayout` adds the Home-only gutter-normalization modifier. `FashionStoreShell` derives it from `variant === 'home'`; `integration.css` additionally uses that class in the accepted combined-Home 1320px Footer rule.
- The shell route watcher closes Header transients on navigation and resets the main landmark focus target. This remains the central route-transition cleanup owner.

### Existing observable test owners inspected

- Static structure, shared ownership, two-layout/profile seams, Home Header typography, Footer width modifier, and source inventory: `tests/fashion-store-home-source.test.ts` and `tests/fashion-store-theme.test.ts`.
- Home/Header profile matrix, background, desktop/mobile geometry, overflow, and labeled actions: `e2e/fashion-store-live-unified-home.spec.ts`.
- Header search focus movement/restoration, preview mini-cart pointer/keyboard behavior, mobile menu focus restoration, responsive geometry captures, and Home/product/collection shared regions: `e2e/fashion-store-theme.spec.ts`.
- Home → product and product → Home client transitions, body-class cleanup, mini-cart padding coupling, live cart truth, live search keyboard navigation, and platform-shell presentation content: `e2e/fashion-store-live-commerce.spec.ts`.
- Product body top geometry and purchasing/cart continuity: `e2e/fashion-store-product.spec.ts`.
- Internal shop Header-to-body spacing: `e2e/fashion-store-shop.spec.ts`.
- Content/account shared cart behavior: `e2e/fashion-store-content.spec.ts`.
- `e2e/support/layout-assertions.ts` owns reusable centered-child and horizontal-sequence geometry assertions; U1 found no missing helper that requires changing this file.

Every capability named by U1 has an observable existing owner: navigation/search/mobile/focus in the theme suite, mini-cart/cart count in theme/product/content/live-commerce, route transitions in live-commerce, Home geometry/overflow in live-unified-home, internal body fit in product/shop, and platform-shell content in live-commerce. Cross-route canonical shell assertions remain intentionally owned by U2-U4.

### Characterization change

`tests/fashion-store-home-source.test.ts` now has a focused source-level characterization covering all three paths (Home renderer shell, template renderer, and platform shell), injected shell configuration ownership, the current solid/overlay and centered/edge-aligned split, accepted Home geometry constants, mini-cart coupling, and the Home-only Footer modifier. The assertions intentionally describe the pre-FS-R4 seam; U2 is expected to update them as the historical runtime modes are removed.

### Verification

- Before the characterization edit: `bun test tests/fashion-store-home-source.test.ts` — 9 passed, 0 failed, 165 assertions.
- During test authoring, the new test first failed because its registry source URL was one directory too high (`ENOENT .../app/themes/registry.ts`). Correcting the fixture path produced the intended characterization result; this was a test-path authoring error, not a product red.
- After the edit: `bun test tests/fashion-store-home-source.test.ts` — 10 passed, 0 failed, 188 assertions.
- Focused U1 aggregate: `bun test tests/fashion-store-theme.test.ts tests/fashion-store-home-source.test.ts` — 32 passed, 0 failed, 557 assertions.
- No browser server was started in U1. Existing browser owners were inspected and retained; the behavioral/geometry runs remain assigned to U2-U4 after implementation creates an outcome to verify.

### Behavior changed

No. U1 changes only governance, retained evidence, and a static characterization test. Header/Footer/Shell/MiniCart/StorefrontExperience/registry runtime sources were inspected but not modified.

## 2026-09-13 — U2 canonical Header and composition-only profile

### Outcome

- The accepted Home edge-aligned Header geometry is now the single canonical Fashion Store Header on every route. Home receives `transparent-overlay` from `FashionStoreShell`; page variants receive `solid` from the same owner.
- The Header layout prop, historical layout type and classes, centered-logo branch, historical fallback-logo branch, and mini-cart Home-layout prop/class are removed. Footer `homeLayout` remains intentionally unchanged for U3.
- The configured Header logo remains authoritative at both normal and high-density sources. Its required alt text supplies the brand portion of the Home-link accessible name; the fallback remains the Fashion Store `Lifestyle` logo and name.
- `STOREFRONT_FASHION_HOME_PROFILE` is retained but accepts only `isolated|combined`, defaults to `combined`, and explicitly rejects the obsolete three-axis values. Active development/test commands use those composition-only values; the isolated command is now `dev:fashion-store:home-isolated`, and the Header matrix command is removed from both `package.json` and the aggregate Fashion Store script.
- Active Header selectors now use canonical/surface vocabulary. Historical upstream files, asset paths, contracts, and evidence were retained as provenance.

### Characterization-first evidence

- The existing `fashion-store-theme.test.ts` and `fashion-store-home-source.test.ts` assertions were changed to the U2 contract before production code.
- First red run: `bun test tests/fashion-store-theme.test.ts tests/fashion-store-home-source.test.ts` — 29 passed, 3 failed, 515 assertions. Failures identified the old `combined:decor:transparent-overlay` default, absent canonical Header styles, and HomeShell's obsolete Header layout/background passthrough.
- After implementation, the same focused run passed: 33 passed, 0 failed, 567 assertions.

### Verification

- `bun test tests/fashion-store-theme.test.ts tests/fashion-store-home-source.test.ts` — 33 passed, 0 failed, 567 assertions.
- `bun run typecheck` — passed (`nuxt typecheck`).
- `git diff --check` — passed before the checkpoint transition.
- Runtime/profile consumer audit covered `nuxt.config.ts`, both fixture preparation scripts, the live unified-Home specification/config, the animation-performance config, package commands, HomeShell, shared Shell, Header, and MiniCart. No active Header layout type, prop, class, `center-logo` branch, Home mini-cart layout modifier, or Header matrix command remains outside approved upstream provenance or explicit absence tests.

### Behavior changed

Yes. All Fashion Store routes now render the same accepted Home Header geometry and Fashion Store/Lifestyle fallback brand. Route context changes only the surface: transparent overlay on Home (with the existing compact white readability fallback), solid on internal routes. Home composition remains independently selectable as `isolated|combined`. Footer behavior is unchanged until U3.

## 2026-09-13 — U3 canonical Footer and page fit

### Outcome

- `FashionStoreShell` no longer derives or passes a Home-only Footer mode. `FashionStoreFooter` has one canonical class and applies the accepted 15px Bootstrap gutter normalization on every Fashion Store route.
- The accepted Footer container policy is now site-wide at `>=1200px`: `calc(100% - 30px)` capped at 1320px. Home body regions remain independently gated by `data-fashion-store-content-layout="wide"`; Footer width no longer depends on Home composition.
- Configured Footer logos remain authoritative for both normal and high-density sources. The configured alt text supplies the Home-link brand name; the fallback remains the Fashion Store/Lifestyle white logo and name.
- Internal Header-to-main spacing is centralized in one shared rule at the measured canonical Header heights: 96px at `>=992px` and 80px below 992px. Product, Article, and Shop-specific 118/119/79px shell constants and navbar offsets were removed. Compact solid and transparent surfaces now share the 80px minimum Header geometry.

### Characterization and measurement evidence

- The U3 source/unit expectations were authored before implementation. First red run: `bun test tests/fashion-store-home-source.test.ts tests/fashion-store-product.test.ts` — 12 passed, 3 failed, 200 assertions. The failures identified the active `home-layout` prop, `fashion-store-footer-home` selector, historical shell-width variables, and missing shared main-offset contract.
- The first post-change Product browser measurement intentionally retained the prior expectations and failed in all four projects: measured page starts were 96px at desktop/laptop and 80px at tablet/mobile instead of the former 118/119/79px constants.
- The first 1200/1199/992/991/768/767 boundary run then measured a 78px compact solid navbar against the intended 80px canonical compact geometry. Moving the existing 80px minimum height from overlay-only to the canonical compact Header resolved the surface-dependent 2px drift.

### Verification

- `bun test tests/fashion-store-home-source.test.ts tests/fashion-store-product.test.ts` — 15 passed, 0 failed, 221 assertions.
- `bun run typecheck` — passed (`nuxt typecheck`).
- Focused Playwright Product/Shop/Content run — 17 passed, 6 intentionally skipped, with one test-fixture failure: the static preview does not inject an active Experience on `/checkout/complete`, so it correctly rendered the generic platform shell rather than the Fashion Store platform shell. This did not expose a runtime regression.
- Corrected representative Footer smoke against the same generated build (Home, Product, Shop, About, Cart, Checkout) — 1 passed, 3 viewport-owner skips. It verified one canonical 1320px/30px Footer container, natural placement after short and long bodies, and no horizontal overflow.
- Product responsive geometry and the explicit 1200/1199/992/991/768/767 boundary test passed; all three Shop layouts passed at desktop, laptop, tablet, and mobile. Together these checks retained product/shop body and commerce behavior while verifying 96px/80px shared offsets and no horizontal overflow.
- `git diff --check` — passed before the checkpoint transition.
- Runtime platform-shell structure remains covered by the source ownership assertion. Browser verification of the injected Fashion Store platform shell stays with U4's existing live-commerce test, because the static preview route does not provide the required active Experience snapshot.

### Behavior changed

Yes. All Fashion Store routes now use one canonical Footer presentation and responsive gutter policy. Internal routes use shared Header-height offsets rather than historical route-specific values; Home overlay placement and Home-only wide body regions remain unchanged. No page-body information architecture or commerce behavior was changed.

## 2026-09-13 — U4 cross-route visual and behavioral regression

### Outcome

- Direct-load coverage now asserts one `fashion-store-header-canonical` and one `fashion-store-footer-canonical` across all fifteen fixture routes. Home alone carries the `transparent-overlay` surface class; every internal route carries `solid`; compact Home retains the accepted white readability fallback.
- The Home → Product → Collection → Home link path and browser back/forward path now verify route-correct surface/body state, unchanged Header/Footer logo sources, canonical navigation geometry, the 14px mini-cart trigger inset, one runtime instance, and no horizontal overflow after every transition.
- Live Experience coverage now asserts the same canonical shell on dynamic Product, Order, and Policy routes. The Order and Policy assertions execute through the registry's platform-shell owner with the active live Experience fixture.
- Existing search, mini-cart, mobile-menu, account/wishlist, focus restoration, scroll, resize, pointer, keyboard, and touch outcome tests remain green. Product and Home boundary coverage explicitly includes 991/992px and 1199/1200px with no overflow.
- The legacy source-contract test no longer treats the superseded Header/Footer regions as Fashion Store authority. Its Home hero pixel budget (`0.04`), Product/body source contract, Product/Shop geometry tolerances, and all unrelated thresholds remain unchanged. The shared screenshot comparator and theme-impact verifier were not edited.

### Characterization-first evidence

- Static Theme red: the focused shared-shell appearance run first produced 3 failures. Product and Collection expected the historical 18px cart inset and received the canonical 14px inset. Home additionally exposed a test-only assumption that an empty preview cart always renders a checkout CTA; geometry capture now records that optional element as `null`.
- Live Commerce red: the focused Home and search transition run first produced 2 failures. Both expected 18px after navigating to Product and received the canonical 14px value.
- Scoped parity red: after the canonical assertions passed, the legacy source-contract test failed on desktop/laptop because it still compared the canonical configured 155px logo against the retired source Header's 167px logo. Per KTD4, only the Header/Footer probes were removed; the retained body and pixel thresholds were not relaxed.

### Verification

- Canonical direct loads and history, desktop: 19 passed, 0 failed. This includes all fifteen fixture routes, Home/Product/Collection interactions, and Home → Product → Collection → Home plus back/forward.
- Canonical direct loads and compact shell, mobile: 18 passed, 0 failed.
- Live Product/platform-shell/Home/search: 3 passed, 0 failed. Dynamic Product, Order, Policy, Home → Product, Search → Product, and browser-back surface restoration were observed with an active Experience.
- Combined Home Header/compact/boundary evidence: 4 passed, 0 failed across 1440, 1024, 768, and 390 projects; the test itself checks 991/992px and 1199/1200px.
- Product/Shop/Content/body-parity aggregate: 24 passed, 6 intentionally skipped, 2 expected legacy-Header comparison failures. After the KTD4 regional supersession, the four-project Home body/source rerun passed 4, failed 0.
- Search/mobile-menu/focus/scroll evidence: 15 passed, 9 viewport-owner skips, 0 failed.
- Product resize/pointer/keyboard/touch/cart plus account/wishlist evidence: 5 passed, 0 failed.
- Live browse-to-order/Home mini-cart removal/cart-page synchronization: 3 passed, 0 failed.
- `bun test tests/fashion-store-theme.test.ts tests/fashion-store-home-source.test.ts tests/fashion-store-product.test.ts` — 38 passed, 0 failed, 592 assertions.
- `bun run typecheck` — passed after the final test changes.
- `bun test ../../tools/verify-theme-change-impact.test.ts` — 7 passed, 0 failed. `bun ../../tools/verify-theme-change-impact.ts --dry-run` conservatively selected `bun run test:theme-matrix` because the accumulated dirty tree contains shared storefront configuration; FS-R4's governed Fashion Store scope remains covered here and U5 owns the plan's full final gate without expanding candidate authority.
- Active-source absence scan found historical layout/Footer tokens only inside explicit negative assertions. No active runtime, public configuration, or command exposes the removed layout matrix or Home-only Footer mode.
- `git diff --check` — passed before moving the checkpoint to U5.

### Behavior changed

No production behavior changed in U4. The unit rebaselined tests around the canonical U2/U3 behavior, made shell-region supersession explicit, and retained browser evidence. No comparator, impact tool, runtime component, route body, or parity threshold changed.

## 2026-09-13 — U5 verification attempt (blocked)

### Outcome

- The canonical shared shell itself passes every focused, live, responsive, dedicated-motion, type, impact, build, and direct-development-server check exercised by U5.
- U5 cannot complete because the plan requires the full Fashion Store gate to be green. That gate remains red only on the same six product-merchandising contracts already preserved at FS-F6-U4: nested source-region boundaries, generic collection of the dedicated motion spec, Home mini-cart fixture truth, 28 unmapped interaction-ledger candidates, top-level versus nested section counting, and serious accessibility failures.
- FS-R4 therefore remains active at U5. The product master pointer was not handed back, and REL, candidate, DC, deployment, and PG state did not move.

### Verification command reconciliation

The plan's literal browser command used `playwright.config.ts` with `e2e/...` arguments. That configuration both sets `testDir: "./e2e"` and ignores `fashion-store-*.spec.ts`, so the command exited 1 with `No tests found`. This was a verification-command mismatch, not an application failure. Per the Verification Contract's reconciliation allowance, U5 used the existing owning configurations:

- `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config playwright.fashion-store.config.ts fashion-store-product.spec.ts fashion-store-shop.spec.ts fashion-store-content.spec.ts fashion-store-theme.spec.ts`
- `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config playwright.fashion-store-live.config.ts fashion-store-live-commerce.spec.ts`

### Passing evidence

- Focused unit set: `bun test tests/fashion-store-theme.test.ts tests/fashion-store-home-source.test.ts tests/fashion-store-product.test.ts tests/compare-theme-screenshots.test.ts` — 42 passed, 0 failed, 610 assertions.
- Root impact verifier: `bun test tools/verify-theme-change-impact.test.ts` — 7 passed, 0 failed.
- `bun run typecheck` — passed.
- `bun run test:fashion-store-home:combined` — 8 passed, 12 intentional viewport-owner skips, 0 failed.
- Reconciled live-commerce browser run — 15 passed, 0 failed.
- Dedicated FS-F6 motion regression: `bun run test:perf:motion` — 2 passed, 0 failed. Desktop medians were 145.974 ms layerize, 110.644 ms paint lifecycle, and 736.887 ms run task; mobile medians were 128.96 ms, 60.926 ms, and 592.583 ms. Both offscreen and reduced-idle probes reported zero effective work.
- `bun run build` — passed, including Nuxt generation, static finalization, and Wrangler dry-run packaging.
- `git diff --check` — passed before and after the verification runs.

### Direct `dev:fashion-store` shell evidence

U5 started the exact `bun run dev:fashion-store` command and inspected `/` and `/products/relaxed-corduroy-shirt` in headless Chromium at 1440×1000:

- Both routes rendered exactly one `fashion-store-header-canonical` and one `fashion-store-footer-canonical`.
- Both used the same Fashion Store fallback logo URL, 155px rendered logo width, and 96px navbar height.
- Home alone exposed `fashion-store-header-surface-transparent-overlay`; Product exposed `fashion-store-header-surface-solid`.
- Both routes reported zero horizontal overflow.

### Blocking full-gate evidence

- Reconciled static Product/Shop/Content/Theme run — 190 passed, 117 intentional skips, 5 failed. Four failures are the preserved top-level section-count assertion (`11` expected, `19` rendered); one is the preserved serious accessibility gate. Canonical Header/Footer direct-load, route-history, geometry, focus, and interaction assertions in the same run passed.
- `bun run test:fashion-store` — unit stage 52 passed and live stage 15 passed before the static stage ended with 271 passed, 252 intentional skips, and 13 failures. The failures map to the preserved six contracts: one source-region/visible-copy parity failure, four generic motion-spec collection failures from running the dedicated spec under unsupported general project names, one empty-Home-mini-cart fixture assertion, one 28-candidate interaction-ledger failure, four top-level section-count failures, one serious accessibility failure, and one nested marquee observer failure.
- The collection-suite failure whose title mentions shared Header styling is not a canonical-layout regression. Its CSS checks passed; it failed when the test unconditionally required `.cart-item-list .close` on `/`, where the preview cart is empty. This is the already-recorded Home mini-cart fixture-truth blocker.

### Absence, scope, and dead-code audit

- Active runtime/configuration/package/script surfaces contain no Header layout prop/type/class, `center-logo` branch, Home-only mini-cart/Footer layout prop or class, obsolete Header matrix command, or three-axis Home profile value.
- Remaining historical tokens occur only in immutable upstream source files and explicit negative assertions that prove absence. Decor-named Home assets/components/contracts remain approved source provenance, not runtime layout choices.
- `FashionStoreShell` remains the sole Header/Footer composition owner and derives only the semantic Header surface from `variant`; the injected presentation-shell view model remains the shared content owner.
- No shared comparator or theme-impact implementation was edited for FS-R4. U5 introduced no production or test-code change, temporary fixture, debug output, or abandoned implementation branch.

### Completion decision

U5 and FS-R4 remain incomplete. Although R1-R9 and R11 plus the shell-specific portion of R10 have focused evidence, the Definition of Done requires every full-gate requirement to pass, including the inherited accessibility gate. Handback is prohibited until a named product-merchandising successor resolves the six preserved contracts and U5 is rerun green.

## 2026-09-13 — U5 final verification and FS-F6 handback

### Outcome

- FS-R4-U5 completed after FS-F7 reconciled the six merchandising contracts and every owning final gate passed. The canonical Header/Footer design was not changed during this rerun.
- The product master pointer returned to the preserved FS-F6-U4 checkpoint. REL, candidate, DC, deployment, and PG state did not advance, and FS-F6 was not executed as part of this handback.
- No production or test code changed in U5; this entry and the coordinated plan checkpoints retain only final verification and governance evidence.

### Final verification

- `bun test tests/fashion-store-theme.test.ts tests/fashion-store-home-source.test.ts tests/fashion-store-product.test.ts tests/compare-theme-screenshots.test.ts` — 44 passed, 0 failed, 621 assertions.
- `bun test tools/verify-theme-change-impact.test.ts` — 7 passed, 0 failed, 9 assertions.
- `bun run typecheck` — passed.
- `bun run test:fashion-store-home:combined` — 12 passed, 12 intentional viewport-owner skips, 0 failed.
- Reconciled static command, `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config playwright.fashion-store.config.ts fashion-store-product.spec.ts fashion-store-shop.spec.ts fashion-store-content.spec.ts fashion-store-theme.spec.ts` — 196 passed, 120 intentional skips, 0 failed.
- Reconciled live command, `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config playwright.fashion-store-live.config.ts fashion-store-live-commerce.spec.ts` — 15 passed, 0 failed.
- `bun run test:a11y` — 8 passed, 0 failed, including all seven serious/critical route audits and skip-navigation order.
- `bun run test:fashion-store` — passed end to end: the unit stage reported 53 passed and 0 failed; live reported 15 passed; generic static reported 288 passed, 252 intentional skips, and 0 failed; combined and isolated Home each reported 12 passed, 12 intentional skips, and 0 failed; all fifteen behavior-report verification invocations succeeded.
- `bun run build` — passed Nuxt generation, static finalization, and Wrangler dry-run packaging; ten static routes were prepared and the production fallback remained unchanged.
- `bun run verify:static` — passed for ten indexable routes and four private commerce shells.
- `bun tools/verify-theme-change-impact.ts --dry-run` — conservatively selected `bun run test:theme-matrix` because shared storefront configuration is present in the accumulated dirty checkout; the complete Fashion Store gate above covers this plan's governed scope without expanding candidate authority.

### Motion sampling

- The first `bun run test:perf:motion` sample passed mobile but reported desktop median RunTask at 1358.18 ms against the unchanged 1200 ms budget. No runtime, test, or threshold was changed in response.
- An independent clean rerun passed 2 of 2 projects: desktop medians were 152.282 ms layerize, 96.584 ms paint lifecycle, and 706.12 ms RunTask; mobile medians were 168.742 ms, 97.239 ms, and 829.103 ms. Both offscreen and reduced-idle probes reported zero effective work. Together with the passing complete Fashion Store gate, this records the first result as a transient loaded-host sample rather than a reproducible product defect.

### Direct shared-shell and absence evidence

- A source-owner scan found the only runtime imports and renders of `FashionStoreHeader` and `FashionStoreFooter` in `FashionStoreShell.vue`; other matches are historical unification-disposition records.
- The exact `bun run dev:fashion-store` command was started and inspected in headless Chromium at 1440×1000. `/` and `/products/relaxed-corduroy-shirt` each rendered exactly one `fashion-store-header-canonical` and one `fashion-store-footer-canonical`, the same logo URL at 155px, a 96px navbar, and zero horizontal overflow. Home alone used `fashion-store-header-surface-transparent-overlay`; Product used `fashion-store-header-surface-solid`.
- The active runtime/configuration/package/script scan found no `center-logo`, `home-layout`, `fashion-store-footer-home`, `combined:decor`, `combined:fashion`, `header-matrix`, `headerLayout`, or `homeLayout` token outside excluded immutable upstream source. The remaining distinction is semantic route surface, not a second Header/Footer identity.
- Final formatting and diff checks passed. The working tree remains intentionally uncommitted, and no stash, reset, checkout, commit, worktree, or FS-F6 execution occurred.

### Behavior changed

No. U5 changed only the FS-R4, FS-F6, and product-master checkpoints plus this retained evidence after the already-implemented canonical shell passed its final contract.
