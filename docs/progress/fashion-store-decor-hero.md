# Fashion Store Decor Hero implementation evidence

Recorded: 2026-09-06. Execution authority remains the FS-R2 activation checkpoint; this file
retains evidence only and does not define a second current-unit queue.

## Delivered scope

- Fashion fixture and live Home now use one Fashion-owned, three-slide Decor Hero implementation.
  The content is Corby (`$199`), Verona (`$259`), and Lewis (`$259`); every primary CTA resolves
  to `/shop`.
- Swiper is pinned to `14.2.0` for the fade track, keyboard, gesture, 75px threshold, 9000ms
  autoplay, and lifecycle. GSAP is pinned to `3.15.0` and is dynamically loaded only for
  component-scoped layer motion.
- The twelve Hero images and Plus Jakarta Sans font are copied into the Fashion namespace with
  provenance and resource registration. Fashion imports no Decor runtime, jQuery, Revolution
  JavaScript, or remote Hero asset.
- The first slide is complete in SSR/no-JavaScript output. Reduced motion, document visibility,
  thrown GSAP loading, busy transitions, destruction, and repeated mount behavior have focused
  coverage. The Product Gallery's former private Swiper hook is replaced by public
  `setTransition`/`setTranslate` calls.
- Source-equivalence tooling keeps Fashion as page authority and assigns only the Hero region and
  named Hero states to the real Decor source. The intentional source-only More information control
  and tooltip are the only Hero mask selectors.

## Retained verification

| Gate                          | Result                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type and lint                 | Root typecheck and lint passed.                                                                                                                                                                                                                                                                      |
| Source/theme contracts        | Source-equivalence verification passed 158 checks with zero failures; theme verification passed.                                                                                                                                                                                                     |
| Focused unit coverage         | The final Fashion and source-tool unit selection passed 90 tests, including controlled source-ledger drift and GSAP `fromTo()` exception fallback.                                                                                                                                                   |
| Hero browsers                 | Chromium, Firefox, and WebKit matrix passed 32 tests with 40 intentional applicability skips, including SSR, no-JS, reduced motion, threshold, lifecycle, and GSAP-failure behavior.                                                                                                                 |
| Regional visual parity        | All eight Decor-referenced Hero captures passed the unchanged 0.4% threshold. Diff ratios: desktop DPR1 `0.0002715`, desktop DPR2 `0.0002104`, laptop DPR1 `0.0004709`, laptop DPR2 `0.0003719`, tablet DPR1 `0.0010033`, tablet DPR2 `0.0008968`, mobile DPR1 `0.0022085`, mobile DPR2 `0.0008214`. |
| Named state                   | Decor-referenced settled slide 2 passed using the repository-owned font and the two declared absence masks.                                                                                                                                                                                          |
| Decor compatibility           | Decor unit acceptance passed 14 tests; Decor browser acceptance passed 15 tests with 6 intentional skips. No Decor implementation file changed.                                                                                                                                                      |
| Build and static preview      | Fashion production preview build and Fashion static preview verification passed.                                                                                                                                                                                                                     |
| Bundle isolation              | Home initial JavaScript is 72,751 bytes gzip and Product is 83,092 bytes gzip, both below the 307,200-byte gate; selected-theme isolation passed.                                                                                                                                                    |
| Performance and accessibility | All six performance routes passed (the Home cold attempt had one transient failure and passed on retry); the available accessibility suite passed 8 tests.                                                                                                                                           |
| Review closure                | The required simplification pass was applied. Independent validation of the adversarial, reliability, and performance review findings found no remaining P0/P1/P2 issue after the source-ledger and GSAP fault-injection additions.                                                                  |

Representative retained local artifacts are
`/tmp/fs-r2-region-final/fashion-store/report.json` and
`/tmp/fs-r2-named-final-3/fashion-store/named/report.json`. They are machine-local run evidence,
not product-plan authority.

## U6 closure evidence

- The application-level first-interaction capture/replay layer and font-ready control gate are
  removed. Fixture and live shopper controls initialize on mount, and the intentionally omitted
  promotional top bar remains governed by an exact-copy exclusion rather than a broad region mask.
- The live Home first-key failure was traced to an SSR-rendered direct-add button receiving input
  before Vue attached its handler. Live product cards now expose a disabled/loading action until
  mount, so no apparently available control can swallow the first click or key. The complete live
  suite passes 15 tests.
- `bun tools/run-fashion-store-acceptance.ts --scope=page --page=home` passes 13 unit tests, 171
  browser tests with 77 intentional matrix skips, and verification of 61 behavior-mode evidence
  records. The unchanged 4% mixed-source Hero slice gate passes after excluding only page chrome
  that overlays the Hero but belongs outside the compared region.
- The Home runner now includes the dedicated Decor-Hero spec, so its 74px rejection, 76px native
  threshold acceptance, busy-input rejection, no-JavaScript, lifecycle, and GSAP-failure branches
  feed the governed behavior report. GSAP failure injection identifies the generated dependency by
  runtime signature instead of assuming a filename containing `gsap`.
- Focused Decor Home compatibility passes 23 browser tests across its desktop and responsive
  branches. Root lint/import boundaries and Storefront typecheck pass.

Historical minimum browser versions, physical iOS/iPadOS/Android devices, WebViews, and embedded
hosts remain explicitly unverified; current Playwright evidence is not presented as a substitute.

## Primary-worktree integration and temporary-worktree cleanup

On 2026-09-06 the verified tree from temporary checkout
`/Users/studio/.codex/worktrees/bc23/shoppp` and branch
`codex/fashion-store-decor-hero` at `4178e3b7` was cherry-picked into the long-lived primary
checkout `/Users/studio/Documents/GitHub/shoppp` on
`codex/fashion-store-components-dependencies` as `c040a0a4`. The two pre-existing plan-document
edits in the primary checkout were retained in the integrated commit; a recoverable backup remains
as stash `pre-integration FS-R2 plan backup`.

Immediately before cleanup, the temporary checkout had an empty tracked-change manifest and an
empty untracked-path manifest. Its ignored-path manifest contained only rebuildable dependencies,
generated previews, bundles, and test output:

- `apps/admin/node_modules/`
- `apps/api/node_modules/`
- `apps/storefront/.nuxt/`
- `apps/storefront/.output/`
- `apps/storefront/app/generated/collections/`
- `apps/storefront/app/generated/products/`
- `apps/storefront/dist`
- `apps/storefront/fixtures/experience/.generated/`
- `apps/storefront/node_modules/`
- `apps/storefront/test-results/`
- `apps/storefront/worker-dist/`
- `node_modules/`
- `packages/contracts/node_modules/`
- `packages/db/node_modules/`
- `packages/domain/node_modules/`

No ignored path was material source or unique evidence. The preview server was stopped before the
exact cleanup command `git worktree remove /Users/studio/.codex/worktrees/bc23/shoppp`. Removing
that checkout does not delete either branch, either integration commit, the retained stash, or any
plan/evidence authority.
