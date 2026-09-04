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

Guide simplification ran all three ce-simplify-code personas. No reuse/quality findings; applied one efficiency finding by canceling superseded HTTP requests with AbortController while retaining the tested response-identity guard. The eight guide tests and scoped ESLint passed again. Admin static typing remains part of the final build gate.

## Settings and return verification

Host Rstest: launch-settings, setup-guide-return, catalog-list, catalog-form, theme-editor, standard-list-page-recipe, app-shell and shipping-settings: 8 files / 90 tests passed. This includes complete payload/reason saving with a failed health request, readonly forced-submit blocking, independent recovery, failed-save input retention, fixed return route allowlisting and basename, catalog form returns, and successor draft query preservation. The shared list callback is optional; existing default navigation continues through its original hook and shared recipe suite.

U3 simplification completed all three personas. Reused the canonical FormMode type (type-only change); no quality findings. Deferred the optional request-cancellation suggestion for the two settings reads: existing request counters already protect state, these loads do not poll or repeatedly overlap, and retry is exposed after failure. No permission or stale-result guard was removed. Final build verifies the type-only adjustment. Shared-file staging includes only the nine new guide-return/settings keys and AppShell's return component, leaving other concurrent translations and breadcrumb work untouched.

## Browser and final static verification

The retained Playwright suite uses explicit mock administrator sessions and API fixtures. Its save handler parses the existing update contract and verifies the reason and idempotency header. The desktop and mobile journeys change USD to EUR, save, return to a fresh 12/13 summary, and traverse browser back/forward. A failed operational-health request does not block the save. Other cases cover restricted fixed progress, readonly settings, unknown return markers, staff homepage fallback, revoked guide access and Chinese dark-mode collapse/expand. A settings link is activated with the keyboard. Document and content widths are checked for overflow.

- Root deployment: setup-guide and scaffold-smoke, 7/7 passed; the final English mobile readonly variant also passed independently.
- `/admin` deployment: the same 7/7 passed after final link-affordance styling. The configured web server ran `tsc -b` and the test build successfully before the suite.
- Desktop 1440×900, mobile 390×844, Chinese dark mobile and lower policy/manual-task screenshots were visually inspected. Links were underlined after the first inspection; final desktop and dark mobile screenshots were inspected again. Local images are retained under `/Users/studio/.codex/visualizations/2026/09/03/01a065f2-30e1-7f60-b4d5-cec6bd2d460a/` as `guide-desktop.png`, `guide-mobile.png`, `guide-mobile-zh-dark.png` and `guide-mobile-zh-dark-policies.png`.
- The first Admin build caught test-only typing errors: unsupported RTL role-query `exact` options and matchers absent from Rstest's types. Tests now use exact role names and equivalent native element properties. The four affected suites passed again: 4 files / 44 tests. The explicit Admin `build:test` then passed, including TypeScript.
- Changed-file Admin/API ESLint and Admin/backend Prettier checks passed. API and contracts typechecks passed; Admin typing is covered by the build. No broad cross-template or release acceptance run was used as feature evidence.

Local logs: `/tmp/shoppp-setup-root-browser.log`, `/tmp/shoppp-setup-mobile-restricted.log`, `/tmp/shoppp-setup-subpath-browser.log`, `/tmp/shoppp-setup-final-rtl.log` and `/tmp/shoppp-setup-build.log`. The Playwright Node harness reports its existing NO_COLOR/FORCE_COLOR conflict; this is not an application console failure. Task preview servers were stopped after verification. Nothing was deployed.

## Requirement closure

