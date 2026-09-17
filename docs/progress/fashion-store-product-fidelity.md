# Fashion Store Product Fidelity evidence

## FS-F10-U1 rejected baseline and target confirmation

### Frozen identities

- Source HTML: `apps/storefront/app/themes/fashion-store/upstream/demo-fashion-store-single-product.html`
  at SHA-256 `9f2a5cb42d81df1505c3a911c59544eefd8a0a60e6b27791d8469fd552179f43`.
- Mechanical donor: `FashionStoreProductPage.vue` at Git commit
  `f3be48b38cd265ae16a65394431901e1f4b1cd5b`, immediately before `159fec57`, at
  SHA-256 `9788cad519037756258d65691152b97f1b5aacfc6a07f1245302dc7c97dd2060`.
- Retained viewports: desktop `1440x1000`; mobile `390x844`.
- Fixture identity: release `representative-release-2026-07-30`, product
  `prod_01J00000000000000000000002`, route `/products/relaxed-corduroy-shirt`, selected variant
  `var_01JFSHIRTGREENXL000000001` (`Green / XL`).
- Existing live identity: release `fashion-store-live-2026-09-13-v1-shopper-release`, product
  `prod_01JFS8SHOP00000000000001`, route `/products/textured-sweater-01`, selected variant
  `var_01JFS8SHOP00000000000001` (`Blue / M`).

### Rejected captures

All captures are under `test-results/u4-product-human-review/20260915T152838Z-corrected/`.

| State           | Capture                                                                                       | SHA-256                                                            |
| --------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Source desktop  | `source-default-desktop-1440x1000.png`                                                        | `59ae29f487a7d9ec61387c995b6f37b517d79d2348255d639e409fa8c960ddd9` |
| Source mobile   | `source-default-mobile-390x844.png`                                                           | `1252fac1ddad97fac17899c7f1a09faf0c541480bb196cf5a496fda8b56bfbca` |
| Fixture desktop | `fixture-default-desktop-1440x1000.png`                                                       | `cb113dc527389078debdd21e1583f2ed6514b39746d563850d45ab7fa90b94f7` |
| Fixture mobile  | `fixture-default-mobile-390x844.png`                                                          | `fede90150a86e70256b7651732d16a61bd1d59620d7bb747453c32eac5244af1` |
| Live desktop    | `live-prod_01JFS8SHOP00000000000001-textured-sweater-01-default-blue-m-desktop-1440x1000.png` | `8016ce32aea058294d2ae1d3f6e1144b1a0505fde08fc79a477368b749b9b5e5` |
| Live mobile     | `live-prod_01JFS8SHOP00000000000001-textured-sweater-01-default-blue-m-mobile-390x844.png`    | `a77a2bc7b20439179e8bbe21122995ee1a405655d58cd04840429e3185d81b9d` |

The rejection is region-specific: fixture and live omit the frozen brand/rating density, assurance,
payment, taxonomy, and rich lower detail branches; their Color controls are text chips rather than
computed swatches from product option metadata.

### Red contract evidence

- Pre-change characterization:
  `bun test tests/fashion-store-product.test.ts tests/fixture-contract.test.ts tests/theme-source-contract.test.ts`
  passed `38` tests with zero failures.
- After strengthening the contract, the same command passes `37` tests and fails exactly two:
  the shared component is missing 16 frozen fixture content facts, and fixture normalization reports
  six rich regions as hidden/source-shaped-empty instead of populated.
- Matched browser proof:
  `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config playwright.fashion-store.config.ts e2e/fashion-store-product.spec.ts --grep "Product preserves source structure" --project=fashion-store-desktop --project=fashion-store-mobile`
  fails at both viewports because the rejected page exposes `0` authoritative swatch nodes where the
  fixture contract requires `3` (`Gold #d4af37`, `Blue #5881bf`, `Green #87a968`).
- No Catalog model, normalizer, Product template, or CSS production behavior was changed to obtain
  these failures.

