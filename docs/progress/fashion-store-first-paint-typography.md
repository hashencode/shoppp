# Fashion Store First-Paint Typography Evidence

This file records a bounded post-completion correction for Fashion Store preview rendering. It does
not reopen a Fashion unit, maintain a current-unit queue, change Candidate eligibility, or move the
product master pointer.

## 2026-09-04 diagnosis

Repeated refreshes of `/products/relaxed-corduroy-shirt` visibly changed text size and geometry.
Browser timing showed the local font files were already cacheable and completed before or around
first paint, while Nuxt development mode replayed the preview CSS modules after first paint. During
that replay, shared upstream `:root` typography (`Inter` / `Plus Jakarta Sans`) and the Fashion demo
typography (`Figtree` / `Outfit`) could temporarily win at different times. A genuinely cold font
load could add a second, smaller fallback-to-web-font change.

## Correction

- Added a Fashion-only, body-scoped first-paint typography baseline before the upstream styles.
  Its custom properties and body metrics keep the same values even when the development CSS modules
  are replayed.
- Moved the two local `@font-face` declarations into that first-paint stylesheet so each face has one
  owner.
- Preloaded the two local WOFF2 files from the rendered head and gave the links stable head keys so
  hydration does not duplicate them.
- Kept `font-display: swap`; the preload starts the downloads early without hiding page content or
  turning font fetches into a page-rendering dependency.

## Verification

- `bun test apps/storefront/tests/fashion-store-theme.test.ts apps/storefront/tests/theme-font-contract.test.ts apps/storefront/tests/fashion-store-product.test.ts` — 13 passed.
- `bun run --cwd apps/storefront typecheck` — passed.
- `bun run --cwd apps/storefront build:preview:fashion-store` — passed, including prerender and the
  Wrangler dry run.
- The generated product page contains exactly two hydrated font preload links. Browser inspection of
  the generated page reports both fonts loaded and the product title computed as `Figtree`, `38px`,
  with a `43.2px` line height.
