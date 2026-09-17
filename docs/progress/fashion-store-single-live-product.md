# Fashion Store Single Live Product evidence

This file retains FS-F11 execution evidence. The active unit and next action remain authoritative in
`docs/plans/2026-09-16-1337-refactor-fashion-store-live-product-plan.md`.

## FS-F11-U1 frozen target and rejected-path baseline

Human approval was recorded on 2026-09-16 for the historical Vue desktop/mobile target and the
data-authority exception ledger. U1 is complete; its intentionally failing three-path assertion
remains a guard for the U3-U6 convergence work rather than an unresolved U1 approval blocker.

- Donor component commit: `f3be48b38cd265ae16a65394431901e1f4b1cd5b`.
- Donor component SHA-256: `9788cad519037756258d65691152b97f1b5aacfc6a07f1245302dc7c97dd2060`.
- Regression commit: `159fec579bb2722f45c6d327e0a5ad506c81f6dd`, whose first parent is the donor commit.
- Primary visual authority: the historical Vue `FashionStoreProductPage.vue` at donor commit
  `f3be48b38cd265ae16a65394431901e1f4b1cd5b`.
- Secondary design reference only: `apps/storefront/app/themes/fashion-store/upstream/demo-fashion-store-single-product.html`,
  SHA-256 `9f2a5cb42d81df1505c3a911c59544eefd8a0a60e6b27791d8469fd552179f43`.
- Fresh accepted-cookie historical Vue captures, with the development-only checker overlay removed:
  - `test-results/fs-f11-u1-vue-target/20260916T-current/source-vue-donor-1440x1000.png` — SHA-256 `aebbf5e0dd62f3466b21873330aeda31a9c82ee1958036e794c7db66ffd7c9c4`.
  - `test-results/fs-f11-u1-vue-target/20260916T-current/source-vue-donor-390x844.png` — SHA-256 `42a4a489f10386539523f57cd13fe6686b378b5200ac7af8d3410eaf8a6a55ce`.

The frozen profile lives in `fashionStoreProductParityProfile`. It records both viewport sizes,
historical Vue geometry, a maximum 1% changed-pixel ratio, a mean-channel-delta ceiling of 5, and the exact
dynamic content classes that must be masked rather than copied. Desktop geometry allows at most an
8px source/implementation delta for the legacy split; mobile allows at most 4px. Existing 2px local
alignment assertions remain stricter where they already apply.

### Historical Vue-owned structure and static presentation

- Header/shell relationship, breadcrumb, two-column desktop Product composition, mobile stacking,
  six-item gallery, right-rail hierarchy, Color and Size control placement, quantity/cart/actions,
  four-tab navigation, rich-detail composition, related heading/grid, and Footer relationship.
- Static control labels and visual hierarchy remain donor-owned unless the authority ledger below
  explicitly replaces a claim.
- Gallery contains six donor slots, tabs remain ordered Description / Additional information /
  Shipping and return / Reviews, and the rich canonical target contains four related cards.

### Approved-data exception ledger awaiting human confirmation

| Donor content                                                       | Required live authority                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Zalando, ratings, and review bodies                                 | Released brand plus an API-backed published review-display snapshot, otherwise zero |
| Demo identity, description, SKU, prices, options, and product media | Selected Catalog Release Product and stable released Variants                      |
| Estimated delivery, free shipping/returns, and checkout guarantee   | Published policy/configuration only; otherwise retain a truthful empty source slot |
| Fashion/Woman taxonomy and demo tags                                | Published collection/category membership only                                      |
| Four named demo related products                                    | Bounded ordered released collection projection, or its truthful empty state        |

### Current three-path rejection baseline

- Deterministic preview uses `createFixturePresentationProvider`, accepts a Product
  `theme-section`, and enters `normalizeFashionStoreFixtureProductPresentation`.
- Live preview uses `composeExperienceRoute` and enters
  `normalizeFashionStoreLiveProductPresentation`.
- Production `apps/storefront/app/pages/products/[slug].vue` owns an independent sparse
  `<article class="product-page">` implementation.
- `apps/storefront/tests/fashion-store-product.test.ts` now contains the FS-F11 single-path
  contract. Its focused run is intentionally red until those three paths converge in U3-U6.

The retained FS-F10 captures show the observable consequences:

