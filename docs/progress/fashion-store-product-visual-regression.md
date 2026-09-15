# Fashion Store Product visual regression evidence

This file retains focused FS-F9 execution evidence. It does not own the current-unit queue,
candidate identity, DC state, deployment state, or PG state.

## 2026-09-15 — U1 immutable contract and red characterization

- The source authority remains
  `apps/storefront/app/themes/fashion-store/upstream/demo-fashion-store-single-product.html` at
  SHA-256 `9f2a5cb42d81df1505c3a911c59544eefd8a0a60e6b27791d8469fd552179f43`.
- The accepted framework baseline is the Product component at commit
  `f3be48b38cd265ae16a65394431901e1f4b1cd5b` immediately before `159fec57`, at SHA-256
  `9788cad519037756258d65691152b97f1b5aacfc6a07f1245302dc7c97dd2060`.
- The region/adaptation ledger records required source relationships, geometry classes, data
  owners, allowed populated/source-shaped-empty/hidden treatments, and forbidden unsupported
  content.
- Focused static characterization produced 17 intended missing-relationship failures across the
  breadcrumb shell, Product summary/options/actions, tab composition, description/information/
  shipping/reviews panel composition, and Related heading underline. The remaining 23 focused
  source, absence, and fidelity tests passed, distinguishing product drift from harness failure.
- Focused desktop Playwright reached the rendered page and failed the intended breadcrumb
  relationship with a count of `0` against `1`; this was not a page-build or browser-harness error.
- `bun run verify:source-equivalence` passed with 162 tests. `bun run check:theme-impact` selected
  the affected Fashion Store path and stopped only at the retained Product characterization red.
- No production Product component or CSS was changed before this evidence was captured.

## 2026-09-15 — U2 provider-neutral presentation reconciliation

- Fixture and live Product inputs now normalize to one shape with explicit literal absence states
  for assurance, delivery, taxonomy, specifications, shipping, and reviews. No fixture-only rich
  content was added to the live presentation contract.
- Fixture variant typing retains authoritative availability, compare-at price, price, and SKU when
  supplied. The existing Commerce runtime mapper is exported for direct contract verification;
  revalidation and cart mutation remain inside the action port.
- Proof-first failures showed the prior contract contained only review/specification state and the
  Commerce runtime mapper lacked a test seam. After the bounded changes,
  `bun test apps/storefront/tests/fixture-contract.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts`
  passed 30 tests with 198 expectations.
- Repository typecheck, boundary checks, targeted lint, and formatting passed. Existing runtime
  Commerce tests also passed, including revalidated-price and disappearing/unavailable-variant
  behavior without fixture fallback.

## 2026-09-15 — U3 shared renderer restoration

- `FashionStoreProductPage.vue` again carries the accepted breadcrumb row/column, 7/5 Product
  layout, Product summary/option spacing, source-shaped secondary actions, full tab row/column/
  divider/content/panel composition, and Related heading underline.
- Information, shipping/return, and reviews retain source-shaped empty layouts with truthful copy.
  Assurance, delivery, payments, taxonomy, ratings, counts, promises, and fixture-only business
  facts remain absent without an authoritative owner.
- The shared action port, live revalidation, option selection, quantity, retry/add-to-cart, route
  reset, gallery/lightbox, description-media fallback, keyboard tabs, and no-JavaScript behavior
  remain in the one shared Product component.
- The six-file focused unit suite passed 65 tests with 1,431 expectations. Storefront Nuxt
  typecheck passed. Live Commerce Playwright passed 16 tests. Product Playwright passed 23 tests
  with 41 matrix-defined skips. Targeted lint, formatting, and `git diff --check` passed.
