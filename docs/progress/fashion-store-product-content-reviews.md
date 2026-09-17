# Fashion Store Product Content and Reviews Evidence

This file retains the FS-F12 catalog inventory and focused evidence. The FS-F12 plan owns unit
status and the product master owns the active pointer.

## 2026-09-17 — U1 local catalog inventory

### Scope and source identity

- `tools/fashion-store-live-catalog.json` is the 13-product/24-Variant/18-media staging seed that
  FS-F8 published as `fashion-store-live-2026-09-13-v1-shopper-release`. The 2026-09-15 read-only
  live check returned all 13 Product routes and all 18 public media URLs; this U1 pass did not
  repeat a fresh remote D1/R2 readback.
- `apps/storefront/fixtures/release.json` contains six local Product records: the lead Product,
  four of the 12 shop-card Products, and an unrelated Atlas carry-on. It is not a complete local
  copy of the 13-product staging release. FS-F12 verification must build a 13-product deterministic
  release through the canonical preparer rather than infer complete coverage from this fixture.
- Each of the 13 staging slugs has one distinct Product ID. The 12 shop-card Products each have one
  Variant/SKU and one media object; the lead Product has 12 Variants and six media objects. The
  local manifest test passed 6/6 and verifies the exact 13/24/18 counts, unique identities/R2
  keys, Product-owned media and Variant references, and local file SHA-256 bytes.

| Product slug             | Product ID                      | Variant SKU                 | Media | Specifications | Published review baseline                                                                 | Local release fixture |
| ------------------------ | ------------------------------- | --------------------------- | ----: | -------------: | ----------------------------------------------------------------------------------------- | --------------------- |
| `textured-sweater-01`    | `prod_01JFS8SHOP00000000000001` | `FS-TEXTURED-SWEATER-01`    |     1 |              0 | None                                                                                      | Yes                   |
| `traveller-shirt-02`     | `prod_01JFS8SHOP00000000000002` | `FS-TRAVELLER-SHIRT-02`     |     1 |              0 | None                                                                                      | Yes                   |
| `crewneck-sweatshirt-03` | `prod_01JFS8SHOP00000000000003` | `FS-CREWNECK-SWEATSHIRT-03` |     1 |              0 | None                                                                                      | Yes                   |
| `skinny-trousers-04`     | `prod_01JFS8SHOP00000000000004` | `FS-SKINNY-TROUSERS-04`     |     1 |              0 | None                                                                                      | Yes                   |
| `sleeve-sweater-05`      | `prod_01JFS8SHOP00000000000005` | `FS-SLEEVE-SWEATER-05`      |     1 |              0 | None                                                                                      | No                    |
| `pocket-sweatshirt-06`   | `prod_01JFS8SHOP00000000000006` | `FS-POCKET-SWEATSHIRT-06`   |     1 |              0 | None                                                                                      | No                    |
| `cotton-sweater-07`      | `prod_01JFS8SHOP00000000000007` | `FS-COTTON-SWEATER-07`      |     1 |              0 | None                                                                                      | No                    |
| `texture-regular-08`     | `prod_01JFS8SHOP00000000000008` | `FS-TEXTURE-REGULAR-08`     |     1 |              0 | None                                                                                      | No                    |
| `sequined-dress-09`      | `prod_01JFS8SHOP00000000000009` | `FS-SEQUINED-DRESS-09`      |     1 |              0 | None                                                                                      | No                    |
| `bermuda-shorts-10`      | `prod_01JFS8SHOP00000000000010` | `FS-BERMUDA-SHORTS-10`      |     1 |              0 | None                                                                                      | No                    |
| `traveller-shirt-11`     | `prod_01JFS8SHOP00000000000011` | `FS-TRAVELLER-SHIRT-11`     |     1 |              0 | None                                                                                      | No                    |
| `textured-sweater-12`    | `prod_01JFS8SHOP00000000000012` | `FS-TEXTURED-SWEATER-12`    |     1 |              0 | None                                                                                      | No                    |
| `relaxed-corduroy-shirt` | `prod_01JFASHIONLIVE0000000002` | 12 `M492300-*` SKUs         |     6 |              2 | Historical demonstration aggregate: 165 count, three lorem entries, no individual ratings | Yes                   |