- Deterministic preview is closer than live but still changes the accepted shell: the yellow
  announcement row and left utility navigation are absent, the page starts at a different vertical
  offset, review text receives a source-absent bordered/focus treatment, and spacing/typography drift
  remains across the right rail and tabs.
- Live preview loses the complete gallery and detail media, brand, assurance/payment/taxonomy rows,
  rich detail composition, three related cards, and the accepted Footer content. Its desktop page is
  roughly 700px shorter than the source, and its mobile page is roughly 3,500px shorter.
- The live empty gallery is the direct result of Commerce presentation projection replacing released
  media. Its one-card related grid and reduced detail panel demonstrate that data absence currently
  changes the page hierarchy rather than only changing truthful values and states.
- Production remains a separate sparse article, so neither preview result proves the shopper route.

No production code, remote Catalog state, release activation, deployment, candidate, DC, or PG
state changed while producing this baseline.

## FS-F11-U7 human rejection and corrective reconciliation

The first U7 capture set is rejected evidence, not a near-pass. It repeated the same visible defects
as the prior attempt because the implementation retained the reduced current template and tried to
compensate for missing regions with CSS height floors and screenshot masks.

- `FashionStoreProductPage.vue` differs from the accepted donor by 633 additions and 489 deletions;
  it was not a mechanical restoration of the known-good Vue template.
- `productViewModel` hardcodes `reviewSummary` to zero, and the Fashion Product normalizer explicitly
  removes assurance/right-rail data. No amount of component styling can recover the historical
  review values or missing delivery/payment content from those inputs.
- `integration.css` adds Product minimum-height compensation while the parity profile masks broad
  Product regions. Those mechanisms can make aggregate image metrics green while leaving missing
  controls and content visible to a human reviewer.
- The single Product model/component and release-backed Commerce boundary from U2-U5 remain valid.
  The visible restoration claim from U6 is reopened and now executes through U7.1 reconciliation,
  U7.2 mechanical donor restoration plus API binding, and U7.3 unmasked aggregate verification.
- The review display correction will use an optional API-backed published snapshot. Development
  demonstration values may be seeded only through that path; production without a snapshot uses
  the historical zero-review state. Color circles require explicit released swatch values; missing
  swatches render as text rather than fabricated neutral colors.

No new implementation screenshot is accepted until the height compensation and broad masks are
removed and named assertions fail on the rejected color, review, right-rail, related-grid, and footer
defects.

### FS-F11-U7.1 frozen region reconciliation

The corrective inventory is now closed. Each visible region has one owner and one assertion that
would fail on the rejected result:

| Region | Donor contract and current correction | Data authority / remaining U7.2 work | Unmasked acceptance |
| --- | --- | --- | --- |
| Product summary | Historical hierarchy retained; the browser-default review-button border and Product height floors are removed. | Release owns identity, brand, description, SKU, and selected Variant prices. | Summary hierarchy, price pair, SKU, and natural geometry are asserted. |
| Color and size | Circular color controls render only for explicit released swatches; swatchless values render as text. Development default is Green / XL. | Release option definitions and default Variant. | No fabricated neutral swatch; Green and XL are selected. |
| Reviews | Summary is 5.0 / 165 while the tab label reflects the three published display entries, matching the donor's distinct total/display semantics. | Optional published Product review-display snapshot; absence is truthful zero. | Summary, tab count, entries, and zero state are asserted independently. |
| Actions | Compare, Ask a question, Share, cart, quantity, and the disabled unsupported wishlist retain donor labels and placement. | Existing action port; unsupported controls remain disabled rather than fabricated. | Named controls and count are asserted. |
| Assurance / taxonomy | Historical slots remain in the DOM. Missing delivery, return, payment, or tag data renders an explicit unavailable state. | Versioned public Experience/policy/payment fields remain U7.2 work; release collection owns category. | Slot presence and populated/source-shaped-empty state are asserted without a region mask. |
| Gallery | Six released slots and donor ordering are retained; a broken allowlisted historical development URL may resolve to the matching bundled template asset. | Release media order; Commerce cannot replace it. | Gallery count/order and image loading are asserted; only image pixels may be masked. |
| Tabs and rich detail | Four donor tabs and rich detail composition remain present. | Release presentation plus published policy/review owners. | Tab order, review label, and detail structure are asserted. |
| Related products | Four-card donor grid remains present, but the current released membership still yields Atlas first. | Ordered released collection membership must be corrected in U7.2. | Exact four-card identity/order assertion will replace generic count-only proof. |
| Footer transition | Artificial page and tabs minimum heights are removed, so the Footer follows natural content. | Donor shell/footer contract. | Footer offset is measured after named content assertions, not manufactured by height floors. |

