# Fashion and Decor Source-Equivalent Progress

Authority: `docs/plans/2026-07-31-001-refactor-source-equivalent-fashion-decor-plan.md`.
This ledger records implementation and verification evidence without modifying the authoritative plan.

## Current audit

| Unit  | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                         |
| ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1    | Complete | Source/implementation capture, source/font/motion contracts, Sharp-first full-page and named-state comparison, ranked regions, heatmaps, bounded diagnostic crops, stale-evidence checks, and a two-slot process guard are implemented. Review hardening protects fresh leases from concurrent stale cleanup and retains diff evidence for dimension mismatches. |
| U10   | Complete | Shared interaction controller/virtual clock and central Nuxt route-scroll policy cover autoplay boundaries, input, pause reasons, disposal, new-route top reset, saved-position restoration, and rendered hash targets.                                                                                                                                          |
| U2-U4 | Complete | Fashion was rebuilt from the original HTML/CSS/JS/assets with complete header, navigation, hero, body, footer, overlay, typography, interaction, no-JS, reduced-motion, and responsive states.                                                                                                                                                                   |
| U5    | Complete | Fashion full-page and all named-state fidelity gates pass, the complete browser/accessibility/performance matrix passes, retained evidence exists, and original plus implementation are open in parallel browser tabs.                                                                                                                                           |
| U6-U8 | Complete | Decor was rebuilt after Fashion acceptance from the original HTML/CSS/Revolution initialization/assets with functional language/navigation menus, layered hero motion, body/footer states, local fonts, responsive behavior, and Vue lifecycle cleanup.                                                                                                          |
| U9    | Complete | Decor full-page and all named-state fidelity gates pass, the complete browser/accessibility/performance matrix passes, retained evidence exists, and original plus implementation are open in parallel browser tabs.                                                                                                                                             |

## Verified evidence

- Fashion full-page changed-pixel ratios at tolerance `16`: desktop `0.583277%`, laptop `0.573323%`, tablet `0.541694%`, mobile `0.498813%`; document-height deltas are `0`.
- Fashion named-state matrix: `76 / 76` passed, maximum changed-pixel ratio `0.467330%`; all configured named-state thresholds pass.
- Hardened Decor full-page matrix: `28 / 28` passed at tolerance `16` across home, collection, and product routes, DPR `1/2`, and the canonical responsive widths. Home changed-pixel ratios range from `0.248972%` to `0.736580%`; document-height deltas are `0`. The former standalone `922px` checkpoint has been retired in favor of the canonical desktop, laptop, tablet, and mobile set.
- Decor named-state matrix: `72 / 72` passed, maximum changed-pixel ratio `0.433862%`; maximum named geometry-edge delta is `0.046875px`.
- Final theme browser matrix: Fashion main matrix `75 passed / 81 conditional skips`, with the six environment-specific wildcard cases passing on their targeted rerun; Decor `72 passed / 60 conditional skips / 0 failed`. The source-visible product lightbox then passed its focused four-viewport matrix for both themes (`4 passed / 2 conditional skips` each).
- Accessibility reports contain zero critical or serious violations. Lighthouse mobile performance passes configured thresholds: Fashion home `0.91`, secondary routes `1.00`; Decor home `0.77`, collection `0.99`, and remaining secondary routes `1.00`.
- Root verification after review hardening: tools `77`, Admin `264`, Storefront `79`, Contracts `13`, DB `1`, Domain `29`, all passing. ESLint, import boundaries, root/workspace typecheck, Prettier, theme catalog/provenance verification, font inspection, Decor preview static checks, selected-theme isolation, and bundle budget pass.
- Production fallback E2E: `18 passed / 24 conditional skips / 0 failed`; route-scroll focused matrix: desktop/mobile `4 passed`, no-JS `2 conditional skips`.
- Non-mechanical review applied the earlier resource-guard, worker-cap, diff-evidence, geometry, state-isolation, route-scroll, cookie, and responsive corrections. The final review additionally restored the original product-gallery lightbox, paused Fashion gallery autoplay while it is open, removed Fashion preloader listeners during disposal, centralized payment asset naming, and registered exact source provenance for all payment SVGs. The acceptance harness was then hardened so full-page section normalization can only remove subpixel raster drift already within `0.1px`; a real offset can no longer be aligned away. The hardened Decor matrix remains `28 / 28` green and no actionable finding remains. Final review artifact: `/tmp/compound-engineering/ce-code-review/20260805-022752-1ab0/`.
- Retained evidence: `artifacts/theme-fidelity/` and `apps/storefront/artifacts/theme-fidelity/`, including reference/implementation metadata, full-page reports, named-state reports, PNG/JSON diffs, heatmaps, and high-signal crops. Human-readable report: `apps/storefront/artifacts/theme-fidelity/report/index.html`.

## Live browser checkpoint

