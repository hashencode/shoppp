# Storefront Control Plane Verification

This record retains the FS-F14 U1.1 reconciliation evidence. The active plan and product master
remain the only authorities for execution status, current unit, blocker, next action, and handback.
This inventory does not freeze a Catalog Release, approve an Experience Snapshot, advance a
candidate, or change runtime behavior.

## Reconciliation scope and method

- Scope: all 19 rows in the Fashion PC Surface Control Matrix in
  `docs/plans/2026-09-22-0043-feat-storefront-control-plane-plan.md`.
- Current generated mode: `apps/storefront/app/generated/active-experience.ts` exports
  `activeExperienceProviderInput.mode = "fixture-preview"`. The classification below follows the
  currently generated Fashion preview. Where one matrix row visibly combines sources, every
  observed category is listed; every category token is one of `api`, `store-setting`,
  `theme-setting`, `catalog`, `fixture`, `fallback`, or `constant`.
- Important route exception: `StorefrontExperience.vue` selects the live composer for Product when
  `productUsesRelease` is true, even while the generated mode is `fixture-preview`. Product facts,
  reviews, and policy-backed Product regions therefore come from the generated Catalog Release;
  most other audited Fashion routes still resolve fixture ViewModels.
- Historical provenance: the local Codex audit at
  `/Users/studio/.codex/visualizations/2026/09/21/01a0c3a5-e335-7ac2-a4bf-776202bd9919/shoppp-control-audit/README.md`
  observed the same fixture-preview boundary. Its screenshots support surface coverage only; the
  source classifications and anchors below were rechecked against current code.
- Interpretation rule: rendered structure is not authority evidence. Each anchor identifies the
  value-producing array, composer, fixture, release field, or fallback branch rather than only the
  Vue node that displays it.

## Fashion PC Surface Control Matrix reconciliation