The Product parity profile now masks image pixels only; both broad Product-region masks are empty.
The proof-first run failed on the old minimum height, conditional assurance slot, and fabricated
neutral color fallback before those defects were corrected.

### FS-F11-U7.2 desktop core checkpoint

- Published development data now carries a review-display snapshot with 165 total reviews, a 5.0
  rating, and three displayed entries. The component contains no literal fallback for those values.
- The development default Variant is Green / XL with the released `$85.00` compare-at and `$65.00`
  current prices. Color and Size labels, source action labels, and all gallery thumbnails match the
  historical desktop composition.
- Truthful remaining gaps are intentionally visible in the checkpoint: delivery/return/payment are
  unavailable until their public Experience owners are implemented, and Atlas remains the first
  related card until released membership/order is corrected.
- Focused verification: Storefront contract/theme/fixture tests `75/75`; Storefront typecheck green;
  desktop Product structure browser test `1/1`; `git diff --check` green.
- Fresh direct-review captures:
  - `apps/storefront/test-results/fs-f11-u7-core/20260916T-current/desktop-core-1440x1000.png`
    — SHA-256 `7be2aa9cd5c6ed61135c68008e186e437a63bd0934ad63d15216fc93be2f02d9`.
  - `apps/storefront/test-results/fs-f11-u7-core/20260916T-current/desktop-core-full-page.png`
    — SHA-256 `7229eeb7ceaaaaf22cbab6094cc4ae129310c1794bb5b0e1f036832c63f4377d`.
- No remote Catalog mutation, release activation, deployment, candidate, DC, or PG state changed.

## FS-F11-U2 Product presentation authority

- Added optional validated Product presentation metadata for brand, rich-detail copy/bullets,
  detail-media identity, ordered specifications, and default Variant identity.
- D1 migration `0028_product_presentation.sql` adds a nullable JSON-object column without changing
  historical Product rows. Historical schema-v2 releases remain readable and acquire no claims.
- Presentation writes use the Product version CAS boundary, reject foreign media/Variant IDs and
  duplicate specification labels, preserve Variant/media rows, and remain immutable after publish.
- General draft edits retain matching media and Variant IDs and reject removal of an identity still
  selected by Product presentation.
- Public Product reads, the governed Fashion development Catalog, and immutable release generation
  carry the same aggregate. Related Product order remains owned by released collection membership.
- Admin Product editing now exposes the aggregate in the existing form with gallery/default-Variant
  selection and keyboard-operable specification ordering/removal.
- Verification: Contracts/tool tests `13/13`; D1 migrations `12/12`; API typecheck plus focused API,
  release, route, and staging tests `41/41`; Admin typecheck and form tests `8/8`; focused Admin
  Playwright `2/2`; affected Admin lint green.
- No remote Catalog mutation, release activation, deployment, candidate, DC, or PG state changed.

## FS-F11-U3 canonical ProductPageModel

- Theme-engine composition now owns a presentation-complete `ProductPageModel`: released identity,
  gallery order, authored option definitions, deterministic default Variant, brand, rich detail,
  detail media, specifications, collection-derived taxonomy and related order, policy copy, and a
  truthful zero-review state.
- Historical releases without the optional presentation aggregate retain their released copy/media,
  receive neutral option presentation, select the first active priced Variant deterministically,
  and acquire no fabricated brand, review, specification, shipping, or payment claims.
- Catalog media IDs remain available for aggregate validation but are stripped at the presentation
  boundary, preventing strict render schemas from receiving persistence-only identity fields.
- The Fashion Product normalizer now accepts only `ProductPageModel`; the Product `theme-section`
  branch and the fixture/live Product normalizer pair were removed. Taxonomy is rendered from its
  independent released authority instead of being coupled to unavailable assurance claims.
