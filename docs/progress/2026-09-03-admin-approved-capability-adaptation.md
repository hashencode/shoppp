# Shoppp Admin approved capability adaptation evidence

Date: 2026-09-03. Execution authority: [approved plan](../plans/2026-09-02-1310-refactor-admin-approved-capability-adaptation-plan.md). This evidence contains no current-unit queue or product readiness decision.

## Frozen identities and scope

- Destination HEAD: `55b2608c51ada6c00a2cf5e3365fe4b40460fb5e`, `main`, existing `/Users/studio/Documents/GitHub/shoppp` checkout. Initial dirty state: only the authorized plan was untracked. No branch/worktree/index/commit/push/PR/history operation.
- Source: `/Users/studio/Documents/GitHub/codex-admin-quick-start`, exact commit `5b732ffd17fac02cd10088ba0a1b5ff456e819a7`; inspected with `git show`, including Card heading withdrawal. Source worktree is not completion authority and was not modified.
- Baseline is unchanged, so no new full audit. Root workspaces and Admin package metadata confirm `@shoppp/contracts` dependency; no contracts changes, no package validation required. No API/storefront/master-pointer changes.
- Product authority remains master `REL-Pre-DC`; this work makes no DC/PG/candidate-readiness assertion.

## Behavioral evidence by unit

| Unit / row         | Adaptation and existing tests                                                                                                                                                                                                                                                     | Added evidence / red observation                                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SA-U1 / SHOP-QS-01 | Existing pagination hook, StandardList/ModalList recipes and Catalog; default all-data behavior preserved. Catalog closes all-data and caps pageSize=100.                                                                                                                         | 3 new regressions failed before implementation (disabled/default options, custom99999 re-entry, Catalog dropdown). Focused 5 suites/29 passed; real Select→recipe→API→MSW observes 10 then100.                                                                                                 |
| SA-U2 / SHOP-QS-02 | Docs now direct ordinary row danger through ListRowActions.confirm. Existing primitive already supports confirm. IAM/recent-auth/operation-ID/conflict/release Modal flow retained.                                                                                               | L0 document and static consumer review; no redundant behavior tests added. IAM existing suites and browser confirmation verify composed behavior under new provider.                                                                                                                           |
| SA-U3 / SHOP-QS-03 | Primitive owns option state; TemplateListFilterForm production file is no-op. Existing12 primitive +9 filter tests inspected. Retains i18n, stale isolation, remote paging/retry and actual controlled value.                                                                     | Added10 source behavior cases,4 local control/mode cases,1 Ant Form integration case. Observed9+2+1 expected red failures; 2 suites/36 passed. Explicit value=undefined remains controlled.                                                                                                    |
| SA-U4 / SHOP-QS-04 | Existing scroll helper and StepForm consumer; shared BasicCrud scroll options unchanged. Array errorFields classifier, null-safe rethrow; StepForm consumes only validation rejection.                                                                                            | Existing helper tests extended, new real StepForm/Ant Form integration. Red: validation rejected out of workflow and null/undefined replaced by TypeError. Focused2 suites/19 passed, including nonvalidation identity and submitting reset.                                                   |
| SA-U6 / C-S-01     | Root ConfigProvider extracted as AdminUiProvider for tests; single Ant App. 28 message consumers and2 static IAM confirms use App context; provider preferences announced after commit. ThemeProvider state/storage already equivalent: no-op.                                    | Provider test fails without App (message.success unavailable), then passes for zh/en and portal cleanup. Existing shell language tests now assert one translated message. Browser tests validate dark notice color, language, cleanup, IAM cancel/no-write then confirm, and401 page feedback. |
| SA-U7 / C-S-02     | No time-range consumer: analysis fixed seven-day date display; basic month-start/end dates serialize unchanged ISO; advanced effective dates separate from taskTime; generic filter has no showTime instance.                                                                     | L0 no-op. Source minute truncation would lose local end-of-day seconds/milliseconds. No idle helper or90/365day cap added. Source invalid/equal/span/minute tests are not claimed as local passes.                                                                                             |
| SA-U8 / C-S-04     | Existing API tests and download tests inspected. Preserve local code parser, nested envelope, timeout/404/5xx priority, details/status; add cause and same-object return. TableQuery explicitly retains its generic5xx presentation instead of relying on repeated normalization. | Real AxiosError→normalize→download transport fallback replaces fabricated ApiError. Business/HTTP errors never fallback; repeated normalize keeps identity/message/details/cause;401 remains request-owned. Focused API/download23 passed.                                                     |
| SA-U5              | Local provenance records only these seven approved rows and exact source SHA.                                                                                                                                                                                                     | Documentation closeout only; no source-wide equivalence claim.                                                                                                                                                                                                                                 |