All 12 short descriptions merely restate a name and color. They have no ordered detail fields,
brand, specifications, or individual review records. The lead Product has a richer presentation,
but its `Zalando` brand, organic-cotton material claim, and historical 165-review demonstration
snapshot lack independent product/customer provenance; these cannot become verified production
facts or customer reviews by migration. Every Product route currently shares one Vue component;
the slug and release Product identity, not a separate page file, select its own record.

### Lead-image visual audit

All 18 local photos were inspected directly. The 12 shop-card heads do not show the named and
colored item in their Product record:

| Product slug             | Visible head image                                   | Recorded identity mismatch |
| ------------------------ | ---------------------------------------------------- | -------------------------- |
| `textured-sweater-01`    | Pale blue short-sleeve T-shirt                       | Blue textured sweater      |
| `traveller-shirt-02`     | White button-front cardigan                          | Brown traveller shirt      |
| `crewneck-sweatshirt-03` | Green short-sleeve T-shirt                           | Green crewneck sweatshirt  |
| `skinny-trousers-04`     | Cream cardigan and cropped top; trousers not visible | Black skinny trousers      |
| `sleeve-sweater-05`      | Taupe ribbed sleeveless top                          | Orange sleeve sweater      |
| `pocket-sweatshirt-06`   | White graphic T-shirt                                | Maroon pocket sweatshirt   |
| `cotton-sweater-07`      | Pale gray tie-neck blouse                            | Green cotton sweater       |
| `texture-regular-08`     | Black T-shirt and crossbody bag                      | Blue textured top          |
| `sequined-dress-09`      | Navy blazer over a light top                         | Maroon sequined dress      |
| `bermuda-shorts-10`      | Pale blue long-sleeve shirt; shorts not visible      | Orange Bermuda shorts      |
| `traveller-shirt-11`     | Light gray sweatshirt                                | Black traveller shirt      |
| `textured-sweater-12`    | Gray button-front blouse                             | Brown textured sweater     |

The lead `relaxed-corduroy-shirt` Product is also internally inconsistent: gallery media 01-04
show one dark charcoal button-front shirt, while media 05-06 show a different pale yellow shirt.
Its released Gold/Blue/Green options do not correspond to the dark head image. Consequently a
new description or generated side view alone cannot make the current catalog truthful. U2/U3 must
first reconcile Product names, options, and head/gallery identity against a rights-cleared source.
The existing Product and Variant IDs can stay stable, but their current displayed claims should
not be treated as verified facts.

### Content and taxonomy checks

- The shop-card source `source.kind=shop-card` provides names, colors, size, price, and a head
  image. It does not establish fabric, care, dimensions, fit, manufacturing, or brand. Author only
  image-verifiable visual details until an authenticated Product fact source is supplied.
- Current seed taxonomy has apparent source-template category/tag carryover: the blue textured
  sweater is categorized as `Jeans`, the green crewneck sweatshirt as `Winter jackets`, the green
  cotton sweater as `Leggings`, the regular textured top as `Dupattas`, and the sequined dress as
  `Swimwear`. The `Cotton` and `Polyester` tags imply materials without a verified source. Correct
  these through the versioned published-Product revision path, not a silent direct edit to the
  immutable released Product row.