| # | Fashion PC surface | Observed source category | Exact current source anchor | Final authority | Ownership change reason / disposition |
| ---: | --- | --- | --- | --- | --- |
| 1 | Browser title, store name, tagline, favicon, social-share image, global SEO defaults | `catalog` + `constant` | `apps/storefront/app/StorefrontExperience.vue` — `routeSeo` reads `liveRelease.site.name` and Product/Collection SEO but supplies fixed route titles and the fixed description `Browse the published Fashion Store Experience.`; `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreShell.vue` — `useHead` always resolves `images/favicon.png`; the current Release bytes are in `apps/storefront/app/generated/active-experience.ts` — `activeExperienceProviderInput.release.site`. | Store Identity — Store Settings / Identity, frozen into Catalog Release site metadata. | Current site name/route SEO is partly Release-backed, but tagline, global defaults, social-share media, and favicon do not share one editable owner. Store Identity must own the complete identity bundle; deployment origin and default currency remain environment/Commerce-owned per R7. |
| 2 | Header/Footer Logo media and shared variants | `fallback` | `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreHeader.vue` — `configuredLogo`, `fallbackLogo`, and `configuredLogo() ?? fallbackLogo()`; `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreFooter.vue` — the same `configuredLogo`/`fallbackLogo` branch. The current fixture shell in `apps/storefront/app/themes/fashion-store/fixtures/home.ts` — `fashionStoreHomeFixtures.shellViewModels.home` supplies only announcement copy, so the fallback assets render. The legacy live composer still reads Theme settings in `apps/storefront/app/theme-engine/composer.ts` — `shellViewModel` (`header-logo`, `footer-logo`). | **Store Identity owns the approved Logo asset set and stable primary/light/dark/compact asset IDs. Theme owns presentation only:** named-variant selection, sizing, placement, spacing, visibility, and responsive behavior. | KD4/R7 require Logo assets to survive theme switching. Remove Theme-owned uploads/asset truth and the live fallback for new schemas; keep Theme presentation controls without allowing an unapproved asset. |
| 3 | Header navigation and Mega Menu labels, order, targets | `constant` | `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreHeader.vue` — the `<ul class="navbar-nav alt-font navbar-left">` tree beginning with literal `Home`, `Shop`, `Collection`, `Magazine`, `Pages`, and `Contact`, including literal Mega Menu groups/items and fixed `fashionStoreRoutePaths`. | **Navigation — Storefront / Navigation**, a reusable authority independent of Theme versions; Catalog Release freezes the menu and Experience stores only a navigation reference plus placement/variant. | The current Vue tree is a fixed presentation implementation, not reusable menu data. KTD5/R12 require stable menu/item IDs, explicit order, bounded depth, typed targets, and survival across theme switching. |
| 4 | Footer navigation columns, labels, order, targets | `constant` | `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreFooter.vue` — literal `footer-navbar` plus the `Categories`, `Information`, and `Quick links` lists and fixed route targets. | **Navigation — Storefront / Navigation**, independent of Theme versions, with Footer menu identity frozen into the Catalog Release. | The Footer currently duplicates a fixed navigation tree. Move labels/order/targets to the same reusable Navigation domain as Header menus; Theme retains Footer layout/presentation only. |
| 5 | Header/Footer contact and social facts | `constant` | Current fixture-preview: `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreHeader.vue` renders fixed `Find stores`/Instagram fallback content when `publicContact` is absent; `FashionStoreFooter.vue` renders fixed phone, email, and social destinations under `!liveMode`. Live branch anchor: both components' `publicContact` computed values, populated by `apps/storefront/app/theme-engine/composer.ts` — `shellViewModel` from `ExperienceSnapshot.contact`. | Contact — Store Settings / Contact, using the exact FS-F13 Contact version frozen into the Experience input. | Current preview constants and the legacy Theme `contactCopy`/`socialLink` branches can disagree with Contact. Preserve FS-F13 as the sole fact authority and remove Theme/contact fallbacks from new schemas. |
| 6 | Home Hero slides | `constant` | `apps/storefront/app/themes/fashion-store/contracts/home-hero.ts` — `fashionStoreDecorHeroSlides`; `apps/storefront/app/themes/fashion-store/components/sections/FashionStoreHeroSection.vue` — `FashionStoreDecorHero` is mounted without consuming its Section ViewModel; `FashionStoreDecorHero.vue` iterates the fixed array. | Theme Blocks — Storefront / Themes, frozen in the approved Experience Snapshot and referencing approved media. | The required Hero Section structurally exists but ignores configured data. Replace the fixed three-slide array with manifest-allowed stable Block instances and whole-draft validation (R14-R15). |
| 7 | Home promotion, marquee, and visual campaign strips | `fixture` | `apps/storefront/app/themes/fashion-store/fixtures/home.ts` — `fashionStoreHomeData.marquee` and the fixture Home payload; `apps/storefront/app/themes/fashion-store/components/sections/home-section-context.ts` — `fixtureFoundation` supplies fixed promotion copy and fixture marquee values. The live branch falls back to constants in `liveFoundation`. | Theme Blocks — Storefront / Themes. | Marketing copy, media, order, and visibility are presentation-owned repeatable content, but current fixture/live adapters embed arrays and copy in code. Move them to bounded Theme Blocks with renderer, editor, empty-state, and test ownership together. |
| 8 | Home service assurances | `fixture` | `apps/storefront/app/themes/fashion-store/fixtures/home.ts` — `fashionStoreHomeData.services`; `apps/storefront/app/themes/fashion-store/components/sections/home-section-context.ts` — `fixtureFoundation` maps those values. The live branch instead maps `fashionStoreHomeServices` from `components/sections/home-content.ts`, which is still code-owned. | Shipping, published Policies, and Commerce facts; Theme controls presentation only. | Claims such as free shipping, returns, secure payment, and support are business facts. R9/R16 require derivation from released authorities and provider capability, with Theme limited to visibility/style and no contradictory free text. |
| 9 | Home category and Collection cards | `fixture` | `apps/storefront/app/themes/fashion-store/fixtures/home.ts` — `fashionStoreHomeData.categories` and `.collection`; `apps/storefront/app/themes/fashion-store/components/sections/home-section-context.ts` — `resolveFashionStoreHomeEditorial` maps them to fixed Collection destinations in fixture mode. The live branch uses one Catalog `featuredCollection` but still supplies category labels and imagery from `home-content.ts`. | Collections — Catalog / Collections for identity, copy, cover media, status, and ordered membership; Theme chooses stable Collection references and placement. | Current preview cards are sample data and the live projection still mixes a real Collection with code labels/images. U4/U7 must close the reference chain and preserve truthful empty behavior. |
| 10 | Home brand presentation | `fixture` | `apps/storefront/app/themes/fashion-store/fixtures/home.ts` — `fashionStoreHomeData.brands`; `apps/storefront/app/themes/fashion-store/components/sections/home-section-context.ts` — `fixtureFoundation.brands`. The live branch uses the constant `fashionStoreHomeBrands` in `components/sections/home-content.ts`. | Theme Blocks — Storefront / Themes. | The strip is presentation content rather than store identity or Catalog taxonomy. Replace fixture/code arrays with a bounded brand Block and approved media references. |
| 11 | Home editorial cards and Article destinations | `fixture` | `apps/storefront/app/themes/fashion-store/fixtures/home.ts` — `fashionStoreHomeData.magazine`; `apps/storefront/app/themes/fashion-store/components/sections/home-section-context.ts` — `resolveFashionStoreHomeEditorial` assigns every fixture entry the fixed `fashionStoreRoutePaths.article` destination. The live branch uses the constant `fashionStoreHomeMagazine` array and the same fixed Article route. | Articles — Content for records/destinations; Theme chooses stable Article references and placement. | The cards are fixture/code content and all point to one hardcoded sample destination. R11/R13/R15 require typed published Article references, stable identity, route validation, and optional absence instead of samples. |
| 12 | Product list/detail facts, media, related items | `fixture` + `catalog` | Listing/Collection preview: `apps/storefront/app/themes/fashion-store/contracts/catalog-presentation.ts` — `normalizeFashionStoreCatalogPresentation` uses `fixtureData`/`fixtureGrid` unless it receives a `collection-grid`; fixtures originate in `fixtures/pages/shop.ts`. Product detail exception: `apps/storefront/app/StorefrontExperience.vue` — `productUsesRelease`; `apps/storefront/app/theme-engine/composer.ts` — `productViewModel`/`productCardViewModel` read Release Product, Collection, media, variants, and related products. | Products and Collections — Catalog, frozen into a Catalog Release. | FS-F12 already owns Product facts; FS-F14 extends Collection presentation and ordered membership authority. Fixture listings must not remain a new-schema live path. |
| 13 | Product review content and aggregates | `catalog` | `apps/storefront/app/theme-engine/composer.ts` — `productViewModel` maps `presentation.reviewDisplay` into `reviewSummary` and `reviews`; `apps/api/src/publishing/build-manifest.ts` — `buildCatalogReleaseManifest` selects approved `product_reviews` and writes `reviewDisplay`; `packages/contracts/src/catalog.ts` — `productReviewDisplaySchema`. | Reviews — Catalog, published into the Catalog Release. | FS-F12 already established the Review authority and release projection. FS-F14 changes no owner; U9 must retain compatibility and ensure no fixture review body reappears. |
| 14 | About, FAQ, Magazine, Article, and other merchant pages | `fixture` | `apps/storefront/app/themes/fashion-store/fixtures/pages/content.ts` — `fashionStoreContentData` and `fashionStoreContentFixtures`, composed from `fashionStoreAboutData`, `fashionStoreFaqData`, `fashionStoreMagazineData`, and `fashionStoreArticleData`; `contracts/content-presentation.ts` — `resolveFashionStoreContentPresentation` reads `theme-section` fixture content. | Pages and Articles — Content, frozen with the Catalog Release route manifest; route-specific Fashion renderers remain presentation owners. | Existing route/components prove layout only; merchant copy is fixture-owned. R11/R20 require bounded typed records and safe structured sections without turning Theme fixtures into content authority. |
| 15 | Returns, privacy, terms, shipping-policy bodies and effective dates | `catalog` | `apps/storefront/app/pages/policies/[slug].vue` — `policyCatalogRelease` and `policyCatalogRelease.policies.find(...)`; in fixture-preview it reads `apps/storefront/app/generated/catalog.ts`, while live reads `activeExperienceProviderInput.release`. | Policies — Store Settings / Policies, with approved published Policy versions frozen into the Catalog Release. | The renderer already consumes Catalog policy bytes, but the current generated policies are build fixtures/code-produced inputs rather than independently versioned Policy authoring records. New-schema Release construction must fail when required approved policy is absent and must not synthesize legal defaults. |
| 16 | Contact page merchant facts | `fixture` | `apps/storefront/app/themes/fashion-store/fixtures/pages/contact.ts` — `fashionStoreContactData`; `fixtures/pages/content.ts` includes it in `fashionStoreContentData`; `contracts/content-presentation.ts` — `resolveFashionStoreLiveContactPresentation` selects `publicContact` only when a live state ViewModel carries it. | Contact — Store Settings / Contact, exact FS-F13 Contact version. | The audited Contact page still displays demo locations in fixture-preview. Live rendering must use the frozen FS-F13 Contact input; Theme keeps only bounded presentation fields and truthful unavailable behavior. |
| 17 | Payment marks and claims | `theme-setting` + `constant` | Product: `apps/storefront/app/generated/active-theme.ts` — Product Section settings `payment-brand-*`; `apps/storefront/app/theme-engine/composer.ts` — `productViewModel` filters `publicPaymentBrands` only by those booleans. Footer: `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreFooter.vue` renders four fixed payment images. | Commerce provider capability; Theme controls visibility/style only. | Theme toggles and fixed Footer marks can claim unsupported methods. R9/R16/AE6 require intersection with released provider capability and removal/ignore-with-diagnostic of unsupported legacy toggles. |
| 18 | Shipping and returns summaries | `theme-setting` + `catalog` | Top Product assurance: `apps/storefront/app/generated/active-theme.ts` — `delivery-summary` and `shipping-returns-summary`; `apps/storefront/app/theme-engine/composer.ts` — `productViewModel` copies those Theme strings. Shipping tab: the same composer derives `shipping.standard` and `shipping.returnBody` from Release policies with slugs `shipping` and `returns`. | Shipping and published Policies; Theme controls visibility/style only. | One Product surface currently has two truth paths. Canonical released facts must own both; legacy Theme copy is migrated only when provably equivalent, otherwise flagged for operator resolution. |
| 19 | Required account, cart, checkout, and accessibility utility destinations | `constant` | `apps/storefront/app/themes/fashion-store/page-contracts.ts` — `fashionStorePageContracts`/`fashionStoreThemeRoutes`; `apps/storefront/app/themes/fashion-store/capability-matrix.ts` — `fashionStoreLiveCapabilities`; Header/Footer controls use fixed `fashionStoreRoutePaths`, and `FashionStoreShell.vue` owns the skip link, no-JS return link, search state, and scroll-to-top behavior. | System-owned versioned route/capability authority. | These are platform capabilities, not merchant content. Navigation may reference available typed internal targets, but cannot invent unavailable routes; U6 verifies availability, focus, keyboard, and semantic behavior. |

