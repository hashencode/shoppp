# Fashion Store Product gallery carousel correction evidence — FS-F3

The completed [FS-F3 plan](../plans/2026-09-04-1336-fix-fashion-store-product-gallery-carousel-plan.md) retains correction scope and completion authority. This file retains bounded reproduction and verification evidence only; it does not maintain an execution queue or advance candidate, DC, or PG state.

## Before correction

The inherited FS-R1 Product gallery advanced on a 2 second cadence. The new application-owned selector found zero `data-active="true"` markers because the old component instead wrote Swiper's reserved `swiper-slide-thumb-active` class; repeated visits could leave that reserved class on multiple thumbnails even while `aria-current` followed the semantic index.

Thumbnail synchronization called `slideTo(index)` on every main-image change. The U1 regression demonstrated movement even when the selected thumbnail was already fully visible. Selecting the sixth image translated the 612px desktop rail to approximately `-627px`, left only the final two thumbnails visible, and exposed a large empty trailing region.

## Correction

Implementation commit `c621bb5e` keeps the main Swiper `realIndex` as the semantic image identity, exposes a named 5,000ms autoplay delay, and retains independent hover, focus, document-hidden, lightbox, and reduced-motion pause reasons. It replaces the reserved Swiper marker with application-owned `data-active="true"` plus the matching button's `aria-current="true"`.

Thumbnail movement now compares the active slide's bounding box with the rail viewport. A fully visible target does not move the track; a clipped or offscreen target receives only the leading/trailing reveal delta, and Swiper clamps the resulting translation. The rail uses CSS-owned auto slide sizing so runtime geometry and the responsive layout agree.

The final review hardened two transition boundaries. Thumbnail resize events now re-run the reveal policy after Swiper recalculates layout, including both same-breakpoint and vertical-to-horizontal changes. A new reveal first settles an interrupted thumbnail transition at its rendered position so rapid semantic selections cannot combine a live bounding box with a stale target translation.

## Verification on 2026-09-04

- `bun test apps/storefront/tests/fashion-store-product.test.ts` — passed: 4 tests, 0 failures, 13 expectations.
- `bun run --cwd apps/storefront typecheck` — passed with exit code 0.
- Broad Product exploration: `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config apps/storefront/playwright.fashion-store.config.ts apps/storefront/e2e/fashion-store-product.spec.ts` initially produced 13 passed, 26 skipped, and 5 failed. The new five-second timing, unique-selection, bounded-geometry, mobile-touch, and reduced-motion/remount checks passed. Three failures were unrelated responsive-structure breadcrumb-y expectations at desktop/laptop/tablet. The other two exposed test setup errors: transition duration was asserted while Swiper was legitimately idle, and ArrowLeft was sent while focus remained on the lightbox retry button even though gallery keyboard ownership is focus-scoped.
- The two test setup errors were corrected without changing production behavior. A focused desktop follow-up passed the complete pointer, keyboard, lightbox, pause, and focus-restoration interaction scenario (1 passed); a second focused run passed the lightbox load-failure/retry scenario after explicitly returning focus to the gallery before ArrowLeft (1 passed).
- Representative Product and non-target runs covered desktop/mobile Product timing, selection, geometry, interaction, lightbox failure/retry, reduced-motion/remount, Home collection, Shop arrivals and fallback, About carousel and fallback, and the generic no-JavaScript shell. All named FS-F3 and non-target smoke scenarios passed. The three unrelated breadcrumb-y expectations from the exploratory broad run remain outside this gallery correction and are not claimed as passing.
- Post-review responsive and overlap coverage passed in the desktop/mobile Chromium projects: same-breakpoint desktop resize, desktop-to-horizontal breakpoint change, two selections issued within the 300ms reveal transition, and the mobile sixth-thumbnail path all retained a fully visible final target and exactly one semantic marker. The final focused regression command covered timing, selection, geometry, resize, transition overlap, interaction, and lightbox recovery with 8 passed and 6 expected project skips.

The focused browser assertions exercise real timer delays and computed boxes. They passed the no-advance-before-5-seconds/one-advance-after-delay contract, one active marker and one `aria-current` across repeated semantic selections, no movement for a fully visible target, minimal leading/trailing reveal for clipped and offscreen targets, and clamped final-image geometry.