- Verification: Storefront typecheck green; focused theme-engine and fixture-contract tests `61/61`.
  The FS-F11 three-host assertion remains intentionally red only for U4 production/preview host
  convergence.
- No remote Catalog mutation, release activation, deployment, candidate, DC, or PG state changed.

## FS-F11-U4 converged Product hosts

- Deterministic Fashion preview input now carries a validated Catalog Release. Product routes use
  that release with the live composer while Home, Collection, Cart, Checkout, and content retain
  their existing fixture-preview providers.
- Exact deterministic Product routes now resolve stable release Product ID/slug parameters; absent,
  unpublished, or mismatched identities fail at the existing route/composer boundary.
- Production Product generation emits the canonical release in the route-bounded Product input.
  `/products/[slug].vue` now owns only loading, SEO/JSON-LD, theme CSS/assets, and established
  Commerce/cart ports around `composeProductPageModel` and `FashionStoreProductPage`; its sparse
  independent `<article class="product-page">` implementation was removed.
- Production prerender now follows only the explicit release/system route inventory, preventing
  Fashion shell links to preview-only information routes from widening the production build.
- Verification: Storefront typecheck green; focused routing/theme/composer/Product tests `86/86`;
  full production static generation and Wrangler dry-run green, including both published Product
  routes and their canonical structured output.
- No remote Catalog mutation, release activation, deployment, candidate, DC, or PG state changed.

## FS-F11-U5 released-Variant Commerce overlay

- Runtime Commerce can update only price, compare-at price, and availability for Variant IDs already
  present in the released Product model. Unknown Commerce Variants are ignored and released Variants
  omitted by Commerce become unavailable.
- Product identity, slug, and currency mismatches fail revalidation and retain the complete initial
  release presentation. Empty Commerce media and option arrays no longer alter gallery, detail media,
  option labels/order/swatches, selected Variant, SKU, taxonomy, or related Products.
- Cart verification now rejects wrong Product/slug responses and still submits current verified unit
  price, currency, quantity, release ID, and the selected released Variant ID.
- Verification: Storefront typecheck green; runtime/normalizer/boundary unit tests `41/41`; focused
  live Product browser tests `3/3` after updating stale pre-default-selection and taxonomy
  expectations. The first browser run correctly exposed those two obsolete expectations; no product
  implementation defect remained after the aligned rerun.
- No remote Catalog mutation, release activation, deployment, candidate, DC, or PG state changed.

## FS-F11-U6 donor restoration and single Product surface

- The development release now supplies the historical Product composition through release data:
  ordered Color/Size definitions, deterministic default Variant, compare-at price, six gallery
  images, authored detail copy and specifications, a separate historical detail image, and four
  collection-derived related products. The detail asset uses the governed Fashion asset resolver
  because the retained 2026-09-13 R2 development upload intentionally contains only gallery images
  01-06; no remote object was invented or uploaded.
- `ProductPageModel` excludes an explicitly selected detail-media identity from the gallery while
  preserving every other ordered release image. The Fashion boundary resolves the bounded
  `/media/fashion-store-theme/<filename>` development reference to its allowlisted template asset;
  ordinary Catalog HTTPS media stays URL-backed.
- Deterministic Product preview and the production `[slug]` route both render the same
  `FashionStoreProductPage`. The production route opts out of the generic Nuxt layout, eliminating
  the duplicate Shoppp header/footer that the first production-shaped capture exposed.
- Fixture-era browser assumptions were removed: unsupported related-card actions and wishlist are
  no longer fabricated, review authority is shown as `0 Reviews`, assurance is hidden without a
  publisher, and local preview cart behavior remains available through the action port.
- Verification: Storefront typecheck green; focused theme-engine/Product/Commerce tests `68/68`;
  focused desktop/mobile Product browser evidence `6/6` with `2` intended viewport skips; full
  production static generation and Wrangler dry-run green. The broader Product run reached `19`
  passes with `13` intended viewport skips before its only two failures identified the missing
  detail-asset mapping; the corrected focused rerun is green.
- Fresh deterministic release captures:
  - `test-results/fs-f11-u6/20260916T-current/release-backed-desktop-1440x1000.png` — SHA-256
    `57fb9ccce684e1f23f129565ae1b9815c9d18c7533b29a28b731aca93c7634ee`.
  - `test-results/fs-f11-u6/20260916T-current/release-backed-mobile-390x844.png` — SHA-256
    `a079b9c1f3cf6a9463b3c7b5b081d3890c5c7cf7dd92bc166a43e815cabbe9ef`.