## Ownership resolutions required before U1.2

- **Logo:** resolved. Store Identity owns the media assets and stable shared variant IDs. Theme may
  select a named approved variant and own presentation, but it cannot upload or persist a competing
  Logo asset. The current Theme `header-logo`/`footer-logo` and static fallback paths are migration
  inputs, not the final asset authority.
- **Navigation:** resolved. Header and Footer menus belong to the independent Navigation authority,
  not Store Settings and not Theme. The Catalog Release freezes menu records; the Experience
  Snapshot stores only a stable menu reference plus placement/variant presentation.
- No matrix row remains unclassified. Rows with multiple categories are intentional current-source
  splits inside one visible region, not unresolved ownership. Their final authorities above are
  singular for each fact type and identify which duplicate/fallback path later units must remove.

## U1.1 verification evidence

- `behavior_changed`: no. One progress document was added; runtime, contracts, data, migrations,
  tests, plan checkpoint, and master pointer were not changed.
- `existing_tests_inspected`: `apps/storefront/tests/theme-engine.test.ts`,
  `apps/storefront/tests/fashion-store-home-source.test.ts`,
  `apps/storefront/tests/fashion-store-product.test.ts`, and the browser-owner inventory retained in
  `docs/progress/fashion-store-shared-shell.md`. These tests establish existing source/route owners;
  none was changed for this documentation-only stage.
