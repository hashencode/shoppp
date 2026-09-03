# Admin internationalization implementation evidence

Implementation authority: [ADM-I18N](../plans/2026-09-03-1553-fix-admin-i18n-completion-plan.md).
This file retains observations and verification receipts, not a current-unit queue or release verdict.

## Baseline and scope — 2026-09-03

- Baseline: `a1ba0125`, existing primary checkout on `codex/fashion-store-shared-styles`.
- Pre-existing unrelated modification: `apps/storefront/app/generated/active-experience.ts`; excluded from this work and any task commit.
- The new ADM-I18N plan and its master-register entry were authored in this conversation and offered for implementation by the user.
- Existing local commits beyond `origin/main` are not publication authority. No push, PR, deployment, candidate freeze or DC/PG transition is part of this run.
- Admin verification level: L3, because shared error normalization and cross-page display change. Focused suites and browser evidence follow the plan; one final Admin typecheck after stabilization.
- Knowledge search: `docs/solutions/` contains two workflow documents, with no direct i18n match; no `patterns/critical-patterns.md` exists. Retain observable behavior evidence and the separation between local verification and release authority.

## L3 consumer closure

Read-only inventory used `rg` for imports/re-exports and `ApiError`, `AdminOrderDetail`, `OrderTimelineEntry`, `adminOrderDetailSchema`, `orderTimelineEntrySchema`, and order-service methods across `apps`, `packages`, and `tools`.

- Root workspaces are `apps/*` and `packages/*`. Contracts exports `.` via `src/index.ts` and `./admin`; index re-exports admin. Admin, API, Storefront, domain and db depend on contracts, but only API order queries and Admin order services/detail consume the changed timeline type. No additional runtime parser for the timeline/detail response was found. Admin services use typed Axios responses, not schema parsing; the order-operation E2E fixture also imports the detail type.
- Admin uses relative imports (no app source path aliases in `tsconfig.app.json`). `api-client` has no competing re-export entry point. It feeds auth, catalog, IAM, inventory, orders, notifications, platform, reporting, shipping and storefront services, plus retired template services.
- `localizeApiError` / `useLocalizedApiError` feed dashboard, reports, order list/detail, fulfillment, inventory, audit, privacy, jobs, commercial settings, shipping settings and catalog list. Other direct normalizer consumers are IAM pages, catalog form, theme list/editor/pickers and password recovery. Shared form contracts/state gates consume `ApiError`; the response priority and unknown fallback must remain unchanged.
- Shared-error verification selection: `infrastructure/http/api-client.test.ts`, `shared/i18n/api-error.test.ts`; existing consumer suites for dashboard, report, order detail, IAM, inventory, jobs, catalog list/form, launch/shipping settings, password-reset pages, template API contract and form state gate. Order list/fulfillment/audit/privacy have no dedicated page suite; their unchanged generic error behavior is covered at the shared helper/interceptor boundary, with source inspection for branch parity. Theme surfaces receive new direct tests under the feature plan.
- Timeline projection boundary: API `orders/queries.ts` -> HTTP detail and fulfillment/refund/cancel response projection -> Admin `services/orders/api.ts` -> `pages/orders/order-detail.tsx`. U4 requires contract compatibility tests, Worker operations tests and Admin detail tests; U5 adds real-browser detail evidence. No database schema change is needed.
- Root `test` already runs `bun test tools`, so the scanner's real-source assertion participates in the existing CI path without a new workflow or gate.

Verification results will be appended only after observation. This inventory itself is not a passing-test claim.

## U1 — Coverage and dictionaries

- Behavior: symbol-aware TypeScript source scanning; finite AST catalogs for permissions, API errors, IAM labels and theme run/build labels; nonempty Chinese strings with matching placeholder sets. Jobs placeholder now translates without changing its request status.
- Pre-implementation evidence reported by the U1 worker: scanner missing-key/placeholder fixtures failed twice; the real-source assertion failed on missing messages; three new Admin checks failed for permission fallback, missing catalog translations and the untranslated status placeholder, while 18 existing tests passed.
- Added 77 different messages on this baseline: 27 theme literals, 47 permission messages, 3 preview labels. Current inventory: 131 production files, 930 message uses / 738 different keys, zero issues. 83 unresolved dynamic calls remain exposed, not claimed covered; no arbitrary API/user string is treated as a catalog.
- Host-authoritative verification: root `bun test tools/check-admin-i18n.test.ts` passed 8/8; Admin `bun run test src/shared/contexts/i18n-context.test.tsx src/pages/iam/iam-pages.test.tsx src/pages/operations/jobs/notification-jobs-page.test.tsx` passed 21/21. These assert permission read/write selection and language-switch preservation, plus the actual `failed` jobs query code and no extra language-triggered request.
- Root `bunx tsc --noEmit -p tsconfig.tools.json` and changed-tool ESLint/Prettier passed. Admin changed-file ESLint passed; formatting follows subtree conventions. No runtime dependency or CI workflow was added.

## U2 — UTC and application-locale dates

