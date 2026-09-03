# Admin Dashboard cleanup and localization audit

## Scope and authority

2026-09-03 user request: simplify Dashboard period comparisons, move metric explanations next to
their values, remove redundant reporting summaries, record that UI convention, and audit Admin
localization quality. This is a bounded correction plus a read-only audit, not a successor plan or
a candidate-readiness decision. It does not change the active FS-F2 checkpoint, product order,
DC/PG status, or deployment authority. Pre-work HEAD: `8eaa6a7f`.

Existing storefront, generated-file, plan and runbook edits are excluded. No PR or deployment is
part of this work.

## Implemented behavior

The current behavior is summarized here; the same-day iteration notes below retain historical
evidence and are superseded by the final retirement note where they describe temporary previews.

- Dashboard compares current minus previous values using an up/down arrow and a localized absolute
  change. Up is green, down is red; following the user's refinement, unchanged has no comparison
  content. Color means numeric direction, not whether
  a refund increase is desirable. No division by zero or invented growth percentage.
- Metric questions use Ant Design Tooltip with hover and keyboard focus. Definitions are
  application-owned bilingual explanations checked against
  `apps/api/src/reporting/order-metrics.ts` and `revenue-metrics.ts`; raw API keys/prose are not UI copy.
- Gross sales is labeled “销售总额”, not “商品总额”: the implementation sums order totals. The
  explanation preserves cancellation/refund recognition, successful-refund timing, net-negative
  values, paid-order exclusions and average-order-value rounding.
- The duplicate Dashboard reporting-basis row and bottom definition card are removed. Currency,
  time zone and complete date-range selections query immediately and clear the previous result;
  failure does not leave old metrics under new filters, and retry is available.
- The same redundant reporting-basis alert is removed from the order revenue report. Its filter
  controls and export/security feedback remain.
- Dashboard uses the existing custom-page header recipe. Formatting uses the application locale;
  direction colors use theme tokens. No new ARIA/focus protocol or shared abstraction is introduced.

## Retained project convention

`apps/admin/docs/ai/ai-rules.md`, Design Baseline, now records the user's convention:
show information once at the nearest useful decision point; do not repeat visible filter values
in a card, alert or summary row. Put metric explanations beside the metric in localized tooltips.
Keep genuinely new information such as unapplied filters, failure, or data limitations.

### Same-day refinement: compact changes and shared breadcrumbs

- Nonzero deltas now show only an arrow and absolute, locale-formatted amount; unchanged has no
  comparison element, text or zero placeholder. The previous-period date range is available only
  in the amount's tooltip. Metric cards in the same row keep equal height without fake content.
- `AppShell` suppresses breadcrumbs for all standalone menu entries and paths with fewer than two
  labels. Grouped entries and detail hierarchy remain. React Router's ranked matcher resolves
  parameterized detail metadata; the non-mounted `*` fallback is excluded so it cannot label the
  welcome page as 404. Route metadata remains available to content recipes.
- The shared contract lives in `apps/admin/docs/ai/page-guardrail-recipes.md` §5.5, linked from
  `ai-rules.md` and `apps/admin/AGENTS.md`; no page-specific flags were added.
- Risk is now Admin L3 (shared shell). Reference closure: production router -> AppShell -> route
  metadata -> CustomPageRecipe. Focused tests cover all 12 registered standalone routes, empty/single
  breadcrumbs, grouped hierarchy, dynamic detail metadata and the welcome fallback boundary.
- Proof-first: compact-dashboard and hierarchy tests failed against the prior behavior. A separate
  welcome regression reproduced the fallback metadata issue before its fix. The test helper needed
  an index route to mount the home metadata probe; that fixture correction is not application logic.
- Final focused coverage: Dashboard 5, order report 2, shell 25, CustomPageRecipe 3, i18n context 6,
  Ant Design locale 1 (42 tests total). Typecheck and changed-code ESLint/Prettier checks passed.
- Authenticated Chrome verification supersedes the earlier login limitation: Dashboard has one
  content heading and no breadcrumb; the revenue-report page also has no redundant breadcrumb.
  Desktop and 390px-wide Dashboard views were inspected. At 390px the settled layout has document
  scrollWidth 390 and the displayed monetary values fit. Chinese question tooltip was exercised.
