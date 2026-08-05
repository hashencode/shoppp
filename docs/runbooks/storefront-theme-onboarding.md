# Storefront Theme Onboarding

## Preconditions

Use internal, reviewed source only. Before copying any upstream asset, record its source revision,
license, owner approval, digest, dimensions, and alternative text in
`tools/storefront-theme-source-manifest.json`, then import it with
`tools/import-storefront-theme.ts`. Never copy vendor JavaScript, generated output, secrets, demo
forms, unrelated pages, or an entire upstream tree.

## Package a theme

For a port from an existing HTML template, first follow the
[source-equivalent porting workflow](./source-equivalent-html-template-port.md). Create an
intake-only package with `bun run scaffold:source-equivalent-theme -- ...`; do not register it until
its source contract, assets, responsive/interaction matrices, tests, and policy entry are complete.

1. Add `apps/storefront/app/themes/<theme-id>/manifest.ts`, one or more presets, namespaced
   components, a registry, tokens, and `UPSTREAM.md`.
2. Use a stable lowercase theme ID and semantic `themeVersion`. Declare the platform compatibility
   range and an independently incremented `configurationSchemaVersion`.
3. Keep shared capabilities in `core.*`. Prefix purpose-built component types with `<theme-id>.`.
   Do not add arbitrary HTML, CSS, script, recursion, or remote module inputs.
4. Supply exactly one home, collection, product, cart, checkout, order, and policy template in each
   initial preset. Required visible instances must provide every declared capability.
5. Add the static manifest import to the source allowlist in
   `tools/generate-storefront-theme-catalog.ts`, add its descriptor to the generated catalog
   source, and add its package entry and migration chain to `verify-themes.ts`.
6. Add one fixed registry import to the internal module allowlist in `prepare-experience.ts`. The
   renderer itself must not change for a normal theme.
7. Add a fixture snapshot builder and per-theme Playwright configuration. Reuse the shared fixture
   ViewModels and intent Actions; do not connect a business API.

## Validate

Run:

```sh
bun run verify:source-equivalence
bun run verify:themes
bun run --cwd apps/storefront test
bun run --cwd apps/storefront test:<theme-id>
STOREFRONT_THEME=<theme-id> bun run --cwd apps/storefront test:perf
```

The source-equivalence command validates canonical thresholds, resource limits, source-contract
facets, explicit waivers, and visual-harness self-tests. Theme verification then detects catalog
drift, duplicate IDs, bad versions or provenance, unsupported
platform ranges, invalid schemas and capabilities, missing routes, and migration gaps. The theme
and performance suites prove static content, responsive layouts, no-JavaScript behavior,
accessibility, selected-theme bundle isolation, and mobile Lighthouse budgets.

A minimal internal theme may use only registered `core.*` Sections with one complete preset. The
matrix test demonstrates that such a third fixture validates without modifying the renderer.

## Upgrade an existing package

Keep the theme ID stable and increment `themeVersion`. Increment
`configurationSchemaVersion` only when stored configuration changes, and add one pure migration
for every adjacent version. Run the operator dry run, resolve stable-instance conflicts, and
approve explicitly. Never mutate a prior package, preset, or approved snapshot in place.

## Handoff

Attach provenance, matrix results, visual acceptance evidence, bundle output, and the immutable
preview snapshot ID to review. Approval makes the package available for private fixtures only; it
does not switch the production storefront.
