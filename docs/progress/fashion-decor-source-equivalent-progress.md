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
