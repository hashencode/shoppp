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

| Donor content                                                       | Required live authority                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Zalando, ratings, and review bodies                                 | Released brand plus an API-backed published review-display snapshot, otherwise zero |
| Demo identity, description, SKU, prices, options, and product media | Selected Catalog Release Product and stable released Variants                       |
| Estimated delivery, free shipping/returns, and checkout guarantee   | Published policy/configuration only; otherwise retain a truthful empty source slot  |
| Fashion/Woman taxonomy and demo tags                                | Published collection/category membership only                                       |
| Four named demo related products                                    | Bounded ordered released collection projection, or its truthful empty state         |

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

| Region               | Donor contract and current correction                                                                                                                   | Data authority / remaining U7.2 work                                                                  | Unmasked acceptance                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Product summary      | Historical hierarchy retained; the browser-default review-button border and Product height floors are removed.                                          | Release owns identity, brand, description, SKU, and selected Variant prices.                          | Summary hierarchy, price pair, SKU, and natural geometry are asserted.                       |
| Color and size       | Circular color controls render only for explicit released swatches; swatchless values render as text. Development default is Green / XL.                | Release option definitions and default Variant.                                                       | No fabricated neutral swatch; Green and XL are selected.                                     |
| Reviews              | Summary is 5.0 / 165 while the tab label reflects the three published display entries, matching the donor's distinct total/display semantics.           | Optional published Product review-display snapshot; absence is truthful zero.                         | Summary, tab count, entries, and zero state are asserted independently.                      |
| Actions              | Compare, Ask a question, Share, cart, quantity, and the disabled unsupported wishlist retain donor labels and placement.                                | Existing action port; unsupported controls remain disabled rather than fabricated.                    | Named controls and count are asserted.                                                       |
| Assurance / taxonomy | Historical slots remain in the DOM. Missing delivery, return, payment, or tag data renders an explicit unavailable state.                               | Versioned public Experience/policy/payment fields remain U7.2 work; release collection owns category. | Slot presence and populated/source-shaped-empty state are asserted without a region mask.    |
| Gallery              | Six released slots and donor ordering are retained; a broken allowlisted historical development URL may resolve to the matching bundled template asset. | Release media order; Commerce cannot replace it.                                                      | Gallery count/order and image loading are asserted; only image pixels may be masked.         |
| Tabs and rich detail | Four donor tabs and rich detail composition remain present.                                                                                             | Release presentation plus published policy/review owners.                                             | Tab order, review label, and detail structure are asserted.                                  |
| Related products     | Four-card donor grid remains present, but the current released membership still yields Atlas first.                                                     | Ordered released collection membership must be corrected in U7.2.                                     | Exact four-card identity/order assertion will replace generic count-only proof.              |
| Footer transition    | Artificial page and tabs minimum heights are removed, so the Footer follows natural content.                                                            | Donor shell/footer contract.                                                                          | Footer offset is measured after named content assertions, not manufactured by height floors. |

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

## FS-F11-U7.2 2026-09-17 user-feedback correction, pending visual review

- The compare-at price now uses light gray, while current price remains primary. The star group and
  count do not shrink; a long SKU wraps first. Shipping and return headings, columns, and spacing
  follow the supplied Crafto module, while all delivery/return text comes from Product Experience
  settings or published policies. The right rail no longer asserts free shipping without authority.
- The Product model now reads bounded public delivery and shipping/return summaries and enabled
  payment-brand settings. The local preview snapshot carries policy-backed summaries. Both Product
  composition paths honor an explicitly selected published related collection and preserve its
  released product order. The Reviews tab uses the published summary count (`165` in the development
  release), rather than the three visible example entries.
- The two new Product settings are optional, with empty defaults in the current 1.1.0/schema-2
  successor package. A previously approved schema-2 snapshot that omits both still composes with
  no delivery or return assurance claim. Historical 1.0.0 package bytes remain
  immutable; this additive successor setting change needs no override migration. A rejected or
  unpublished explicit related collection now fails on the direct Product path as it does in route
  composition, while an unrelated selected collection does not relabel the Product's own category.
- Browser inspection at 320, 390, 576, 768, 992, 1024, 1100, and 1440 CSS pixels found no horizontal
  overflow. It exposed an isolated Share action at 320-390px and an isolated fourth tab at 768px;
  mobile actions now form full-width rows and tabs form balanced two-column rows below 992px. The
  eight-width content-stress browser assertion covers star integrity, long SKU, overflow, and these
  control layouts. The historical baseline remains immutable; named R21-R23 geometry overrides cover
  the downstream height changes without adding screenshot masks or a height floor.