- Original Fashion: `http://127.0.0.1:4321/demo-fashion-store.html`
- Vue Fashion: `http://127.0.0.1:3433/`
- Original Decor: `http://127.0.0.1:4321/demo-decor-store.html`
- Vue Decor: `http://127.0.0.1:3434/`
- All four URLs returned HTTP `200` at the final checkpoint. The two Vue implementations are open in separate in-app browser tabs; original-source pages remain available on the fixed `4321` origin and were used as the parallel acceptance reference.

## Remaining Definition of Done work

None. R1-R22 and U1-U10 are complete; both live browser checkpoints are open and the retained evidence is available for review.

## Decor Store homepage source-parity handoff (2026-08-11)

Authority: `docs/plans/2026-08-10-001-feat-decor-store-source-parity-plan.md`. This section records U8 evidence without modifying that plan. It concerns the independent home-only `decor-store` theme; the earlier Fashion and `decor` evidence above remains unchanged.

### Contract ownership and evidence

All 13 structural rows are owned by the Decor source contract and are asserted against the independent original page and Nuxt implementation by `decor-store-source-equivalence.spec.ts` and `decor-store-home.spec.ts`.

| Structural row        | Owner                                     | Passing evidence                                                                                     |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `header`              | Decor source contract                     | Region order, desktop/mobile control counts, copy, links, assets, typography, and geometry inventory |
| `hero`                | Decor source contract + source runtime    | One Hero region, three slides, source geometry, named slides/transition, fallback, teardown, remount |
| `featured-categories` | Decor source contract                     | Six category cards and three promotion cards in source order                                         |
| `products`            | Decor source contract                     | Two tabs and 16 product cards, source copy/assets/actions                                            |
| `promotional-marquee` | Decor source contract + source runtime    | Six messages, moving/reduced-motion/static states                                                    |
| `collection-carousel` | Decor source contract + source runtime    | Three slides, moving/manual/reduced-motion/static states                                             |
| `client-marquee`      | Decor source contract + source runtime    | Eight logos, moving/reduced-motion/static states                                                     |
| `journal`             | Decor source contract                     | Four source-ordered journal cards                                                                    |
| `services`            | Decor source contract                     | Four source-ordered service cards                                                                    |
| `footer`              | Decor source contract + framework adapter | Copy/link/action inventory and truthful newsletter presentation                                      |
| `cookie`              | Decor source contract + framework adapter | Visible/dismissed/no-JavaScript states and zero request                                              |
| `sticky`              | Decor source contract + source runtime    | Desktop threshold, responsive absence, teardown                                                      |
| `scroll-progress`     | Decor source contract + source runtime    | Desktop monotonic progress/return-to-top and non-desktop absence                                     |

All 13 behavioral ledger rows have an explicit runtime owner and named evidence:

| Behavior row           | Owner               | Passing evidence                                                                                                  |
| ---------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `header-language`      | `framework-adapter` | `header-language-open`, fallback readable current language                                                        |
| `header-navigation`    | `framework-adapter` | desktop `header-menu-open`, `mobile-menu-open`, keyboard/touch/resize/dismissal/focus                             |
| `header-search`        | `framework-adapter` | `header-search-open`, labelled native fallback, focus return, no unexpected request                               |
| `header-commerce`      | `framework-adapter` | `header-cart-open`, typed account/cart intents and native-link fallback                                           |
| `hero-revolution`      | `source-runtime`    | initial + slides 1–3 + deterministic transition + reduced-motion + dependency/initializer failure + clean remount |
| `product-tabs`         | `framework-adapter` | best sellers/new arrivals, eight-card panels, keyboard/touch, no-JavaScript default panel                         |
| `product-card-actions` | `framework-adapter` | representative hover/focus/touch action set and truthful route/intent mapping                                     |
| `promotional-marquee`  | `source-runtime`    | moving, hidden/reduced-motion/static track, teardown/remount                                                      |
| `collection-carousel`  | `source-runtime`    | moving/manual/reduced-motion/static states, teardown/remount                                                      |
| `client-marquee`       | `source-runtime`    | moving/pause/reduced-motion/static states, teardown/remount                                                       |
| `cookie-notice`        | `framework-adapter` | visible/dismissed/fallback states and no persistence/network invention                                            |
| `sticky-social`        | `source-runtime`    | desktop threshold, responsive branch, teardown                                                                    |
| `scroll-progress`      | `source-runtime`    | monotonic desktop progress, return-to-top, responsive branch, teardown                                            |

The 11 absence rows are jointly owned by the source-equivalence runner, Decor lifecycle tests, and selected-theme build scans:

| Absence row                      | Passing evidence                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| source-only visible copy         | Complete normalized visible-text inventory by region/state                                                       |
| implementation-only visible copy | Complete normalized visible-text inventory by region/state                                                       |
| changed visible copy             | Source/implementation copy comparison with zero waiver                                                           |
| missing or reordered region      | Exact 13-region order and eight-section count                                                                    |
| remote or broken resource        | Request, manifest, font, image-decode, and static-build scans                                                    |
| analytics or tracking request    | Network and forbidden-resource scans                                                                             |
| PHP request                      | Network scan plus truthful newsletter/action tests                                                               |
| console error                    | Page/failure/remount console gates                                                                               |
| duplicate runtime instance       | Hero and timed-body route/remount stress                                                                         |
| post-unmount owned residue       | Two teardown windows: owned rAF/interval and DOM mutation remain zero; raw document callbacks stay within budget |
| cross-theme import               | Decor, Fashion, and fallback selected-theme output scans                                                         |

### Visual, accessibility, and performance evidence

- Independent four-viewport full-page comparison changed-pixel ratios: desktop `0.0014924283`, laptop `0.0009200516`, tablet `0.0010980655`, mobile `0.0009467491`, all within the `0.01` budget. Manual side-by-side review of all four pairs found no P0/P1 discrepancy. Waivers: zero.
- Motion-enabled cold profile: 105 requests; app JS 620,206 raw bytes; Decor vendor JS 382,482; CSS 1,360,713; fonts 464,436; images 2,148,581; Hero ready approximately 3.58s cold and 3.52s repeat; zero long tasks. Hidden-page DOM mutation is zero. The final acceptance sample has first/second post-unmount raw document callbacks 26/59 within the explicit 80-callback/750ms ceiling, Decor-owned rAF 0/0, Decor-owned intervals 0/0, DOM mutations 0/0, and timeouts 2/1. Exact raw counts stay attached per run because document scheduling varies independently between documents; the bounded Nuxt/Revolution-tools owned residue does not accumulate.
- Reduced-motion Lighthouse now gates both the first cold sample and the existing stable-state threshold. Cold bounds are CLS at most `0.50`, LCP at most `17000ms`, and TBT at most `200ms`; the final cold sample was performance `0.49`, CLS `0.35721`, LCP `13756.39ms`, and TBT `95ms`. The reduced audit hides the uninitialized source slide list until Revolution reports ready; the same command passed the unchanged stable-state threshold at performance `0.98`, CLS `0.00087`, LCP `2240.93ms`, and TBT `69.5ms`. Accessibility `0.92`, best practices `0.96`, SEO `0.69`; dedicated Axe critical/serious violations: zero.
- Decor preview static and selected-theme isolation pass. The complete transitive initial JavaScript closure is 116,947 gzip bytes against the existing 204,800-byte budget.

### Delivery boundary

The Hero remains the original Revolution template runtime and initializer. No framework-Hero hybrid, dormant alternative Hero, shared runtime/kernel, cross-theme component extraction, or Fashion lifecycle migration is present. Potential lifecycle, behavior-ledger, registration, and capture-tool abstractions are documented in Decor `UPSTREAM.md` only as post-acceptance candidates. No approved waiver or unresolved P0/P1 issue remains.

### Repository stabilization gates

| Gate                                         | Result                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source-equivalence policy and tooling        | Pass: 150/150 tests; two source-equivalent themes verified                                                                                                                                                                                                                     |
| Theme catalog and manifests                  | Pass: four storefront themes verified against platform 1.0.0                                                                                                                                                                                                                   |
| Decor source/registration unit scope         | Pass: 9/9 tests                                                                                                                                                                                                                                                                |
| API Decor experience fixture                 | Pass: 9/9 in the Cloudflare Workers Vitest pool                                                                                                                                                                                                                                |
| Root typecheck                               | Pass: tools, root E2E, Admin, API, Storefront, Contracts, DB, and Domain                                                                                                                                                                                                       |
| Workspace build and root static verification | Pass: all build workspaces; 10 indexable routes, four private commerce shells, deployment headers/HTML/sensitive-artifact checks                                                                                                                                               |
| Fashion affected unit scope                  | Pass: 33/33 tests                                                                                                                                                                                                                                                              |
| Fashion preview isolation                    | Pass: 15 routes at 80,441/307,200 initial JS gzip; no Decor resource in selected output                                                                                                                                                                                        |
| Production fallback isolation                | Pass: home 126,023/204,800, collection 125,030/204,800, product 125,841/204,800 initial JS gzip; no Decor or Fashion resource in selected output                                                                                                                               |
| Changed-file lint                            | Pass for every changed human-authored TypeScript/Vue/config file                                                                                                                                                                                                               |
| Root format/lint                             | `bun run format:check` and `bun run lint` pass. The hash-pinned Decor upstream tree is excluded from formatter/linter ownership, matching the established Fashion source boundary; exact imported-tree verification remains authoritative and frozen source was not rewritten. |

The generated active theme is restored to the committed Fashion Store fixture after build/isolation checks. The authoritative final browser gate is `bun run accept:decor-store`; its terminal result is retained in the U8 task/commit handoff because generated test output is intentionally not committed.