- Preview-only response in the user's existing local Dashboard tab: gross $1,250 (+$250), refunds
  $150 (-$50), net $1,100 (+$300), paid orders 10 (unchanged), AOV $125 (+$25). This replaced one local
  reporting XHR response via browser tooling. No backend rows, production fixtures or demo switch
  were created. Interception was cleared immediately; Apply/reload restores actual data. The
  displayed preview is intentionally left for the user to inspect.
- The dedicated-review collector limitation recorded below remains unchanged; no completed
  independent review is claimed. Manual scoped scanning caught and fixed the welcome fallback
  regression. Code review: skipped (ce-code-review unavailable) — the required terminal-outcome
  collector is not available in this harness. No commit, PR, deployment or plan-status change.

## Audit conclusion: not yet complete or high quality

### Preview delivery correction

Final retirement (user accepted the Dashboard polish): removed the development-only report
fixture, preview query branch, demo banner/action and their translations. The retired
`/dashboard?preview=metric-states` link now queries the real reporting API in both development and
production. Real-order drilldown is always available when a report is displayed. No demo records
were ever written to the database; normal test response fixtures remain as regression coverage.
All confirmed presentation changes, immediate filters, searchable currencies and default CNY remain.

Final verification: the development legacy-link regression failed before removal and passed
afterwards. Six focused suites passed, 49 tests total (Dashboard, order report, shared shell,
CustomPageRecipe, i18n context and route locale). Admin typecheck, changed-code ESLint and formatting
checks passed. Authenticated local Chrome displayed real zero-valued CNY metrics without demo
content and with the real-order drilldown. No product checkpoint, deployment or PR was changed.
The confirmed polish is being saved in a scoped local commit; unrelated storefront edits are excluded.

The following paragraphs are historical iteration evidence, not active preview instructions.

Currency-list follow-up: Dashboard now defaults to CNY and builds a deduplicated list from
`Intl.supportedValuesOf('currency')`, with CNY and frequently used codes first. The dropdown supports
case-insensitive code search. This supersedes the six-item list investigation below; it does not
enable those currencies for checkout or introduce FX conversion. Admin L2: nine Dashboard tests
passed, including initial CNY requests and immediate queries after lowercase TWD/CHF searches.
Authenticated Chrome confirmed initial CNY/¥ metric titles and an `hkd` search returning HKD; the
page was left on CNY. Typecheck, changed-file ESLint and whitespace checks passed.

Automatic-filter polish supersedes the Apply-based behavior recorded below. Currency, time zone
and complete date-range changes now query immediately; the Apply button and draft-change message
are removed. Empty ranges clear results and prompt for dates without a request. Each query effect
invalidates its predecessor so a late success/failure cannot replace the latest result or loading
state. Retry remains available. Admin L2: eight Dashboard tests passed (including automatic filter
queries, empty ranges, retry and out-of-order response), as did typecheck, changed-file ESLint and
diff whitespace checks. Chrome verified that selecting EUR updates all monetary titles to (€)
without an Apply action; the demo tab was then restored to USD.

Currency investigation (read-only): Dashboard hardcodes USD/EUR/GBP/CAD/AUD/JPY. It does not derive
these from shop configuration or recorded orders. `currencyCodeSchema` accepts three uppercase
letters, and reporting SQL filters orders/refunds by the supplied currency; it performs no FX
conversion. Checkout separately enforces `sellableCurrencies` in `apps/api/src/cart/service.ts`;
launch readiness requires an active price list for each configured sellable currency. Therefore
the six-item reporting dropdown is a frontend limitation, not evidence of a six-currency backend
limit or universal payment-provider support. No currency configuration or list was changed.

Date-range polish: the two native date fields are now one Ant Design RangePicker, with a localized
“日期范围” label and separately associated start/end input labels. It keeps ISO date-only query
values, updates draft filters only after a range selection, and queries only on Apply. Clearing
the range is rejected by the existing missing-date validation. Picker selection/ordering and
keyboard behavior remain library-owned. The shared currency formatter and other report pages are
unchanged. This is L2 scope: all seven Dashboard tests and changed-file ESLint passed; browser
verification showed the combined input and Chinese two-month calendar. App typecheck still fails
only in the concurrently edited catalog/settings/theme/setup-guide-return tests noted below.