### Proposed target requiring explicit human approval

| Region/capability                      | Fixture target                                                                   | Live target                                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity, gallery, price, SKU          | Populated from the rich fixture                                                  | Populated from release plus Commerce revalidation                                                                                                          |
| Brand and rating                       | `Zalando`, five-star/`165 Reviews` source composition                            | Brand hidden; source-shaped zero-review summary                                                                                                            |
| Color options                          | Exact reviewed fixture swatches: Gold `#d4af37`, Blue `#5881bf`, Green `#87a968` | Exact released Catalog swatches; proposed reviewed Fashion values use Blue `#5881bf` and Green `#87a968`; historical releases use a labeled neutral swatch |
| Wishlist and compare                   | Visible, active preview/simulated outcomes already declared by the fixture       | Visible disabled controls labeled unavailable                                                                                                              |
| Question and share                     | Active contact navigation and share outcome                                      | Active only with verified contact and browser share/clipboard outcomes                                                                                     |
| Delivery, assurance, payment, taxonomy | Populated from the retained fixture and frozen source-shaped composition         | Hidden until a published policy/taxonomy authority exists                                                                                                  |
| Rich description                       | Full eyebrow, heading, body, four bullets, and source image                      | Released description/media in the same source-shaped geometry                                                                                              |
| Specifications                         | Populated fixture table                                                          | Released SKU/weight when present; otherwise labeled source-shaped empty                                                                                    |
| Shipping/returns                       | Populated fixture standard/express/return content                                | Published policy when present; otherwise labeled source-shaped empty                                                                                       |
| Reviews                                | Three fixture reviews and source rating composition                              | Source-shaped zero-review state                                                                                                                            |
| Related products                       | Four fixture products                                                            | Released related products when present; otherwise labeled source-shaped empty                                                                              |

Approval of this table authorizes U2 to begin. It does not authorize remote staging mutation,
activation, deployment, candidate freeze, DC, or PG work.

### Human target approval

- Approved explicitly by the user on `2026-09-16`.
- Approved scope: the complete fixture/live region-state and capability matrix above, including the
  proposed reviewed Gold `#d4af37`, Blue `#5881bf`, and Green `#87a968` swatches.
- The approval closes the U1 pre-production gate and authorizes U2 local implementation only. It
  does not authorize any remote staging mutation, activation, deployment, candidate freeze, DC, or
  PG work.

## FS-F10-U2 option-definition persistence evidence

- Added additive D1 migration `0027_product_option_definitions.sql`: existing rows receive `[]`;
  invalid JSON and non-array JSON are rejected by the column constraint.
- Shared contracts accept ordered `text` and `color` definitions, require lowercase opaque
  `#rrggbb` swatches only for color values, reject duplicate definition/value labels, and retain
  schema-v2 releases that omit `optionDefinitions`.
- New and fully edited draft products persist explicit definitions. Migrated public products with
  `[]` derive deterministic text definitions from exact variant name/value insertion order without
  color inference.
- `PATCH /admin/catalog/products/:id/option-definitions` validates exact, case-sensitive coverage
  before its single product-row update. It never invokes the destructive full-Product PUT path.
- The focused API test snapshots full variant, price, and media rows before and after a swatch-only
  update and observes byte-for-byte equality. Published and archived writes return `409`.
- Verification on 2026-09-16: DB migrations `11/11`, release contracts `6/6`, Catalog API `14/14`,
  existing Admin Catalog form `5/5`, and repository typecheck all pass.

## FS-F10-U3 Admin option-presentation evidence

- Admin verification level: `L4`. FS-F10 is a release-closeout batch that changes the shared
  Catalog contract consumed by Admin, adds a write-concurrency boundary, and requires the plan's
  cross-layer U6 gate plus browser proof. The final Admin full test/build/E2E commands replace
  equivalent narrower reruns after code stabilizes.