- Fresh production-shaped captures after removing the duplicate generic layout:
  - `test-results/fs-f11-u6/20260916T-current/production-shaped-desktop-1440x1000.png` — SHA-256
    `afe0eafe43b5e0d111c4989aaa5a867ae0b259ef2496b875bae121a0a214552e`.
  - `test-results/fs-f11-u6/20260916T-current/production-shaped-mobile-390x844.png` — SHA-256
    `2588e254bd8dfe4c38817ef61ede848dc46ca7538f7fd8ed9c4f1802c580b03f`.
- No remote Catalog mutation, release activation, deployment, candidate, DC, or PG state changed.

## FS-F11-U7 review remediation and matched pre-approval evidence

> Human review on 2026-09-16 rejected this capture set. The geometry and masked-pixel checks below
> are retained as diagnostic evidence only and are not acceptance evidence: minimum-height padding
> reproduced document coordinates without restoring the missing right-rail presentation, while the
> pixel masks excluded the same visually incorrect Product regions the review was meant to judge.

- Independent code review reported 17 confirmed findings. The retained report is
  `/tmp/compound-engineering-501/ce-code-review/20260916-152452-b7336f96/report.md`; all confirmed
  implementation findings were addressed before the fresh evidence below.
- Ordinary Admin saves now preserve option presentation and stable referenced Variant IDs. Legacy
  draft writers may omit `optionDefinitions`, in which case the API derives neutral text
  definitions. Product and publication writes use the Product version boundary, release option
  definitions are cross-validated against Variant values, and metadata mutation/audit work is
  atomic.
- Publication freezes Product metadata before manifest construction and rolls the Product back to
  its previous editable status if the build hook fails. Selected-Variant price and cleared
  compare-at price remain truthful, release media bounds match the shared contract, and related
  Product order comes only from published reciprocal release membership.
- The production Product shell no longer renders unowned contact/social claims, the invented
  Express claim, or links to unpublished `/shop` routes. Empty related collections retain a
  truthful source-shaped state.
- The frozen historical Vue geometry profile was made an executable browser gate. Missing policy and
  payment authority remains hidden, while Product right-rail minimum geometry and related-card
  media ratio preserve the donor layout without copying unsupported claims. Both frozen viewports
  match the donor document height and the breadcrumb, gallery, Product information, tabs, Related
  heading, and Footer geometry within their 8px/4px tolerances.
- The profile's dynamic-data masks and pixel ceilings were consumed by
  `scripts/verify-fashion-store-product-parity.ts`. Fresh masked comparison is green:
  - desktop changed-pixel ratio `0.0315%`, mean-channel delta `0.1442`;
  - mobile changed-pixel ratio `0.0859%`, mean-channel delta `0.8212`;
  - both remain below the frozen `1%` and mean-channel-delta `5` ceilings.
- Rejected accepted-cookie release-backed captures:
  - `apps/storefront/test-results/fs-f11-u7/20260916T-current/implementation-desktop-1440x1000.png`
    — SHA-256 `4dfa7a8ad89039473f03446c8b0df35fa9e250223b4062421ad6744eccc6b867`.
  - `apps/storefront/test-results/fs-f11-u7/20260916T-current/implementation-mobile-390x844.png`
    — SHA-256 `26f4ffbd6496da890e377d8190f15d2a1c5122463262fd7252ca570b10dd25ad`.
- Verification: Storefront focused unit tests `87/87`; API catalog worker tests `19/19`;
  Contracts tests `20/20`; Admin focused tests `13/13`; Storefront, API, and Admin typechecks green;
  complete Product browser run `27/27` with `41` intended viewport skips; frozen geometry gate `2/2`
  with `2` intended non-profile viewport skips; production generation, Wrangler dry-run, static SEO,
  production-shell residue inspection, masked pixel comparison, and `git diff --check` green.
- Deterministic preview generated outputs were restored after production verification. No remote
  Catalog mutation, release activation, deployment, candidate, DC, or PG state changed. U7 remains
  open; the next implementation pass must restore the visible historical Vue regions instead of
  compensating with empty height or broad screenshot masks.