| Requirement | Implementation and evidence                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1          | Settings readers land on the guide; authorized-home/route/menu suites and browser staff fallback preserve other users' entry and deep links.                           |
| R2          | Six freely accessible steps with text status and permitted destinations; guide suite and desktop/mobile browser journeys.                                              |
| R3          | Existing commercial-settings URL, four anchored groups and full audited save; settings tests and browser save/return journey.                                          |
| R4          | Server-side saved configuration, authoritative SKU availability, shipping association and environment facts; Workers and contract fixtures.                            |
| R5          | Distinct passed/action/unavailable/restricted/loading states; isolated domain failures, denied access and retry fixtures.                                              |
| R6          | Contract-enforced fixed 13 checks; restricted and failed checks retain the denominator in API, page and browser coverage.                                              |
| R7          | Initial/return/manual reload, cancellation and response-identity guard; A→B→A regression, changed-currency return and history tests.                                   |
| R8          | Manual preview/policy/shopping-flow prompts remain separate; all-green fixture still displays manual verification. No completion record or launch operation was added. |
| R9          | Domain queries and links honor permissions, credentials are excluded, readonly forced submit is blocked; Workers, contracts, settings and browser permission cases.    |
| R10         | Page-local collapse with visible summary and reopen on issues/failure; page suite and Chinese mobile browser interactions.                                             |
| R11         | Existing page recipes, translated labels, responsive layout and Ant Design controls; locale/layout suites, visual inspection and independent health recovery.          |

F1–F3 and AE1–AE6 are represented by the default/return journeys, fresh-result and permission-failure tests above. No implementation question remains unresolved. The maintenance runbook records check limits, extension points, manual verification and deployment-owner recovery. These local results do not establish real-account, provider-connectivity, candidate or production readiness.

## Completed code review

`ce-code-review mode:agent` completed with `status: complete`, run ID `20260903-adm-setup`, artifact directory `/tmp/ce-code-review/20260903-adm-setup`. All 11 selected reviewers completed: correctness, security, project standards, testing, maintainability, API contract, SQL performance, reliability, adversarial, frontend races and learnings. Actionable findings: none; no fix batches or unresolved actionable residuals. All R1–R11 were assessed as met. The local adversarial reviewer substituted for an unavailable independent model route; no cross-model independence is claimed.

The review covered feature commits above base `61eab54e`, the final test-typing/link-style working changes, and the new E2E/runbook files. It excluded concurrent dashboard/report/breadcrumb/AI-rule/generated-experience changes. A non-blocking coverage observation remains: the legacy launch endpoint does not have a separate populated active/inactive fixture for every extracted aggregate; its endpoint baseline and the new endpoint's detailed extracted-check fixtures passed, and review found no changed legacy semantics. This observation did not produce an actionable finding or require another broad test run.

Final document references resolve and `git diff --check` passed. Delivery uses local commits on the existing primary branch; no push, PR, deployment, or candidate/production gate advancement is part of this work.

## 2026-09-04 guide controls correction

The running local Admin at `http://127.0.0.1:3418/welcome` reproduced the reported full-guide failure. A Cloudflare tail captured the authenticated request reaching `shoppp-api-fashion-staging` and returning HTTP 404 for `GET /admin/settings/setup-guide` (request ID `a3132c91-69f3-44ad-845b-db501408f3c6`, Worker version `72ce049c-443f-419c-8b02-76f8d053240f`). The same endpoint rejects unauthenticated requests at the shared authentication middleware, so an unauthenticated 401 did not prove that the route existed. The causal chain is a locally current Admin bundle calling a route absent from the deployed fashion-staging API version; the Admin then correctly clears prior results and renders the whole-request failure state. Individual configuration/domain failures remain isolated check results.

The user-directed UI correction removes the dashboard shortcut and whole-guide collapse control. Every permitted destination now uses an Ant Design default Button-styled anchor while retaining its exact href and basename behavior. Focused page coverage was changed first and failed on the old dashboard link before implementation; it then passed with all eight guide tests. The existing browser suite asserts the absence of both removed controls and the default button class on guide destinations.

The first corrected browser run exposed horizontal overflow from long default-button labels at 390 px. Guide actions now keep the default Ant Design button treatment while allowing text to wrap within the available width. The final targeted browser run rebuilt Admin with TypeScript and passed all 6 setup-guide cases: desktop/mobile save-and-return, mobile readonly permissions, staff fallback, revoked access and Chinese dark mode. The final mobile screenshot was inspected; no whole-guide control or dashboard shortcut remained, button actions were visually present, and the width assertions passed. Scoped ESLint, Prettier and `git diff --check` passed.

