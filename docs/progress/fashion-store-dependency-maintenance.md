# Fashion Store dependency maintenance — FS-R1-U11

The active [FS-R1 plan](../plans/2026-09-03-1750-refactor-fashion-store-components-dependencies-plan.md) owns execution status. This note records the settled maintenance boundary without creating a second unit queue.

## Owned dependencies

- `swiper` is pinned to 11.2.10. `FashionStoreCarousel.vue` owns ordinary carousels; `FashionStoreProductGallery.vue` owns the synchronized main/thumbnail gallery. Page components supply content and documented timing/layout variants. Do not add page-local timers, drag engines or resize controllers alongside them.
- `bootstrap` is pinned to 5.3.2. Fashion Store loads its package CSS through `styles/vendor.css`; only `FashionStoreProductLightbox.vue` dynamically imports the Modal JavaScript module, on the client and on first open. Standard modal focus, Escape, backdrop and scroll locking remain Bootstrap responsibilities.
- `@lucide/vue` remains the ordinary icon source. `FashionStoreIcon.vue` exposes the reviewed semantic allowlist using named imports. Brand marks remain exact local SVG assets with their retained licenses.
- Tooltip and quantity behavior remain local Vue components because their bounded contracts do not require another runtime. Commerce truth continues through the existing action, cart and checkout ports.

## Update procedure

1. Change the exact version in `apps/storefront/package.json` and refresh `bun.lock`. Do not widen a range or raise the approved browser targets as an incidental dependency update.
2. Review the package release and license, then update `fashion-store-dependency-versions.md`. For Swiper, recheck Vue SSR, loop/real-index behavior, touch direction, reduced motion and breakpoint changes. For Bootstrap, recheck Modal lifecycle, focus restoration, Escape/backdrop close, body scroll unlock and dynamic-import failure/retry.
3. Keep `styles/vendor.css`, `registry.ts` and the Fashion preview CSS list in `nuxt.config.ts` aligned. Use Bootstrap 5 utilities such as `visually-hidden`; do not depend on utilities that existed only in the retired monolithic vendor CSS.
4. Run type checking, the focused component/browser tests, the complete Fashion fixture and live suites, the available Chromium/Firefox/WebKit compatibility matrix, static verification, the bundle budget and Fashion performance checks. Record the actual engine versions and keep unavailable historical browsers/devices explicitly unverified.
5. Compare the five governed route resource totals against `fashion-store-final-resource-baseline.json`. Reject a change that restores jQuery, the monolithic vendor runtime/CSS, icon fonts, remote fonts, duplicate Swiper CSS or a second carousel/tooltip initializer.

Preview generation rewrites `app/generated/active-theme.ts` and `active-experience.ts`. When either file contains unrelated work, retain byte-for-byte backups and restore them after the run, or use an already validated external preview. Verify the protected file hash before and after testing.