- The lead Product's `reviewDisplay` is explicitly marked `fashion-store historical Vue
demonstration snapshot`. Its aggregate count cannot be reconstructed from its three visible
  entries. It has no per-entry rating, stable entry ID, moderation history, or submission record.
  Production review count stays truthful until real approved rows are published in a new release.

### Media provenance and publication boundary

- All 18 seed media records point to local
  `apps/storefront/app/themes/fashion-store/upstream/images/demo-fashion-store-product*.jpg`
  bytes with per-Product R2 keys under `catalog/fashion-store/2026-09-13-v1/`. Their manifest
  SHA-256 values match the local files. No two Product records share a media ID or R2 key.
- At U1, the repository did not contain an image-rights grant for these Crafto demo photos. The
  [Crafto HTML5 listing](https://themeforest.net/item/crafto-the-multipurpose-html5-template/50404044)
  notes demo-image licensing limits. On 2026-09-17 the user explicitly confirmed that the existing
  head photos may be used for derivative generation for this work. This authorization unblocks
  local Product-specific generation; it does not establish rights to unrelated third-party images
  or authorize remote R2/Catalog publication.
- Use each cleared Product's exact head photo as the reference, inspect garment color, shape,
  hardware, lettering and crop, and accept only a reviewed Product-specific result. Keep the
  one-image gallery when a generated result differs; do not share a common placeholder.
- The canonical preparer currently asserts exactly 13 Products, 24 SKUs and 18 media objects at
  `tools/prepare-fashion-store-live-catalog.ts:139-153`. U3 must change the 18-media invariant only
  alongside an accepted media manifest, updated hash/provenance records, and positive/negative
  Product-owned media tests. The new exact 29-media successor profile meets that requirement;
  the historical 18-media profile and 13/24 identity constraints remain intact.

### Publication rules frozen for later units

1. Keep Product/Variant IDs, existing SKUs and historical release bytes stable. Stage published
   Product content/media revisions with a version check; build a new release only from an approved
   staged revision. A review-only release must leave Product content unchanged.
2. Keep editorial content and approved review rows in D1, image objects in R2, and public Product
   reads pinned to a validated immutable Catalog Release. Commerce continues to own only current
   released-Variant price, compare-at price and availability.
3. Record each accepted image's local source, usage permission, original/generated status, Product
   and Variant mapping, hash, role, order, dimensions, alt text, and R2 key. Reject cross-Product
   references and unverified claims. No remote Catalog/R2 mutation or release activation occurred
   during this inventory.
4. Keep sample review fixtures labeled as demonstrations; never turn the lead 165-count snapshot
   or new authored examples into purported customer submissions. Guest submissions start pending,
   only approved rows enter a future release, and existing live pages do not change on approval
   alone.
5. Treat external open sample catalogs as schema/content-coverage references only until each
   product match, image provenance, copy rights, and price authority is proven. No third-party
   product, image, review, or price data was imported in U1.

## 2026-09-17 — U8 published Product revisions and release boundary

- Migration `0029_published_product_revisions.sql` adds versioned Product content/media revisions,
  durable media ownership claims, and a release-to-revision link. Existing published Product and
  Variant rows keep their IDs and bytes; historical `catalog_releases.manifest_json` is not edited.
- `PUT /admin/catalog/products/:id/revisions/draft` stages a Product-owned, version-checked
  revision. It validates media identity, R2 presence, and presentation references. The preview
  endpoint composes a candidate release without changing the live Product. Catalog write/read
  permissions guard these paths.
- `POST /admin/catalog/products/:id/revisions/publish` selects an exact draft version or builds a
  review-only release from the already published content. `catalog.publish` and idempotency guard
  the operation. The build callback switches a selected revision and its release state in one D1
  batch; a failed trigger restores the draft. The public live Product read applies only a deployed
  published revision. The Admin Product form exposes staging, ordered media, data preview, and
  release actions with the matching permissions.
- Focused API tests prove stale writes and cross-Product media fail, a new Product-owned image is
  claimed while original `product_media` stays unchanged, preview shows revised content, and a
  deployed revision changes public content while the old release remains byte-identical. They
  also prove a review-only release retains Product facts and a failed build retains the prior
  published revision.
- Verification: API workers 39 files/243 tests passed; DB workers 2 files/16 tests passed; Admin
  Product form 9 tests passed; API and Admin typechecks and Admin lint passed. The complete API
  run also required registering the new tables in the staging reset inventory and updating two
  Experience assertions to the completed FS-F11 Home/media fixture.
- This is local code and test evidence. It did not change remote D1/R2, activate a release, or
  deploy a storefront. Source imagery rights remain unresolved for U2/U3.

## 2026-09-17 — U4 pending reviews and authorized moderation

- Migration `0030_product_reviews.sql` stores individual ratings and text as pending rows, with
  separate approved/rejected moderation state. `reviews.moderate` is granted only to Admin by
  default. Public submission validates rating, name, and body, checks same-origin requests and
  size/rate limits, and reuses the existing idempotency boundary. Admin list/detail/decision
  endpoints require the new permission and write audit evidence.
- The Admin review queue displays pending reviews and makes approval/rejection explicit. Approval
  alone does not expose a review in the current storefront release.
- Worker API suite: 40 files/247 tests passed after the U4/U5 implementation, including submit,
  moderation, permission, and release behavior. Admin moderation and Product editor focused tests
  and API/Admin typechecks passed after the translation-key correction. No remote review row was
  submitted or moderated.

## 2026-09-17 — U5 immutable approved-only review displays

- New Catalog Release builds compute per-Product counts, one-decimal average, five rating bands,
  and individually rated entries exclusively from approved review rows. Pending and rejected
  names/text do not enter the release. A review-only build can update that snapshot while keeping
  Product content and historical release JSON unchanged.
- The contract validates band/count/entry/average agreement for modern snapshots while continuing
  to read older snapshots without invented per-entry ratings or a fabricated distribution.
  Contract tests passed 7/7; storefront Product/theme tests passed 66/66.
- `fashion-store-demo-reviews.ts` prepares four visibly labeled demonstration reviews for each
  of the 13 sample Product slugs. `STOREFRONT_FASHION_DEMO_REVIEWS=1` opts the local preview into
  this data where a Product presentation exists; ordinary and production builds do not set it.
  A direct fixture check confirmed 13 distinct slugs with coherent four-entry distributions.
  Desktop browser verification passed for distribution, per-entry stars, Show more, and no
  portraits. These examples are never inserted into the customer review table.

## 2026-09-17 — U6 populated, empty, and historical Reviews UI

- The Fashion Store Product page now shows the approved review aggregate, five green rating bars,
  individual truthful star ratings, author/date/text without portraits, and a three-at-a-time
  Show more action. Historical snapshots without individual ratings state that their breakdown
  is unavailable and do not assign invented per-entry stars. Zero-review Products show the empty
  state and an available submission form.
- Add a review uses a native five-option star radio group, validates required fields, posts a
  pending submission with an idempotency key, disables repeat clicks during save, shows the
  moderation delay after success, and preserves input plus the key for a recoverable retry.
  The Crafto demo PHP action and demo portraits are not used.
- Direct local browser screenshots of the implementation and the supplied Crafto Reviews region
  at 1440px and 390px exposed a zero-height rating fill and mobile clipping. Both were corrected.
  A browser sweep at 320/390/768/992/1024/1100/1440px then confirmed visible distribution
  labels/counts/fills, intact star groups and form width, and no horizontal overflow. The final
  local capture also shows the star-based form input in the template's hierarchy.
- Browser evidence: source-structure/geometry tests passed 6/6 with two viewport-specific skips;
  historical submission and same-key retry passed 3/3 with five scope skips; populated demo
  distribution/expansion and seven-width layout passed; empty Product passed at desktop/mobile
  within its one browser case; live Commerce smoke passed 17/17. Storefront Product/theme tests
  passed 66/66, the 13-Product demo-data test passed, routing tests passed 5/5, and storefront,
  Admin, API, and E2E typechecks plus focused lint/import checks passed.
- A broader Fashion Store browser run was stopped after its live and empty profiles passed and
  the normal profile had no failures in its first 28 cases; the scoped Product/browser checks
  above are the U6 completion evidence. U2/U3 content and media remained open at that checkpoint;
  no remote Catalog/R2 write, release activation, or deployment occurred.

## 2026-09-17 — U2/U3 local image and content reconciliation, still open

- The user confirmed that existing head photos are authorized references for derivative generation.
  Each of the 12 shop-card heads was re-inspected. The versioned successor catalog now gives those
  Products image-verifiable names, descriptions, neck/sleeve/visible-detail specifications,
  corrected color options and categories, and removes unsupported material tags. Stable Product,
  Variant, SKU, price, and inventory identities are preserved. Legacy slug/SKU wording remains
  as an identity/history key even where the new visible name differs; this should be considered
  when planning any deliberate slug alias or SKU re-key, rather than silently changing them.
- Eleven head-referenced derivatives passed visual review and are stored as Product-specific JPEGs
  under `apps/storefront/public/media/fashion-store-generated/`. Each accepted file has its own
  media ID, Product-owned R2 key, dimensions, SHA-256, alt text, and original-head checksum in
  `tools/fashion-store-product-content-media-provenance.json`. Product 06's attempted derivative
  omitted its black front lettering and was rejected; its original one-image gallery remains.
  An initially blocked Product 04 model-crop request was replaced with a cardigan-only flat lay
  that preserves the garment's visible appearance. The lead Product uses its existing gallery and
  has no new derivative.
- The successor manifest `tools/fashion-store-product-content-catalog.json` is separate from the
  historical reset manifest. The validator preserves the exact historical 13/24/18 profile and
  accepts only the named 13/24/29 successor profile, with Product-owned keys for new media.
  Nine focused manifest tests passed, including wrong-Product media-key rejection and a
  canonical 13-route release build. No historical release bytes were rewritten.
- The versioned published-Product revision path can now carry option definitions and exact-ID
  Variant option labels alongside Product text/media. Staging checks the full Variant ID set and
  option matrix. Release construction and public Catalog reads apply those labels without changing
  source Variant rows or their prices. Focused API Catalog tests passed 22/22; API and Admin
  typechecks and the Admin Catalog editor tests passed.
- `STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG=1` opts local preview into the 13-Product successor
  release and live route family; `STOREFRONT_FASHION_DEMO_REVIEWS=1` adds clearly labeled local
  demonstration reviews. An initial static build exposed fixture bindings that were invalid for
  live routes; replacing them with Product/Collection Catalog bindings made the full 13-Product
  preview build pass. A browser sweep opened all 13 routes, checked each Product's own content,
  specification rows and gallery, decoded all 11 new images, traversed a Shop card to its matching
  Product, and checked seven widths for overflow and star-group geometry (3/3 cases pass).
- The lead `relaxed-corduroy-shirt` still has unverified associations between its dark head,
  pale-yellow gallery photos, and Gold/Blue/Green SKU option values. U2/U3 cannot be marked
  complete or published as truthful for this Product until the color-to-SKU association is
  provided or the user chooses a narrower verified presentation. No remote Catalog/R2 mutation,
  release activation, deployment, candidate, DC, or PG action occurred.

## 2026-09-17 — User-approved narrower lead presentation

- The user chose the narrower verified presentation instead of supplying a Gold/Blue/Green SKU
  mapping. The successor catalog version `fashion-store-product-content-2026-09-17-v2` now shows
  the lead as **Charcoal button-front shirt** with four matching original photos (01-04), visible
  collar/sleeve/button/pocket facts, and no unsupported brand, material, or historical 165-review
  claim. Pale-yellow media 05-06 remain in the historical seed and old releases but are absent
  from the successor's ordered gallery. The successor has exactly 13 Products, 24 preserved
  Variant/SKU identities, and 27 media objects (11 reviewed derivatives plus 16 retained
  originals). The earlier 29-media local v1 inventory above is superseded by this v2 selection.
- Because no existing Gold/Blue/Green SKU can honestly be assigned to the charcoal shirt, the
  released presentation marks its purchase status `unverified`. The Product page hides SKU,
  price, color and size selectors, and its add-to-cart action, and explains that purchasing is
  unavailable while choices are verified. Shop cards omit this non-sellable lead Product. Old
  Variant records and historical release bytes are untouched. Once a revision with this status
  becomes published, the live Product API rejects the unverifiable assortment; cart add/update
  sees zero sellable quantity and existing cart lines receive an availability adjustment.
- Local verification: the historical and successor manifest suite passed 9/9, cart worker tests
  passed 12/12 including direct Product API and old-SKU cart rejection, storefront typecheck and
  complete preview static build passed. Browser tests passed 4/4: all 13 routes retain their own
  content/media, seven acceptance widths keep the star group intact, Shop card navigation reaches
  its own Product, and the charcoal lead page contains only matching photos and no purchase
  controls. No remote Catalog/R2 write, deployment, candidate, DC, or PG action occurred.
- Follow-up regression found that a later verified revision must release the purchase hold even
  while the older unverified revision remains in history. Cart authority now reads the latest
  published revision, matching public Catalog lookup. The local worker test covers hold, existing
  cart adjustment, and reopening after a newer verified revision. Admin revision editing now has
  Chinese labels for the new content and purchase-status controls. The focused Admin editor suite
  passed 9/9; API Catalog/cart/media suites passed 36/36; contract/manifest suites passed 16/16;
  Admin, API, and storefront typechecks, focused lint, formatting, and `git diff --check` passed.

## 2026-09-17 — Demo charcoal sizes and description-image correction, U2 remains open

- The user requested a default purchasable specification and authorized generated demonstration
  SKUs. Local successor v3 now has four charcoal sample Variants (S/M/L/XL), defaulting to M,
  using the historical sample price and a documented demo quantity of 20 each. The successor has
  13 Products, 16 active Variants, and 27 media. The original 13/24/18 seed and historical
  Gold/Blue/Green SKU/release records remain unchanged. No remote D1 migration or release was run;
  real checkout remains gated on creating these four D1 Variants and disabling the old 12.
- The blank Description image came from `descriptionDetail.media` being undefined when a Product
  had no dedicated `detailMediaId`. Composer now reuses that Product's last gallery image as
  the Description illustration, leaving the gallery intact. The unit assertion failed before
  the fix and passed afterward. The rebuilt 13-route local preview and browser image-decode sweep
  verified that every Description panel has a loaded Product-owned image.
- A browser Commerce mock verified the default M SKU, a switch to L, and that Add to cart sends
  the L Variant ID. This proves storefront selection wiring; it does not claim that the remote
  staging Catalog already contains the generated SKUs. U2 next verifies the matching local D1
  migration/round trip before any remote publication is considered.
- The user-facing verification sentence was removed from the Product page. A fresh static preview
  build contains the default demo M SKU and Product-owned Description image without that sentence.
  The focused composer/manifest suite passed 55/55, the Product-content browser suite passed
  16/16 across desktop, laptop, tablet, and mobile, and storefront typecheck and focused lint
  passed. The browser purchase case uses a matching mocked Commerce response because the remote
  D1 assortment has not been changed.

## 2026-09-17 — Four-color demonstration assortment, U2 remains open

- The user explicitly requested multiple fabricated color values with corresponding product images.
  Local successor v4 now presents Charcoal, Gold, Blue, and Green with visible swatches and
  S/M/L/XL options. It retains the original Gold/Blue/Green SKU identities, adds four demo
  Charcoal SKUs, and defaults to Charcoal/M. The local successor is 13 Products, 28 active
  Variants, and 30 media objects. The original seed and historical releases remain unchanged.
- Three AI-edited front images were generated from the user-authorized charcoal head photo,
  inspected for shirt shape, collar, pocket, buttons, and color, and saved as Product-owned JPEGs.
  The release presentation maps each color to its own media IDs. Gallery and Description images
  follow the selected color; old pale-yellow images remain excluded from this Product.
- Contract and revision validation reject gallery references outside the Product's media. The
  focused catalog/contract/composer suite passed 57/57, storefront and API typechecks passed,
  and the static preview built. The browser suite passed 16/16 at desktop, laptop, tablet, and
  mobile widths, including color-image switching and a Blue/L Add to cart Variant ID under
  matching mocked Commerce data. Remote D1/R2 have not been mutated; real checkout for the
  newly added Charcoal SKUs still requires the Catalog migration and publication gate.

## 2026-09-17 — Product action and shared-footer copy correction

- Reproduced the Product button state in the local static preview: the Product live API request
  returned HTTP 503 with `api_unavailable` because `serve-static.ts` intentionally has no
  integration API. The Product page translated any revalidation error into the long visible
  label “Retry and add to cart,” which wrapped at narrow widths. The button now keeps “Add to
  cart” on one line while the separate status message reports the failed verification; a click
  still retries verification and does not falsely claim a successful cart add.
- Removed the unsupported Compare control from live Product presentation. Removed the global
  Fashion Store footer's Crafto/ThemeZaa credit and the template's unsupported reCAPTCHA claim.
  Removed unconfigured shell filler defaults: “Stay in touch.”, “How can we help?”, the generic
  published-catalog announcement, and the unverified free-delivery manifest default. Removed
  the Shop/Collection “Discover the latest edit.” preset and manifest fallback. Explicit
  operator-authored shell copy remains supported. Other legacy source-parity preset messages
  remain on About, FAQ, Contact, Magazine, Cart, and Checkout; they require a content decision
  rather than replacement with another invented claim.
- The static-preview regression failed on the original long button label before the fix and
  passed at four configured viewport profiles after the fix. The complete Product-content browser
  suite passed 20/20 before the Shop copy adjustment; the final four-profile copy regression
  passed afterward. The live-Commerce retry test passed with a mocked API recovery. Focused
  shell/Product/theme unit tests and storefront typecheck passed after the change; local preview
  generation and Wrangler dry run passed.
