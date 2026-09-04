# Fashion Store carousel migration evidence — FS-R1-U5/U6

The active [FS-R1 plan](../plans/2026-09-03-1750-refactor-fashion-store-components-dependencies-plan.md) owns execution status.

## Shared boundary

`FashionStoreCarousel` is the single thin Vue wrapper around the pinned Swiper 11.2.10 runtime. It owns Swiper lifecycle, real-index normalization, keyboard activation while focus is inside an instance, and the independent hover/focus/document-hidden/reduced-motion pause reasons. Pages retain their content, business actions, semantic current index, labels, responsive geometry and timing configuration.

Reduced motion stops autoplay. Fashion Store's broad reduced-motion CSS gives Swiper wrappers a minimal transition completion interval so Swiper can complete its own loop state instead of being left permanently animating by a removed CSS transition.

## U5 home migration

The Home hero and new-arrival collection now use separate Swiper instances. The hero retains the three original slides, 4 second autoplay intent, 1 second normal transition, vertical desktop direction and horizontal mobile direction. Its visible numeric controls select semantic slide indices and meet the existing control target-size rule. Inactive hero slides are inert while hidden so their links cannot enter the focus order.

The collection retains four semantic cards and repeats their rendered data once so a four-card desktop viewport can loop without an empty rail. `realIndex % 4` is the application-visible index. Dragging, looping, autoplay and resize behavior no longer come from the deleted Fashion Store runtime composable or Home timers/pointer calculations.

## Verification

- Production generation, static verification and the existing per-route initial JavaScript budget passed. Home initial JavaScript is 102,073 bytes gzip against the 307,200 byte limit before the U9 legacy-vendor removal.
- Typecheck, focused lint and runtime/interaction contract tests passed.
- The pre-migration mobile drag regression failed against the custom implementation, then passed after Swiper migration: hero drag changes only the hero, collection drag changes only the collection, and the card link is not followed.
- Desktop accessibility passed after inactive hero slides were made inert. Source-region screenshots for desktop/mobile retained the hero content and geometry; artifacts are under `apps/storefront/test-results/fs-r1-u5/`.

U6 results are appended after the Product, Shop and About consumers are migrated and verified.

## U6 Product, Shop and About migration

The fixture Product gallery now uses a dedicated two-Swiper composition because its main image and responsive thumbnail rail must remain synchronized. The application-visible index always comes from the main Swiper `realIndex`; thumbnail selection uses `slideToLoop`, and the lightbox continues to read and change that semantic index. Desktop thumbnails are vertical with three visible items; narrower layouts are horizontal with four. Main autoplay remains 2 seconds with a 300ms normal transition, and single-image input disables loop and autoplay.

Shop creates one shared carousel only when a sidebar and its two three-product arrival groups exist. It retains 5 second autoplay, 300ms transition and external previous/next controls; the no-sidebar route creates no hidden instance. About renders its six images with 2/3/4 responsive slides, the recorded gaps, 2 second autoplay and rewind. Its `calc(100% + 30vw)` container geometry remains the owner of the approved trailing white region.

Across these pages, Swiper now owns drag, loop/rewind, track sizing and resize. Page-local intervals, pointer thresholds, wrapper transforms and thumbnail measurement code were removed. Product lightbox state remains an additional local pause reason.