- Verification: focused Storefront unit tests `91/91`, Storefront and E2E typechecks, ESLint, Prettier,
  and diff check pass. Focused deterministic Product browser tests pass at both retained desktop and
  mobile viewports; the local live Product composition and grouped-option/no-JavaScript
  flows pass. The broader theme-impact run surfaced stale Collection and Product E2E expectations
  from the enriched development release; focused reruns passed after those expectations were aligned.
  Full U7.3 aggregate, production-shaped capture, independent review, and human visual acceptance
  remain open.
- Final local rerun after the empty-policy fallback copy changed: preview generation and Wrangler
  dry-run passed; Product structure, responsive content stress, and Reviews interaction passed `4/4`
  with two intentional mobile-project skips. The optional-value compositor cases passed `66/66`
  focused unit tests; changed code passed ESLint and Prettier checks. Read-only code review found an
  invalid direct-path related-collection fallback, which was corrected and covered by a unit test;
  the versioned optional-setting compatibility decision is recorded above and covered by a missing-
  field composition test.
- Fresh accepted-cookie deterministic preview captures (local, not approved):
  - `apps/storefront/test-results/fs-f11-u7/20260917T-feedback/product-1440.png` — SHA-256
    `ed24a49cf41acbe4d225d1601c2cdf6aa90518c6f7169ae4c24f6ba93cbef19d`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-feedback/product-390.png` — SHA-256
    `832e9c51a76d603bf862234f2769e5eadc707d1fe5efae663fe1ff933d9d52c9`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-feedback/product-shipping-1440.png` — SHA-256
    `0efa9778299e9d1d67e11adb1c3fa04e7de7f21961a1d679e3f0b7f13dea3da4`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-feedback/product-reviews-1440.png` — SHA-256
    `c5a81ef9717f7d390d1ca80361d7fe80ac9f8ca4a49a3a997576d0ea4697fec3`.
- No remote Catalog mutation, release activation, deployment, candidate, DC, or PG state changed.

### FS-F11-U7.2 follow-up: Product card price hierarchy

The user clarified that the light-gray compare-at treatment also applies to Product cards. The
shared card now covers Home, Shop, Related, wishlist, and content-state grids; the Shop sidebar
carousel and Home merchandising slider use the same `.fashion-store-compare-at-price` style. Current prices keep
their existing emphasis. The user also removed reviewer avatars from the planned FS-F12 scope;
reviewer names, per-entry ratings, the distribution, Show more, and Add a review remain planned. The
current Reviews list now omits portraits and gives author/date a text-only column; its historical
published review snapshot remains readable.

- The rebuilt local preview and Wrangler dry-run pass. At 1440px, browser-computed compare-at color
  was initially `rgb(168, 168, 168)` in Home, Shop, Related, and Shop sidebar cards; the shared-card
  current price remained `rgb(35, 35, 35)`. The full live theme test then exposed an axe contrast
  failure against white (`2.37:1`). The shared compare-at style is now `#6b6b6b`, visibly secondary
  to current price and above the `4.5:1` text threshold; focused live Home/Product/Wishlist axe
  paths pass. The Home merchandising slider uses the same class in code but
  is not present in the active Fashion Home preview. The focused Product Reviews interaction test
  passes with an explicit assertion that the rendered entry list contains no portrait images. The
  Reviews panel has no horizontal overflow or portraits at 320, 390, 768, and 1440px; Storefront
  typecheck, changed-code ESLint, changed-file Prettier, and `git diff --check` pass.
