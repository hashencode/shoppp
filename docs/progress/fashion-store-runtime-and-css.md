# Fashion Store runtime and CSS consolidation evidence — FS-R1-U9/U10

The active [FS-R1 plan](../plans/2026-09-03-1750-refactor-fashion-store-components-dependencies-plan.md) owns execution status.

## JavaScript runtime boundary

Fashion Store no longer injects `upstream/js/jquery.js` or `upstream/js/vendors.min.js`. The loader and its ambient global cleanup contract were deleted. All active carousels are Vue Swiper instances, Tooltip is local Vue behavior, and the Product fixture lightbox dynamically imports the pinned Bootstrap Modal module only when opened.

The previous Isotope call had no required masonry result: the governed Product/Shop grids already use the theme's CSS grid/flex layout at their responsive boundaries. `initializeFashionStoreCapabilities` now owns only the remaining application behavior: exposing static content, desktop dropdown state, scroll progress, sticky-rail visibility and lifecycle cleanup. No alternate layout engine runs over those grids.

## CSS and license boundary

Both the live registry and fixture preview config now load `styles/vendor.css`. It contains only the package entry points for Bootstrap 5.3.2 foundation/modal styles and Swiper 11.2.10 core styles. The former monolithic Crafto `vendors.min.css`, icon-font CSS and plugin CSS are not application entries. The original upstream stylesheet list remains unchanged in the source contract as provenance for independent comparisons.

Exact package versions, tarball integrity and MIT notices are retained in [dependency version evidence](fashion-store-dependency-versions.md). Local Figtree and Outfit files remain the only intended Fashion Store font requests.

## Verification

The U9 runtime lifecycle contract passed 3/3. Four focused browser checks confirmed clean initialization, route cleanup/remount, usable static content and zero legacy script/global installation. Source-region comparisons at the governed desktop and mobile viewports passed after the CSS entry replacement, including Header, hero and first-product geometry. The initial U1 network baseline remains the comparison authority; existing static initial-JavaScript budgets remain an additional ceiling rather than a substitute for cumulative resource totals.

The same Chromium 151 desktop, no-preference, cold-route probe produced the following cumulative encoded-body totals. Every route used only the local origin, and every final route requested exactly two font files (Figtree and Outfit). No legacy plugin CSS, icon-font file, jQuery script or monolithic vendor script was requested.

| Route | U1 baseline | U10 result | Reduction | Final JS | Final CSS | Final fonts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 1,432,403 B | 431,124 B | 69.9% | 242,930 B | 135,931 B | 52,263 B |
| `/cart` | 920,363 B | 401,657 B | 56.4% | 213,463 B | 135,931 B | 52,263 B |
| `/checkout` | 924,587 B | 405,192 B | 56.2% | 216,998 B | 135,931 B | 52,263 B |
| `/products/relaxed-corduroy-shirt` | 1,110,279 B | 443,905 B | 60.0% | 254,807 B | 136,835 B | 52,263 B |
| `/shop` | 1,075,817 B | 428,828 B | 60.1% | 240,634 B | 135,931 B | 52,263 B |

The machine-readable before/after breakdown, including transfer bytes, request counts, browser version and origins, is retained in [the final resource baseline](fashion-store-final-resource-baseline.json). Static generation, static verification and all per-route initial-JavaScript budgets passed with the final dependency boundary.
