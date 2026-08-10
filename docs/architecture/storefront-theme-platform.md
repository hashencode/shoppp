# Storefront Theme Platform

## Authority and boundaries

The platform is a constrained presentation system. A theme package owns versioned tokens,
namespaced Vue components, schemas, presets, and provenance. The core renderer owns the bounded
Template → Section → Block composition model. Fixtures own preview data. None of those layers owns
catalog, price, inventory, cart, checkout, order, payment, analytics, authorization, or compliance
behavior.

The current Nuxt storefront remains the production default. An approved experience snapshot is a
reproducible presentation release, not a production activation. Connecting one to live commerce
requires a separate activation plan that proves adapters and compatibility with the catalog release
protocol.

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

`prepare-experience.ts` accepts either the production fallback or one validated immutable preview
snapshot. It generates a fixed static import from an internal theme allowlist before Nuxt
compilation. Caller-supplied file paths, package names, remote modules, and executable source are
not inputs.

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
snapshots/<snapshot-id>/<sha256>
```

The build machine fetches an exact snapshot with its dedicated bearer credential and reports the
exact build attempt through an authenticated, idempotent callback. The preview Worker never lists
the bucket. It serves only the artifact prefix returned by the authorization service.

An operator receives a short-lived opaque grant from Admin. Admin submits it in a new-tab `POST`;
the credential is never put in a URL. The Worker exchanges it for a host-only `Secure`,
`HttpOnly`, `SameSite=Strict` cookie. Preview responses are private/no-store, non-indexable,
referrer-suppressed, analytics-free, and isolated from production origins and caches.

## Future commerce adapter seam

Theme components consume fixture-backed ViewModels and emit intent-level Actions. Future adapters
may translate stable business DTOs into those ViewModels and Actions, but must live outside theme
packages. They must preserve server authority for price, inventory, tax, checkout, payment, order,
analytics, permissions, and legal rules.

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