## Consumer closure

- Pagination: hook → StandardList/ModalList recipes → list barrel/spec → Catalog/TableQuery; analysis directly uses hook.
- Selection: RemoteSearchSelect → TemplateListFilterForm → same recipes; no current business remote-select configuration. Primitive file expansion is necessary implementation ownership, not new business scope.
- Validation: form barrel → StepFormPage; FORM_ERROR_SCROLL_OPTIONS also → BasicCrudFormRecipe, unchanged.
- Errors: apiClient response interceptor → local services/pages and download helper; local codes/contracts/parser retained. AuthProvider handles session/login/cleanup; API client has no static feedback to inject/clean up, so no new singleton or duplicate401 toast.
- Feedback: following28 production modules now consume the sole root App; related existing tests either use renderInLocale or the isolated render-with-app fixture.

- `src/pages/audit/audit-page.tsx`
- `src/pages/catalog/catalog-form-page.tsx`
- `src/pages/catalog/catalog-list-page.tsx`
- `src/pages/dashboard/dashboard-page.tsx`
- `src/pages/fulfillment/fulfillment-page.tsx`
- `src/pages/iam/role-detail-page.tsx`
- `src/pages/iam/roles-page.tsx`
- `src/pages/iam/user-detail-page.tsx`
- `src/pages/iam/users-page.tsx`
- `src/pages/inventory/inventory-page.tsx`
- `src/pages/operations/jobs/notification-jobs-page.tsx`
- `src/pages/orders/order-detail.tsx`
- `src/pages/orders/order-list-page.tsx`
- `src/pages/privacy/privacy-page.tsx`
- `src/pages/reports/order-report-page.tsx`
- `src/pages/settings/launch-settings-page.tsx`
- `src/pages/settings/shipping-settings-page.tsx`
- `src/pages/storefront/theme-editor-page.tsx`
- `src/pages/storefront/themes-page.tsx`
- `src/pages/templates/form/advanced-form-page.tsx`
- `src/pages/templates/form/basic-form-page.tsx`
- `src/pages/templates/list/table-query-page.tsx`
- `src/shared/components/file-preview.tsx`
- `src/shared/components/list-search-settings-dropdown.tsx`
- `src/shared/components/upload-form-item.tsx`
- `src/shared/layout/app-shell.tsx`
- `src/shared/template-kit/hooks/use-batch-status-action.ts`
- `src/shared/template-kit/list/use-template-list-controller.ts`

## Verification policy and artifacts

Selected L4 because the approved batch changes the root feedback provider across Admin. Focused red/green during implementation; final complete Admin test plus build:test (includes tsc -b), changed-file ESLint/Prettier, and focused real Browser Mode. No standalone typecheck or redundant focused runs after the final full pass. No contracts/server/monorepo release gates or production mutations.

The initial full test run passed339/341. One TableQuery message regression was fixed in its adapter. One existing ThemeEditor heavy test timed out during concurrent build; worker concurrency was limited to2; the heavy test still timed out. Its isolated original test passed, establishing a near-timeout query cost rather than a failed media contract. The same assertions now use control labels/image alt text instead of repeatedly calculating every document role; the existing timeout stays20s. Original isolated runtime was21.36s total; optimized was10.78s total (both pass). Button roles and group semantics remain tested. Initial build found two new test-generic typing errors, corrected before final build. Browser development failures were fixture selectors (hidden duplicate dropdown content and Ant6 notice class); the final assertions cover real rendered background and interactions.

Final authoritative results:

