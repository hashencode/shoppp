# Fashion Store page-suite interaction QA

Date: 2026-08-10

Scope: product detail, Shop, Collection, the shared header and mini-cart, and shared product-card
actions. The desktop review used a 1280 x 720 CSS-pixel viewport at DPR 1; project laptop, tablet,
and mobile viewports covered the responsive structure.

## Source authority

- Product page: `demo-fashion-store-single-product.html`
- Shop page: `demo-fashion-store-shop.html`
- Product gallery: 300 ms Swiper transition, 2000 ms autoplay, vertical thumbnails, and no visible
  previous/next buttons.
- Shop New Arrivals: 300 ms Swiper transition and 5000 ms autoplay.
- Image preview: full-viewport 0.8 backdrop, viewport-height image with 40 px vertical inset, edge
  arrows, 40 px white close control, title, and image counter.

The authoritative files live under `templates/Crafto - The Multipurpose HTML5 Template/html/`.
Local comparison captures were used during review but are not committed because the acceptance
runner can reproduce them from the pinned source and implementation identities.

## Resolved findings

1. Product gallery behavior now uses 300 ms main/thumbnail transitions and 2000 ms autoplay, with
   keyboard/touch handling and no source-absent arrow controls.
2. Product image preview now matches the source-composed viewport geometry, controls, counter,
   keyboard navigation, backdrop dismissal, and document scroll locking.
3. Shop New Arrivals now moves one flex track over 300 ms instead of toggling item display, while
   retaining 5000 ms autoplay, pause, keyboard, and teardown behavior.
4. The Cotton tag filter now changes the deterministic grid from 12 products to 3 and toggles back
   to 12.
5. Shared semantic buttons no longer regain user-agent borders or backgrounds outside the home
   route.
6. Shop and related-product cards share one `FashionStoreProductCard` presentation owner.

## Result

No unresolved high- or medium-severity mismatch remains in this scope. Gallery, lightbox, arrival,
filtering, shared cart controls, and shared product-card interactions are covered by unit and browser
tests, including keyboard, touch, reduced-motion, teardown, and remount behavior.