- Fresh accepted-cookie local captures for renewed visual review:
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/home-card.png` — SHA-256
    `396c0995e20130b6dd0c82f9330f94b2255b1d3560293bb0f9fe5fe8f20829dc`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/shop-card.png` — SHA-256
    `4757891551279d6351dbe3c6818598bedae066b212d59041d898efa8a9d2a876`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/related-card.png` — SHA-256
    `aa3713d4b58271ada04f0817cf314b272e72899fe13755a45f73408c4bd46ca7`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/product-1440.png` — SHA-256
    `24a09ce271f5f67c4ac21492885ddc82e44f82563b4dd221ca410462c5fa09fc`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/product-390.png` — SHA-256
    `c7e8bc399d6a348bc4a066cf267868f694098f0f4bcd343e69ef134f545551b8`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/product-shipping-1440.png`
    — SHA-256 `1ae65b51fb3a6b086284ecfdffc6783f548a6f0c06de416f20308e26d69b4833`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/product-reviews-1440.png`
    — SHA-256 `da27a1ce07f4b0a796a9c62092305938fbd6db60e01425b90d4772812b184fdf`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/product-reviews-390.png`
    — SHA-256 `3f6f20017eb8a40890cdb26a871f49da1d6d86c4014acb9e004123ba8bb0273d`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/reviews-panel-1440.png`
    — SHA-256 `4b911a4754b52f03da324ca085522ca7052776f50b69b6da0c2af60131d0363a`.
  - `apps/storefront/test-results/fs-f11-u7/20260917T-card-feedback/reviews-panel-390.png`
    — SHA-256 `de790beed86134c7ea097bcf1a2f0963d3b800d7167fd9320d166ff7f8692fa6`.

### FS-F11-U7.3 follow-up evidence

The user accepted the earlier desktop/mobile card and portrait-free Reviews layout. The full
theme-impact gate then exposed that its first `#a8a8a8` compare-at shade fails axe text contrast
against white. The shared shade is now `#6b6b6b`; the Product hero and Home, Shop, and Related cards
have computed-color browser assertions. The user accepted this final gray and portrait-free Reviews
appearance on 2026-09-17; the aggregate gate remains in progress.
The browser ledger now drops a redundant shared utility row whose route-specific owners supersede it;
the no-JavaScript recovery assertion follows the published Home route, and the history check uses
the Home/Product routes that the selected preview actually publishes.

One canonical test-only live input removes the Product's published review snapshot and the Product
Experience delivery, returns, and payment-brand settings. Its browser case passed at 1440px and
390px: the summary and tab both show zero, the panel shows the empty state, and assurance and
payment slots make no unsupported claim. A read-only six-lens review found no remaining actionable
code findings or testing gaps; it withheld handback pending the aggregate, production-shaped, and
renewed human evidence.

Fresh local preview evidence after the contrast correction and neutral Review/payment headings:

- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/source-desktop.png` — SHA-256
  `f539f4019de34e2a35574b60c1f34b746aace5c1db899bf68ddc398ab3070bc9`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/source-mobile.png` — SHA-256
  `1252fac1ddad97fac17899c7f1a09faf0c541480bb196cf5a496fda8b56bfbca`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/home-card.png` — SHA-256
  `ab5263f2e16ff7b08aa6469aaa0e33ae1dc5342747ed65b9f7b7cf82503f068a`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/shop-card.png` — SHA-256
  `97db0081ba6e78f8e9b1d486fd4102280ae253f74e327bf5751736023a233f71`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/related-card.png` — SHA-256
  `1be019a2e553afa42240f794b5dff00e1beb5ac1d7fbfd27577e12b574a6bde5`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/product-desktop.png` — SHA-256
  `687f31d6e9e334deb0f010bdafd2270cf9a0cb84405f832a40e94c6d6a0f9fb8`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/product-mobile.png` — SHA-256
  `84307aec63773d6683dbcfdb0031be37440611b7d02c8903959c07a127ba63a2`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/shipping-desktop.png` — SHA-256
  `f24dcf8e0a53a71a442ef4540558d1fbd2fcbffcb98b31edb9e0517dc433bdc7`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/shipping-mobile.png` — SHA-256
  `2f57e7cbfe4f26cd5661bad03ee1ce5104d2173a5f0ca5bc113bbca0e8721f79`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/reviews-desktop.png` — SHA-256
  `a62fe8537aea73111c660ff32ec72c5c8df003bfdbca1daa05e1b94ee2bc6afb`.
- `apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/reviews-mobile.png` — SHA-256
  `dc6faac502d48c42dcc9ae25c3f3a566bc6e1bd5a8b618588922e8b5ee060bb3`.

