# Admin layout merge integration verification — 2026-10-20

## Scope and baseline

Independent integration under `docs/plans/2026-10-20-fix-admin-layout-merge-conflicts-plan.md`.
Starting HEAD: `1c7ae747b24e7caf47ca584ffa861c937051296f` on
`codex/fix-new-arrival-icon`. The pull merge already existed; the index held four unmerged
paths labelled Updated upstream / Stashed changes, plus pre-existing staged local work.
No stash, reset, checkout, commit, push, PR, deployment or real backend mutation was performed.
Existing historical plans/evidence and product master remain unchanged. IDE files remain outside
the integration scope, including additional `.idea/` changes observed during verification.

## Reconciled behavior

- `role-detail-page.tsx`: preserve `resourceId/onClose/onSaved`, 720px Drawer, synchronous write
  lock, request-generation/unmount guards, reduction confirmation, success close and single parent
  refresh. Integrate the local leaf-only permission tree and share fields/reset with the existing
  compatibility URL. The Drawer stacks basic information above permissions; the compatibility
  page uses the local wide layout. Detail errors use the standard retry state. Form backfill,
  dirty baseline and reset retain all stored permissions, including readonly values outside the
  caller's grant authority; edit/archive restrictions remain enforced.
- `navigation-page.tsx`: retain the local structure tree, selected-item form, full-menu payload,
  reset, independent tab drafts and responsive layout. Combine `canPublish` with the current
  synchronous mutation lock and existing version/dirty/reason guards.
- `ai-rules.md` / `page-guardrail-recipes.md`: retain current container and Card rules while
  admitting the local independent-page split layout. Form save results retain §3.1 ownership;
  §4.3 does not add a duplicate toast. The existing recipe metadata consumes that scope.

## Verification evidence

Admin L2, with browser checks for the changed content composition. API requests in tests use
MSW or the existing Axios browser adapter; unexpected browser requests reject before the network.

| Check                                                                                                                        | Result                                                          |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Initial `bun run test src/pages/iam/iam-pages.test.tsx`                                                                      | Reproduced the conflict-marker parser failure before resolution |
| Focused IAM + navigation component suites                                                                                    | 69/69 passed; no skipped tests                                  |
| `bun run test:browser src/pages/iam/iam-form-drawers.browser.test.tsx src/pages/storefront/navigation-page.browser.test.tsx` | 2/2 passed; no skipped tests                                    |
| `bun run typecheck` in `apps/admin`                                                                                          | Passed (`tsc -b`)                                               |
| ESLint on the seven affected TSX implementation/test files                                                                   | Passed                                                          |
| Prettier on the 15 integration/runtime/local-doc files                                                                       | Passed                                                          |
| `bun test tools/check-admin-i18n.test.ts`                                                                                    | 8/8 passed, including production translation audit              |
| Local Markdown references                                                                                                    | 41 paths resolved; feedback/layout heading targets retained     |

The new Drawer component tests exercise exact trimmed leaf-permission payloads and version,
duplicate submission suppression, busy close/reset blocking, one list refresh and no refresh
on success acknowledgment, reduction cancellation/retry/confirmation, readonly browsing with
zero writes, and detail-error retry without a list refresh. Existing tests retain standalone
payload, readonly, stale-version and archive-dependency coverage.

Browser evidence uses the real Ant Design components and CSS: the role Drawer measures 720px,
has no body overflow, stacks its sections and keeps its footer reachable. Tree selection, search
and expansion reset to loaded values; readonly search/expand remain available. Cancelling a
reduction preserves the draft and re-enables Save. Navigation uses explicit 1100px and 700px
content fixtures to test its container breakpoint independently of the runner viewport; it
checks actual section positions and token dividers, retained selection/drafts, reset, and no
container or page overflow in the compact fixture. This is focused fixture evidence, not a
deployed-page, all-theme or full-viewport regression audit.

Intermediate integration checks found an old `Save changes` assertion, two unsupported `exact`
options in Testing Library queries, and timing assumptions about Ant Design's exiting loading
icon/Popconfirm. Tests were corrected to the standard Save action and actual library lifecycle.
The browser's initial wide-container assertion was corrected to provide the requested content
width rather than assuming the default runner viewport. No production lifecycle workaround was
added for these test issues.

## Targeted integration review

Reviewed only the four conflict resolutions, their supporting metadata and tests against the
index stages/current HEAD. Checked permission/grant boundaries, full payload and reset, shared
save/archive locks, cancellation results, late response guards, close/refresh ownership,
navigation state transitions, responsive composition and documentation precedence.

Simplification was skipped for overlapping pre-existing edits. Review was a targeted manual pass
because the branch/index contains unrelated local work; no branch-wide review or rewriting of
historical work was performed. No unresolved integration finding was identified.

Final component command: `bun run test src/pages/iam/iam-pages.test.tsx src/pages/storefront/navigation-page.test.tsx`
from `apps/admin`; 69/69 passed with no skips. `git ls-files -u` is empty after staging the four
resolved paths and the integration's supporting files. Scoped cached diff checks pass; no Admin
integration edits remain unstaged. New plan/evidence are staged with the integration. The
pre-existing unrelated index entries and IDE work are retained. No additional tests were needed
after the final documentation-only closeout.
