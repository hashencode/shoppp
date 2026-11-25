# Storefront visual editor implementation evidence

Owner: [THEME-E1](../plans/2026-10-10-1950-refactor-shopify-style-storefront-editor-plan.md).
This document records evidence only; the owning plan holds execution status.

## Baseline and verification scope

- User authorized local implementation and verification on 2026-10-31; no deployment, commit,
  push, candidate freeze, DC or PG action is included.
- Canonical checkout: `/Users/studio/Documents/GitHub/shoppp`, existing feature branch
  `codex/fix-new-arrival-icon`. Native execution, sequential under repository AGENTS mapping.
- Existing tracked/untracked changes, index diff, source snapshots and hashes are retained at
  `/tmp/shoppp-theme-editor-20261031/`. Existing form, Drawer and picker changes are retained.
- L3 consumers: contracts → domain resolver → API draft/save/validation/snapshot → Vue
  composer/provider/renderer and Admin library/session/workspace. Entry/build integration requires
  representative browser proof and production-shaped local builds at closeout.
- Existing formal-publication implementation is inherited from the completed merchant workflow
  plan. Tests and actual consumers will be checked before recording reconciliation.
- Compound packs: no project configuration is present; no external execution engine is selected.

## Contracts, topology and first rendering evidence

- Introduced Fashion `1.3.0` / schema `4` without changing the `1.0.0`, `1.1.0` or `1.2.0`
  package payloads. Registry tests retain historical byte checks and extend the exhaustive reader
  matrix. Authoring metadata declares home-only section creation and per-type limits; six existing
  page types remain home, collection, product, cart, checkout and content. Commerce/system regions
  retain their required ownership. Styles use bounded colors, local fonts, spacing and button radius.
- Same-origin topology: an independent Nuxt/Vue editor bundle is packaged into Admin static assets.
  Admin Worker checks the current authoritative session before serving `/theme-editor/*`, including
  its assets. It sets private/no-store, self-only embedding and denies form submissions. Formal
  Preview worker policy is unchanged. No dependencies were upgraded; Admin declares its existing
  domain workspace dependency for shared document resolution.
- Added draft/actor/release-bound editor sessions with a ten-minute expiry. API test first observed
  missing endpoint `404`; after implementation, the scoped test passes for authorized context,
  cross-actor rejection and expiry. Each context read rechecks permissions and source lifecycle.
- Shared contract/domain/registry checks pass, including add/remove/independent section edits,
  required-region protection, typed styles, exact migration boundaries and old reader behavior.
  Session tests pass for unified undo/redo, save A/edit B acknowledgement, reopen and copy bindings.
- Built the real editor bundle and ran Chromium against the actual authenticated Worker entry and
  Vue components using explicit local source fixtures. The browser verifies text update, Hero Block
  selection, stale/wrong-session messages, Hero removal retaining the shared store header and zero
  Commerce requests. No browser page errors occurred. Ten warm text changes at 1440×1000 with
  reduced motion yielded p95 33.36ms; initial loading and downloads are excluded.
- Commands: `bun tools/build-storefront-editor.ts`, `bun tools/verify-storefront-editor.ts`,
  `bun test tools/admin-editor-entry.test.ts packages/contracts/test/storefront-editor.test.ts`,
  `bun run --cwd apps/admin test src/pages/storefront/theme-editor/editor-session.test.ts`, and the
  scoped experience API session test. Logs and pre-work source snapshots remain in
  `/tmp/shoppp-theme-editor-20261031/`. Temporary screenshots are under `.artifacts/screenshots/`.
- The above is the historical first-loop result. The subsequent checks below close the local
  workspace, lifecycle, migration and delivery-contract scope; they do not attest a deployment.

## Local closeout

- Reviewed base: `b3680807f62ea70e4416415691c028be2880eb54`, with the authorized changes in the
  existing dirty checkout. No commit, branch switch, push, PR, real store write or deployment
  was performed. Build commands used dry-run delivery only.