The U7.3 report verifies the hashes of the U1-frozen historical Vue donor captures, then compares
them with the fresh matched-width Product captures without a mask. It preserves every pixel,
including unequal full-page tails, and reports desktop/mobile height deltas of `+60px/-46px`
and changed-pixel ratios of `17.16%/27.93%`. The fresh Crafto HTML screenshots listed above are
secondary design references, not the R18 visual authority. Released content, imagery, and
user-approved R21-R23 styling intentionally differ from the historical Vue donor, so the report
records the strict historical one-percent threshold as unmet instead of claiming pixel parity.
Its local artifact is
`apps/storefront/test-results/fs-f11-u7/20260917T-final-feedback/unmasked-parity-report.json`.

The full Fashion live browser suite passed `17/17`; the ordinary Fashion browser suite passed
`296` with `260` intended skips; combined and isolated Home profiles each passed `12` with `12`
intended skips after the unified fixture's collection/product membership was made reciprocal and
its released card count reached eight. Behavior acceptance and the mobile Lighthouse budget passed.
The empty Product browser case passed at both retained widths and now waits for hydration before
checking that Reviews replaces Description visibly. Storefront typecheck, changed-code ESLint,
Prettier, and diff checks passed. These are segmented reruns after the aggregate gate first stopped
at unified fixture setup; the aggregate command has not been rerun as one invocation.

The uninterrupted `bun run check:theme-impact` rerun exited `0` on 2026-09-17. It passed the
Fashion live suite (`17`), the empty Product suite (`1`, checking both retained widths), the
ordinary Fashion browser suite (`296` passed, `260` intentional skips), the combined and isolated
Home profiles (`12` passed and `12` intentional skips each), all 15 route behavior evidence
records, and the mobile Lighthouse budget. Home's first Lighthouse pass transiently missed its
budget; its permitted retry scored `1.00` performance. Product scored `0.92` performance,
`0.95` accessibility, and zero layout shift. The exact local command log is
`/tmp/shoppp-f11-theme-impact-green.log`.

Final read-only review caught one evidence-integrity issue: the first unmasked script read the
Crafto HTML screenshots as its baseline, while R18 names the historical Vue donor. The script now
reads the U1-frozen Vue captures, verifies both SHA-256 values against the frozen profile, and
reports the old one-percent threshold as unmet without masking or moving the donor. The final
review found no other actionable code regressions in the empty Product case, unified Home fixture,
price, or Reviews styling. R18's numeric pixel gate is explicitly superseded for the current
user-approved Product by R21-R23 and release-owned content; its frozen profile remains available
for audit. FS-F11 U7.2-U7.3 closed and handed the content/media/review tail to FS-F12-U1 without
remote Catalog mutation, deployment, candidate freeze, DC, or PG change.

The deterministic live input uses release `fashion-store-live-2026-09-16-v2-shopper-release`,
Product `prod_01JFASHIONLIVE0000000002`, and snapshot `snapshot-fashion-store-live-1`.
Static production-shaped generation, static verification, and bundle budget passed with this
identity. Without Commerce, the published Product keeps its static facts and shows a retry state;
the 1440px and 390px captures have zero horizontal overflow. The same input with successful
Commerce revalidation shows the ready state at both widths. The canonical empty input keeps
review and assurance slots truthful. All following artifacts are under
`apps/storefront/test-results/fs-f11-u7/`:

- `20260917T-production-shaped/product-desktop.png`
  (`a94ec1be846edafb93d9937f850b0e9f4320f260e240318f155d858c314551c9`) and
  `product-mobile.png` (`9bb539e7d6709e4d0c4e83f6d1d3cd6fcb1a94b500bf6a10f54e1183dde3acac`).
- `20260917T-live-revalidated/product-desktop.png`
  (`1917cc2438e99d717df623f12d77980c6892199fc13d5b67d750beae1fe6ab81`) and
  `product-mobile.png` (`782ab4babca9f120e53d76f860335f76810e559b6afa8ab6e507938bc070df37`).
- `20260917T-live-empty/product-1440.png`
  (`b7d260fdd9adbc5c9a3a26ef337b255d6e359aa8df06734f45317753d4e41267`) and
  `product-390.png` (`6a7cfc37b21b0d7423fcd6fb4c5d37ca8ce5921d304b9e663cf8e54e8986b8e6`).
- `20260917T-live-empty/reviews-1440.png`
  (`49bd148869127a1ff1c8aac927f752ec0ded3a8b3c85052508ac6180014d8eaa`) and
  `reviews-390.png` (`8ae8371a8fb725c59f38b40c693ce4888528d43a9e127166c9e28d21cf9d961c`).
