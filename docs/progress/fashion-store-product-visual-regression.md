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

## 2026-09-16 — U4 automated parity and review gates

- The complete Fashion Store matrix, source-equivalence, theme-impact selection, production/static
  build, repository type/lint/format/boundary gates, and reversible fixture/live HMR probes passed.
  The theme-impact performance run retained a 0.92 Product Lighthouse score with a 3,312 ms LCP;
  the permitted Home retry passed at 0.99 with a 1,128 ms LCP.
- Corrected source, fixture, and live captures at 1,440 x 1,000 and 390 x 844 are retained under
  `test-results/u4-product-human-review/20260915T152838Z-corrected/`. The capture manifest pins the
  fixture/live release, Product, variant, route, viewport, and timestamp identities; all visible
  images loaded and no cookie overlay remained.
- Full `ce-code-review` receipt
  `20260915-234332-082f4265` confirmed three gate gaps. The follow-up extracted one shared Product
  composition assertion, added matched live desktop/mobile geometry and forbidden-content checks,
  made the Color chip locator non-vacuous, and directly tested description-media failure plus
  remount recovery. No finding remains unapplied.
- Post-review Product Playwright passed 27 tests with 41 matrix-defined skips. The complete live
  Commerce Playwright suite passed 17 tests, including the pinned matched-viewports Product case.
  Storefront typecheck, targeted lint/format, and `git diff --check` passed after the review fixes.
- U4 remains open only for the plan-mandated human matched-viewport approval. Automated checks and
  screenshots do not replace that decision and no candidate, DC, deployment, or PG state advanced.

## 2026-09-16 — U4 human rejection and successor handoff

- Human review rejected the retained result. The Product page still lacked substantial right-hand
  action/content and lower detail content, and Color options rendered as text rather than their
  authoritative colors.
- The rejection invalidates FS-F9-U4 completion and handback even though its automated gates were
  green. Those gates are retained as evidence, not promoted to completion authority.
- `FS-F10` supersedes the text-only color adaptation, hard-coded fixture absence policy, and FS-F9
  boundary that excluded Admin/Catalog option metadata. It will use the frozen pre-regression Git
  component as the implementation donor and the upstream HTML only as a parity verifier.
- No candidate, DC, remote release, deployment, or PG state advanced.
