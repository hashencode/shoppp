# Admin Store Setup Guide Evidence

Execution authority: `docs/plans/2026-09-03-1445-feat-admin-store-setup-guide-plan.md`.
This document retains evidence only; it does not own unit status or execution order.

## Workspace and scope

- Implementation authorized on 2026-09-03; native serial implementation on the primary checkout, branch `codex/fashion-store-shared-styles`.
- Pre-existing work: dashboard/report UI and tests, Admin AI rules, translations, a dashboard i18n evidence file, and generated active experience. Preserve these changes. The plan and its master register row were authored in this task before implementation.
- Pre-existing local commit: `61eab54e` (Fashion Store shared style correction). It is not setup-guide delivery authority and is not authorized for publishing by this run.
- A private baseline preserves pre-work status/diff and the shared translation/master file bytes. No credentials were read or recorded.

## Verification scope

Admin L3: this feature changes authorized root navigation, shared menu consumers, cross-page return paths and the contracts/API boundary.

Consumer search: `fetchLaunchConfiguration`, `fetchOperationalHealth`, `LaunchConfigurationStatus`, `LaunchConfiguration` and platform service imports were searched under Admin/API/contracts. Existing launch readers are the settings page and API route; runtime configuration has separate cart/order/inventory readers whose shape and semantics remain unchanged. Platform exports flow through `packages/contracts/src/index.ts`.

Workspace manifests: Admin, API, storefront, db and domain depend on `@shoppp/contracts`. The new setup-guide contract is additive; old launch configuration types remain stable. Focused contract tests and package typecheck verify the export boundary. API checks cover the old launch endpoint plus the new summary. Admin consumers are the guide, settings, route guards, menu and return-navigation pages; audit/privacy service imports retain existing signatures. No storefront runtime behavior is changed.

Planned evidence: focused Workers tests, contract tests, Admin page/route tests, changed-file lint/format, API/contracts typechecks and one Admin build containing typecheck; targeted root and subpath browser journeys with explicit test sessions. Browser fixtures prove UI behavior, not real identity or production launch readiness.

## UI implementation constraints

The guide is a CustomPageRecipe workspace with summary, freely accessible step content, inline check feedback and permission-aware links. It has no filters or submit workflow. Commercial settings retain a single-save form with grouped content and readonly enforcement. No data-table action column is added. Return navigation is intentionally in the same tab to support the approved guide/settings journey. Standard Ant Design keyboard/focus semantics remain authoritative.

## API and contract verification

U1 introduced a fixed 13-check summary with no-store caching, one configuration context, permission-gated domain queries and isolated failures. The old launch response and checkout behavior retain their semantics. Public catalog price eligibility and available inventory SQL are shared with the new existence check.

Proof-first: the new endpoint test initially returned 404 instead of 200. Host verification after implementation: Workers setup-guide + platform-operations: 2 files / 12 tests passed; catalog consumer: 11 tests passed; contracts: 13 tests passed. Fixtures cover unsaved defaults, runtime credential truth, production issue categories, valid-country/wrong-method association, unpublished/inactive/unpriced/out-of-stock SKU, currency changes, missing permissions with no domain query, partial outage and unreadable configuration. Contract tests reject missing/duplicate checks and secret fields.

Contracts typecheck passed. A test binding type mismatch was found by API typecheck and repaired in the fixture; the final API typecheck passed. One initial root-wrapper test command failed to forward the file selector and was interrupted before test results; all retained results use explicit package working directories.

Backend simplification used the ce-simplify-code reuse, quality and efficiency personas. Applied one reuse finding (the existing permission predicate) and three bounded-query improvements: requested currencies/countries/methods only, and an existence query for oversell. No quality findings or skipped findings. Domain failure isolation and legacy issue outputs remain unchanged. The 12 setup/legacy Workers tests, API typecheck and scoped ESLint passed afterward. Contracts had no subsequent code changes.

## Guide and entry verification

Host Rstest verification: welcome-page, authorized-home, app-shell, auth-route-guards and locale index: 5 files / 48 tests passed. Evidence covers six destinations, fixed denominator including partial/unknown/restricted results, 500/403 retry, 401 session recovery, permission changes with late responses, authorized homepage fallback, and return navigation under an application basename. A history A→B→A test reproduced reuse of the old A result before the request identity changed from a string to a fresh dependency-bound reference; it passed after the fix.

Shared files were committed selectively: only guide translations, the menu replacement and its two tests (plus their required route import). Pre-existing breadcrumb rules/tests, dashboard/report work and later demo-mode strings remain working-tree work owned elsewhere.