Latest polish: currency symbols now appear only in each monetary metric's title (for example,
`销售总额 (US$)`), while the metric value is a locale-formatted number. Delta rows contain only
an up/down arrow and the absolute number, without currency or plus/minus signs; unchanged still
renders no delta row. Currency precision is retained (USD two digits, JPY zero). A genuinely
negative metric value retains its minus sign. Arrows have localized accessible names now that
their direction is no longer also conveyed by a signed number. Daily table cells are unchanged.
The ce-polish scope remains the user's live Dashboard feedback, with no general QA expansion.

Admin L2: seven Dashboard tests passed; changed-file ESLint and diff whitespace checks passed.
Authenticated Chrome confirmed the title `销售总额 (US$)`, value `1,250.00`, up `250.00`, down
`50.00`, and no change row for paid orders. App typecheck was blocked by unrelated concurrently
edited tests in catalog, launch settings, theme editor and setup-guide-return (`exact` option and
unsupported matcher typings); none of those files was changed by this polish. No commit or deploy.

The user could not see the one-response preview after reload. That delivery mechanism is superseded
by `/dashboard?preview=metric-states`, available only when `NODE_ENV` is `development`. The same
Dashboard components render a dynamically loaded synthetic report; a bilingual banner identifies
demo data and provides a return-to-real-data action. The real-order drilldown is hidden in demo
mode. Normal Dashboard requests and production behavior remain unchanged; no database writes occur.
This bounded follow-up leaves ADM-SETUP and all product checkpoints untouched.

Admin L2 verification: a proof-first preview test failed before implementation. All seven Dashboard
tests then passed, including remount persistence, no reporting API requests in preview, returning to
real data and ignoring the preview parameter in production. Typecheck and changed-file ESLint passed;
Prettier formatted the four changed code files. Authenticated Chrome opened the explicit URL in a
separate tab and navigated to it again: the demo notice and `+US$250.00`, `−US$50.00`, unchanged order
count remained visible. No one-shot interception remains necessary. Local changes remain uncommitted;
the previously recorded independent-review limitation is unchanged.

The table below records findings, not a second execution queue. Outside the implemented display
scope above these are diagnosed, **not fixed**. Sources refer to the inspected tree on this date.

| Area / route | Evidence | User-visible defect |
| --- | --- | --- |
| Theme editor `/storefront/themes/:draftId` | `apps/admin/src/pages/storefront/theme-editor-page.tsx`, conflict recovery around lines 959–1011; literal-call AST/dictionary comparison | 27 unique missing translation keys (28 call sites), including conflict recovery choices, resource binding and preview feedback. Missing keys silently fall back to English. |
| Theme resource controls | `catalog-media-picker.tsx`, `storefront-resource-picker.tsx`, `storefront-link-editor.tsx` under the same directory; mounted by the production editor | Search, loading/error/retry, empty states, pagination and accessible names contain hardcoded English. These are not demo-only components. |
| Roles `/access/roles` and `/access/roles/:id` | `apps/admin/src/pages/iam/permission-checklist.tsx:49`; `packages/contracts/src/admin.ts` permission catalog | Of 25 permissions, 24 labels and all 25 descriptions are absent from the Chinese dictionary: 49 missing dynamic keys. Categories are translated. |
| Order timeline `/orders/:reference` | `apps/admin/src/pages/orders/order-detail.tsx:252`; backend construction in `apps/api/src/orders/queries.ts` | `kind`, `label`, `status` are rendered raw, exposing values such as `refund`, `fulfillment`, `succeeded`, `shipped`. Business status needs localization; user reasons, carriers and tracking numbers must remain untouched. |
| Theme errors | `theme-editor-page.tsx` catch paths around 439/476/510/554/715, media/resource pickers | `normalizeApiError(...).message` bypasses the localized error helper, mixing API English with Chinese fallback and retaining old-language error strings. |
| Automation recovery `/operations/jobs` | `apps/admin/src/pages/operations/jobs/notification-jobs-page.tsx:182` | `placeholder="Status"` remains English although adjacent names/options are localized. |
| Revenue report `/reports/orders` | `apps/admin/src/pages/reports/order-report-page.tsx:81` | Column says `Created (UTC)` but formats in browser local time. Reproduction under `TZ=Asia/Shanghai`: `2026-09-03T00:00:00.000Z` becomes `2026-09-03 08:00`. This is a correctness issue, not merely word choice. |
| IAM dates | `apps/admin/src/pages/iam/users-page.tsx:205`, `user-detail-page.tsx:170` | `toLocaleDateString()` / `toLocaleString()` omit the application locale, so language selection can disagree with browser-language formatting. |