- Reviewed code digest: `4b3c2a066d617a970f8ecaa50725f2137009d39910e66872bf078d01efcf73af`.
  The review directory retains the per-file source manifest. Concurrent form/gallery/picker work
  was preserved; its shared control implementations are excluded from this editor review diff.
- The existing theme-editor URL now loads the visual workspace. The old page body and its
  superseded form tests are retired. Saved-document coverage moved to the editor session/workspace
  tests; the native-browser publication tests and their existing form changes are retained.
- The page coordinates the session, preview and source identity. A separate workspace inspector
  owns the right column; standard modal, tree, select and focus behavior stays with Ant Design.
- Fashion 1.3.0/schema 4 declares bounded section/block authoring, independent references, shared
  shell settings and real styles. Historical package payloads and readers remain registered.
  Old packages keep their previous asset-validation semantics and historical-only packages are
  inspected without granting activation/write eligibility.
- Section and Block markers are editor-only. Section-owned services, categories, brands, marquee,
  promotion and editorial cards carry their actual Block IDs; rendering keys use stable IDs.
  Non-home pages with multiple roots receive an editor-only region. The production renderer emits
  neither that wrapper nor selection markers.
- Migration 0040 adds names, tombstones and expiring actor/release-bound editor sessions. Existing
  cleanup removes expired editor sessions. Source-version conditions and database guards cover
  removal racing saves, successor/migration creation, validation, snapshots and builds.
  Active operator runs and Preview builds block removal. Mutable backlinks exclude tombstones;
  immutable history remains available.

## Requirement and acceptance evidence

| Contract | Evidence |
| --- | --- |
| R1 / AE7–AE8 | Library API CAS/copy/tombstone, active-build and save/approve-race tests; real Admin rename/copy/remove and guide-return flow. Navigation tombstone regression plus existing content/Logo owner suites. |
| R2 / AE12 | Actual Admin bundle at 1440, 768 and 320 pixels; canvas, inspector, toolbar selects and buttons checked within viewport, followed by screenshot inspection. |
| R3 / AE2, AE6 | One document for settings, references and structure; session tests and delayed save A/edit B, invalid input, 409, language and read-only workspace cases. Required capability removal is rejected before session mutation. |
| R4 / AE1 | Actual compiled Admin and Vue components perform selection, text/image editing, undo/redo, save and reopen. Invalid input retains the session and last accepted rendering. |
| R5 / AE3–AE4, AE12 | Browser duplicates a Products Section, removes it, undoes removal, saves and reopens it; clicks a Category Block; keyboard activates move and save controls. Domain/registry tests cover IDs, limits, bindings and required regions. Vue harness removes Hero while preserving shell identity. |
| R6 / AE5 | Browser verifies accent, actual heading font and Product section spacing, then persists and reopens styles. Shared shell no longer depends on Hero. Defaults remain style-free. |
| R7 / AE2 | Existing six-template matrix retained. Actual Home, Product, Cart and Checkout rendering tested; existing composer/source suites cover collection/content routes. Owner links preserve the local editor session in a separate tab. |
| R8 / AE10–AE11 | Existing validation, frozen Contact, exact Snapshot/Preview/approval/publication suites; new read-only approver restore/retry and late-validation tests. Native-browser publication tests preserve queued/failure recovery and do not infer online status from approval. |
| R9 / AE9 | Current permission checks on entry/assets and context; actor/expiry tests; origin/window/session/revision contract tests and browser wrong-nonce/old-revision rejection. Real canvas tests make zero Commerce requests. Formal Preview policy unchanged. |
| R10 / AE12 | Versioned 1.2.0-to-1.3.0 successor migration preserves authored content and original draft. Old exact 1.2.0 build lookup remains accepted; old editor links resolve through the compatibility entry. |

## Verification results

- Full Admin suite: **838 passed** (`rstest run --pool.maxWorkers 2`). The initial unrestricted
  full run had three timeouts and the changed draft-name expectation; the name assertion/history
  transport were updated, affected suites passed, then the bounded full run passed. Later review
  fixes passed the final **15 editor tests**, including historical eligibility and preview recovery.