## Direct browser geometry and interaction inspection

The local Fashion Store preview at `http://127.0.0.1:3435/products/relaxed-corduroy-shirt` was inspected with desktop and mobile Chromium viewport overrides under normal motion, first through the worker browser fallback and then through the host-integrated browser.

- The gallery exposed `data-autoplay-delay="5000"`; the desktop thumbnail Swiper was vertical; initial inspection reported one `data-active` marker and one `aria-current` control.
- After selecting the sixth thumbnail while focus paused autoplay, the semantic index was `5`, the selected label was `View product image 6`, and marker counts remained 1/1. The worker probe measured a last-edge delta near `0.003px`; the host probe at 1440×900 independently measured `-0.22px`. Both retained four intersecting predecessors and no large trailing blank region; their different transforms reflect different available rail heights, not a different alignment policy.
- At 412×915 the rail changed to a row with 25%-width thumbnails. Selecting the sixth thumbnail produced semantic index `5`, marker counts 1/1, and exact alignment between the final thumbnail and the 367px rail's right edge. The worker measured three visible predecessors; the host follow-up independently confirmed a horizontal translation and zero right-edge delta after a desktop-to-mobile resize.
- Opening the lightbox on image 6 reported `6 of 6`; Next wrapped to `1 of 6`. Closing removed the dialog, synchronized the gallery to index 0, retained one marker and one `aria-current`, and restored focus to the Product gallery.
- A real mouse drag probe changed the semantic index while retaining one marker and one `aria-current`. The automated desktop pointer, keyboard, and lightbox path subsequently passed after transition duration was asserted during actual motion rather than at idle.

The local fixture preview emitted known missing-adapter and Nuxt development warnings. These were not attributed to the gallery correction; no production or external environment was exercised.

## Generated-state restoration and limits

Before each build-backed Playwright run, the exact ignored directories `apps/storefront/public/theme-preview-generated/decor-store` and `apps/storefront/.output/public/theme-preview-generated/decor-store` were moved into a `mktemp -d` location and restored afterward. Both originals were confirmed restored after the final runs; no tracked generated mutation remained.

Coverage is intentionally bounded to current Chromium desktop/mobile fixture projects and a local normal-motion browser inspection. Minimum historical browser versions, physical devices, embedded hosts, RTL presentation, formal Decor Store/cross-template regression, a Product-specific JavaScript-disabled context, and live Commerce are not claimed. The generic no-JavaScript recovery shell and prerendered Product contract passed, but the available Product spec has no dedicated single-image fixture; single-image behavior was only code-inspected (`loopEnabled` gates loop/autoplay and non-loop selection) and is not claimed as an independently executed browser case.

The FS-F3-focused Verification Contract is green. The three responsive breadcrumb-y failures from the exploratory broad Product run are outside this gallery correction and remain explicitly unclaimed. Candidate eligibility, DC, and PG remain with their owning plans.

## Post-completion initial-render correction

A refresh follow-up found that the server-rendered desktop thumbnail wrapper used Swiper's default row direction until hydration added `swiper-vertical`. Because the wrapper filled the 661px gallery rail, flex cross-axis stretching made every pre-hydration slide 661px tall even though its image was approximately 141px tall. This produced the reported full-cell flash; the image already had explicit dimensions and was not the source of the instability.

The Fashion Store integration CSS now gives only an uninitialized desktop Product thumbnail wrapper its eventual column direction. The rule stops applying when Swiper initializes, and the existing narrow-layout row rule remains authoritative below 992px. A JavaScript-disabled browser regression failed before the fix with `row` and a 661px first slide, then passed with `column`, a 143px slide, and a 141px image. A direct mobile probe retained `row` at 390px. The adjacent desktop/mobile Product run retained five passing structure, geometry, and interaction cases with two expected viewport skips; the existing desktop breadcrumb-y expectation still failed at 78px versus its unrelated 118px expectation and is not attributed to this correction. This focused correction does not reopen FS-F3 or change the REL-Pre-DC pointer.
