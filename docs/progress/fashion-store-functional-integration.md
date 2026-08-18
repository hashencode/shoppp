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