- Three production formatter sites changed: report uses `dayjs.utc` with the existing layout, invitation expiry uses `toLocaleDateString(locale)`, user update time uses `toLocaleString(locale)`. IAM timezone remains local. No query, permission or transaction production code changed.
- Worker red proof: `TZ=Asia/Shanghai bun run test src/pages/reports/order-report-page.test.tsx src/pages/iam/iam-pages.test.tsx` failed on five new cases and passed 13 existing cases before the fix.
- Host authoritative runs of the same two suites under both `TZ=Asia/Shanghai` and `TZ=UTC` passed 18/18 each. Midnight and next-local-day cases, both initial application languages, language-switch state/request preservation and exact query/export payloads are covered.
- Changed-file Admin ESLint and diff whitespace checks passed. Full Admin typecheck remains the planned final stable-code gate.
- Browser limitation: jsdom tests set the navigator language preference opposite the application language; native browser Intl locale/timezone evidence is reserved for U5, not inferred from this preference override.

## U1–U2 simplification receipt

Three read-only ce-simplify-code reviewers completed (reuse, quality, efficiency). No code changes applied. Reuse/efficiency found no worthwhile changes. One quality suggestion to remove the opposite navigator preference from the IAM fixture was skipped: retain the explicit fixture condition while recording that it is not native-browser locale evidence. No new shared date framework or test helper was introduced. Required focused checks passed; project-wide Admin lint/typecheck is not duplicated here under the repository's L3 proportional-verification rule.

## U3 — Theme feedback and editor preservation

- Red proof: the full editor's locale-switch regression observed two draft GETs instead of one before removing translation from the loading dependency. The fixed test preserves unsaved text, resource binding, selected Catalog Release and hydrated preview, then verifies the explicit save payload.
- Persistent feedback now retains transport errors or local message keys; renders and pending-operation toasts use the current language without replaying old toasts. Existing 409 keep/reload/successor paths, validation field targeting, preview and approval rules remain intact.
- Media/resource/link controls translate owned labels, search, loading, empty, error, recovery and pagination text while preserving resource names, URLs, target enum values and off-page selections. Query/page/selection survive locale changes without requests.
- Finite request error codes were traced to theme service/build/catalog-resource/preview and operator-approval sources. Timeout/404/5xx priority, status/details and repeated normalization identity are tested through the real interceptor. Callback-only error codes remain excluded. Successful validation/migration/preview payloads have separate finite diagnostic maps; unknown codes use safe explanations plus technical codes and locations, not server prose.
- Necessary type-only seam: the Admin migration conflict type now reflects the API's optional message and setting/operation location fields. No API endpoint or payload producer changed in this unit.
- Host authoritative direct run: seven suites (HTTP client, API error helper, theme feedback, three controls, full editor) passed **54/54**. Thirteen selected shared-consumer suites listed above passed **62/62**. Scanner passed **8/8 (32 assertions)**, including discovery of fallback/local-precondition/move-status keys. Root tools typecheck, changed-file ESLint/Prettier and diff whitespace checks passed.
- These are local behavior results, not browser evidence, release evidence or a full-Admin-suite claim.

## U4 — Domain timeline and compatible shipment projection

- Proof-first: contracts had 2 passing legacy/strictness cases and 4 expected failures for unrecognized shipment fields; Worker operations had 6 passing cases and 2 missing-field failures; Admin had 1 passing case and 2 expected failures for raw receipt text and the absent carrier column. The new helper initially failed module resolution. Scanner then reported 38 new missing messages before they were added.
- Projection adds optional nullable `carrier` / `trackingNumber` strings without trimming or minimum lengths. The API reuses already queried fields; legacy label construction, IDs, timestamps and sorting are unchanged. The history test follows existing database fulfillment transitions and proves exact null/empty/space/punctuation preservation plus repeat-read equality.
- Six domain catalogs translate only known dimension/event/result values. A payment event result cannot borrow notification terminology, and checkout-attempt audit actions are not classified as order audits. Prototype/unknown keys remain raw. Actor/reason and carrier/tracking values equal to dictionary keys remain untouched.
- New Admin uses structured shipment fields when present and retains old mixed labels verbatim when absent. Separate carrier/tracking cells preserve whitespace; the fixed-width timeline uses its existing local horizontal-scrolling pattern (1500px column sum). This is not a general claim that old strict parsers accept new properties.
- Consumer recheck found only the existing API query and Admin typed-JSON/detail boundary. The new contract accepts old responses; the current Admin service ignores additive JSON fields. Detail, fulfillment, refund and cancel return the same projection, verified by action-response schemas, fresh GET equality, and existing permission/idempotency tests.
- Host authoritative results: contracts **6/6**, API order operations **8/8**, Admin detail/message helper **11/11**, scanner **8/8 (40 assertions)**. Contracts, API and tools typechecks passed; changed-file ESLint/Prettier and diff whitespace checks passed. No database migration, deployment or transaction-production change.

## U3–U4 simplification receipt

Three read-only ce-simplify-code reviewers completed (reuse, quality, efficiency), scoped from `4b2ea98a` through the U4 working changes and new files. All returned no worthwhile exact-behavior findings: **0 applied, 0 skipped**. Finite domain maps, legacy/raw-data guards and separate error/translation state are deliberate. Existing parallel query fan-out and polling cleanup remain; the shipment projection adds no query. Scoped gates above stand unchanged; final Admin typecheck is not duplicated before the browser work stabilizes.
