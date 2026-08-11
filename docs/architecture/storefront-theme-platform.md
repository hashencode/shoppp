# Storefront Theme Platform

## Authority and boundaries

The platform is a constrained presentation system. A theme package owns versioned tokens,
namespaced Vue components, schemas, presets, and provenance. The core renderer owns the bounded
Template → Section → Block composition model. Deterministic fixtures own design-QA preview data;
an immutable Catalog Release owns live build-time catalog content and an Experience Snapshot owns
merchant-authored composition. None of those presentation layers owns mutable price, inventory,
cart, checkout, order, payment, analytics, authorization, or compliance behavior.

The current Nuxt storefront remains the production default. An approved experience snapshot is a
reproducible presentation release, not a production activation. Fashion Store can compose immutable
Catalog and Experience inputs in private preview and isolated test builds. Production activation
remains a separate plan.

## Version and compatibility model

Three versions move independently:

- `platformContractVersion` identifies the renderer and contract understood by this repository.
- `themeVersion` identifies package code and preset defaults.
- `configurationSchemaVersion` identifies stored operator configuration.

A package declares a half-open compatible platform range. CI rejects invalid semantic versions,
duplicate IDs, incomplete provenance, unsupported ranges, missing page templates, invalid required
capabilities, descriptor drift, and a configuration schema without a contiguous migration chain.
Upgrades are explicit dry runs; they never rewrite an approved snapshot.
The render-snapshot contract carries an explicit `kind`: preview snapshots have null approval
metadata, while approved snapshots require both an approver and approval timestamp. This keeps a
validated preview from being misrepresented as an approval at the build boundary.

Source-controlled manifests feed one generated catalog for the API and storefront. Admin reads the
API descriptor and does not keep a separate theme or field list.

## Build isolation

`prepare-experience.ts` accepts either the production fallback, a deterministic fixture-preview
input, or one validated private live-preview tuple. A live tuple binds the Catalog Release,
Experience snapshot and version, theme version, and platform contract version. It generates a fixed
static import from an internal theme allowlist before Nuxt compilation. Caller-supplied file paths,
package names, remote modules, and executable source are not inputs.

Theme assets remain inside their namespaced package until compilation. Matrix verification scans
each output for inactive-theme namespaces and prohibited Crafto runtimes. The final production
build verifies that it contains neither theme preview code nor preview credentials.

Fashion Store is an isolated experiment under the `fashion-store` identity. It is the only selected build
allowed to include its hash-pinned Crafto CSS and reviewed jQuery/vendor runtime; the upstream
`main.js` entrypoint remains excluded. Its larger initial-JavaScript allowance is separate from the
unchanged Fashion, Decor, and production-fallback budget. A passing experiment is only
promotion-eligible: it does not change the current `fashion` package, snapshots, generated
production fallback, or active storefront selection.

The Fashion Store accessibility suite fixes semantic names, landmarks, and focus behavior without
changing source geometry. Its dedicated contrast audit records narrowly selected source-exact
secondary copy, labels, prices, and footer text; all other serious Axe violations fail the
experiment. The separate Lighthouse accessibility floor reflects those retained source colors and
the source-exact compact search target, and does not lower the current Fashion or Decor floor.

The Fashion and Decor reference-fidelity scope is the home template only. Collection, product,
cart, checkout, order, and policy templates remain complete platform-regression routes, but they
are not represented as reproductions of the supplied reference pages. Reference imagery and
self-hosted fonts enter the selected build through the theme asset resolver; the source matrix
verifies every imported binary is allowlisted and recorded in that theme's provenance file.

## Preview trust boundary

A preview build is a private, content-addressed artifact under:

```text
snapshots/<snapshot-id>/<catalog-release-id>/<sha256>
```

The build machine fetches an exact snapshot with its dedicated bearer credential and reports the
exact build attempt through an authenticated, idempotent callback. The preview Worker never lists
the bucket. It serves only the artifact prefix returned by the authorization service.

An operator receives a short-lived opaque grant from Admin. Admin submits it in a new-tab `POST`;
the credential is never put in a URL. The Worker exchanges it for a host-only `Secure`,
`HttpOnly`, `SameSite=Strict` cookie. Preview responses are private/no-store, non-indexable,
referrer-suppressed, analytics-free, and isolated from production origins and caches.

## Composition and commerce authority

The theme-neutral Composer resolves stable product and collection references against one canonical
ID-bearing Catalog Release and emits typed Presentation ViewModels. The fixture provider remains a
separate deterministic path and live rendering never falls back to it. Theme components consume
only ViewModels and emit identifier-only intents; runtime Commerce adapters revalidate mutable
availability, price, cart, checkout, and order facts before mutation.

Admin derives controls from the same manifest used for validation. It may persist bounded text,
enum, approved media, safe links, section presentation, and stable catalog references. It cannot
persist SKU, price, currency, inventory, tax, promotion, shipping, checkout, order, or Catalog-owned
policy content. Catalog Release discovery requires both `themes.preview` and `catalog.read`, is
environment-isolated, and exposes only deployed canonical releases. Approved Experience snapshots
remain immutable.

Production activation must compose an immutable experience snapshot with an immutable catalog
release, retain the current rollback guarantees, and prove the existing static, accessibility,
performance, security, and operational gates. Until that work is approved, no theme workflow may
change the production active theme.

## Verification ownership

- `apps/storefront/scripts/verify-themes.ts` validates the complete source matrix.
- `tools/generate-storefront-theme-catalog.ts --check` detects generated catalog drift.
- Per-theme Playwright and Lighthouse suites verify complete fixture routes, responsive behavior,
  no-JavaScript content, accessibility, and performance.
- Desktop and mobile home captures remain separate from source references. The fidelity report
  binds implementation evidence to its theme, initial state, viewport, and commit, and creates no
  approval record until a user explicitly accepts the comparison.
- `apps/storefront/scripts/check-bundle-budget.ts` enforces JavaScript and selected-theme output
  isolation, including the independent Fashion Store source-runtime allowance.
- `tools/release-validate.ts` runs the full matrix before rebuilding the unchanged production
  fallback and excludes preview material from release reports.
- `docs/runbooks/storefront-theme-promotion.md` defines the separate human promote/abandon
  decision and the rollback boundary for experimental themes.