The scoped ce-simplify-code pass found no reuse or efficiency issues. Its quality pass found one stale test name that counted steps as destinations; the name was corrected to describe all guide destinations without a false count. A final targeted manual review was used because the active branch contains unrelated storefront work; no production-code issue or residual finding remained.

## 2026-09-04 statistic and deployment correction

The user replaced the category-count summary with one Ant Design Statistic. It displays the passed count over the fixed 13-check denominator; needs-action, unavailable and restricted states remain visible on their individual checks and no longer receive separate totals at the top. Guide destination anchors use the default Button size without a custom height. The longest English action was shortened to “Inventory settings” so the unmodified 32 px Button remains inside the mobile content width.

Proof-first page expectations failed against the former paragraph summary. After implementation, the focused WelcomePage suite passed 8/8. The first browser run correctly detected that the old long action label overflowed at 390 px after removing the custom auto-height rule. After shortening that action label, the final setup-guide browser run rebuilt Admin with TypeScript and passed 6/6, including desktop/mobile, restricted access, revoked access and Chinese dark mode; scoped Prettier, ESLint and `git diff --check` also passed.

The API deployment uses temporary worktree `/tmp/shoppp-fashion-api-deploy-1313552b`, detached at committed ref `1313552b`. This task owns the worktree solely to build and deploy the committed setup-guide API to `shoppp-api-fashion-staging` without the primary checkout's unrelated API authentication or Storefront work. Cleanup becomes due after the deploy command completes and the live Worker route/version is verified; removing it does not change plan or release status.

From that clean ref, the two focused Workers suites passed 12/12, API TypeScript passed, and `wrangler deploy --dry-run --env fashion-staging` packaged the expected Fashion bindings. The user-authorized deployment then uploaded `shoppp-api-fashion-staging` successfully as Worker version `a1f5591a-30f3-4cde-99b0-e6d0f554f9f3`. Wrangler repeated pre-existing warnings that several top-level workflow, queue, R2 and Analytics bindings are not inherited by this specialized environment; the declared Fashion D1, media, preview-artifact, email, rate-limit and notification-workflow bindings resolved and the setup-guide bundle deployed.

Live verification used the existing authenticated Admin session at `http://127.0.0.1:3418/welcome`. “重新检查” changed the former whole-request 404 state into a current `8/13` Statistic with `staging`, USD configuration context and individual passed/needs-action results. This proves the deployed route is available behind the shared authentication middleware and resolves the reported version mismatch. The exact pre-cleanup path manifests and removal command are retained in `docs/progress/admin-store-setup-guide-deploy-worktree-manifest.txt`.

The scoped code review completed under run `20260904-adm-setup-statistic` at `/tmp/ce-code-review/20260904-adm-setup-statistic`. Correctness, project-standards and local adversarial reviewers found no actionable defect; the testing reviewer and independent validator found one P1 test synchronization defect: the Statistic title exists while its value is still loading, so it was not a valid boundary before replacing the API handler. The test now waits for the actual `13/13` content, re-queries the enabled Recheck control and confirms that the second request fired. The 500 and 403 cases each passed in isolation, and the complete page suite passed 8/8 afterward. The cross-model adversarial route did not run because no attested different-family command was installed; the local fallback completed. No actionable review residual remains.

### 2026-09-04 summary wording, step folding and list correction

The Statistic title now labels the value as passed check items rather than presenting a success conclusion, so a partial value such as `8/13` cannot be read as all checks passing. Environment, check time, default currency and configuration-save time were removed from the page summary. Each step derives its initial expanded state from its own checks: steps with any non-passed result open automatically, while fully passed steps remain collapsed and can still be opened manually. Check items retain native `ul`/`li` semantics and now show disc markers.

The focused WelcomePage suite passed 8/8. It verifies all-passed steps are collapsed, affected steps open for partial results, passed steps stay collapsed, metadata is absent and the unordered list styling is present. The browser suite rebuilt Admin with TypeScript and passed 6/6 across desktop, mobile, permissions and dark-mode flows; the final focused mobile case also passed with explicit browser assertions that passed steps are collapsed and restricted steps are expanded.
