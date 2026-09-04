# Fashion Store modernization verification - 2026-09-04

This record retains FS-R1-U11 verification evidence. The active plan and product master plan remain
the only authorities for implementation status, the current product pointer, and next work. These
results do not select a candidate or advance DC/PG.

## Outcome

FS-R1 completed its approved local scope. Shared icons, quantity controls, Tooltip, Swiper
carousels/gallery, Bootstrap Modal lightbox, commerce reuse, and the reduced CSS/runtime surface
are integrated without a second legacy runtime. The final review found seven actionable issues;
all seven were applied locally and verified before this record was written.

Historical minimum browser releases, physical Android/iOS devices, Android WebView, and embedded
mobile hosts remain unverified. The configured Chrome/Edge 111, Firefox 115, and Safari/iOS 16.4
build targets remain implementation constraints and are not presented as device certification.

## Final verification matrix

| Verification | Result |
| --- | --- |
| `bun run test:fashion-store` | Passed: 34 unit tests, 15 live tests, 240 fixture browser tests; 204 expected skips. All 16 behavior-report verifiers passed. |
| Full compatibility entry | Passed: 84/84 across available Chromium, Firefox, and WebKit projects, desktop/mobile viewports, ordinary/reduced motion, temporal checks, and no-JS checks. |
| Representative deep cross-browser matrix | Passed: 24 tests; 12 expected skips. Covered desktop/mobile gallery behavior, modal module failure/retry, first-touch behavior, and Tooltip placement in all three engines. |
| Desktop drag and WebKit mobile tap probe | Passed: 2/2; dragging does not open the lightbox and a mobile tap does. |
| `bun run test:perf:fashion-store -- --workers=1` | Passed: 1/1 performance suite. The home cold attempt missed the performance/LCP gate and the allowed retry passed; all other named routes passed on their recorded attempts. |
| Static generation and verification | Passed: Nuxt preview generation, `finalize-static.ts`, `verify-static.ts`, bundle budget, and selected-theme isolation. |
| Initial JS gzip budget | Passed on every Fashion Store route. `/` 73,719 bytes; shop/collection variants 69,587; product 82,769; cart 70,955; checkout 72,842; remaining named routes 78,139, all below 307,200 bytes. |
| `bun run typecheck` | Passed. |
| Root `bun run lint` | Passed: ESLint, import boundaries, and Admin lint. |
| `git diff --check` | Passed. |

The compatibility run used the locally available engine versions recorded by the U1 baseline:
Chromium 151.0.7922.34, Playwright Firefox 153.0, and Playwright WebKit 26.5. The matrix uses
explicit browser and viewport project metadata, so engine-specific project names no longer turn
viewport scenarios into silent skips.

## Performance and resource evidence

Final Lighthouse results retained by the run:

| Route | Performance | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: |
| `/` | 0.74 first attempt; 1.00 retry | 5,574.57 ms first; 1,127.17 ms retry | 46 ms first; 0 ms retry | 0.00098456 |
| `/shop` | 1.00 | 1,278.09 ms | 0.5 ms | 0.0006736 |
| `/products/relaxed-corduroy-shirt` | 0.93 | 3,155.34 ms | 2 ms | 0.0000748 |
| `/cart` | 1.00 | 1,427.29 ms | 0 ms | 0.0012279 |
| `/checkout` | 1.00 | 1,427.00 ms | 0 ms | 0 |
| `/magazine` | 1.00 | 1,515.01 ms | 0 ms | 0.0004332 |

The retained same-route cold Chromium resource comparison records cumulative compressed JS, CSS,
and font reductions of 56.2%-69.9% across home, shop, product, cart, and checkout. Exact request
rows remain in [the structured resource baseline](fashion-store-final-resource-baseline.json), with
interpretation in [the runtime and CSS record](fashion-store-runtime-and-css.md). This browser
measurement does not measure decoded-image memory or CPU on low-power physical devices.

## Review fixes verified in the final runs

1. Added stable Fashion Store browser/viewport project metadata and a shared test helper so
   viewport-specific scenarios run in generated Chromium, Firefox, and WebKit projects.
2. Normalized product-gallery indices so Previous from the first image and Next from the last image
   wrap correctly.
3. Paused gallery autoplay at the lightbox open request and verified it remains paused while open,
   then resumes under the existing pause rules.
4. Added a visible, focused reload recovery when the optional Bootstrap Modal module cannot load,
   plus a forced-failure and successful-retry browser test.
5. Constrained Tooltip width to the visual viewport and covered edge placement, scroll repositioning,
   and offscreen hiding.
6. Removed the unused visual-runtime failure channel while retaining runtime status and live-instance
   diagnostics.
7. Preserved Swiper's drag click suppression while recognizing a bounded mobile image tap, verified
   by desktop drag and WebKit touch tests.

The formal review artifacts are retained at `/tmp/shoppp-ce-code-review/fs-r1-u11-final/`. No review
finding remains actionable. No mechanically reproducible lifecycle race was found; component and
listener cleanup is covered by the final route/remount suite.

## Delivery boundary

The work remains uncommitted in the existing primary checkout, including the user's prior generated
experience change. No worktree, pull request, deployment, candidate freeze, or production action was
created. FS-R1 returned product execution to REL-Pre-DC for capability-scope reconciliation and
candidate-identity enforcement.