- Full API suite: **405 passed, 1 skipped** across 54 files. The skip requires the existing
  `U9_EXACT_HANDSHAKE_URL`; it is not counted as a pass. The full run exposed the permission
  inventory and sandbox reset table drift, which were corrected. The final affected experience and
  reset suites passed **62 tests** after cleanup/lifecycle changes.
- Shared contract/domain/storefront/tool baseline: **504 passed**. After the final renderer and
  Block-marker changes, all storefront tests passed **389 tests**; focused contracts, domain,
  entry-auth and translation checks also passed. `verify:themes` passes against the generated
  1.3.0 descriptor. Tool, API, main Nuxt and standalone-editor type checks pass.
- Admin lint passes with the existing upload-form warning and four intentional generation-token
  cleanup warnings; scoped new shared code/probes lint without errors. `git diff --check` passes.
- `build:test` compiles the real standalone Vue bundle and Admin app. Admin Worker dry-run passes.
  The approved-public fixture compiles the real storefront, retains its saved text/font/styles,
  omits the removed Services Section and editor markers, and emits the exact Snapshot digest and
  theme-version release marker. This uses a local fixture approval, not a real business approval.
- Mode-sensitive generated/public source files were captured and restored exactly after public
  verification. Only the intended generated theme catalogs remain changed.
- `check:theme-impact --dry-run` classifies the shared changes as matrix-impacting. A broad matrix
  invocation was stopped and its generated inputs restored. This local closeout uses the
  target/template consumer suites and actual builds above; frozen-candidate cross-template
  regression remains DC3 under repository AGENTS.md.

## Browser and performance artifacts

- `tools/verify-storefront-editor-workspace.ts` runs the actual Admin Worker, Admin bundle and Vue
  bundle with explicit local transport fixtures. It covers text/image edits, keyboard move/save,
  Category selection, structural undo, persisted styles, Home/Product/Cart/Checkout, library
  lifecycle, guide return and viewport bounds. Latest run: zero unexpected API calls and zero page
  errors.
- Ten warm workspace text changes at 1440×1000 in headless Chromium on this ARM macOS host,
  reduced motion and already loaded local resources: **p95 124.21ms**, below the 300ms local target.
  First load, network downloads and formal builds are excluded. The isolated Vue bridge run
  measured p95 44.87ms and also produced zero Commerce requests/page errors.
- Screenshots: `.artifacts/screenshots/2026-10-31-storefront-visual-editor/workspace-1440.png`,
  `workspace-768.png`, `workspace-320.png`, and `actual-vue-preview.png`. These remain ignored.
- Reproducible probes: `tools/verify-storefront-editor-workspace.ts`,
  `tools/verify-storefront-editor.ts`, `tools/verify-storefront-editor-public.ts`.
  Logs and pre-work snapshots remain in `/tmp/shoppp-theme-editor-20261031/`.

## Review and authority handoff

- Applied ce-simplify-code to the authorized changes: reused domain normalization, canonical JSON
  and API error localization; separated the inspector; removed redundant session state aliases.
  Proof tests remain behaviorally intact.
- ce-code-review ran serially in the main thread per repository instructions. It covered
  correctness, scoped standards, testing, maintainability, security, performance, API contracts,
  additive migration, reliability and frontend races. No independent peer/model review is claimed.
  Receipt: `/tmp/compound-engineering-501/ce-code-review/20261031-222439-804521f4/review.json`.
- Review fixes include version-scoped asset bounds, actual font/spacing consumption, standalone
  composable imports, initialization/review recovery, session expiry cleanup, historical write
  eligibility, required-capability protection and stable Section/Block selection. No unresolved
  local implementation findings remain.
- THEME-E1 owns its completed local implementation. The master pointer returns to REL-Pre-DC for
  capability/identity reconciliation. No candidate is frozen and no DC/PG or remote release is
  implied by these local results.
