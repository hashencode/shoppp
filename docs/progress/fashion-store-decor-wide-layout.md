# Fashion Store Decor Wide Layout Evidence

## Completed behavior

- Combined Decor Home uses a bounded 1320px content width, with ordinary 15px page gutters, for
  featured categories, products, journal, client logos, and both Footer containers.
- Isolated Decor keeps the source baseline: 1140px from 1200-1399px and Crafto's 1220px override
  from 1400px upward.
- Hero, promotional marquee, Lounge collection, and services remain full-bleed. Compact widths below
  1200px retain the existing Bootstrap container behavior.

## Verification

- `bun test tests/fashion-store-home-source.test.ts`: 9 passed, 162 assertions.
- Combined full responsive browser matrix: 8 passed, 12 intentional project skips.
- Combined and isolated focused width-policy tests passed across 1199, 1200, 1300, 1399, 1400,
  1536, and 1920px.
- `bun run typecheck` and focused ESLint passed.
- `STOREFRONT_FASHION_HOME_PROFILE=combined:decor:transparent-overlay bun run build:preview:fashion-store`
  passed Nuxt static generation and the Wrangler Worker dry run.
- Simplification consolidated Footer and body content widths into one CSS policy. Code review found
  two geometry-test gaps; both were fixed and validated as resolved.

This file records evidence only. FS-F5 owns completion status; REL owns the resumed Pre-DC queue.