- The existing scalar create field remains available only for the initial single option value; an
  existing product instead exposes ordered option groups derived from its exact variants. Option
  names and value labels are read-only.
- Color presentation uses Ant Design's alpha-disabled ColorPicker plus an editable canonical hex
  field. Manual and picker values normalize to lowercase `#rrggbb`; incomplete or malformed color
  groups are blocked locally.
- Color-to-text changes require confirmation before swatches are discarded. Published and archived
  products expose the definitions read-only.
- Saves call only `PATCH /admin/catalog/products/:id/option-definitions`; field-addressable API
  errors attach to the owning swatch input without adding a second page-global announcement path.
- Verification on 2026-09-16: Admin typecheck passes; focused Catalog form tests pass `7/7`; the
  focused Chromium Catalog spec passes `2/2` and proves an ordered multi-option swatch edit emits
  lowercase definitions through the presentation-only PATCH with zero full-Product writes.

## FS-F10-U4 release and runtime propagation evidence

- New Catalog builders emit validated explicit option definitions. Migrated `[]` rows and unchanged
  historical schema-v2 releases derive deterministic text presentation from exact variant insertion
  order; no label-to-color inference was introduced.
- Product composition carries immutable release definitions separately from mutable Commerce option
  groups. Runtime revalidation may refresh variants, prices, availability, and media, but the shared
  Product component keeps release-owned option labels and order.
- The versioned Fashion manifest is now `fashion-store-live-2026-09-16-v2`. The user-approved
  product-detail aggregate persists exact `gold #d4af37`, `blue #5881bf`, and `green #87a968`
  pairs; products without an approved hex remain text-presented.
- The same shared option-definition schema validates the manifest before migration planning, and the
  local D1 bootstrap persists the exact JSON on each Product row.
- A new local release was generated at
  `test-results/fs-f10-u4-release/fashion-store-live-2026-09-16-v2/shopper-release.json` with release
  ID `fashion-store-live-2026-09-16-v2-shopper-release`, 13 products, 24 variants, stable relaxed-shirt
  Product/Variant IDs, and SHA-256
  `14e79599e4c0df90edb08b986d8af0c5d2d49cc6670038e90e6c858c6953ef5a`.
- Verification on 2026-09-16: Fashion manifest tests pass `6/6`; API build/bootstrap tests pass
  `15/15`; focused Storefront release, runtime, composer, and live-Commerce tests pass `66/66`; full
  repository typecheck passes. No remote catalog, release, artifact activation, or deployment changed.

## FS-F10-U5 shared Product recovery evidence

- The provider-neutral Product presentation now retains fixture brand, review summary, assurance,
  payment, taxonomy, rich description, specifications, shipping, reviews, and related products. The
  same schema assigns live data explicit hidden, populated, or source-shaped-empty treatments.
- The shared component mechanically restores the frozen right-rail and detail geometry while keeping
  the current route reset, runtime revalidation, stale-result guard, gallery, lightbox, failure, cart,
  and focus behavior.
- Color-presented definitions render real `data-product-option-swatch` nodes with exact released
  backgrounds, visible/accessibly named labels, a contrast boundary, radio selection, and Commerce-
  derived disabled states. Text definitions remain labeled text controls.
- Live compare and wishlist remain visible but disabled and labeled unavailable; fixture preview
  actions remain active. Unsupported live assurance/taxonomy claims remain absent.
- Verification on 2026-09-16: Product/fixture/source contract tests pass `39/39`; Storefront
  typecheck passes; fixture Product composition passes desktop and mobile `2/2` with exact Gold,
  Blue, and Green RGB; the live Product matched desktop/mobile flow passes `1/1`, preserves the same
  three release swatches through Commerce revalidation, selects Green/XL, and completes the cart
  action. Build-generated tracked files were restored to their pre-run bytes.

## FS-F10-U6 aggregate verification and review evidence