- `tests_added_or_changed`: none.
- `tests_used_unchanged`: none executed; U1.1 changes no executable behavior.
- `characterization_observed`: current generated mode is fixture-preview; Product alone is composed
  from the generated Release through `productUsesRelease`; Header/Footer navigation remains literal;
  Logo falls back to packaged assets in the current fixture shell; Home marketing/content regions
  remain fixture or code arrays; Policy rendering reads Catalog data.
- `no-test exception reason`: this stage is a read-only source/authority inventory. Its completion
  signal is exact matrix coverage, allowed-category validation, stable source anchors, and the
  absence of unresolved ownership—not an application behavior assertion.

## U1.2 persistence and Collection cutover evidence

- Added typed Store Identity, shared Logo asset, Policy, bounded Page/Article, Navigation, and
  Collection authority contracts. Store Identity uses the fixed singleton ID `identity.primary`.
- Added migration `0032_storefront_control_authorities.sql` after the existing Product review
  consent migration. It expands authority tables, backfills ordered Collection versions and
  memberships, and makes the historical `collection_products` table read-only with a stable
  maintenance diagnostic.
- Added a SELECT-only storefront-control preflight with deterministic conflict codes, membership
  digest, duplicate-position checks, invalid-position checks, and orphan anti-joins. No remote
  production export was available or queried; the preflight was exercised against a
  production-shaped D1 fixture before migration.
