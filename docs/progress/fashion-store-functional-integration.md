# Fashion Store Functional Integration Evidence

This file retains focused evidence for
`docs/plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md`. It is not a second
unit queue, checkpoint, or candidate-readiness ledger; the active plan owns current status and next
action.

## U1.1 shared-contract reconciliation — 2026-08-13

The reconciliation inspected commit `8a3723d4` on
`codex/feat-fashion-store-functional-integration`. The tracked tree was clean before the audit.
The original shared-contract implementation is retained in `864c4d76` and did not modify a
deployment workflow.

### Contract and evidence map

| U1 contract                                                                                                                                        | Implementation                                                                                                                                                                                                                                                                 | Observable evidence                                                                                                                                                                                                                                                                                                           | Reconciliation result                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID-less legacy Catalog Releases remain readable but cannot supply stable live references                                                           | `packages/contracts/src/catalog.ts` separates canonical and legacy schemas, returns explicit compatibility from `parseCatalogRelease`, and rejects stable-reference resolution for legacy releases                                                                             | `packages/contracts/test/catalog-release.test.ts` covers legacy parsing, stable-selection exclusion, and failed stable resolution                                                                                                                                                                                             | Covered and passing                                                                                                                                                                |
| Canonical product and collection IDs survive parsing, deterministic digest input, resource resolution, and composition                             | `packages/contracts/src/catalog.ts` owns canonical parsing, digest input, and stable resolution; `apps/storefront/app/theme-engine/composer.ts` maps canonical resources into presentation models                                                                              | Catalog contract tests preserve IDs through parse/digest/resolve; `apps/storefront/tests/theme-engine.test.ts` preserves selected-release IDs in product and collection composition                                                                                                                                           | Covered and passing                                                                                                                                                                |
| Commerce product and collection IDs survive rename, archive, restore, and publication; deletion and recreation do not reuse IDs                    | `apps/api/src/catalog/products.ts`, `apps/api/src/publishing/build-manifest.ts`, and `apps/api/src/publishing/releases.ts` retain Commerce IDs in canonical releases                                                                                                           | `apps/api/test/catalog/catalog.test.ts` exercises the identity lifecycle and published manifest                                                                                                                                                                                                                               | Covered and passing; archive, restore, and destructive setup use the real test database directly, while creation, update, recreation, and publication use application entry points |
| Duplicate IDs and slugs, malformed money, inconsistent membership, wrong references, and unknown fields fail closed                                | Strict canonical Catalog schemas and reciprocal membership validation live in `packages/contracts/src/catalog.ts`; stable reference kinds are discriminated                                                                                                                    | Catalog contract tests cover duplicate identity, slug collision, malformed money, unpaired membership, and unknown fields; Storefront Experience and Composer tests cover invalid and wrong-kind references                                                                                                                   | Covered and passing                                                                                                                                                                |
| Presentation models keep structured money and availability; Commerce intents carry stable identifiers without authoritative price or inventory     | `packages/contracts/src/storefront-experience.ts` owns strict presentation and intent schemas                                                                                                                                                                                  | `packages/contracts/test/storefront-experience.test.ts` accepts structured money/availability and rejects price or inventory assertions in intent payloads                                                                                                                                                                    | Covered and passing                                                                                                                                                                |
| Fixture bindings and catalog bindings remain distinct; fixture-era snapshots remain readable history                                               | `packages/contracts/src/storefront-experience.ts` uses discriminated fixture and catalog bindings and immutable snapshot contracts                                                                                                                                             | Storefront Experience contract tests cover separate bindings and snapshot round trips; provider tests prove live mode has no fixture fallback                                                                                                                                                                                 | Covered for the U1 contract layer. Migration and re-approval task evidence remains owned by U7                                                                                     |
| Fashion live components consume presentation contracts and ports rather than fixture-owned business fields, Commerce DTOs, or Commerce composables | Live-only components use Presentation ViewModels and injected ports, but the current source checks cover only selected files. `FashionStoreProductCard.vue`, which is used by `FashionStoreLiveCatalog.vue`, directly imports the fixture-owned `FashionStoreShopProduct` type | `apps/storefront/tests/fixture-contract.test.ts` scans only `view-models.ts` and `actions.ts` for its DTO assertion; `apps/storefront/tests/fashion-store-live-commerce.test.ts` scans two named live surfaces for fixtures/composables/network access but does not reject Commerce DTO imports or traverse live dependencies | **Confirmed gap.** Existing green tests do not prove the declared live-component import boundary                                                                                   |

The shared mixed fixture/live product-card normalization remains a later U10 behavior outcome. U1.2
is limited to removing the fixture-owned type from the live dependency path and making the declared
import boundary executable without broad product-card behavior migration.

### Focused verification observed

| Command                                                                                                                                                                                                    | Result                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `bun test packages/contracts/test/catalog-release.test.ts packages/contracts/test/storefront-experience.test.ts`                                                                                           | 14 passed, 0 failed                                                                                                                    |
| `bun test apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts apps/storefront/tests/theme-actions.test.ts` | 39 passed, 0 failed                                                                                                                    |
| `bun run --cwd apps/api test:workers -- test/catalog/catalog.test.ts`                                                                                                                                      | 10 passed, 0 failed                                                                                                                    |
| `bun run --cwd apps/api test:workers -- test/publishing/build-manifest.test.ts`                                                                                                                            | 1 passed, 0 failed                                                                                                                     |
| `bun run typecheck`                                                                                                                                                                                        | Root tools plus Admin, API, Storefront, Contracts, DB, and Domain typechecks passed                                                    |
| `bun run check:boundaries`                                                                                                                                                                                 | Passed, while inspection confirmed that this generic command currently enforces only browser-to-database and domain-to-framework rules |

Passing commands establish the retained baseline but do not erase the source-inspection gap above.
U1.1 therefore completed reconciliation with a confirmed gap; it did not establish parent U1
completion.

## U1.2 live-component boundary closure — 2026-08-13

Boundary enforcement now begins at the three live Fashion Store component roots and follows every
static relative import within the component graph. It rejects direct imports from fixtures,
`@shoppp/contracts`, and the Commerce composables while leaving theme-engine presentation and
intent ports as the allowed boundary.

Controlled negative sensitivity first produced the expected failure against the initial live-only
root graph:

- `FashionStoreMiniCart.vue` directly imported the Commerce `Cart` DTO.
- `FashionStoreProductCard.vue` directly imported the fixture-owned
  `FashionStoreShopProduct` type.

Review then confirmed that the live registry also mounts the mixed Cart and Checkout pages. Adding
registry-completeness enforcement exposed four more direct imports: a Commerce contract and a
fixture-owned type source in each page. The implementation moved Cart and shipping types behind
theme-engine ports and moved source-parity preview shapes into explicit theme compatibility
contracts. `FashionStoreLegacyProductCard` preserves the existing product-card compatibility branch
and names U10 as the owner of its later normalized ViewModel replacement; it does not claim the U10
behavior outcome.

Synthetic fixture, Commerce-contract, imported Commerce-composable, Nuxt auto-imported Commerce
composable, and dynamic-import violations prove the boundary test fails for every prohibited
dependency class. The registry key assertion prevents a newly registered Fashion Store live
surface from silently escaping the root inventory, while registry-component and wrapper-to-live-leaf
assertions prevent an existing key from silently switching to an unaudited component path. The
corrected component-local graph and all direct imports pass with no diagnostics.

## U1.3 focused verification and closure — 2026-08-13

| Command                                                                                                                                                                                                                                                                                                          | Result                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `bun test packages/contracts/test/catalog-release.test.ts packages/contracts/test/storefront-experience.test.ts apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts apps/storefront/tests/theme-actions.test.ts` | 54 passed, 0 failed                                                                 |
| `bun run --cwd apps/api test:workers -- test/catalog/catalog.test.ts`                                                                                                                                                                                                                                            | 10 passed, 0 failed                                                                 |
| `bun run --cwd apps/api test:workers -- test/publishing/build-manifest.test.ts`                                                                                                                                                                                                                                  | 1 passed, 0 failed                                                                  |
| `bun run lint`                                                                                                                                                                                                                                                                                                   | Passed, including generic import-boundary checks                                    |
| `bun run typecheck`                                                                                                                                                                                                                                                                                              | Root tools plus Admin, API, Storefront, Contracts, DB, and Domain typechecks passed |
| `git diff --check`                                                                                                                                                                                                                                                                                               | Passed                                                                              |

Together with the U1.1 contract map, this closes the only confirmed gap without changing a
deployment workflow. Parent U1 is complete; the active implementation pointer advances to U2.1 in
the owning child plan and product master plan.

## U2.1 Composer and provider reconciliation — 2026-08-13

The reconciliation used native inline execution because U2 is one dependent audit unit in the
shared checkout and no live, caller, project, or checkout configuration selected another engine.
The institutional-learning search found one unrelated source-parity workflow note and no critical
patterns file, so no prior provider-specific remedy was available.

### Contract and evidence map

| U2 contract                                                                               | Implementation and retained evidence                                                                                                                                                                                                                            | Reconciliation result                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One Experience resolves selected-release content                                          | `composer.ts` receives an explicit canonical release; `theme-engine.test.ts` composes the same snapshot against two releases and covers product and collection projection                                                                                       | Covered                                                                                                                                                   |
| Product and collection reference-state matrix                                             | Composer diagnostics preserve page, section, setting, reference kind, and ID; current tests cover valid product/collection, missing product, one wrong-kind direction, draft product, and an empty binding                                                      | **Partial:** deleted/absent collection, archived collection, disabled-only product, and the reciprocal wrong-kind case are not explicit retained evidence |
| Deterministic fixture QA with no Commerce request                                         | The fixture provider resolves only fixture bindings; provider and boundary tests prove deterministic output and reject Commerce/network dependencies                                                                                                            | Covered                                                                                                                                                   |
| Live composition fails truthfully with no fixture fallback                                | `providers/live.ts` throws structured composition diagnostics and imports no fixtures; however `StorefrontExperience.vue` selects the fixture provider when mode is live but the generated snapshot or route contract is absent                                 | **Confirmed behavior-boundary gap:** the branch is normally non-rendering but still violates the no-fallback invariant                                    |
| Production preparation remains unchanged without private input                            | `prepare-experience.ts` defaults to production, emits the unchanged fallback modules, requires explicit preview mode plus input for private preview, and retains the existing release preparation inputs; generation tests cover the production output          | Covered                                                                                                                                                   |
| Preview build, artifact, grant, session, and authorization bind one immutable input tuple | Build-input validation binds Catalog Release, Experience snapshot/version, theme/version, and platform contract; API and worker tests carry the tuple through the manifest, release-scoped artifact prefix, grant, one-time session, and authorization response | Covered                                                                                                                                                   |
| Clients cannot substitute Catalog identity                                                | API tests reject a substituted artifact prefix and grant body, reject grant replay, and return the server-bound identity when a caller supplies a different catalog header                                                                                      | Covered                                                                                                                                                   |

U2.1 therefore advances to U2.2 for two narrow changes only: remove the latent provider fallback and
complete the missing reference-state matrix. No Composer redesign, Commerce contract change, or
deployment workflow change is authorized by this reconciliation.

## U2.2 provider and diagnostic gap closure — 2026-08-13

The reference-state test now explicitly covers valid product and collection composition, missing
product, deleted/absent collection, both wrong-kind directions, draft product, archived collection,
a product with only disabled variants, and an empty binding. Every invalid reference preserves the
exact route path, page, section, setting, reference kind, and stable ID in its diagnostic.

The live-mode boundary assertion was added before the implementation change and failed because
`StorefrontExperience.vue` selected `fixturePresentationProvider` whenever live mode lacked a
snapshot or resolved route. The provider selection now returns no provider for that invalid live
input, so the existing truthful unavailable/404 path remains in control and fixture QA is selected
only outside live mode.

