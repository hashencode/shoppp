---
title: FS-F14 Review Findings - Bounded Fix Plan
type: fix
status: completed
date: 2026-09-28
topic: fs-f14-review-findings
execution: code
plan_alias: FS-F14-F1
---

# FS-F14 Review Findings - Bounded Fix Plan

## Goal and authority

Correct the eight confirmed FS-F14 review findings so an operator's edits and private preview remain truthful, and the frozen release renders the authored Fashion Store metadata and navigation. This is an independent bounded fix against the completed FS-F14 baseline in `docs/plans/2026-09-22-0043-feat-storefront-control-plane-plan.md` (R3, R5, R7, R11-R13). It does not reopen FS-F14, change the product sequence or candidate scope, select a candidate, or move `REL-Pre-DC`. The product master and REL checkpoint remain the current product authority.

The user selected this execution order: review finding **3 → 2 → 6 → 7, 8 → 1, 5, 10**. Preserve historical Release and Snapshot bytes. Use the existing Admin, API, contract, and Fashion Store boundaries; add no general state-management or accessibility framework.

### Execution checkpoint

- **Current unit:** Complete — U1-U7 are verified.
- **Next concrete action:** None in this bounded fix plan; REL retains its separate `REL-Pre-DC` next action.
- **Blocker:** None.
- **Status:** U1-U7 complete on 2026-09-28. This execution body is frozen as the bounded fix record.

## Decisions

- A local unsaved guard blocks Navigation transitions until the visible edits are saved or discarded. The server still owns version checks.
- A private candidate is revalidated through the existing candidate read endpoint on each Theme Editor load while its session handoff is valid. A failed or inaccessible candidate is cleared with an actionable warning; the editor never silently substitutes a deployed Release for an invalid selected candidate.
- New schema output uses authored Navigation labels and frozen Content SEO. Legacy rendering keeps its historical behavior where necessary.
- Favicon media must be frozen into the release through the same validated media authority as shared Logo assets, then supplied to the document head. Missing assets fail candidate construction rather than reaching a broken public URL.
- Abandonment immediately invalidates existing private Preview grants and sessions through the shared candidate-state check; it does not require a second revocation store.
- Slug return A→B→A removes obsolete self-redirects atomically and preserves redirects from other former slugs.
- A Theme Logo variant must resolve to a frozen Identity Logo before Preview/approval; invalid selection produces an operator-facing validation error instead of a demo Logo.

## Units and verification

| Unit | Finding | Scope and acceptance scenarios | Focused evidence |
| --- | --- | --- | --- |
| U1 | 3 | `apps/admin/src/pages/storefront/navigation-page.tsx`: after editing a saved menu, Publish/Archive cannot discard visible edits; saving clears the guard; untouched versions still transition. | `apps/admin/src/pages/storefront/navigation-page.test.tsx` |
| U2 | 2 | `apps/admin/src/pages/storefront/theme-editor-page.tsx`: refresh retains an accessible private candidate selection and rechecks its identity; invalid/abandoned handoff is cleared and explained; deployed selection still works. | `apps/admin/src/pages/storefront/theme-editor-page.test.tsx` and existing browser test only if browser-only behavior remains uncertain |
| U3 | 6 | `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreFooter.vue`: released Footer `/about` items display their authored labels, including a custom label; legacy shell behavior is characterized. | `apps/storefront/tests/fashion-store-navigation.test.ts` |
| U4 | 7, 8 | `apps/storefront/app/StorefrontExperience.vue`, `apps/api/src/publishing/candidate-releases.ts`, and release contracts: Page/Article title and description use frozen SEO with a sensible authored fallback; private Preview remains noindex; favicon ID resolves to frozen media and the head uses its URL. Missing media fails freeze; old release schemas parse and render. | `apps/storefront/tests/fashion-store-content.test.ts`, `apps/storefront/tests/catalog-release-source.test.ts`, `apps/api/test/catalog/candidate-release.test.ts`, `packages/contracts/test/catalog-release.test.ts` as affected |
| U5 | 1 | `apps/api/src/publishing/candidate-releases.ts` and `apps/api/src/storefront-experience/preview.ts`: after abandonment, old grants cannot be redeemed and existing sessions cannot read Preview; a still-active candidate continues to work. | `apps/api/test/storefront-experience/experience-api.test.ts`, `apps/storefront/tests/preview-access.test.ts` as affected |
| U6 | 5 | `apps/api/src/content/resources.ts`: Page and Article slug A→B→A succeeds; no `from_path = to_path` row exists; any older slug remains redirected to the current path; conflicts remain rejected. | `apps/api/test/content/pages.test.ts`, `apps/api/test/content/articles.test.ts` |
| U7 | 10 | Theme selection/validation and composer: selected Logo variant must exist in the frozen Identity set; invalid selections are rejected before Preview or approval; valid variants render without demo fallback. | `apps/storefront/tests/theme-engine.test.ts`, `apps/api/test/storefront-experience/experience-api.test.ts`, Admin Theme test if its error display changes |

## Verification boundary

Admin page changes are **L2** under `apps/admin/docs/testing-standards.md`: focused component tests, changed-file quality checks, and one Admin typecheck after Admin code stabilizes. If implementation changes shared Admin infrastructure, reclassify to L3 using consumer evidence. Contract changes require package-focused tests/typecheck and reverse-consumer checks. API and Fashion Store checks follow the affected boundaries above; run one exact-tuple Fashion smoke only if the frozen data or head integration cannot be proven by focused tests. Record commands and outcomes in this plan at completion, without creating a second product-current-unit queue.

## Done

All U1-U7 acceptance scenarios pass, the changes stay within the selected finding scope, and no historical immutable artifact is rewritten. Mark this plan completed with focused evidence; leave FS-F14 and the REL product pointer unchanged.

## Completion evidence

- Admin `L2`: `bun run --cwd apps/admin test src/pages/storefront/navigation-page.test.tsx src/pages/storefront/theme-editor-page.test.tsx` — 46 passed; `bun run --cwd apps/admin typecheck` and changed-file ESLint passed. The final extra Navigation assertion passed its focused rerun.
- API: `bun run --cwd apps/api test:workers test/catalog/candidate-release.test.ts test/content/pages.test.ts test/content/articles.test.ts test/storefront-experience/experience-api.test.ts` — 80 passed, 1 pre-existing skipped; `bun run --cwd apps/api typecheck` passed. The final Preview authorization query passed both focused grant/session scenarios.
- Storefront and contracts: `bun test packages/contracts/test/catalog-release.test.ts apps/storefront/tests/fashion-store-navigation.test.ts apps/storefront/tests/fashion-store-content.test.ts apps/storefront/tests/catalog-release-source.test.ts apps/storefront/tests/theme-engine.test.ts` — 77 passed; `bun run --cwd apps/storefront typecheck` and `bun run --cwd packages/contracts typecheck` passed.
- `git diff --check` and changed-file Prettier checks passed. The user-selected findings 3, 2, 6, 7, 8, 1, 5, and 10 are complete in that order. No candidate, deployment, DC, PG, worktree, or PR state was advanced.