- Independent review covered correctness, project standards, and adversarial failure modes. Eight
  confirmed findings were applied: explicit historical-neutral release fallback, release-ordered
  option groups, collision-safe radio IDs, full Product-version CAS coverage, associated Admin
  swatch errors, master-plan alignment, Admin L4 evidence, and one effective description-media
  identity. A subsequent aggregate pass also repaired the review-count tab mapping, star-summary
  semantics, and stale browser assertions exposed by the recovered fixture contract.
- Focused and aggregate results on 2026-09-16: Admin `498/498` in the complete passing run and
  focused Catalog form `7/7`; Storefront unit `319/319`; contracts `39/39`; database seed `1/1`
  plus worker `15/15`; domain `30/30`; root tools `429/429`; accessibility `8/8`; source
  equivalence `162/162`; typecheck, lint/boundaries, formatting, production/static build, static
  verification, and `git diff --check` all pass.
- `bun run check:theme-impact` completed successfully after selecting the full Fashion Store matrix:
  live Commerce `17/17`; cross-viewport fixture execution `292` passed with only declared
  viewport skips; combined Home `12/12`; isolated Home `12/12`; all behavior-verifier pages
  passed; mobile Lighthouse budgets passed for Home, Shop, Product, Cart, Checkout, and Magazine.
  Transient Lighthouse misses on Home and Product passed on the runner's bounded second attempt.
- The API worker aggregate remains `236/237` because the unchanged Home test expects
  `decor-icons` while the unchanged source-parity default emits `source`; exact focused
  reproduction confirms this is a pre-existing, non-Product baseline defect. One unrelated Admin
  theme-editor timeout also passed on exact focused reproduction. Neither defect changed FS-F10
  behavior or its focused/impact gates.
- The final Admin and Storefront typechecks, root lint/boundaries, format check, and diff check pass
  after the browser-test repairs. Build-generated tracked Storefront files were restored, and the
  unrelated Admin settings files retain their pre-run SHA-256 identities.
- U6 is complete. Authority is at U7 only; no remote catalog mutation, activation, deployment,
  candidate freeze, DC, or PG state changed.

## FS-F10-U7 matched evidence pending human approval

- Fresh full-page captures are retained under
  `test-results/fs-f10-u7-review/20260916T043928Z/`; `MANIFEST.md` pins all 13 SHA-256 identities,
  the frozen source HTML, fixture Product, local v2 release/Product, capture protocol, and review
  decision boundary.
- The set covers source, fixture, and live defaults at `1440x1000` and `390x844`; populated fixture
  Reviews; fixture Blue/M; live empty Reviews; Green/M unavailable; Green/XL selected; revalidation
  failure; and successful recovery/cart confirmation.
- Visual inspection confirms source/fixture right-rail and detail parity, exact labeled Gold/Blue/
  Green swatches, responsive ordering, truthful live omissions and unavailable actions, and usable
  failure/recovery states. Temporary capture-only specs/config were removed after evidence creation.
- Human approval remains the sole U7 blocker. The child plan and master pointer remain at
  `FS-F10-U7`; no handback or release-state advancement is claimed.

## FS-F10-U7 human rejection and FS-F11 handoff

- On 2026-09-16 the user explicitly rejected the FS-F10-U7 visual result. The prior statement that
  visual inspection confirmed source/fixture parity is therefore not completion evidence and cannot
  authorize handback.
- The rejected result still diverges across three Product paths: deterministic preview, live preview,
  and the independent production route. The current component does not reproduce the accepted donor
  page closely enough, and Commerce can replace release presentation with sparse runtime data.
- FS-F10 remains incomplete with U1-U6 implementation evidence retained. Its U7 approval tail is
  superseded by
  [FS-F11](../plans/2026-09-16-1337-refactor-fashion-store-live-product-plan.md), which owns the
  single release-backed Product path, donor restoration, fresh verification, and human approval.
- No remote Catalog mutation, release activation, deployment, candidate freeze, DC, or PG state
  changed as part of this rejection and handoff.
