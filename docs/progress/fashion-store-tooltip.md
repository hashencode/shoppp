# Fashion Store local Tooltip evidence — FS-R1-U4

The active [FS-R1 plan](../plans/2026-09-03-1750-refactor-fashion-store-components-dependencies-plan.md) owns execution status.

## Replaced behavior

The 30 Home product-card triggers formerly carried Bootstrap Tooltip data attributes. Shared ProductCard action controls also had native `title` prompts. They now use one local `FashionStoreTooltip` that keeps each existing button/link as the actual trigger, preserves its classes, label, href and business listener, and teleports only the visible prompt to `body`.

The prompt uses the inherited Bootstrap-compatible dimensions: no delay, 6 px gap, preferred left placement with top/right/bottom fallback, 200 px maximum width, 0.875 rem text and 150 ms opacity entry. Placement is clamped to the visual viewport and recomputed on scroll/resize while visible. An off-screen trigger closes its prompt; unmount removes all active listeners and animation frames. Reduced-motion disables the opacity animation without removing the prompt.

Hover and focus are independent reasons to remain open. Escape closes the prompt without moving trigger focus. The visible tooltip is associated with its trigger through `aria-describedby`. Touch click handling remains on the native trigger; the prompt has no pointer events and does not intercept the first action.

## Dependency boundary

`initializeFashionStoreCapabilities` no longer constructs Bootstrap Tooltip instances, and the vendor-runtime type no longer exposes Tooltip. There are no remaining active Fashion Store `data-bs-toggle="tooltip"` consumers. Other Bootstrap behavior and the temporary whole-vendor load remain until their owning U7/U9 stages.

## Verification

Verification results and retained artifact paths are appended after the focused engine and route checks finish. The pre-implementation regression failed under reduced motion because the old runtime skipped Tooltip initialization, confirming the application-owned gap.

### Results — 2026-09-04

- Typecheck, fixture production build, static verification, bundle budget, focused lint and the existing runtime lifecycle tests passed.
- Focus/Escape/hover/focus-overlap/viewport-bound/route-cleanup passed in Chromium, Firefox and WebKit under reduced motion. The first Chromium hover attempt targeted a card action while its existing reveal transition was moving; the corrected check first establishes the visible card hover state, then exercises the trigger without weakening the assertion.
- ProductCard consumer geometry and the existing first-touch action behavior passed at desktop/mobile across Product and all three Shop layouts: 10/10.
- Retained output: `apps/storefront/test-results/fs-r1-u4/{red,engines,engines-green,chromium-recheck,consumers}` and `/tmp/shoppp-fs-r1-u4-*.log`.