- Product reads, publication, manifest composition, and Fashion staging use the new Collection
  authority. Product membership changes fail closed with
  `collection_membership_maintenance_required`; independently safe Product edits preserve the
  existing versioned membership bytes.
- Proof-first failures were observed for the missing authority module/tables, missing Store
  Identity singleton enforcement, and an incorrectly accepted Product membership change.
- Authoritative verification on 2026-09-22: Contracts `50/50`, DB workers `20/20`, API workers
  `261/261`; Contracts, DB, and API scoped TypeScript checks passed; `git diff --check` passed.
- The root typecheck remains outside this unit's completion signal because of existing Storefront
  type errors in `apps/storefront/app/theme-engine/composer.ts` and
  `apps/storefront/app/themes/fashion-store/contracts/home-merchandising.ts`; all modified-workspace
  typechecks pass.

## U1.3 permissions and evidence

- Added first-class `identity.read/write`, `policies.read/write/approve/publish`,
  `content.read/write/publish`, and `navigation.read/write/publish` keys to the canonical contract
  registry. Migration `0033_storefront_control_permissions_evidence.sql` explicitly grants the new
  keys only to the protected `role_admin`; an upgrade fixture proves a pre-existing custom role
  retains exactly its prior `catalog.read` grant. Existing request-time role resolution and
  `assertPermissionSubset` remain the grant/removal enforcement path, and the focused IAM test
  proves a caller with `content.read` cannot grant `content.publish`.
- Added concrete Navigation-to-Policy/Page/Article/Collection reference relations and domain-owned
  query helpers with one `resource_referenced` diagnostic shape. Per-domain insert/archive guards
  make both race orders fail closed: an existing reference blocks archive, and an archived target
  blocks a later reference. Reference relation rows are immutable, so target ID/version or
  environment changes require an atomic delete-plus-insert and cannot bypass the active-target
  guard. No generic reference-index service or table was introduced.
- Expanded existing `catalog_releases` persistence with purpose, environment, manifest/source
  digest, and paired attestation fields. The upgrade fixture preserves the historical
  `manifest_json` string byte-for-byte, maps old rows to compatible public/development lifecycle
  defaults, leaves absent historical digest/attestation evidence null, and applies purpose,
  environment, digest, JSON, and attestation-pair constraints to new writes. Existing public
  Product release writers now persist the runtime environment and a SHA-256 manifest digest; no
  candidate builder, candidate route, activation, or public-elevation behavior was added.
- Added `apps/api/src/security/audit-reason.ts` and routed the shared audit prepare/record boundary
  through it, so all current audit mutation paths normalize horizontal whitespace, reject newline,
  control, and bidirectional characters with `invalid_audit_reason`, and redact credential-, token-,
  password-, secret-, and API-key-like values in reasons and nested metadata. Audit reads apply the
  same metadata redaction before returning diagnostics.
- Proof-first failures observed before implementation: the contract registry omitted all 12
  storefront authority keys; DB tests returned no matching permission definitions and no
  `navigation_policy_references` table; the API security test could not import the missing audit
  boundary. After the first implementation pass, the redaction test also exposed an unredacted
  `apiKey` metadata value, and the first backlink implementation allowed an existing relation to be
  updated to an archived target; both centralized boundaries were strengthened before the focused
  suites passed.
- Authoritative verification on 2026-09-23: Contracts `51/51`, DB workers `22/22`, and API workers
  `268/268`; Contracts, DB, and API scoped TypeScript checks passed. `git diff --check` passed.
- The broader root typecheck reaches the unchanged Storefront boundary and still reports only the
  two pre-existing `exactOptionalPropertyTypes` failures in
  `apps/storefront/app/theme-engine/composer.ts` and
  `apps/storefront/app/themes/fashion-store/contracts/home-merchandising.ts`; no U1.3-owned
  workspace typecheck fails.
- System-wide check: the new permissions are deliberately registered before their U3/U5/U6 Admin
  routes exist; the API route-permission inventory explicitly excludes only those reserved keys and
  continues proving every currently registered route denies and audits a missing permission. The
  Fashion staging reset inventory now treats the four concrete reference tables as disposable in
  dependency-safe order, and its full API regression suite passes. No remote mutation, Preview
  candidate, deployment, or candidate/DC/PG state was created or advanced.