| Command / check                                                                       | Result                                                                                                                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run --cwd apps/admin test --pool.maxWorkers 2`                                   | 64 files,341 passed,0 skipped;52.715s total                                                                                            |
| `bun run --cwd apps/admin build:test`                                                 | exit0; tsc-b and test build, final1906.6kB /608.0kB gzip                                                                               |
| `bun run --cwd apps/admin test:browser src/routes/antd-app-feedback.browser.test.tsx` | 2 passed;3.461s total                                                                                                                  |
| `bunx eslint <changed Admin ts/tsx files>` from apps/admin                            | exit0, no warnings/errors                                                                                                              |
| `bunx prettier --check <changed Admin files>` from apps/admin                         | exit0; root ignore excludes Admin, so Admin checks deliberately run in its own cwd                                                     |
| `git diff --check` and bounded path/HEAD/branch review                                | clean; main and original HEAD preserved                                                                                                |
| Built-candidate Playwright smoke on owned43871                                        | root resolves to authorized Catalog; one App, dark theme, page errors=[]; screenshots1440×900/390×844 inspected; owned preview stopped |

Unit focused commands included pagination/Catalog/recipe/TableQuery tests, remote-search-select+filter tests, form-validation-scroll+StepForm tests, and api-client+download tests. SA-U1's exploratory command also named a nonexistent analysis test; the actual result is five suites, not six. Final full-suite totals above exclude Browser Mode by configuration; the2 browser tests are additional.

Screenshots are local synthetic-fixture artifacts `/tmp/shoppp-admin-desktop.png` and `/tmp/shoppp-admin-mobile.png`, not release evidence. The browser module itself is the durable executable regression. No production network writes or other-project service ownership was taken.

## Deliberate exclusions

- C-S-03 Card heading rejected. No Card heading capability adopted; any line wrapping of existing Card JSX is formatting only.
- C-S-05 stable upload remains deferred. UploadFormItem only changes feedback ownership, not upload transport, concurrency, URL or business behavior.
- C-S-02 no-op preserves pure date and serialization contracts; no time-range implementation claimed.
- HttpOnly session, IAM first authorized entry, permissions, recent-auth, operation IDs and brand retained.
- Browser fixtures use an explicit synthetic principal and Axios adapter. No credentials, real login, database mutation or production evidence claimed.

## Return-to-caller receipt (initial implementation delivery)

- status: complete
- plan_path: `/Users/studio/Documents/GitHub/shoppp/docs/plans/2026-09-02-1310-refactor-admin-approved-capability-adaptation-plan.md`
- u_ids_attempted / u_ids_completed: SA-U1, SA-U2, SA-U3, SA-U4, SA-U5, SA-U6, SA-U7, SA-U8 (SA-U7 disposition=no-op)
- verification_results / verification_evidence: tables above; behavior changed in SA-U1/U3/U4/U6/U8; SA-U2/U5 docs-only; SA-U7 deliberate semantic no-op.
- implementation_engine_binding: null
- requested_route / actual_route: native Codex desktop; bounded native subagents for SA-U1/U3/U4/U7, inline for other units
- requested_model: null; actual_model: unverified (no separate serving receipt)
- fallback_reason: null for implementation; Phase2 simplify rubrics evaluated inline after agent task limit, no further abstraction changes
- run_id: null; source_kind: plan; source_digest: null (native run, no external controller digest)
- unit_receipts: native workers' source/red/green evidence integrated and inspected; all unit outputs remain local uncommitted; no detached external processes; no canonical commit; no worktree cleanup needed; owned preview stopped
- plan_checkpoint: null (no checkpoint commit authorized; plan's Execution checkpoint is updated in this diff)
- blockers: []
- recovery_path: null
- settled_decision_conflicts: []
- behavior_change: true
- standalone_shipping_skipped: true

## Changed-file manifest

All paths below are repository-relative. The implementation diff includes required formatting of touched Admin files; semantic review used the same bounded files. No production files outside apps/admin changed.

- `apps/admin/docs/ai/ai-rules.md`
- `apps/admin/docs/ai/component-catalog.yaml`
- `apps/admin/docs/ai/list-action-guidelines.md`
- `apps/admin/docs/ai/shared-capability-sync.md`
- `apps/admin/src/infrastructure/http/api-client.test.ts`
- `apps/admin/src/infrastructure/http/api-client.ts`
- `apps/admin/src/pages/audit/audit-page.tsx`
- `apps/admin/src/pages/catalog/catalog-form-page.tsx`
- `apps/admin/src/pages/catalog/catalog-list-page.test.tsx`
- `apps/admin/src/pages/catalog/catalog-list-page.tsx`
- `apps/admin/src/pages/dashboard/dashboard-page.tsx`
- `apps/admin/src/pages/fulfillment/fulfillment-page.tsx`
- `apps/admin/src/pages/iam/role-detail-page.tsx`
- `apps/admin/src/pages/iam/roles-page.tsx`
- `apps/admin/src/pages/iam/user-detail-page.tsx`
- `apps/admin/src/pages/iam/users-page.tsx`
- `apps/admin/src/pages/inventory/inventory-page.tsx`
- `apps/admin/src/pages/operations/jobs/notification-jobs-page.tsx`
- `apps/admin/src/pages/orders/order-detail.tsx`
- `apps/admin/src/pages/orders/order-list-page.tsx`
- `apps/admin/src/pages/privacy/privacy-page.tsx`
- `apps/admin/src/pages/reports/order-report-page.tsx`
- `apps/admin/src/pages/settings/launch-settings-page.tsx`
- `apps/admin/src/pages/settings/shipping-settings-page.tsx`
- `apps/admin/src/pages/storefront/theme-editor-page.test.tsx`
- `apps/admin/src/pages/storefront/theme-editor-page.tsx`
- `apps/admin/src/pages/storefront/themes-page.tsx`
- `apps/admin/src/pages/templates/form/advanced-form-page.tsx`
- `apps/admin/src/pages/templates/form/basic-form-page.test.tsx`
- `apps/admin/src/pages/templates/form/basic-form-page.tsx`
- `apps/admin/src/pages/templates/form/step-form-page.test.tsx`
- `apps/admin/src/pages/templates/form/step-form-page.tsx`
- `apps/admin/src/pages/templates/list/table-query-page.test.tsx`
- `apps/admin/src/pages/templates/list/table-query-page.tsx`
- `apps/admin/src/routes/admin-ui-provider.test.tsx`
- `apps/admin/src/routes/admin-ui-provider.tsx`
- `apps/admin/src/routes/antd-app-feedback.browser.test.tsx`
- `apps/admin/src/routes/index.tsx`
- `apps/admin/src/shared/components/file-preview-video-load-error.test.tsx`
- `apps/admin/src/shared/components/file-preview.browser.test.tsx`
- `apps/admin/src/shared/components/file-preview.test.tsx`
- `apps/admin/src/shared/components/file-preview.tsx`
- `apps/admin/src/shared/components/list-search-settings-dropdown.tsx`
- `apps/admin/src/shared/components/remote-search-select.test.tsx`
- `apps/admin/src/shared/components/remote-search-select.tsx`
- `apps/admin/src/shared/components/upload-form-item.browser.test.tsx`
- `apps/admin/src/shared/components/upload-form-item.test.tsx`
- `apps/admin/src/shared/components/upload-form-item.tsx`
- `apps/admin/src/shared/hooks/use-standard-pagination.test.ts`
- `apps/admin/src/shared/hooks/use-standard-pagination.ts`
- `apps/admin/src/shared/layout/app-shell.test.tsx`
- `apps/admin/src/shared/layout/app-shell.tsx`
- `apps/admin/src/shared/template-kit/form/form-validation-scroll.test.ts`
- `apps/admin/src/shared/template-kit/form/form-validation-scroll.ts`
- `apps/admin/src/shared/template-kit/form/index.ts`
- `apps/admin/src/shared/template-kit/hooks/use-batch-status-action.ts`
- `apps/admin/src/shared/template-kit/list/template-list-filter-form.test.tsx`
- `apps/admin/src/shared/template-kit/list/use-template-list-controller.loop.test.tsx`
- `apps/admin/src/shared/template-kit/list/use-template-list-controller.test.tsx`
- `apps/admin/src/shared/template-kit/list/use-template-list-controller.ts`
- `apps/admin/src/shared/template-kit/recipes/modal-list-page-recipe.test.tsx`
- `apps/admin/src/shared/template-kit/recipes/standard-list-page-recipe.test.tsx`
- `apps/admin/src/shared/utils/download.test.ts`
- `apps/admin/src/test/render-in-locale.tsx`
- `apps/admin/src/test/render-with-app.tsx`
- `docs/plans/2026-09-02-1310-refactor-admin-approved-capability-adaptation-plan.md`
- `docs/progress/2026-09-03-admin-approved-capability-adaptation.md`

## Subsequent local commit authorization

After the verified implementation delivery, the user requested “提交代码”. This authorizes a local commit of exactly the67 manifest files on the existing main branch. The initial receipt above records the pre-commit implementation delivery; it does not override this later authorization. No push, PR, merge or history rewrite is authorized. The implementation remains complete, and the product master pointer stays unchanged.

Commit preparation reconciled all67 paths against the manifest and confirmed an empty pre-existing index and unchanged baseline HEAD. Only the plan/evidence authorization notes changed since verification; this documentation update is L0 and does not require repeating the passed341 tests,2 browser tests or build. Commit identity is available from Git history rather than embedded in its own content.