| Command                                                                                                                               | Result                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun test apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts` before the implementation change | Expected proof-first result: 32 passed, 1 failed at the new live no-fallback assertion; the expanded diagnostic matrix already passed as characterization |
| `bun test apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts` after the implementation change  | 33 passed, 0 failed                                                                                                                                       |
| `bun run --cwd apps/storefront typecheck`                                                                                             | Passed                                                                                                                                                    |

No Commerce, Catalog, deployment, fixture-output, or production-default behavior changed. The
active pointer advances to U2.3 for the complete focused verification contract.

The first U2.3 run passed 52 of 53 focused Storefront tests, all 15 API preview-identity tests, the
generic boundary check, and Storefront typecheck. It reopened U2.2 because
`generation.test.ts` still searched for `themeRoutePaths(fashionStoreThemeRoutes` while the current
Nuxt configuration correctly calls `themeRoutePaths(selectedPreviewThemeRoutes` to preserve the
selected-template boundary. This is retained as a stale-test correction, not a generation behavior
change.

After the assertion was aligned with `selectedPreviewThemeRoutes`, the six-test generation suite
passed and the active pointer returned to U2.3 for a full clean rerun.

## U2.3 focused verification and closure — 2026-08-13

| Command                                                                                                                                                                                                                                                                                                                                   | Result              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `bun test apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts apps/storefront/tests/generation.test.ts apps/storefront/tests/theme-actions.test.ts apps/storefront/tests/seo.test.ts apps/storefront/tests/fashion-store-routing.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts` | 53 passed, 0 failed |
| `bun run --cwd apps/api test:workers -- test/storefront-experience/experience-api.test.ts`                                                                                                                                                                                                                                                | 15 passed, 0 failed |
| `bun run check:boundaries`                                                                                                                                                                                                                                                                                                                | Passed              |
| `bun run --cwd apps/storefront typecheck`                                                                                                                                                                                                                                                                                                 | Passed              |

Together with the U2.1 mapping and U2.2 proof-first closure, these results establish separate
deterministic fixture and truthful live providers, actionable reference diagnostics, immutable
preview inputs, unchanged production defaults, and an authorization chain that retains the exact
Catalog Release, Experience, theme, and platform identity. Parent U2 is complete; the active
implementation pointer advances to U9.1 in the owning child plan and product master plan.

## U1/U2 closure review reopening — 2026-08-13

The required post-implementation review invalidated the preceding completion verdicts despite the
green focused commands:

- The live-component graph starts at hand-selected leaves rather than every actual registry root;
  the registered Collection wrapper still statically loads fixture-owned code.
- `StorefrontCart` and the shipping port names are aliases of upstream Commerce DTOs, so the theme
  package remains structurally coupled through an indirect import.
- Fixture Cart and Checkout receive the live Commerce adapters; mounting those deterministic QA
  routes calls `ensureGuestCart` and runtime configuration before falling back to fixture output.
- The application-level no-fallback and selected-theme prerender assertions inspect source text
  rather than executing the provider-selection and route-selection contracts.

The active pointer therefore returns to U1.2. U1 must reclose before U2.2 can remove fixture
Commerce adapters and replace the two source mirrors; U9.1 remains queued until both parents pass
fresh U1.3/U2.3 verification.

## U1.2 closure-review correction — 2026-08-13

The live registry now registers dedicated live Home and Collection roots, while the legacy
fixture-capable route wrappers live only in `fixture-registry.ts`. The boundary test derives every
root from the registry's actual sync and async component imports and recursively follows both
static and dynamic relative imports; a temporary dynamic child containing a prohibited Commerce
contract proves sensitivity.

Theme-engine cart and checkout contracts are now structural presentation ports rather than aliases
or imports of upstream Commerce DTOs. Fixture generation selects the fixture registry explicitly,
while the live generated registry remains fixture-free. The correction's initial Storefront
verification passed 47 tests across the fixture contract, theme engine, live-Commerce boundary,
generation, and action suites, and Storefront typecheck passed. The pointer advances to U1.3 for
the complete parent verification contract; these initial results are not the closure verdict.

## U1.3 closure-review reverification — 2026-08-13

| Command                                                                                                                                                                                                                                                                                                          | Result                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `bun test packages/contracts/test/catalog-release.test.ts packages/contracts/test/storefront-experience.test.ts apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts apps/storefront/tests/theme-actions.test.ts` | 55 passed, 0 failed                                                                 |
| `bun run --cwd apps/api test:workers -- test/catalog/catalog.test.ts`                                                                                                                                                                                                                                            | 10 passed, 0 failed                                                                 |
| `bun run --cwd apps/api test:workers -- test/publishing/build-manifest.test.ts`                                                                                                                                                                                                                                  | 1 passed, 0 failed                                                                  |
| `bun run check:boundaries`                                                                                                                                                                                                                                                                                       | Passed                                                                              |
| `bun run typecheck`                                                                                                                                                                                                                                                                                              | Root tools plus Admin, API, Storefront, Contracts, DB, and Domain typechecks passed |
| `git diff --check`                                                                                                                                                                                                                                                                                               | Passed                                                                              |

The fresh gates cover the corrected registry and structural-port implementation rather than the
superseded hand-maintained root inventory. Parent U1 is complete again, and the pointer advances to
reopened U2.2.

## U2.2 closure-review correction — 2026-08-13

`selectPresentationProvider` now returns the fixture provider only outside live mode and returns no
provider for incomplete live input. `selectLivePort` exposes action and checkout adapters only in
live mode, so fixture Cart and Checkout mount their deterministic data without invoking `ensure`,
runtime configuration, or any other Commerce operation. The renderer provides only adapters it
actually receives, and Checkout treats the no-adapter fixture state as ready fixture behavior.

Prerender route selection moved into a pure resolver whose tests execute the exact Fashion Store
fixture, Decor Store fixture, selected-release live, and production route sets. The provider test
likewise executes fixture, incomplete-live, complete-live, and mode-gated port selection rather
than matching application source text. The correction passed 47 focused Storefront tests and
Storefront typecheck. The pointer advances to U2.3 for a fresh complete verification run.

## Adversarial reverification reopening — 2026-08-13

The fresh U2.3 command passed 54 Storefront tests, 15 API preview-identity tests, the boundary check,
and Storefront typecheck. Correctness and testing re-review confirmed all original findings fixed.
The final adversarial pass nevertheless found two additional U1 boundary escapes: the live graph
ignored Vue dependencies imported through the Nuxt `~/` alias, and `StorefrontActionAdapter` still
used Commerce Cart and request DTOs directly.

U1 therefore reopens at U1.2. The active change must traverse approved alias Vue dependencies,
remove the Commerce DTOs from the action port, and rerun U1.3 before the already-green U2.3 result
can be reconfirmed as a parent completion verdict.

## U1.3 alias/action-port reverification — 2026-08-13

The graph resolves approved `~/` imports and follows Vue component dependencies throughout the app
root while retaining the actual Fashion Store registry as its authority. A temporary aliased child
that imports a Commerce contract produces the expected diagnostic. The shared checkout address
component now consumes the structural shipping-address port, and `StorefrontActionAdapter` owns
structural add/update/shipping requests and a structural cart result without importing Commerce
contracts.

| Command                                                                                                                                                                                                                                                                                                          | Result                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `bun test packages/contracts/test/catalog-release.test.ts packages/contracts/test/storefront-experience.test.ts apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts apps/storefront/tests/theme-actions.test.ts` | 56 passed, 0 failed                                                                 |
| `bun run --cwd apps/api test:workers -- test/catalog/catalog.test.ts`                                                                                                                                                                                                                                            | 10 passed, 0 failed                                                                 |
| `bun run --cwd apps/api test:workers -- test/publishing/build-manifest.test.ts`                                                                                                                                                                                                                                  | 1 passed, 0 failed                                                                  |
| `bun run lint`                                                                                                                                                                                                                                                                                                   | Passed, including import boundaries                                                 |
| `bun run typecheck`                                                                                                                                                                                                                                                                                              | Root tools plus Admin, API, Storefront, Contracts, DB, and Domain typechecks passed |
| `git diff --check`                                                                                                                                                                                                                                                                                               | Passed                                                                              |

Parent U1 is complete again. The pointer advances to U2.3 for final reconfirmation against this
corrected dependency baseline.

## U2.3 final reconfirmation and closure — 2026-08-13

| Command                                                                                                                                                                                                                                                                                                                                   | Result              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `bun test apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts apps/storefront/tests/generation.test.ts apps/storefront/tests/theme-actions.test.ts apps/storefront/tests/seo.test.ts apps/storefront/tests/fashion-store-routing.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts` | 56 passed, 0 failed |
| `bun run --cwd apps/api test:workers -- test/storefront-experience/experience-api.test.ts`                                                                                                                                                                                                                                                | 15 passed, 0 failed |
| `bun run check:boundaries`                                                                                                                                                                                                                                                                                                                | Passed              |
| `bun run --cwd apps/storefront typecheck`                                                                                                                                                                                                                                                                                                 | Passed              |

Correctness and testing re-review confirmed all original findings fixed. The final adversarial
re-review also confirmed the alias-component and action-port findings resolved, reported no new
actionable findings, and independently observed an empty real Checkout graph diagnostic set.

Parent U2 is complete again. The active pointer advances to U9.1 for interaction-ledger
reconciliation; no U9 outcome is inferred from the U1/U2 evidence.

## U9.1 interaction-ledger reconciliation — 2026-08-13

The existing implementation provides useful but non-substitutable foundations. All 15 route IDs
have a source-parity behavior contract, comprising 47 behavior rows. All 47 declare a fallback; 40
name keyboard and 32 name touch as triggers; five declare an explicit breakpoint branch. These
rows govern source/implementation parity and retained capture evidence. They do not own a typed
semantic destination or Commerce payload, and no test proves that every currently rendered
interaction candidate maps to exactly one such semantic row.

The raw Vue-template inventory covers 24 files with 409 native interaction candidates and 119
`click`/`submit` bindings. It is an intentionally conservative source inventory rather than a
deduplicated semantic-row count. Its route-owned concentrations are Home (125 candidates, 46
bindings), Product (30, 17), Checkout (29, 4), Cart (19, 8), Article (17, 6), Account (13, 4),
Contact (9, 1), Shop's three variants through one component (7, 7), Wishlist (6, 2), Magazine
(4, 3), and the remaining live/content pages. The shared layer adds Header (62 candidates), Footer
(39), MiniCart (12), ProductCard (7), Search (5), EditorialCard (4), Lightbox (3), Accordion (1),
and Shell (8); these imports must be accounted for on every route that renders them rather than
copied into independent route rows.

The reconciliation found these U9 gaps:

- `apps/storefront/app/themes/fashion-store/interaction-contract.ts` does not exist. The existing
  `previewActionSchema`, route contract, and source-parity behavior rows do not express the required
  one-owner semantic dispositions, stable reference/payload, observable outcome, input modes,
  fallback, and named acceptance evidence as one validated ledger.
- There is no rendered-candidate-to-ledger bijection check. Current behavior-contract tests validate
  row shape, identity, and evidence mechanics only, so selector or handler presence can still be
  mistaken for functional coverage.
- The raw inventory contains 20 bare `#` targets, six `http://` external targets, 123 literal `/`
  targets, and five named fragments. Named fragments require an allowed local-fragment kind; the
  bare fragments and HTTP links are invalid, while each `/` occurrence must be distinguished as
  either the exact Home route or an unresolved product/category placeholder instead of being
  accepted by string shape alone.
- The shared link contract supports exact local routes and credential-free HTTPS external links,
  but does not yet represent the U9 platform-locked `mailto:`/`tel:` contact cases. Invalid,
  missing, unpublished, deleted, wrong-kind, and empty references are not yet tied to an
  interaction disposition that prevents generic fallback navigation.
- `apps/storefront/app/theme-engine/search.ts` and a build-local Catalog Release search index do not
  exist. `FashionStoreSearchOverlay.vue` only opens, restores focus, and rejects an empty string; it
  has no results, loading, empty, unavailable, keyboard-result, or no-JavaScript outcome.
- No Fashion Store component declares a `noscript` or JavaScript-required mutation explanation.
  Existing static/no-JavaScript tests prove readable shells or individual product content, not the
  complete U9 interaction fallback matrix.

Current characterization remains green but is not U9 completion evidence:

| Command                                                                                                                                                                                                                                                                                                               | Result              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `bun test packages/contracts/test/storefront-experience.test.ts apps/storefront/tests/theme-actions.test.ts apps/storefront/tests/fashion-store-routing.test.ts apps/storefront/tests/theme-interaction.test.ts apps/storefront/tests/theme-behavior-contract.test.ts apps/storefront/tests/fixture-contract.test.ts` | 47 passed, 0 failed |
| `bun run check:boundaries`                                                                                                                                                                                                                                                                                            | Passed              |
| `bun run --cwd apps/storefront typecheck`                                                                                                                                                                                                                                                                             | Passed              |

U9.1 is complete as reconciliation only. The owning child and product master checkpoints advance
to U9.2 to implement the separate semantic ledger, exhaustive candidate coverage, exact
destination/contact rules, build-local search states, breakpoint/input outcomes, and explicit
no-JavaScript fallbacks before U9.3 can issue the parent completion verdict.

## 2026-08-13 — U9.2 semantic interaction gap closure

U9.2 is complete and the owning checkpoints advance to U9.3 verification. The implementation now
keeps the source-parity behavior contract separate from a runtime-validated 132-row semantic
interaction ledger. Resource kind and route family are discriminated, internal routes and named
fragments are distinct, external destinations require credential-free HTTPS, and contact targets
are validated `mailto:` or `tel:` URIs. The rendered audit enumerates links, buttons, forms, and
keyboard-operable role buttons across all 15 Fashion Store routes and resolves each candidate to
exactly one page behavior, shared semantic row, or exact-route fallback.

The Catalog search index is generated from the immutable release during build preparation and is
provided without a runtime catalog query. Browser evidence covers overlay focus, result rendering,
stale-result clearing, empty state, keyboard selection, and canonical navigation. A JavaScript-off
browser verifies the native catalog recovery and truthful transaction limitation. Fixture Cart,
Shipping, Wishlist, Product, and Checkout controls now record preview-only intent or local state,
announce the result, and make zero Commerce requests; unavailable links render without an active
target, and fixture mini-cart mutation controls are disabled.

| Evidence                                                                                                                                                                        | Result                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `bun test apps/storefront/tests packages/contracts/test`                                                                                                                        | 231 passed, 0 failed                                                                   |
| `bun run typecheck`                                                                                                                                                             | All workspaces passed                                                                  |
| `bun run check:boundaries`                                                                                                                                                      | Passed                                                                                 |
| Focused ESLint over changed U9.2 contract, theme, generator, test, and E2E files                                                                                                | Passed                                                                                 |
| `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config playwright.fashion-store.config.ts e2e/fashion-store-interaction-ledger.spec.ts --project=fashion-store-desktop` | 2 passed; all 15 routes plus no-JavaScript recovery                                    |
| Focused fixture Commerce-isolation browser regression                                                                                                                           | 7 passed; Cart, Shipping, Wishlist, Product, and Checkout issue zero Commerce requests |
| `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config playwright.fashion-store-live.config.ts --grep "build-local search"`                                             | 1 passed; focus, results, stale clearing, empty state, keyboard navigation             |
| `git diff --check`                                                                                                                                                              | Passed                                                                                 |

Known upstream CSS sourcemap and existing Nuxt shell/hydration warnings remain visible in the live
development-server log; the U9.2 browser assertions passed and this stage makes no claim that those
independent warnings are resolved. U9.3 owns the final parent-unit verification and completion
verdict; this progress record does not create a second execution queue.

## 2026-08-13 — U9.3 verification and parent closure

The parent verification first exposed that the broad fixture Playwright pattern also selected the
live-only Commerce spec. Those tests correctly failed because the fixture build has neither the
immutable live Catalog index nor live Cart controls. The fixture configuration now excludes that
spec explicitly, while its dedicated live configuration retains the generated live input and API
interception used for local integration evidence. The corrected inventory contains 324 fixture
acceptance cases and no live-only spec; the separate live matrix passes search, shipping, and
shared-cart synchronization.

The first corrected full run then exposed one serious Axe violation: four source-shaped payment
placeholder anchors had no `href` but retained `aria-label`, which is prohibited on an anchor with
no valid role. Moving each accessible name to its image `alt` preserves the source structure and
the unavailable-interaction ledger while removing the invalid ARIA usage. The focused Home Axe
test then passed before the complete matrix was rerun.

Final code review found that the retained `test:fashion-store` command did not yet invoke the
dedicated live configuration, and that fixture Cart initialization announced a false `Cart is
unavailable.` error before applying its local data. The package gate now runs the named live matrix
before the fixture build, so all three live checks are retained while the final generated state is
restored to fixture preview. Fixture Cart initializes without a live error and the four-breakpoint
Cart structure test asserts that the false alert is absent.

| Evidence                                                                                  | Result                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused U9 contract, route, behavior, search, interaction-ledger, and live-boundary tests | 55 passed, 0 failed; 1,135 assertions                                                                                                        |
| `bun run check:boundaries`                                                                | Passed                                                                                                                                       |
| `bun run typecheck`                                                                       | Root tools plus Admin, API, Storefront, Contracts, DB, and Domain passed                                                                     |
| Corrected fixture Playwright inventory                                                    | 324 tests in 13 files; live-only Commerce spec absent                                                                                        |
| Dedicated live-Commerce Playwright matrix                                                 | 3 passed: build-local search, optionless shipping, and mounted MiniCart/Cart synchronization; retained as `test:fashion-store-live`          |
| Focused Home Axe regression                                                               | 1 passed; no critical or serious violation                                                                                                   |
| `bun run --cwd apps/storefront test:fashion-store`                                        | 33 static/contract tests, the 3-test live matrix, Playwright 132 passed/192 intentionally skipped, and all 15 page behavior reports verified |
| `bun run lint`                                                                            | ESLint, import boundaries, and workspace lint passed                                                                                         |
| `git diff --check`                                                                        | Passed                                                                                                                                       |

Parent U9 is complete. Its separately typed semantic ledger remains distinct from source-parity
behavior evidence, and mocks remain local integration evidence rather than deployed Commerce
acceptance. Known upstream resource and tool warnings do not invalidate the passing assertions and
are not claimed as resolved here.

## 2026-08-14 — U10.1 live Home and product-card reconciliation

The reconciliation inspected the current working tree on
`codex/feat-fashion-store-functional-integration` atop commit `8a3723d4`. The tree contains the
retained U1, U2, and U9 work and is not a candidate identity. No product implementation changed
during this stage. The institutional-learning search found one high-severity Fashion Store source
reconstruction record: structural, behavioral, and absence parity must remain separate, and
presence-only assertions cannot certify an observable outcome. The repository has no
`docs/solutions/patterns/critical-patterns.md` file.

### Reconciliation matrix

| U10 outcome                                              | Current implementation and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Reconciliation result                                                                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete approved live Home composition                  | The approved fixture Home retains ten ordered source sections plus Header, Footer, cookie, sticky, and scroll-progress regions. `fashion-store-home-source.test.ts` pins their order and counts. Live composition instead emits one `collection-grid`; `FashionStoreHomeRoute.vue` and `FashionStoreLiveHomePage.vue` route that model to `FashionStoreLiveCatalog.vue`, whose body contains only a catalog heading and product grid. The live-boundary test explicitly characterizes this shortcut. | **Confirmed gap.** Live Home has no typed full-Home ViewModel or section sequence and remains the generic catalog substitute prohibited by R44 and KTD28.                                   |
| One normalized `PresentationProductCard` contract        | `view-models.ts` exposes a five-field collection product summary. `FashionStoreProductCard.vue` accepts a union of that summary and `FashionStoreLegacyProductCard`; the compatibility type explicitly names U10 as its normalization owner.                                                                                                                                                                                                                                                         | **Confirmed gap.** There is no normalized card schema carrying canonical identity, stable variant identity, purchase routing, or runtime action state, and no explicit Home visual variant. |
| Canonical product identity and destination               | Live collection summaries carry a stable product ID and canonical `/products/:slug` href. The shared card uses the same href for image, title, details, and Choose-options exits.                                                                                                                                                                                                                                                                                                                    | **Covered as a static baseline.** Stable product identity and canonical navigation exist, but variant identity and runtime mutation identity do not yet reach the card.                     |
| Static purchase routing                                  | `FashionStoreLiveCatalog.vue` sets `commerce-disabled` on every live card. The card derives Add-to-cart versus Choose-options from that caller boolean, while the Composer retains only the first active variant and does not classify one selectable variant versus multiple or unresolved variants.                                                                                                                                                                                                | **Confirmed gap.** Single-variant direct add is impossible, multi/unresolved routing is not contract-derived, and an addable live card is rendered Commerce-disabled.                       |
| Hydrated action states and stable mutation payload       | The card has no `available`, `pending`, `unavailable`, or `retry` state and emits only the string `cart` without product or variant IDs. Existing runtime-Commerce tests validate a separate stable-ID projection, but no card consumes it.                                                                                                                                                                                                                                                          | **Confirmed gap.** Runtime refresh, pending, unavailable/out-of-stock, failed/retry, and succeeded outcomes are not represented or announced on the representative card.                    |
| Pointer, keyboard, touch, focus, and breakpoint outcomes | Native links and buttons provide a useful pointer/keyboard baseline and repository CSS supplies `:focus-visible`. However, `FashionStoreProductCard.vue` deliberately disables the product link on the first touch and suppresses its click solely to reveal hover actions. No focused test exercises the shared Home card across repository breakpoint boundaries or asserts its loading/error/action-state accessibility.                                                                          | **Confirmed gap.** First touch violates R50, and the representative shared card lacks retained keyboard, touch, focus, status-announcement, and adjacent-breakpoint outcome evidence.       |
| Fixture/source parity remains independent                | The fixture Home still uses its deterministic source data and the focused source test proves the approved composition. U9 evidence proves fixture interactions send no Commerce mutations.                                                                                                                                                                                                                                                                                                           | **Covered dependency baseline.** U10.2 must preserve this lane while adding live composition; fixture success cannot satisfy the live card outcome.                                         |

### Characterization observed

| Command                                                                                                                                                                                                                                                               | Result                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `bun test apps/storefront/tests/fashion-store-home-source.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fixture-contract.test.ts apps/storefront/tests/runtime-commerce.test.ts` | 54 passed, 0 failed; 294 assertions |

The green characterization proves the inherited fixture, Composer, boundary, and runtime helper
baselines. It does not close the confirmed live Home or card gaps. U10.1 is complete as
reconciliation only. The owning child and product master checkpoints advance to U10.2 to add the
complete live Home ViewModel and section composition, normalize the representative Home card,
derive static purchase routing from selectable variants, consume hydrated stable-ID action state,
remove first-touch suppression, and add focused accessible responsive outcome evidence. U10.3
will own final focused verification and the parent U10 completion verdict.

## 2026-08-14 — U10.2 live Home and product-card gap closure

The live Composer now emits a typed Home ViewModel with the approved ten-section sequence rather
than routing Home through the generic live catalog. `FashionStoreLiveHomePage.vue` preserves the
hero, services, categories, best sellers, promotion, collection, brands, featured products,
marquee, and magazine regions while keeping release-owned product facts separate from fixed source
scaffolding and assets.

`PresentationProductCard` now carries canonical product and variant identity, canonical product
navigation, default-currency money, an explicit Home visual variant, variant-derived direct-add or
Choose-options routing, and a truthful initial action state. Composition omits a card when its
active representative variant has no release-default-currency price instead of creating a second
transaction currency. The shared card refreshes mutable price and availability by stable ID before
add, exposes loading, available, pending, unavailable, retry, and succeeded outcomes, and announces
their results. Identical concurrent revalidations coalesce only while in flight so later checks stay
fresh.

Live direct add is keyboard and coarse-pointer reachable without swallowing the image link's first
touch. The shared guest-cart owner serializes add, update, remove, and acknowledgement mutations per
client token, so an older response cannot publish after a newer cart mutation. Shipping selection
retains its independent latest-request-wins behavior.

The post-implementation review reported three P1 defects and two P2 evidence gaps: fallback
currency divergence, stale concurrent cart publication, inaccessible live add controls, missing
failure-state coverage, and insufficient live Home parity coverage. The implementation and focused
tests close all five. Simplification also removed redundant parsing and card props, reused route
contracts, and limited revalidation coalescing to active identical requests without replacing the
Home section contract with a data-driven abstraction.

The repair verification also identified two adjacent transaction-chain risks outside U10's Home
and representative-card completion surface: Product detail still permits a non-default-currency
fallback, and shipping quotes are not ordered with add, update, remove, and acknowledgement
mutations. They remain explicit inputs to the now-current U3.1 reconciliation and are not claimed as
resolved by this U10 closure.

## 2026-08-14 — U10.3 verification and parent closure

| Evidence                                                                 | Result                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Composer, card-boundary, runtime-Commerce, and shared-cart tests | 50 passed, 0 failed; 202 assertions                                                                                                                                                                  |
| Dedicated live-Commerce Playwright matrix                                | 5 passed, including full Home order/assets, Axe, keyboard, touch, adjacent breakpoints, unavailable, product failure, cart failure/retry, search, shipping, and shared Cart/MiniCart synchronization |
| `bun run --cwd apps/storefront test:fashion-store`                       | 33 static/contract tests, 5 live tests, Playwright 132 passed/192 intentionally skipped, and all 15 page behavior reports verified                                                                   |
| `bun run --cwd apps/storefront typecheck`                                | Passed                                                                                                                                                                                               |
| `bun run check:boundaries`                                               | Passed                                                                                                                                                                                               |
| `git diff --check`                                                       | Passed                                                                                                                                                                                               |

The broad matrix retains structural, behavioral, and absence parity as separate evidence lanes:
fixture source acceptance continues to own the approved source contract, while the live suite owns
typed composition and Commerce outcomes. Existing Nuxt hydration, extraneous-attribute, upstream
source-map, and imported-script development warnings remain visible in the run; no passing
assertion treats those warnings as resolved.

Parent U10 is complete. The owning child plan and product master pointer advance together to U3.1
for reconciliation of the complete real-Commerce browse-to-order and authoritative payment-return
vertical slice. This evidence record does not create a second execution queue.

## 2026-08-14 — U3.1 real-Commerce vertical-slice reconciliation

The reconciliation inspected the current working tree on
`codex/feat-fashion-store-functional-integration` atop commit `8a3723d4`. No product behavior
changed during this stage. The institutional-learning search again found the Fashion Store source
reconstruction record: structural presence, observable behavior, fallback, and absence parity are
separate evidence lanes, so an existing component or green presence assertion cannot certify an
end-to-end outcome. The repository still has no
`docs/solutions/patterns/critical-patterns.md` file.

### Reconciliation matrix

| U3 outcome                                                 | Current implementation and evidence                                                                                                                                                                                                                                                                                                                                                                                                    | Reconciliation result                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live Home, Collection, and canonical Product entry         | U10 proves the complete live Home and normalized card. Collection uses the same typed card contract and canonical product route. The live Product page consumes a Composer ViewModel and refreshes mutable state by stable product ID.                                                                                                                                                                                                 | **Covered dependency baseline.** The browse entry and stable-ID boundary exist; U3.2 must preserve them while closing Product semantics.                                                                                                                                                                                                                                        |
| Default-currency Product composition                       | Product cards omit products lacking release-default-currency money, but `productViewModel` falls back to the first price of the first active variant. Runtime revalidation then requests that fallback currency while the shared cart and Checkout use the release default.                                                                                                                                                            | **Confirmed gap.** Product detail can present and transact in a currency inconsistent with the rest of the Experience. Composition must fail closed instead of selecting another currency.                                                                                                                                                                                      |
| Multi-variant selection and authoritative refresh          | Runtime refresh returns stable variants and prices, disables out-of-stock rows, revalidates before add, bounds quantity, prevents duplicate adds while checking, and preserves selection on ordinary failure. The live page renders one flat Variant radio group from preformatted labels; the ViewModel drops release `optionValues`, runtime projection drops product option groups and media, and the first variant is preselected. | **Confirmed gap.** There is no grouped required-option state machine, valid-combination resolution, incomplete/invalid selection error association, selection-driven media, or declared focus recovery. The current flat variant list cannot satisfy R51.                                                                                                                       |
| Shared Cart authority and recoverable Cart/Checkout        | ProductCard, Product, MiniCart, Cart, Checkout, and Header use one readonly injected Cart owner. Add, update, remove, and acknowledgement publish server-returned Cart state through a per-token mutation queue. Terminal cart recovery, currency mismatch, timeout guidance, quantity adjustment, Checkout validation messages, and latest-shipping-request behavior have focused tests.                                              | **Partial; confirmed ordering gap.** `shipping()` bypasses the mutation queue. A shipping response can publish across an add, update, remove, or acknowledgement response and restore stale lines or totals even though shipping requests are ordered relative to one another.                                                                                                  |
| Checkout and payment-return authority                      | Checkout waits for complete address data, publishes server shipping quotes, uses server totals, creates an idempotent hosted session, stores only an opaque order token, and never treats the redirect as payment approval. `/checkout/complete` performs a bounded five-attempt order lookup and distinguishes pending, paid, failed, expired, and invalid-token outcomes.                                                            | **Partial; confirmed state-machine gap.** The contract and UI have no canceled or explicit duplicate-return state, no user-driven retry state, no documented cart disposition per terminal state, and no deterministic focus target or urgent announcement policy. Polling stops on the first request error without a recoverable retry transition.                             |
| Truthful no-JavaScript and accessible transaction behavior | Live pages retain release content and canonical destinations, and `FashionStoreShell` renders a JavaScript limitation notice and Shop recovery link. Existing live Home Axe, keyboard, touch, and breakpoint evidence passes.                                                                                                                                                                                                          | **Partial; confirmed critical-path gap.** Live Product, Cart, and Checkout mutation controls remain active-looking in server HTML, and no live no-JavaScript browser test proves them transaction-read-only. Product selection and payment return also lack the full keyboard, screen-reader, focus, announcement, touch, and representative-breakpoint matrix required for U3. |
| Representative Worker-compatible browse-to-order evidence  | The dedicated live Playwright lane passes five locally intercepted tests for Home/card outcomes, card failure recovery, build-local search, Checkout shipping, and mounted MiniCart/Cart synchronization. Generic Checkout E2E proves one intercepted paid return and rejects a forged return.                                                                                                                                         | **Partial; confirmed evidence gap.** No single live Fashion Store journey covers Collection/Product selection, add, visible MiniCart, remove, re-add, Cart quantity/removal, Checkout `422`, all payment-return outcomes, and order confirmation. U12 still owns the later deployed no-interception journey and destructive environment lifecycle.                              |

### Characterization observed

| Command                                                                                                                                                                                                                                  | Result                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `bun test apps/storefront/tests/cart.test.ts apps/storefront/tests/checkout.test.ts apps/storefront/tests/runtime-commerce.test.ts apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fashion-store-live-commerce.test.ts` | 52 passed, 0 failed; 208 assertions                              |
| `bun run --cwd apps/storefront test:fashion-store-live`                                                                                                                                                                                  | 5 passed; `.last-run.json` records `passed` with no failed tests |

The live run retained the known Nuxt conditional-page/layout, hydration, extraneous-attribute,
upstream source-map, and imported-script development warnings. Its passing assertions do not claim
those warnings are resolved. The generated active Experience was restored to fixture-preview mode
after characterization.

U3.1 is complete as reconciliation only. The owning child and product master checkpoints advance
to U3.2 to close the confirmed Product currency and option-state gaps, order shipping with every
cart mutation, complete the accessible bounded payment-return state machine, make live transaction
controls truthfully read-only without JavaScript, and extend the local Worker-compatible
browse-to-order evidence. U3.3 retains the parent verification and completion verdict; U12 retains
the deployed no-interception, webhook, acceptance-lock, cleanup, and recovery tail.

## 2026-08-14 — U3.2 real-Commerce vertical-slice gap closure

U3.2 closed only the gaps recorded by U3.1. Product composition now rejects every active variant
that lacks release-default-currency money. Dynamic product routes override the template's
representative binding with the release-resolved stable product ID. Product ViewModels and runtime
projections retain grouped option values and media; the live page requires a complete valid
combination, disables unavailable values, refreshes the selected price, submits the stable variant
ID, preserves selection on recoverable failure, associates and focuses selection errors, and keeps
server-rendered mutation controls disabled until hydration.

The shared Cart publication version now orders shipping responses with add, update, remove, and
acknowledgement mutations while retaining latest-shipping-request behavior. Cart and Checkout
render meaningful server content, an explicit recovery destination, and disabled live transaction
buttons without JavaScript.

Payment return now models pending, confirmed, canceled, expired, failed, explicit retry, invalid,
and duplicate outcomes. Redirect intent never grants success: only authoritative `paid` order
access enables the order link and refreshes the shared Cart. Cancellation, failure, expiry, retry,
and unresolved duplicate returns preserve the Cart. Polling is bounded and UI-controlled rather
than hidden behind automatic GET retries; each settled transition announces its result and focuses
the status heading. All configured API cancel URLs return to
`/checkout/complete?return=canceled` on their existing storefront origin.

Focused implementation evidence passed: 38 Composer/runtime tests, 4 checkout-return tests, the
API hosted-session test with the configured cancel URL, Product grouped-option/Axe/no-JavaScript
Playwright, canceled/duplicate/retry/confirmed return Playwright, Cart/Checkout no-JavaScript
Playwright, and a single local intercepted Home → Product → Cart → Checkout → authoritative paid
return journey. This local deterministic evidence does not claim U12's deployed no-interception,
webhook, acceptance-lock, cleanup, or interrupted-run recovery outcomes.

U3.2 is complete. The owning child plan and product master pointer advance together to U3.3 for
the parent verification and closure verdict; this evidence record does not maintain a second
execution queue.

## 2026-08-14 — U3.3 verification and parent closure

| Evidence                                                                                      | Result                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused storefront Cart, checkout-return, runtime-Commerce, Composer, and live-contract tests | 58 passed, 0 failed; 230 assertions                                                                                                                                                                                    |
| API hosted-payment-session Worker test                                                        | 7 passed, including the configured cancellation return URL                                                                                                                                                             |
| Dedicated live-Commerce Playwright matrix                                                     | 10 passed, including canceled/duplicate/retry/confirmed returns, grouped Product options, Axe, no-JavaScript Product/Cart/Checkout gates, shared Cart publication, and the local browse-to-authoritative-order journey |
| Full `test:fashion-store` regression                                                          | 33 static/contract tests passed; 10 live tests passed; Playwright 132 passed and 192 intentionally skipped; all 15 page behavior reports verified                                                                      |
| Fashion Store private preview build                                                           | Passed after the representative Product fixture was brought forward with the required `optionGroups` and per-variant `optionValues` contract                                                                           |
| Storefront and API type checks                                                                | Passed                                                                                                                                                                                                                 |
| Import boundaries and diff hygiene                                                            | `bun run check:boundaries` and `git diff --check` passed                                                                                                                                                               |

The first full regression correctly stopped during the private preview build because the existing
representative Product fixture had not adopted the Product ViewModel's new required option fields.
The fixture was updated, the preview build passed independently, and the complete Fashion Store
regression then passed from its first contract test through all behavior-report verifiers. The
generated active Experience finished in `fixture-preview` mode.

The runs retain the known Nuxt conditional-page/layout, hydration, extraneous-attribute, upstream
source-map, unresolved upstream asset, and imported-script development warnings. Passing U3
assertions do not classify those warnings as fixed.

Parent U3 is complete. Its evidence proves the local Worker-compatible real-Commerce slice and
authoritative payment-return behavior without expanding scope: U12 still owns the deployed
no-interception journey, provider webhook, acceptance lock, inventory baseline, cleanup,
interrupted-run reconciliation, and recovery postconditions. The owning child and product master
checkpoints advance together to U11.1 for full-site interaction reconciliation; this progress file
does not become a second current-unit queue.

## 2026-08-14 — U11.1 full-site interaction reconciliation

The reconciliation compared the full 15-route fixture matrix, live Commerce surfaces, typed
interaction rows, source-behavior contracts, shared Product Card usage, and literal Vue controls.
The institutional learning search found one high-relevance source-parity workflow record and no
repository-wide `critical-patterns.md`: structural presence, observable behavior, and absence
parity must remain separate evidence lanes, and an interaction cannot be certified by DOM presence
or intent counters alone.

### Characterization observed

| Evidence                                                    | Result                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Semantic interaction and shared-controller unit tests       | 8 passed, 0 failed; 1,003 assertions                                                    |
| Existing rendered-candidate and no-JavaScript browser audit | 2 passed                                                                                |
| New reverse ledger-row characterization                     | Failed as intended, exposing six rows without a current fixture-rendered selector match |

### Confirmed U11.2 gaps

- The source-parity Home fixture still assigns `/` to category, product, collection, and brand
  affordances whose visible meaning is not Home; Shell-global anchor interception turns those
  placeholders into real Home navigation.
- Checkout, Shop, Product, Article, Account, and the shared editorial card retain literal `#` or
  prevent-only controls where the outcome should instead be an exact fragment, semantic local
  button, or non-interactive unavailable presentation.
- Wishlist recovery repeats Product Card markup and action handling instead of consuming the shared
  card component and contract already used by Shop, related products, live Home, Collection, and
  live catalog.
- The browser audit proves every rendered candidate has one owner but not that every current ledger
  row is reachable. Its reverse characterization identifies a live-only MiniCart mutation row,
  two state-container/adaptation rows, one incorrect Article related-content selector, and two
  autogenerated route rows for paths with no rendered affordance.

U11.1 is complete as reconciliation only. The owning child and product master checkpoints advance
together to U11.2 to close these exact gaps without weakening fixture/live separation or source
structure. U11.3 retains the parent verification and completion verdict; this evidence record does
not maintain a second execution queue.

## 2026-08-14 — U11.2 gap closure and U11.3 verification

U11.2 replaced every confirmed Home `/` fallback and cross-page placeholder control with an exact
route, semantic local control, named fragment, or non-interactive unavailable treatment. Shell no
longer owns global document anchor or key interception: Header, Search, and MiniCart own their
transient behavior and Nuxt route handoff locally. Wishlist recovery now consumes the same Product
Card and typed intent boundary as the other merchandising surfaces.

The semantic Product Card contract now distinguishes direct `button.add-to-cart` mutation from the
`a.add-to-cart[data-fashion-store-route]` choose-options destination. The 15-route ledger resolves
each rendered action to one winning row, gives direct controls precedence over containing
presentation surfaces, credits passive surfaces without crediting shadowed action rows, and checks
the reverse set against one reasoned fixture-only MiniCart exception. A focused contract test locks
the choose-options/navigation distinction.

The final structured review ran correctness, project-standards, testing, maintainability,
performance, frontend-lifecycle, and adversarial lenses. It found two independently validated
ownership defects: the choose-options classification and the shadow-permissive reverse audit. Both
were fixed and reverified. The proposed Wishlist removal/focus coverage was already present in the
browser suite, so no duplicate test was added. The independent cross-model route did not run
because this host exposed only the same Codex serving family; the local adversarial fallback and a
separate validation pass completed instead.

| U11.3 evidence                                    | Result                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Semantic interaction contract                     | 8 passed, 0 failed; 1,026 assertions                                                              |
| Focused 15-route ledger and no-JavaScript audit   | 2 passed                                                                                          |
| Root lint, import boundaries, and type safety     | `bun run lint` and `bun run typecheck` passed                                                     |
| Source-equivalence policy and contract regression | 147 passed, 0 failed; 357 assertions                                                              |
| Full Fashion Store unit and browser regression    | 33 unit tests passed; 10 live tests passed; Playwright 132 passed and 192 matrix-expected skipped |
| Executed behavior evidence                        | All 15 page reports verified: 59, 8, 3, 8, 4, 10, 6, 6, 4, 4, 6, 6, 5, 4, and 4 records           |
| Generated active Experience                       | Restored to `fixture-preview`                                                                     |

The passing runs retain known upstream source-map and unresolved-asset warnings, Nuxt conditional
page/layout warnings, extraneous-attribute and hydration warnings, and the imported-script
development `SyntaxError`. U11 assertions do not classify those warnings as resolved.

Parent U11 is complete. Its result is the full-site interaction and ownership baseline required by
U4; the owning child and product master checkpoints advance together to U4.1 for route and truthful
page-state reconciliation. This evidence record does not maintain a second current-unit queue.

## 2026-08-14 — U4.1 route and truthful-state reconciliation

The reconciliation compared the 15 exact page contracts, live product and collection families,
generated prerender routes, Shop aliases and canonicals, unknown and trailing-slash paths, live
content composition, unsupported-capability presentation, policy authority, SEO, static output,
and no-JavaScript behavior. The institutional-learning search found one high-relevance source-parity
workflow record and no repository-wide `critical-patterns.md`; it reinforces separate structural,
observable-state, and absence-parity evidence.

The focused characterization baseline passed 71 tests across routing, generation, Composer,
content, information, Shop, Magazine, fixture isolation, SEO, and Catalog search. That baseline
proves the exact route matrix, generated published Catalog slugs, Shop canonical aliases,
trailing-slash normalization, deterministic unknown-route rejection, source-visible fixture
content, and the existing static/no-JavaScript search treatment.

U4.1 found three live gaps. Editable content settings can currently mark Account and Wishlist as
`populated` even though those capabilities are unavailable. The live Wishlist therefore also omits
the Capability Matrix's Catalog-backed recovery merchandising through the shared Product Card.
Finally, live preview prerendering omits Catalog policy paths and the policy page reads the default
generated Catalog instead of the preview-selected Catalog Release. U4.2 owns only these gap fixes;
U4.3 retains the parent verification and completion verdict. This evidence record does not maintain
a second current-unit queue.

## 2026-08-14 — U4.2 truthful-state and policy gap closure

Proof-first coverage strengthened the existing Composer, generation, live-boundary, and live
browser suites. Before implementation, four focused assertions failed for the expected reasons:
configured Account copy produced a populated state, Wishlist had no recovery cards, live policy
paths were absent from prerendering, and the policy page ignored the selected preview release.

The Composer now treats Account as unconditionally unavailable and represents Wishlist as an
unavailable collection-grid state containing up to four normalized, published Catalog product
cards. The live content renderer preserves Shop/Home exits and uses the shared Product Card without
exposing wishlist persistence. Live preview route generation includes every selected-release
policy, while the platform policy page selects the same live Catalog Release for content, site
identity, and canonical metadata. Fixture-preview behavior remains isolated and unchanged.

The post-change focused suites passed 41 unit tests, Storefront Vue typecheck passed, and the new
live browser case passed Account/Wishlist state and exits, two canonical recovery cards, zero
wishlist-removal controls, scoped Axe, Catalog policy content and canonical, Shop alias canonical,
unknown-route 404, and zero non-GET business requests. The generated active Experience was restored
to `fixture-preview`. U4.3 now owns the complete parent verification and completion verdict; this
evidence record does not maintain a second current-unit queue.

## 2026-08-14 — U4.3 complete route and truthful-state verification

The full parent verification retained the U4.2 Account, Wishlist, and selected-release policy
behavior across the complete Fashion Store regression. Account remains explicitly unavailable.
Wishlist remains unavailable as a persistence capability while showing at most four published,
default-currency Catalog products through the shared Product Card. Policy content, site identity,
canonical metadata, and generated paths all come from the same selected live Catalog Release.
Shop aliases, unknown routes, no-JavaScript recovery, and the zero unsupported-mutation boundary
remain deterministic.

The first Lighthouse run exposed a Home CLS of `1.006`. A fixed media ratio was tested as the
initial hypothesis, but it did not change the score and was fully reverted. Layout-shift
instrumentation instead showed that the server-rendered Fashion Store markup painted before its
selected-theme CSS arrived through the asynchronous theme module. Injecting that stylesheet into
the initial document eliminated every recorded shift. The final fix therefore adds the selected
Fashion Store styles to Nuxt's preview-only first-render CSS list while preserving deferred
JavaScript and production/other-theme isolation. The generated document now links the theme CSS in
its head; the verified Home retry scored `1.00` for performance with no observed layout-shift
entries.

The final independent correctness and testing review found no runtime defect, but identified three
P2 false-green risks. The retained gates now read the CSS files linked by the initial HTML and
require a Fashion Store-only selector, compose eight interleaved eligible and ineligible Wishlist
products and prove the ordered four-card bound, use the real live-product API path and require both
recovery cards to become `available`, and render a policy slug, body, date, site name, and origin
that do not exist in the default generated Catalog. The corrected focused suite passed 41 tests,
and the dedicated live browser proof passed with the stronger assertions.

| U4.3 evidence                                                          | Result                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused U4 Composer, generation, live-boundary, and route-state suites | 41 passed, 0 failed; the strengthened dedicated live browser route-state proof passed                                                                                                           |
| Full Fashion Store unit and live suites                                | 33 unit tests and 11 live tests passed                                                                                                                                                          |
| Full 15-route fixture browser matrix                                   | 132 passed; 192 matrix-expected skipped                                                                                                                                                         |
| Executed behavior evidence                                             | All 15 page reports verified: 59, 8, 3, 8, 4, 10, 6, 6, 4, 4, 6, 6, 5, 4, and 4 records                                                                                                         |
| Lighthouse route suite                                                 | Home `1.00`, Shop `0.97`, Product `0.95`, Cart `1.00`, Checkout `1.00`, Magazine `1.00`; accessibility, best-practice, and SEO thresholds passed                                                |
| Static and bundle proof                                                | Static preview HTML, first-render theme CSS, headers, and sensitive-artifact checks passed; all 15 routes stayed below the 307,200-byte gzip initial-JS budget; selected-theme isolation passed |
| Repository quality gates                                               | Root lint, import boundaries, full type safety, `git diff --check`, and 147 source-equivalence tests passed                                                                                     |
| Generated active Experience                                            | Restored to `fixture-preview`                                                                                                                                                                   |

The passing runs retain known upstream source-map and unresolved-asset warnings, Nuxt conditional
page/layout warnings, extraneous-attribute and hydration warnings, and the imported-script
development `SyntaxError`. U4 does not classify those warnings as resolved.

Parent U4 is complete. The owning child and product master checkpoints advance together to U7.1
for bounded Experience editing and preview reconciliation. This evidence record retains the U4
proof and does not maintain a second current-unit queue.

## 2026-08-14 — U7.1 bounded editor and private-preview reconciliation

The reconciliation compared the complete First Editor Inventory and every U7 operator, security,
accessibility, responsive, migration, approval, and private-preview scenario with the shared
contracts, domain invariants, API service and routes, Fashion Store manifest, Admin editor, preview
Worker, storefront context bar, and retained tests. The institutional-learning search found no
U7-specific solution record; the relevant source-parity learning reinforces that the presence of a
field or action is not evidence that its complete observable behavior works.

The inherited implementation is substantial. Admin controls are manifest-derived and already
support bounded text, number, boolean, select, asset, link, product-reference, and
collection-reference settings; section visibility, ordering, and reset; stable-ID-only Catalog
bindings; optimistic version checks; dirty-navigation protection; immutable preview and approved
snapshots; canonical deployed Catalog Release discovery guarded by `themes.preview` plus
`catalog.read`; exact preview-build tuple binding; one-time credential-free POST grants; secure
session digests, origin and replay checks; artifact expiry and cleanup; and migration dry-run and
approval services. Changing the selected release preserves edits and clears the prior build and
snapshot, and Fashion Store approval already requires a deployed build for the current draft
version and selected release.

### Confirmed U7.2 gaps

- The Fashion Store manifest does not encode the complete First Editor Inventory. It omits the
  global announcement, most header/footer fields, Home hero media and actions, merchandising title,
  content-page media and links, and order/policy help surfaces; the Product surface declares a
  product reference where the inventory requires a related collection reference.
- Shared setting and binding contracts model only product and collection references. They do not
  provide typed page, article, or policy references, and the link value has only a route path or
  external URL without the required label and target behavior.
- Catalog media discovery is a query-limited `LIMIT 100` endpoint and the Admin exposes it as one
  searchable text dropdown. There is no cursor/page contract, image preview, explicit browse,
  intrinsic-dimension presentation, missing-asset recovery, replace flow, or dedicated reset flow;
  the plan-listed media library service and focused test do not exist.
- Product and collection selectors have only the currently loaded release array and client-side
  filtering. Media and reference selectors lack the complete loading, paginated search, selected,
  missing, empty, API-error, and retry states. The release selector lacks explicit loading, stale,
  error, and retry presentation, and a release change does not immediately rerun and announce
  reference validation before approval readiness.
- An optimistic conflict preserves in-memory edits but offers only reload-and-discard. There is no
  save-as-successor path and no conflict-specific focus handoff or live announcement.
- The API can dry-run and approve a migration into an immutable migrated snapshot, but it does not
  create the required successor draft. The Admin exposes only conflict assessment and does not
  execute migration approval or guide invalid-reference recovery.
- Preview snapshot rows retain source draft identity and version, and builds retain an artifact
  digest, but there is no immutable draft-preview report with a canonical Experience content
  digest. The storefront preview context bar omits environment, generation time, expiry, and a
  return-to-editor action. Preview grant/session revocation is not implemented.
- The retained Admin E2E covers only one text edit followed by save, validation, preview, grant, and
  approval. It does not cover the representative text/asset/link/visibility/order/reference,
  invalid-reference, successor-conflict, migration, preview-return path, screen-reader focus/error
  behavior, supported widths, or safe unsupported-narrow limitation required by R72 and R74.

### Characterization baseline

| Evidence                                     | Result              |
| -------------------------------------------- | ------------------- |
| Shared Experience contract and domain suites | 15 passed, 0 failed |
| API Experience suite                         | 15 passed, 0 failed |
| Admin editor unit suite                      | 13 passed, 0 failed |
| Real-browser Admin component suite           | 2 passed, 0 failed  |
| Admin save/validate/preview/approve E2E      | 1 passed, 0 failed  |

U7.1 is complete as reconciliation only. The owning child and product master checkpoints advance
together to U7.2 to close these exact gaps without weakening Commerce ownership, immutable
snapshots, fixture/live isolation, or the existing private-preview security boundary. U7.3 retains
the complete parent verification and completion verdict; this evidence record does not maintain a
second execution queue.

### Post-reconciliation dependency repair

The required diff review found seven concrete regressions in completed dependency surfaces, and
they were repaired before U7.2 work began. Home composition now stops after the first 24 eligible
cards and requires every active variant to carry the selected release currency. Product option
selection treats groups as ordered dependencies, so changing an earlier option clears incompatible
later choices. The live Product retry action is enabled after a failed Commerce revalidation.
Shipping quotes, existing-cart refreshes, and cart mutations now share one per-token operation
queue, while payment-return polling cancels stale delays and ignores disposed runs. A shared live
Product Card also returns to its available state after its direct variant is removed from the
authoritative MiniCart.

The focused Composer, runtime-Commerce, and cart suites passed 51 tests. Four targeted live browser
proofs passed for failed Product revalidation recovery, same-page add/remove/re-add, paid-return
cart refresh, and complete-address shipping, and the complete live-Commerce browser file passed all
13 tests. Root lint, import boundaries, repository type safety, fixture-preview Storefront type
safety, and `git diff --check` passed. The generated active Experience was restored to
`fixture-preview`. The browser runs retain the previously recorded
source-map, conditional page/layout, hydration, extraneous-attribute, and imported-script warnings;
this repair does not classify those warnings as resolved.

This repair does not change the execution checkpoint: U7.2 still owns only the confirmed bounded
editor and private-preview gaps above, and U7.3 still owns the parent completion verdict.

## 2026-08-14 — U7.2 bounded editor and private-preview gap closure

U7.2 now encodes the complete First Editor Inventory in the Fashion Store manifest and shared
contracts. Product, collection, page, article, and policy controls persist typed stable references;
links persist a label, typed internal or credential-free HTTPS target, and explicit target behavior.
The Admin derives these controls from the manifest, provides paginated searchable resource and
Catalog-media pickers with fixed-ratio image space and distinct loading, empty, missing, error,
retry, replace, and reset states, and invalidates selected-release validation and preview readiness
when the Catalog context changes.

Optimistic conflicts preserve local work and offer reload-discard, keep-local, or successor-draft
recovery with predictable focus. Theme migration now creates a reviewable successor draft rather
than mutating or approving an immutable snapshot. Preview reports retain the canonical Experience
content digest, and the authorization response exposes an authenticated private-preview context
with the exact Catalog, Experience, theme, platform, generation, expiry, digest, and return-to-editor
identity. Preview grants and sessions can be revoked idempotently and fail closed afterward.

The live Fashion Store consumes representative edited announcement, hero media and link,
merchandising, collection, product, and content presentation values without changing fixture-QA
output or Commerce-owned product, price, availability, cart, checkout, order, or policy facts. The
Admin shell no longer imposes an 800px global minimum width; the complete save, validation, preview,
grant, and approval browser path passes at 768px without horizontal overflow.

The required simplification pass reused the shared resource-kind, link-behavior, reference, link,
and Catalog-asset contracts, stores the immutable content digest once instead of recalculating it
for every preview resource request, filters only the requested resource kind before pagination, and
memoizes normalized editor resources. Larger interaction-changing drawer/cache proposals and broad
renderer extraction were deliberately left for separate work.

| U7.2 retained evidence                                 | Result                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Shared Experience contract suite                       | 12 passed, 0 failed; Contracts typecheck passed                                          |
| API Experience and Catalog media suites                | 17 passed, 0 failed; API typecheck passed                                                |
| Database migration suite                               | 6 passed, 0 failed; DB typecheck passed                                                  |
| Storefront theme-engine and Fashion manifest suites    | 35 passed, 0 failed; Storefront typecheck passed                                         |
| Admin editor unit and real-browser component suites    | 14 unit and 2 browser tests passed                                                       |
| Admin save/validate/preview/grant/approve E2E at 768px | 1 passed, 0 failed; no horizontal overflow                                               |
| Repository quality gates                               | Root lint and import boundaries passed; full typecheck passed; `git diff --check` passed |

U7.2 closes only the gaps recorded by U7.1. The owning child and product master checkpoints advance
together to U7.3 for the complete parent verification and completion verdict. This evidence record
retains results and does not maintain a second current-unit queue.

### U7.3 closure-review reopening

The first closure-review wave invalidated the U7.2 completion claim despite the green implementation
gates. Validation IDs and persisted rows bind only draft ID and version, so an unchanged draft can
reuse a verdict from another Catalog Release. The immutable approval endpoint requires
`themes.write` rather than `themes.approve`. Grant redemption claims the grant and inserts a session
in separate statements, allowing revocation to run between them and miss the later session. The
private-preview CSP and external Catalog media origin are not proven as one deployed behavior, and
multiple declared Header, Footer, Home, content, and related-resource controls do not yet reach a
typed live renderer. The review also found that multi-reference sections can be rejected as
ambiguous and that hiding the announcement currently substitutes fallback copy instead of hiding
the region.

The owning child and product master checkpoints therefore return together to U7.2. Focused fixes
and failure-first permission, cross-release, concurrency, CSP/media, multi-reference, visibility,
and manifest-to-renderer evidence are required before U7.3 can run again. This reopening does not
invalidate the retained U7.2 implementation evidence for unaffected paths and does not create a
second execution queue in this progress record.

## 2026-08-17 — U7.2 closure-review repair gate

The closure-review findings now have focused fixes across Catalog-bound validation identity,
approval permission, grant redemption and revocation, Catalog media origins, typed composition,
declared editor rendering, required runtime references, migration safety, preview release races,
batched validation, static-route verification, Product Card revalidation, and approval-route
authorization. Contracts, API, database, Admin component/E2E, Storefront type, and real generated
preview/static verification gates passed. The complete live-Commerce browser file reached thirteen
of fourteen passing cases.

The remaining Home case exposed a cold-load deferred-hydration race rather than a Commerce
assertion mismatch. Trace timing showed the first `Enter` action can occur before `app.vue` and the
async Storefront Experience module are requested; the shell mounts later, but the original action
is not replayed to the live Product Card. The corrected `<noscript>` markup removed the separate
hydration-mismatch warning. Several early-capture and replay experiments did not restore the
Commerce request, so those experiments and all diagnostic markers were removed instead of being
retained as unverified product code.

U7.2 therefore remains open. This evidence records the completed review repairs and the exact
remaining gate failure; the owning plan checkpoint remains the sole authority for the next action.

## 2026-08-17 — U7.3 bounded editor and preview closure

The cold-load failure was traced to two sequencing facts. Playwright 1.62 no longer forwarded the
top-level `use.reducedMotion` value into the browser context, and Vue's async component hydration
strategy could not install its listeners until after the Storefront module resolved. On a true
reduced-motion cold load, the first trusted key or pointer action could therefore occur before the
strategy existed and be lost.

The Playwright configurations now pass reduced motion through `contextOptions`. A parser-blocking,
same-origin bootstrap captures the first Home interaction before `DOMContentLoaded`; the Vue
strategy consumes that bounded capture, hydrates once, and replays against the current mounted DOM.
The static acceptance helpers now distinguish legitimate deferred `loading`/`static` inventory
state from tests that require a fully ready visual runtime. No diagnostic marker or timeout probe
remains.

| U7.3 closure evidence                    | Result                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused cold-load Home proof             | Passed for pointer and keyboard first actions                                                                                                        |
| Complete live-Commerce file              | 14 passed, 0 failed                                                                                                                                  |
| Focused contracts, Storefront, and Admin | 117 Storefront/contract tests and 17 Admin component tests passed                                                                                    |
| Repository gates                         | Root tests passed; API Worker 175/175 and DB Worker 11/11 passed; lint, boundaries, full typecheck, and `git diff --check` passed                    |
| Complete Fashion Store gate              | 34 focused unit tests; 14 live-Commerce tests; browser matrix 132 passed with 192 matrix-expected skipped; all 15 behavior-evidence reports verified |
| Fresh static gate                        | Fashion Store preview rebuilt; Storefront verification plus root HTML/header/sensitive-artifact checks passed                                        |

The repair also aligned one stale no-JavaScript test literal with the governed self-closing
`noscript` contract and gave one routinely 9.5-second Admin editor test a local 20-second budget;
the repository-wide timeout policy was not relaxed. The post-fix scoped simplify pass found no
behavior-preserving consolidation: the classic bootstrap and typed fallback must remain separate to
preserve parser-time capture. A targeted manual review found no residual P0/P1 issue; independent
review contexts were not used because this execution explicitly prohibited subagents.

Parent U7 is complete. The feature checkpoint, FRT checkpoint, and product master advance together
to the user-directed FRT-U1.1 interlude. FS-U12 remains the next Fashion Store unit after FRT; this
evidence record retains the U7 proof without maintaining a second current-unit queue.

## 2026-08-17 — U12.1 inherited implementation reconciliation

The post-FRT reconciliation found substantial reusable U12 foundations. U13 already provides a
distinct `fashion-staging` preview Worker with separate `PREVIEW_AUTH` and `COMMERCE_API` bindings,
exact deployed build and Catalog/Experience/theme/platform identity checks, stable product and
variant IDs, a private-session handoff, and authoritative cart creation/add evidence. The API
already implements hosted checkout, signed Stripe webhook verification, provider-truth
reconciliation, duplicate-event handling, retry recovery, immutable paid-order creation, and
pending/failed/expired states. Storefront payment-return logic and the fourteen-case local
live-Commerce browser suite cover canceled, pending, confirmed, failed, expired, retry, duplicate,
cart refresh, and canonical Fashion Store browse-to-order behavior. Environment-isolation tests
already fail closed across Worker, binding, D1/R2/KV, email, Turnstile, and Stripe identities.

The reconciliation also confirmed local gaps that prevent U12 completion:

- the private bridge stops at cart shipping and does not admit adjustment acknowledgement,
  checkout session creation, or opaque order-status reads; it does not forward Turnstile only on
  the checkout route, constrain query keys, or bound actual request-body bytes;
- private-preview CSP does not yet admit the exact Cloudflare Turnstile script/frame origins;
- no `apps/api/src/testing/fashion-staging.ts` lifecycle owns an acceptance lock, inventory
  baseline, run namespace, teardown verdict, hard-termination recovery, or paid-order retention;
- the deployment workflow ends at U13 cart-add proof, while `e2e/storefront-purchase.spec.ts` is
  still the legacy generic last-unit journey and explicitly uses the forbidden `Add to bag` path;
- the workflow does not yet preserve journey and cleanup failures independently, prove the three
  product archetypes, reconcile an abandoned run, or record a fresh-session stock/cart
  postcondition.

U12.1 is complete as a reconciliation stage. U12.2 owns these local gaps. A later deployed
no-interception run remains separate external evidence and is not authorized by this local work.

## 2026-08-17 — U12.2 local Commerce-journey closure

The U12.1 gaps are now closed locally. The private Preview bridge admits only the complete declared
catalog, cart, checkout-session, and opaque order-status route/method pairs; validates route-specific
query keys, origin/CSRF state, CartToken use, mutation headers, and actual and declared request-body
size before Commerce; and returns stripped, non-cacheable responses. The private CSP permits only
the exact Cloudflare Turnstile challenge script/frame origin while retaining same-origin Commerce
connections and blocking form submission.

Migration `0020` and protected `fashion-staging` API routes implement one environment lock, exact
Catalog/Snapshot/artifact/commit and canonical Catalog-digest identity, inventory baselines, a
registered resource ledger, separate journey and cleanup failures, paid-order retention, auditable
inventory restoration, idempotent cleanup, expired-lease reconciliation, and a separate
postcondition run. The lifecycle endpoints fail closed outside the exact environment namespace and
token boundary. The lifecycle client validates exact origins, identifiers, digests, and opaque
tokens without placing the authorization token in request bodies or evidence.

The private-preview workflow now validates isolated provider prerequisites before mutation,
acquires the lifecycle lock before U13 or browser work, registers created resources, preserves
journey and cleanup failures independently, always cleans the primary and postcondition runs, and
requires one final all-green verdict. Its no-interception Fashion browser spec proves stable-ID
single-variant, multi-variant, and unavailable archetypes; canonical navigation; MiniCart and Cart
remove/re-add/update behavior; hosted Stripe sandbox checkout; authoritative order return; and a
fresh-session sellable postcondition. Exact workflow JSON, Playwright reports, and test results are
retained as artifacts. The runbook records normal cleanup, paid-order retention, and explicit
expired-lease recovery.

| U12.2 retained evidence      | Result                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview bridge/CSP           | 8 focused tests passed, 59 expectations                                                                                                                   |
| Acceptance lifecycle         | 6 Worker tests passed, including real D1 trigger, paid-order retention, cleanup, inventory restoration, exclusivity, and stale recovery                   |
| Lifecycle client             | 3 tests passed                                                                                                                                            |
| Workflow/environment tooling | 53 tests passed in the combined isolation/workflow/client batch; the final workflow-only preservation check passed 19/19                                  |
| Repository gates             | Root lint and boundaries passed; full typecheck passed; Storefront 237, Contracts 28, DB seed 1, Domain 29, API Worker 181, and DB Worker 11 tests passed |
| Fashion regression           | Complete local live-Commerce Playwright file passed 14/14; theme manifests and static theme verification passed                                           |
| Deployment packaging         | Storefront Preview Worker and API `fashion-staging` Wrangler dry runs succeeded; no deployment occurred                                                   |
| Change hygiene               | `git diff --check` passed; no staging, commit, push, deployment, migration application, or remote mutation occurred                                       |

The API dry run also exposed the remaining environment boundary: the checked-in Fashion profile
sets Turnstile enforcement false and does not provide the site key, while Wrangler warns that the
profile omits inherited workflow, queue, rate-limit, analytics, and support-bucket bindings. The new
migration and lifecycle routes are not deployed. Running the workflow would upload/deploy artifacts,
mutate isolated acceptance resources, and execute a sandbox payment. Those actions require explicit
authorization and exact resource inventory; ordinary staging and production are outside scope.

U12 is therefore locally complete but not test-environment proven. The owning child and product
master checkpoints advance together to U12.3 and retain the external authorization blocker; this
progress record does not create a second current-unit queue.

## 2026-08-18 — authorized read-only `fashion-staging` inventory

The user authorized an exact read-only inventory and prohibited every create, update, delete,
migration, deployment, workflow dispatch, ordinary-staging access, and production access. All
remote commands targeted only the explicit Fashion resources. No secret value was read or logged.

| Inventory target       | Observed state                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare account     | Configured and authenticated account IDs both equal `449e7f42fe4c4e55d5c674e2e7c57c8d`                                                                                                                                                   |
| Fashion API Worker     | `shoppp-api-fashion-staging`, current version `9a7d1a9c-5f3e-4355-9615-e44a60a7cc94` from 2026-08-12; `/health` returns 200                                                                                                              |
| Private Preview Worker | `shoppp-storefront-fashion-preview`, current version `bdda2739-2a2a-46c2-97a4-30fdf9a5731c` from 2026-08-12; an unauthenticated root read returns the expected 401                                                                       |
| D1                     | `shoppp-fashion-staging`, ID `eb1ca4ef-3121-4d02-b20e-e619eac1cecc`, APAC, 978944 bytes, 57 tables, zero writes in the preceding 24 hours                                                                                                |
| Pending D1 migrations  | `0018_storefront_preview_revocation.sql`, `0019_storefront_validation_catalog_identity.sql`, and `0020_fashion_staging_acceptance.sql`                                                                                                   |
| Media R2               | `shoppp-fashion-staging-media`, APAC, zero objects, zero bytes; its exact configured `r2.dev` URL is enabled                                                                                                                             |
| Preview R2             | `shoppp-fashion-staging-preview-artifacts`, APAC, zero objects, zero bytes; public `r2.dev` access is disabled                                                                                                                           |
| Service bindings       | Preview `PREVIEW_AUTH` and `COMMERCE_API` both target only `shoppp-api-fashion-staging`; Cloudflare reports the default service environment label `production`, which is the Workers service namespace, not the Shoppp production Worker |

The deployed API has only `PREVIEW_BUILD_CALLBACK_TOKEN` and `PREVIEW_SERVICE_TOKEN` secret names;
the deployed Preview Worker has only `PREVIEW_AUTH_TOKEN`. The API therefore has no deployed
`FASHION_ACCEPTANCE_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `TURNSTILE_SECRET`.
Its deployed plain-text bindings still set `TURNSTILE_REQUIRED=false`, have no site key, and use the
older payment-cancel target. The deployed Preview CSP allows only same-origin scripts and therefore
does not contain the locally implemented Turnstile origin.

The protected GitHub environment exists but has no protection rules or deployment branch policy.
It contains six variables — the three Preview origins and the U13 currency/product/variant IDs —
and three secret names: `CLOUDFLARE_ACCOUNT_ID`, `FASHION_U13_SERVICE_TOKEN`, and
`PREVIEW_BUILD_TOKEN`. It lacks every new U12 archetype/email/site-key variable plus environment-
scoped `CLOUDFLARE_API_TOKEN`, `FASHION_U12_ACCEPTANCE_TOKEN`, `STRIPE_SECRET_KEY`,
`STRIPE_TEST_CARD`, and `TURNSTILE_SECRET`. Repository- or organization-level values were not
enumerated because that would exceed the authorized Fashion-only scope. The preview workflow has no
historical runs.

The exact D1 data read was limited to non-sensitive acceptance identity and aggregate state:

- the deployed Catalog Release is `representative-release-2026-07-30`; its manifest declares two
  products, but live Commerce contains only the single-variant `prod_01JFASHIONLIVE0000000001`
  (`atlas-carry-on`) and variant `var_01J00000000000000000000000`;
- that variant's `warehouse_fashion_staging` baseline is on-hand 100, reserved 0, backordered 0,
  oversell 0; there are no active reservation groups or reservations;
- the manifest-only second product has twelve variants, but none exists in live Commerce, and no
  unavailable-product archetype exists;
- one pre-existing active U13 cart remains, with no checkout attempt or order. It expires on
  2026-08-19 and is not owned by a U12 run, so later cleanup must not touch it;
- the live snapshot's build is expired, while the fixture snapshot's build has remained `building`
  since 2026-08-12. There are no unexpired Preview grants or sessions and no current immutable
  build that can validly drive the U12 workflow.

This evidence invalidates the prior local-closure verdict. The migration action is a three-file
chain, including a table-rebuild migration, and requires an exact D1 backup plus restore-readiness
evidence. The remote journey also requires deliberately provisioned isolated Commerce rows and a
successor immutable Catalog Release, Experience Snapshot, and Preview build; these are durable
test-environment mutations, not ordinary run cleanup. The checked-in Fashion profile and verifier
must first fail closed on required Turnstile, checkout rate-limit, Stripe sandbox/webhook, secrets,
and immutable three-archetype identity. The feature and master checkpoints therefore return
together to U12.2. No remote state changed during this inventory.

## 2026-08-18 — U12.2 deployment-contract closure after inventory

The authorized local-only correction now closes every deployment-contract gap exposed by the
read-only inventory. The Fashion API profile requires the official test Turnstile site key and a
dedicated `CHECKOUT_RATE_LIMITER` namespace `14001` at 10 requests per 60 seconds, with exact
private Preview payment-return targets. Environment-isolation tests reject missing, shared, or
cross-environment identities and provider targets.

A pure readiness verifier and a future authorized capture tool now fail closed unless the exact
Cloudflare Workers, D1, R2, GitHub protected environment, scoped secret names and variables, Stripe
sandbox webhook/event set, Turnstile test profile, applied migration chain, fresh restore-proven
backup, three Commerce archetypes, approved immutable Catalog/Snapshot/build input, and exact commit
identity all agree. The Preview workflow must download and digest-verify that preparation artifact
before any R2 upload or Worker deployment.

The deterministic one-time seed emits collision preflight, inserts, exact verification SQL, a
successor Catalog Release, and an Experience plan for one single-variant product, one 12-variant
product, and one zero-inventory unavailable product. It never updates or deletes pre-existing rows.
The approved-snapshot build route is idempotent and rejects non-approved snapshots. A separate
preparer credential generator emits only hashed credential SQL and grants exactly `catalog.read`,
`themes.read`, `themes.write`, `themes.approve`, and `themes.preview`.

The governed preparation workflow is checked in but was not dispatched. Its mutation order is
fail-closed prerequisite checks, exact D1 export, disposable local restore and foreign-key proof,
retained backup artifact, migrations `0018`-`0020`, schema/integrity proof, API dry deploy,
least-privilege preparer, collision-checked seed, exact seed verification, approved immutable
Snapshot/build creation, and readiness capture. The runbook records the two-workflow handoff and
states that repository changes do not grant remote authority.

| U12.2 local closure evidence                                | Result                                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deployment/readiness/seed/credential/workflow focused tests | 66 passed, 291 expectations                                                                                                                      |
| Disposable D1 seed gate                                     | All 20 migrations applied locally; collision count 0; exact 3-product, 14-variant, 1/12/0 available-variant and single-Catalog assertions passed |
| Disposable D1 preparer gate                                 | Exact identity and credential rows plus five-permission role passed                                                                              |
| API/DB Worker regression                                    | API 182 passed; DB 11 passed                                                                                                                     |
| Storefront regression                                       | 237 passed, 2166 expectations                                                                                                                    |
| Repository gates                                            | Full typecheck, ESLint, import boundaries, theme verification, and `git diff --check` passed                                                     |
| Static/deployment packaging                                 | Production static and Fashion preview static builds/verifiers passed; API and Preview Wrangler dry runs passed                                   |
| Remote effects                                              | None: no secret/protection change, migration, deploy, seed, provider resource, test data, workflow dispatch, stage, commit, or push              |

Fresh static verification exposed and locally corrected missing canonical/meaningful static shell
metadata on Cart, Checkout, Checkout Complete, and opaque Order access routes. Both the production
and Fashion preview output now pass the static HTML and sensitive-artifact checks. Wrangler still
warns that the bounded Fashion API environment omits inherited ordinary-staging support bindings;
those shared resources are outside the U12 journey and were not added.

U12.2 is locally complete. U12 itself is not complete or test-environment proven. The child and
master checkpoints advance together to U12.3, whose only next action is the separately authorized
remote preparation and no-interception proof; this evidence file does not own a competing queue.

## 2026-08-18 — U12.3 preparation stopped at unsupported GitHub reviewer gate

The user separately authorized Fashion-only remote preparation and prohibited ordinary staging,
production, and Preview workflow dispatch. Commit `86a2a328` corrected the preparation preflight to
use Wrangler's current JSON-format option and the explicit Preview Worker configuration; its 22
workflow tests passed before the branch was fast-forward pushed.

The authorized prerequisite phase created Stripe sandbox endpoint
`we_1U5e3VEaazxPV5ywEL6kPKcI` in test account `acct_1TykFBEaazxPV5yw`. It targets only
`https://shoppp-api-fashion-staging.hashencode.workers.dev/webhooks/stripe`, is enabled, and listens
to exactly the four governed Checkout events. The pre-existing ordinary-staging endpoint was
observed but not opened or modified. Stripe API and signing secrets were transferred directly to
the approved GitHub environment and Fashion API Worker without being printed, and the local
clipboard was cleared.

The `fashion-staging` environment now has all ten required secret names and the reported U12
variables. The Fashion API Worker has the complete six-secret name set, including the acceptance,
Stripe, webhook, and Turnstile secrets. No value was read back from either secret store.

GitHub rejected the required-reviewer environment update with HTTP 422: the current billing plan
does not support that protection rule for this private repository. A follow-up read proved that the
failed request left `protection_rules=[]` and `deployment_branch_policy=null`; the workflow was not
dispatched. Therefore no D1 backup artifact, migration, Worker code deployment, preparer/IAM row,
Commerce seed, Catalog Release, Snapshot, or build was created. U12.3 remains blocked on an explicit
account/governance decision rather than silently weakening the readiness contract.

## 2026-08-18 — approved single-operator preparation gate

For this solo private repository, the user approved replacing the unsupported GitHub required
reviewer with a documented single-operator gate while keeping GitHub-hosted CD. The replacement
does not change the Fashion-only target boundary or authorize a run: preparation remains a manual
`workflow_dispatch` whose confirmation must equal `PREPARE FASHION U12 <exact commit SHA>`, whose
source must be a protected branch ref, and whose fixed `fashion-staging-preview` concurrency group
serializes preparation and Preview activity.

The readiness snapshot now retains the dispatch actor, workflow and event identity, exact
confirmation, protected ref, run ID and attempt, authorization mode, and concurrency identity. Its
verifier rejects any mismatch before the artifact can authorize Preview. Existing exact Cloudflare,
D1, Worker, Stripe sandbox, Turnstile, environment-secret, Catalog-lineage, three-archetype,
backup/restore, migration, and immutable Snapshot/build checks remain unchanged.

Test-first evidence recorded the old reviewer assertion and missing workflow evidence fields as six
expected failures. After implementation,
`bun test tools/verify-fashion-staging-readiness.test.ts
tools/capture-fashion-staging-readiness.test.ts tools/deploy-workflow.test.ts` passed 29/29 tests
with 230 assertions. The complete tools suite passed 223/223 tests with 710 assertions, and the
repository typecheck, lint/import-boundary, focused formatting, and `git diff --check` gates passed.
No preparation or Preview workflow was dispatched, and no additional remote mutation occurred.

## 2026-08-19 — GitHub Free blocks the protected-ref preparation path

After the user authorized the exact protected-branch preparation sequence, read-only preflight
proved that commit `148f74bdcd686cef9e95beef1668ca162428f2f1` matches the remote Fashion branch
and that only the retained untracked `pnpm-lock.yaml` remains locally. GitHub reported the branch as
`protected: false`.

Both supported protection mechanisms were then checked. Repository rulesets returned HTTP 403, and
the authorized minimal classic branch-protection PUT returned the same HTTP 403 response:
`Upgrade to GitHub Pro or make this repository public to enable this feature.` A follow-up read
confirmed that the failed request produced no partial protection and the branch remains unprotected.

The preflight also proved that `.github/workflows/prepare-fashion-staging-u12.yml` is absent from
`origin/main` and absent from GitHub's registered workflow list. The governed workflow therefore
cannot be manually dispatched from its feature-branch-only definition. No new workflow run was
created, and no preparation or Preview mutation occurred. Proceeding without an upgrade now needs a
new governance decision covering both default-branch landing and an exact-default-commit substitute
for the unavailable protected-ref signal; the prior authorization did not permit either change.

## 2026-08-19 — approved exact-main preparation substitute

The user approved merging during development and replacing the unavailable protected-ref signal
with the exact default-branch identity. The preparation workflow and readiness verifier now require
both `refs/heads/main` and `PREPARE FASHION U12 <exact main commit SHA>`. They retain the manual
dispatch event, fixed `fashion-staging-preview` concurrency group, Fashion-only resource guards,
D1 backup and disposable restore proof, migration order, operator/run evidence, and separate Preview
authorization boundary. The readiness snapshot no longer records unsupported protection metadata.

Test-first execution produced the expected failures while the old protected-ref gate remained.
After implementation, the focused readiness/capture/workflow suite passed 29/29 tests with 231
assertions. The complete tools suite passed 223/223 tests with 715 assertions. Repository typecheck,
lint/import boundaries, focused Prettier, and `git diff --check` also passed. No remote workflow was
dispatched during local validation, and no D1 migration, Worker deployment, seed, immutable build,
or Preview action occurred.

## 2026-08-19 — governed Fashion preparation readiness produced

The user authorized a one-time self-hosted runner for `fashion-staging` preparation only. Ephemeral
runner registrations used the sole custom label `fashion-staging-preparation`, had no default
labels, and were removed automatically after every attempt. No Preview workflow run exists.

Preparation exposed and retained regression fixes for portable D1 restore, Wrangler migration-state
capture, transaction-free D1 file execution, pure JSON query output, exact-seed replay safety, and a
Fashion-only manual build-dispatch mode. The last mode creates the `building` input needed by a
later separately authorized Preview workflow without invoking an external build hook; API tests
prove every other resource namespace rejects it before a build row is written.

Run `32265128115` at exact `main` commit
`79fbee07f60245b036b5a4d42858227502947a5c` passed the complete preparation sequence. It preserved
restore-proven D1 backup artifact `9369880770`, verified migrations `0018`-`0020`, deployed only
`shoppp-api-fashion-staging`, provisioned the least-privilege preparer, verified zero seed
collisions, retained the exact three product archetypes, and produced the approved immutable input:

- Catalog Release `fashion-staging-u12-release-2026-08-18`;
- Snapshot `snapshot-approved-be895bedd71bd264a74f264144f8216e`;
- build `preview-build-d71bd264a74f264144f8216e-f1bb77ee6f824f48-1` in `building` state.

Readiness artifact `9369913371` expires on 2026-08-26. Its independently reverified SHA-256 is
`3df043bc341fef6d441a74bd07ef6c05669294f6fc340d398678c2f81f46cee2`; it records one available
single variant, twelve available multi-product variants, and zero available variants for the
unavailable archetype. The runner is deregistered. Ordinary staging and production were not
accessed or modified, and Preview remains blocked on a separate user authorization.

## 2026-08-20 — first authorized Preview attempt fails before readiness

The user authorized one ephemeral Preview runner and one exact dispatch from workflow ref
`15fb2f160374935ce2a7b94ae8ab4f6e35cd2524`. Runner
`shoppp-preview-20260820-15fb2f16` registered with the required `self-hosted` and
`fashion-staging-preview` labels, accepted only run `32323200492`, and auto-deregistered after that
job. GitHub runner inventory was then confirmed empty.

The run passed its exact dispatch-input gate, checkout, and Bun setup, then failed at
`bun install --frozen-lockfile` with exit 134. The `workerd` postinstall selected the runner's
captured `/opt/homebrew/bin/node` 24.4.1, whose dynamic linker could not load
`libsimdjson.26.dylib`. The captured PATH placed Homebrew before the working NVM Node 22 install.
Readiness download and verification, isolated environment validation, build-input fetch, R2 upload,
Preview Worker deployment, build reporting, acceptance locking, browser journeys, and cleanup were
all skipped. Preparation, `fashion-staging`, ordinary staging, and production were not modified.

The failed runner's official v2.336.0 archive matched published SHA-256
`8e8839c49b7060b6b2154f4931f815df330c27f167d53ef2239ee3dfce28b079`. Its 1.8 GB local directory
was moved to the macOS Trash after automatic deregistration because permanent removal was rejected
by the execution environment; it is recoverable there. A retry needs a newly authorized ephemeral
runner configured with NVM Node 22 and GNU coreutils first in the PATH captured at registration,
plus pre-listen `node` and `date -d` probes. The failed dispatch is not automatic retry authority.

## 2026-08-20 — replacement runner proves readiness and exposes build-input drift

The user's bounded continuous authorization permitted ordinary Preview failures to be diagnosed,
fixed, and retried while preserving the exact readiness/build/Snapshot identity. Replacement runner
`shoppp-preview-retry-20260820-15fb2f16` captured NVM Node 22 and GNU coreutils before Homebrew,
proved `node` and `date -d` before listening, and accepted only attempt 2 of run `32323200492` at
exact workflow SHA `15fb2f160374935ce2a7b94ae8ab4f6e35cd2524`.

Attempt 2 passed frozen dependency installation; readiness commit
`79fbee07f60245b036b5a4d42858227502947a5c`, preparation run `32265128115`, digest
`3df043bc341fef6d441a74bd07ef6c05669294f6fc340d398678c2f81f46cee2`, build
`preview-build-d71bd264a74f264144f8216e-f1bb77ee6f824f48-1`, and Snapshot
`snapshot-approved-be895bedd71bd264a74f264144f8216e`; fixed Fashion isolation and sandbox-provider
validation; and authoritative build-input fetch. The static build then failed before generation
because `apps/storefront/scripts/prepare-experience.ts` used a strict live-input schema that omitted
the API manifest's immutable `mediaOrigins` field. The API has emitted and tested that field since
the governed Catalog-origin work, but the storefront test used a narrower hand-written input.

The failure occurred before artifact description, R2 upload, Preview Worker deployment, deployed
reporting, acceptance locking, U13 acceptance, no-interception journeys, fresh-session proof, and
all U12 cleanup. The workflow's existing failure reporter did run and returned the exact build with
`status=failed`, `failureCode=preview.build-failed`, and no artifact identity. API transition guards
permit only a `building` build to transition to `deployed`; retained readiness is immutably bound to
this now-failed build, so another valid remote attempt requires a new build/readiness authority and
cannot continue under the retained identity.

Test-first local repair added the real `mediaOrigins` field to the existing live-input regression,
reproducing the same Zod rejection, then extended only the live schema with the API's bounded,
unique, exact credential-free HTTPS-origin contract. The focused suite passed 35/35 tests with 169
expectations; storefront typecheck and Prettier passed. A complete local static build and
`verify:static` using the exact retained build-input then passed for the approved Fashion Snapshot,
including Wrangler dry-run only. No remote environment was contacted by that local proof.

The replacement runner auto-deregistered, GitHub runner inventory was confirmed empty, and its 1.9
GB directory was moved to the macOS Trash after exit; it remains recoverable. The retained 16 KB
downloaded evidence directory was likewise trashed. Ordinary staging and production were not
accessed. U12.3 remains incomplete and pauses at the separately reserved new-build/readiness or
preparation authority boundary.

## 2026-08-20 — standing FS-U12 execution authority replaces per-run prompts

The user superseded the separate preparation/new-identity prompt with a standing authority limited
to FS-U12. The preparation workflow now fails closed unless current `main` descends from baseline
`79fbee07f60245b036b5a4d42858227502947a5c`, every intervening commit subject ends in `(U12)`, and
every changed path belongs to the explicit FS-U12 allowlist. Readiness records the baseline and
scope alongside the existing actor, run, commit, build, Snapshot, digest, freshness, isolation, and
fixed-concurrency evidence. The workflow no longer accepts a self-asserted confirmation string.

A repeated preparation run at the same scoped commit keeps the approved Snapshot lineage but uses
the GitHub run identity in the build idempotency key, so an ordinary Preview failure can receive a
new `building` attempt without reopening or modifying a terminal build. Focused test-first evidence
passed 31 tests and 274 expectations across the standing-authority verifier, readiness verifier, and
deployment-workflow contracts. A direct history check accepted the four scoped commits from the
baseline through `d2297f0f` and rejected non-descendant, merge, unrelated-subject, and
disallowed-path fixtures. This evidence does not complete U12 or maintain another execution queue.

Standing authority continues to exclude ordinary staging/production, unrelated commits,
stale-build mutation, and new destructive or security boundaries. No remote mutation occurred while
establishing this gate; runner inventory remained empty.

## 2026-08-20 — governed preparation stops on invalid Cloudflare credential

Commit `8672d986` published the standing FS-U12 gate to both the governed branch and `main`; a
post-commit verifier accepted five single-parent, allowlisted `(U12)` commits from the authority
baseline. Official actions runner v2.336.0 was verified at SHA-256
`8e8839c49b7060b6b2154f4931f815df330c27f167d53ef2239ee3dfce28b079`, registered only with the
`fashion-staging-preparation` label, and proved Node 22 plus GNU `date -d` before listening.

Preparation run `32326733190` at exact `main` commit `8672d986c0a44d72a4377c879a526d13b01c0ffa`
passed checkout, the standing-scope verifier, frozen dependency installation, repository isolation,
and deterministic input generation. The first remote prerequisite step then failed when Cloudflare
rejected the GitHub environment's `CLOUDFLARE_API_TOKEN` with authentication error `10000` and
invalid-token code `9109`. The failure preceded Stripe inspection, D1 export, backup, migration,
Worker deployment, preparer provisioning, seed, Snapshot, and build creation; no governed remote
mutation occurred.

The ephemeral runner auto-deregistered, GitHub runner inventory returned zero, and its exact temp
directory was moved to macOS Trash for recoverable cleanup. Replacing or rotating the credential is
a new security boundary outside standing FS-U12 retry authority. Ordinary staging and production
were not accessed. This evidence does not complete U12 or maintain another execution queue.

## 2026-08-20 — non-Link Stripe sandbox acceptance closes the regional credential blocker locally

Preview `32360266387` had already proved that Shoppp creates the exact real Stripe sandbox Checkout
Session, product, total, return identity, and registered checkout attempt. Its remaining browser
failure came from Stripe's AI-agent steering clearing the ordinary automated test card and requiring
Link CLI, which currently supports only United States Link accounts. The operator authorized a
non-Link Stripe test-mode acceptance mechanism without changing the governed build/readiness or
business acceptance goals and continued to prohibit ordinary staging and production.

The replacement browser journey now verifies the real hosted Checkout product and `$129.00` total
without entering card data or interacting with the region-limited agent steering. It then calls a
new acceptance-token-protected settlement route that is unavailable outside the exact Fashion
namespace and requires a current active lease, an already registered checkout attempt, Stripe,
`environment=staging`, `test_mode=1`, and exact pending/completed attempt identity. The Stripe
adapter separately requires an `sk_test_` key, retrieves and matches the hosted Session, creates and
confirms one idempotent sandbox PaymentIntent with Stripe's test PaymentMethod, validates test mode,
amount, currency, attempt and Session metadata, expires the unpaid hosted Session, and passes the
verified result through the existing payment reconciliation and paid-order path. Retry uses the same
PaymentIntent and provider-event identity and returns the retained order reference.

The Fashion preparation/readiness contract no longer requires or forwards `STRIPE_TEST_CARD`.
Standing-authority paths list each new API, Stripe, test, E2E, workflow, plan, progress, and runbook
file explicitly; no wildcard scope was added. The runbook records the new fail-closed boundaries.

| Local evidence                       | Result                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Stripe adapter and Fashion lifecycle | 13 focused Worker tests passed, including the live-key guard and replay path; the complete API suite passed 187/187    |
| Workflow/readiness/tooling           | Focused workflow batch passed 33/33; complete tools suite passed 228/228 with 794 expectations                         |
| Repository gates                     | Full typecheck, ESLint/import boundaries, focused Prettier, and `git diff --check` passed                              |
| E2E compilation/discovery            | Exact journey and post-cleanup phases discovered as two tests after TypeScript validation                              |
| Remote effects                       | None; no preparation, Preview, runner registration, provider mutation, ordinary staging, or production access occurred |

U12.3 remains in progress until the governed Fashion-only preparation and Preview complete. The
governed acceptance identity later proved to be `32360266387-1` (run plus attempt), which had to be
reconciled before acquiring a new lock; this evidence does not replace the active checkpoint or
claim remote completion.

## 2026-08-20 — governed non-Link Preview reaches the browser capture boundary

Commit `b53ea8719037e6c12a5e28f5aa7e2d7a5eeb3874` passed governed preparation run
`32368786058` attempt 2 after a replacement ephemeral runner used a healthy bundled Node runtime;
attempt 1 had failed before mutation because the host Homebrew Node referenced a missing simdjson
dynamic library. Preparation created building build
`preview-build-8906f8150dd2b297a46d2e18-f1bb77ee6f824f48-1`, approved Snapshot
`snapshot-approved-72d9f6368906f8150dd2b297a46d2e18`, and readiness digest
`40440023a546a5914350f28e7d6c13dc63cfff4ea8ed6cd3b452255c130f69ec`.

Preview `32369403046` verified readiness, built and deployed the isolated content-addressed artifact,
then failed before a new acceptance lock because the requested recovery value `32360266387` omitted
the acceptance attempt suffix. The governed D1 backup proved the exact row was
`32360266387-1`, already had released reservations and baseline inventory, and remained
`cleanup_pending`. Equivalent Preview `32371052412` used that exact ID, completed recovery, acquired
a new lock, passed deployed U13, installed Chromium, and reached the real Checkout 201 response.

Both Playwright journey attempts then failed before settlement because the test read the Checkout
response through CDP after Stripe navigation had already released its body. Governed failure
recording and U12 cleanup succeeded, restoring the inventory baseline; the postcondition phase and
accepted-build report correctly remained gated. The local fix now intercepts that exact endpoint
with `page.route`, reads the 201 body before fulfilling it to the page, registers the captured
checkout attempt, and continues the same real hosted Checkout navigation. Workflow contract tests
passed 24/24, E2E TypeScript passed, both phase tests were discovered, and `git diff --check` passed.

Every preparation and Preview runner auto-deregistered; runner and diagnostic directories were
moved to macOS Trash for recoverable cleanup. Ordinary staging and production were not accessed.
The next remote proof uses the operator-authorized new commit/readiness identity; this evidence does
not complete U12 or maintain a second execution queue.

## 2026-08-20 — governed Preview proves settlement and exposes stale confirmation copy

Commit `dbd829bbba7a1ea5dbb05c21b4de7bc6d37fd86e` passed preparation `32376826888`,
creating build `preview-build-a339c1af4d12ec15253bcda0-f1bb77ee6f824f48-1`, Snapshot
`snapshot-approved-832a2fe5a339c1af4d12ec15253bcda0`, and readiness digest
`cc593b73356211b62cf42ff8c51a1aba5c78714c5101c3951377721aa340ad5f`.

Preview `32377264619` deployed and reported the exact artifact but could not acquire a lock because
run `32371052412-1` remained `cleanup_pending`. Recovery Preview `32379174632` ran five minutes
before that row's exact lease expiry and correctly refused to claim a non-abandoned run. After
`2026-08-20T14:36:28.729Z`, Preview `32381219319` reconciled it, acquired a new lock, passed U13,
captured both Checkout 201 bodies before navigation, and settled two Stripe test-mode Sessions into
paid orders `ORD-590957CCA431` and `ORD-A0A248609AD0`.

Both attempts reached the correct confirmation page, which rendered `Payment confirmed` and
`Order reference: …`; the E2E still expected the retired sentence `Order … is confirmed.` and timed
out. Governed cleanup retained both paid orders and restored inventory to 100/0/0/0. The assertion
now matches the existing confirmation-page contract and passes E2E TypeScript, two-test discovery,
Prettier, and diff checks. All ephemeral runners auto-deregistered, ordinary staging and production
were not accessed, and U12 remains in progress pending a fresh governed proof.

## 2026-08-22 — governed Preview closes U12 and hands execution to U8

Commit `1e8231726d8a0ad2c9ed4c10e4d27092160fd629` landed the confirmation-copy assertion repair on
`main`. Governed Fashion-only preparation `32383732029` then passed at that exact commit and
produced readiness artifact `9412144384` with SHA-256
`d7fa774152fa42891faa241eaf1bfddc9711d6fc99e2f2c783e2a86343ad1223`. The retained identity was:

- Catalog Release `fashion-staging-u12-release-2026-08-18` with canonical digest
  `3de6a2b08375c2ae11e4f43838d034106626a8ce39910308c7e54fed66c0fff6`;
- approved Snapshot `snapshot-approved-89c1cd6696769d3a962f1029e9118892`;
- build `preview-build-96769d3a962f1029e9118892-f1bb77ee6f824f48-1`;
- Fashion Store theme and platform contract versions `1.0.0` / `1.0.0` in the isolated
  `fashion-staging` environment.

Preview `32384126394` deployed content-addressed artifact digest
`58eab5a6dcdd9d94a13e22f2002ff72d1f2cc3dffdf85660aeb98f6b341bb52e`, passed the deployed U13
identity and stable-ID add proof, and completed the no-interception Fashion archetype and real
sandbox-payment journey under namespace `fashion-u12-32384126394-1`. The browser test's first
attempt observed a transient cart-quantity mismatch; its governed retry completed the full journey,
and the workflow's final verdict required the passing journey rather than masking cleanup or
postcondition failures.

U12 cleanup retained paid order `ORD-B4939D786114`, reported no journey failure, and restored the
representative inventory baseline to on-hand/reserved/backordered/oversell `100/0/0/0`. A separately
acquired fresh-session phase passed its addability test, completed a second idempotent cleanup with
the same restored inventory, and left no retained order in that postcondition namespace. The final
workflow gate verified U13 `passed=true`, both cleanup reports `status=completed`, and recorded
`Fashion preview accepted by deployed U13 and complete U12 lifecycle proof.` Artifact
`9412765921` retains the exact build metadata and Playwright report with SHA-256
`a3ac342abf1fee8204ac8dc3eaaca1b377ca637b08791872c007a00275db632b`.

All Preview job steps completed successfully, ordinary staging and production remained excluded,
and no bearer-capable values are copied into this retained evidence. U12 is therefore
`Complete — test-environment proven`. The active execution pointer moves to U8.1 reconciliation;
this evidence remains a U12 dependency baseline and does not by itself satisfy U8's broader route,
Admin, responsive, accessibility, no-JavaScript, performance, scale, and full acceptance matrix.

## 2026-08-22 — U8 local acceptance matrix passes and isolates the remote tail

Fresh U8 reconciliation first exposed that the acceptance runner restored
`active-theme.ts` but left `active-experience.ts` changed. The runner now snapshots and restores both
generated selection files, its focused contract passes 5/5, and the final full run leaves both files
with zero diff. The final Fashion Store result is 34/34 unit tests, 132 applicable Playwright tests,
192 contract-driven viewport skips, and verified behavior evidence for all 15 governed pages. An
intermediate red run caught an accessible magazine-image link colliding with the title selector and
a home product-label contrast adaptation exceeding the one-percent source-parity budget; the final
implementation gives the image link a distinct name, uses exact title-link selection, and retains
the already audited home contrast exceptions while keeping the broader accessibility fixes.

The additional local U8 evidence is:

| Gate                      | Result                                                                                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility and input   | Six critical routes plus keyboard skip/purchase order passed 7/7; serious or critical Axe findings are zero outside the existing source-parity home contrast exceptions. Product payment semantics, editorial and cart link names, skip-target focus, and 24 px critical targets are covered. |
| Static, bundle, and theme | `verify:themes`, preview static verification, bundle budget, and repository static-output safety passed; initial route JavaScript remained below 300 KiB.                                                                                                                                     |
| Performance and scale     | Fashion Lighthouse passed after one governed transient Home retry; 1,000 products and 5,000 variants produced 1,027 indexable routes plus four private shells in 28,093 ms and passed the 15-minute gate.                                                                                     |
| Admin L4                  | Full Rstest 299/299, test build/typecheck, focused real-browser editor 2/2, and the save/validate/preview/approve Playwright journey 1/1 passed. Unit coverage includes optimistic conflict, invalid reference/validation, permission, immutable preview, and approval recovery branches.     |
| Isolation and security    | Environment isolation passed 33/33 and the live repository profile verified distinct staging, production, and `fashion-staging` resources. Static sensitive-artifact verification and the focused Worker secret-contract test passed.                                                         |
| Repository quality        | Root tests, API/DB Worker tests 199/199, repository typecheck, ESLint, import boundaries, formatting, and generated-state cleanliness passed.                                                                                                                                                 |

The test-environment p95 executable itself passes 3/3 unit tests, but its live form expects a public
`API_E2E_BASE_URL` and creates 20 carts plus shipping mutations. The Fashion API intentionally has
service-binding-only ingress, and the repository has no existing U8 runner that combines that probe
with the real Admin operator path. Local execution therefore cannot safely supply the remaining
remote latency or real edit/conflict/invalid-reference/preview/approval evidence. U8 remains at
U8.2; the active plan and product master pointer own the next action and blocker. No remote mutation,
ordinary staging access, production access, or runner registration occurred in this U8 pass.

## 2026-08-28 — stale U8 attempt and runner reconciliation

The append-only ledger contained `human-u8-20260825a-30` as started without a terminal record.
Read-only GitHub reconciliation identified Preview run `32814863542` at exact harness `91e5db24`:
the isolated runner eventually accepted the job, but `actions/checkout@v4` failed and every later
readiness, build, deployment, U13, purchase, restoration, and publication step was skipped. No
process for the runner or acceptance harness remained active. Exact offline, non-busy runner ID
`71` was removed from the repository registration, and the repository inventory is now empty for
its name and `fashion-staging-u8` label.

The attempt is retained as failed, not reconstructed as successful. The repository has no surviving
human-evidence file, and the available Cloudflare identity cannot read the Fashion D1 database
(API code `7403`), so operator/session, retry29 source, and any Admin-side audit state remain
unverified. The dedicated macOS account and its inaccessible home also require a privileged
operator to retain the exact manifests before local removal. U8 remains at U8.2 and no new retry is
authorized until those two cleanup surfaces are reconciled.

## 2026-08-28 — Admin accessibility ownership and announcement cleanup

The Voice Studio precedent was applied as a bounded ownership rule rather than as a blanket removal
of accessibility behavior. Shoppp now treats native semantics, Ant Design v6, and existing shared
primitives as the authority for standard roles, keyboard behavior, popup/modal focus, and ordinary
live feedback. Feature code still owns visible task language, control names, field-error association,
and local focus or announcement behavior when an explicit workflow exposes a reproducible gap.

The Theme Editor no longer maintains one page-global hidden announcer for unrelated operations.
Catalog Release and resource selection rely on the selected Ant control and visible dirty/validation
state; preview revocation relies on its visible success Alert; preview return relies on deterministic
focus restoration; successor creation uses one Ant Design success message and focuses the stable
editor heading after the new draft loads. The section-order control retains one local `role="status"`
result because its changed position is otherwise not announced while focus remains on the move
button. Validation-summary focus, conflict recovery focus, and preview-return focus remain intact as
explicit workflow behavior.

Admin verification used L2 because the runtime change is bounded to one existing business-override
page and does not touch shared components, routes, permissions, APIs, or build configuration. Updated
component expectations first failed in exactly three places against the prior implementation: the
reorder result lacked the local status role, preview revocation appeared twice, and preview return
still rendered duplicate hidden copy. After the implementation change, the focused Theme Editor
suite passed 19/19, changed-file ESLint passed, Admin `tsc -b` passed, the governed Fashion-staging
Playwright configuration discovered its single live acceptance spec, and `git diff --check` passed.
The first test launch through the host Homebrew Node aborted before collection because its simdjson
dynamic-library link is stale; the same command passed with the bundled Node v24.19.0 runtime. The
live human U8 browser lane was not executed and no remote, staging, production, account, session, or
runner state changed. U8 remains at U8.2 with the same cleanup blocker and next action.

Code review kept Reset feedback library-native and local (changed fields plus retained button focus),
while adding one visible Ant Design success message for async successor creation because the
initiating control is removed during navigation. The successor route also focuses the stable editor
heading after the new draft loads, and unit coverage verifies that message-and-focus result.

## 2026-08-28 — Fashion U8 remote cleanup reconciliation

An authorized Fashion-staging D1 cleanup disabled exact operator
`identity_fashion_u8_u8_20260825a`, revoked its sessions, and then reconciled the full
`identity_fashion_u8_%` namespace. A separate read-only verification proved zero enabled U8
identities, zero active U8 sessions, and 23/23 U8 sessions revoked. It also established the retained
attempt-30 state that local evidence could not reconstruct: source
`draft-fashion-u8-u8-20260825a-retry29-source` is v3, remains attributed to the run-scoped operator,
and has no Snapshot. The draft and its setup/validation/update audits remain excluded non-candidate
evidence; no fresh source, approval, build, Preview, VoiceOver, or terminal-p95 attempt was started.

The GitHub runner inventory still contains neither the exact runner name nor the U8-specific label,
and UID `502` has no running process. The dedicated account `shopppu8_20260825a` and exact home
`/Users/shopppu8_20260825a` remain intact because the `0700` home requires interactive administrator
authorization before its tracked, untracked, and material-ignored manifests can be retained. The
run-scoped repository-external credential file must also be destroyed during that privileged
cleanup. This is the sole remaining cleanup blocker; the active plan and product master retain the
current unit and next-action authority.

The subsequent privileged local tranche retained 12,061 exact runner paths plus the empty
tracked/untracked/material-ignored Git manifests expected after the checkout failure. The protected
manifest index digest is `cd6b510e36935586038eaa8fb3b8c3ab291ca4c63cd63ab6291219f9501739b1`;
the separately retained exact removal-command record digest is
`538b3857638721d69b95b3ab315f51f3c47f6bba04993bea48bbfc2c2da570aa`.
Directory contents are not copied into repository evidence. Exact runner
`/Users/shopppu8_20260825a/actions-runner-u8-20260825a` was then moved recoverably to
`/Users/studio/.Trash/shoppp-fashion-u8-20260825a-runner-20260828` and transferred to UID `501`.

The account-removal continuation did not receive its second interactive administrator authorization
and was cancelled, so no delayed destructive command remains pending. Account
`shopppu8_20260825a`, home `/Users/shopppu8_20260825a`, three UID-specific macOS
cache/metadata roots, and the intentionally unrecorded external credential file remain. UID `502`
still has zero processes. This partial local result does not close cleanup or authorize the CI
handoff.

macOS `sysadminctl` then removed the dedicated home but returned Directory Services error `-14120`
while committing the account record. The supported System Settings Users & Groups flow completed
that record removal: `dscl` and `id` now report no `shopppu8_20260825a`, its home is absent, and UID
`502` has zero processes. The protected runner manifest remains outside the repository and the
runner directory remains recoverable in the operator account's Trash under UID `501`.

The account cleanup removed the UID-specific MDServer, Spotlight, and security-analysis roots. One
macOS per-user cache root was immediately retained/recreated at exact path
`/private/var/folders/hb/jqrrv4rj6m50m5ggjcby7kmc0000gp` under orphaned UID `502`. Both recursive
deletion and ownership transfer were denied by TCC even after administrator authorization, so it
requires a Terminal with Full Disk Access rather than a privilege bypass. The intentionally
unrecorded external credential path also remains required. These two remnants keep FS-U8.2 cleanup
open and CI-U8.3 waiting.

The Full-Disk-Access deletion hypothesis was then disproved. Direct inspection shows the retained
cache root carries `com.apple.rootless`; the APFS Data volume is mounted with `protect`, and System
Integrity Protection is enabled. Both administrator-authorized deletion and recursive ownership
transfer fail with `Operation not permitted`. The account record and home remain absent, UID `502`
has no process, and the runner remains recoverable in Trash. The cache root is therefore classified
as non-actionable macOS-managed metadata rather than runner/account content; disabling SIP is neither
required nor authorized. Only the intentionally unrecorded external credential file remains an
actionable FS cleanup blocker.

Metadata-only search then found the exact 65-byte owner-only operator credential file without
reading its contents. It was validated as a single-link regular file owned by UID `501`, mode
`0600`, outside the repository, and deleted with an exact-path unlink; postcondition verification
proves it absent. The separately named build-hook credential file was classified under the retained
Preview build-hook infrastructure and deliberately preserved. The FS cleanup-only tranche is now
terminal: remote operator/session cleanup, retry29 reconciliation, runner deregistration and
recoverable removal, protected manifest retention, dedicated account/home removal, and operator
credential destruction all pass. Product execution hands to `CI-U8.3` without starting a fresh FS
acceptance run.

## 2026-09-01 — FS-U8.2 terminal acceptance passed

Exact candidate `4fe21a47` and reviewed harness `072adc7d` completed the fresh cloud-only U8 path.
Preparation `33466592253`, the named-operator missing-reference recovery and real optimistic
conflict, successor `draft-0c37fb8a-f56c-4f60-8633-b3bd877843f2`, operator Preview
`33466865943`, immutable approval `snapshot-approved-76aeaf69a7c416a92e115141b75c9d14`, refresh
`33467799538`, and final Preview `33467889188` all passed on one immutable lineage. Terminal
acceptance `33468537473` passed the unchanged 20-sample 500/800 ms Commerce p95 gates, cleanup,
Preview revocation, operator consumption, and append-only ledger. Every transitive job used
`ubuntu-24.04`, repository self-hosted runner inventory is empty, and retained terminal evidence
passed file-type and redaction scans. The active checkpoint and product master now advance to
FS-U8.3 for the complete Verification Contract and final closure verdict.

## 2026-09-01 — FS-U8.3 verification and plan closure passed

The accepted U8.2 lineage was followed by the complete Verification Contract. Root repository
tests, Worker tests, typecheck, lint, and boundary checks passed. Storefront unit and complete
Fashion Store suites passed, including 132 browser cases with 192 configured skips, 15-page
behavior evidence, source equivalence, theme verification, static verification, and the explicit
34-unit Fashion acceptance scope. Admin passed 303/303 tests on full rerun after one isolated stale
IAM-role timeout passed its exact focused reproduction; E2E, eight accessibility cases, and mobile
Lighthouse performance passed. Catalog scale passed with 1000 products, 5000 variants, and 1027
indexable routes; the full Decor/Fashion theme matrix and Fashion mobile performance gate passed.

The production static build temporarily changed the generated selection exactly as expected; the
tracked Fashion preview fixture baseline was regenerated and formatted afterward, leaving a clean
worktree and a clean `git diff --check`. Retained U8.2 evidence remains JSON-only and passed the
recorded sensitive-marker scan; every cloud job used `ubuntu-24.04`, with zero repository
self-hosted runners. U8 is complete, the Fashion Store functional-integration plan is closed, and
product execution transfers to blocked `REL-Pre-DC` without freezing a candidate or authorizing DC,
PG, or production mutation.