The base `AdminUiProvider` / Ant Design `ConfigProvider` locale connection exists and should be
preserved. Unmounted `pages/templates/**` examples and fixture data are not counted as production
page defects. IANA zones, ISO date-only values, currency codes, URLs, identifiers and user-authored
content are not inherently translation omissions.

## Why the existing checks missed this

`translateMessage` deliberately falls back to the source string. The existing i18n-context test
checks only a small list of workflow headings; it cannot detect all literal keys or dynamic
permission-catalog strings. Most business tests use `renderInLocale`'s English default, including
theme editor coverage. Dashboard's old test explicitly required five repeated period lines and
the reporting-basis summary and did not inspect Chinese definitions.

Future localization work should validate literal application messages and explicit dynamic
catalogs, plus Chinese interactions in existing page suites (normal, failure, empty/reference-loss
and conflict-recovery states). Check placeholder preservation and terminology, not just dictionary
presence. Test UTC-labeled values outside UTC and app-language changes against a different browser
language. Do not enforce a blanket “no English” test that corrupts technical identifiers or user data.

## Verification

- Admin `L2`: local Dashboard/report presentation changes; no permission, transport or reporting
  calculation contract changes. Consumers of the changed gross-sales labels are Dashboard and the
  order report, found by `rg` reference search. Selected focused suites also include i18n context.
- Proof-first Dashboard: four updated/new checks failed on the old repeated summary, missing
  help controls, missing changes and missing draft hint. After implementation, five checks passed,
  including failure/retry and empty-date validation. Additional arrow assertions check actual icons.
- Proof-first order report: the existing row test was strengthened to reject the repeated summary.
- Verification commands/results are recorded in the final completion note below.
- Code simplification: reuse and quality reviewed; a proposed removal of the existing request
  timer was rejected as outside behavior-preserving scope. One efficiency improvement reuses the
  locale number formatter for daily rows.
- Browser attempt at `http://127.0.0.1:3418/dashboard` redirected to `/login`. Authenticated
  desktop/narrow-screen visual verification was unavailable; no login bypass or session fabrication
  was used. Responsive layout remains structurally reviewed, not visually certified.

## Completion note

Final checks from `apps/admin`:

- `bun run test src/pages/dashboard/dashboard.test.tsx src/pages/reports/order-report-page.test.tsx src/shared/contexts/i18n-context.test.tsx`: 13/13 passed, 3 files.
- `bun run typecheck`: passed. The first pass caught unsupported matcher typings in the new
  tests; using the existing plain `textContent` assertion convention corrected them before the
  successful final pass.
- `bunx eslint src/pages/dashboard/dashboard-page.tsx src/pages/dashboard/dashboard.test.tsx src/pages/reports/order-report-page.tsx src/pages/reports/order-report-page.test.tsx src/shared/i18n/translations.ts`: passed.
- Prettier applied to changed code; scoped `git diff --check` passed.
- Baseline test warnings about jsdom pseudo-element styles and pre-existing report `Alert.message`
  deprecations remain outside this correction. They were also present in the proof-first run.
- Code review: skipped (ce-code-review unavailable). The selected review workflow requires a
  blocking collection primitive returning terminal reviewer results; the available agent wait
  primitive returns notification summaries instead. No completed dedicated-review receipt is
  claimed. A manual scoped diff scan and the three completed simplification passes were retained.

That initial pass remained local and uncommitted; the final retirement note above supersedes its
delivery state. No production UI verification or deployment was performed.
The audit findings above remain open; their presence does not imply a new product execution queue.
