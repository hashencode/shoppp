---
title: Revenue report header help
type: fix
date: 2026-09-30
plan_role: independent
status: completed
---

# Revenue report header help

## Scope and decisions

This bounded Admin presentation fix follows the user's approved column-header design. It does not
change the active product plan, product sequence, candidate scope, or reporting calculations.

- Remove the permanent scope Alert between the filters and results.
- Put `InfoCircleOutlined` in a small Ant Design text Button immediately after each gross, refund,
  and net column label; Ant Design Tooltip owns hover/focus behavior.
- Gross explains paid order totals by order creation time. Refunds explain successful completion
  time and inclusion of older orders. Net explains subtraction and possible negative values.
- Use English and Chinese copy through existing i18n. Do not repeat currency, environment, or test
  order exclusions in the help. Keep currency in the committed column labels.
- Keep the existing StandardListPageRecipe, standard filters, export-status feedback, permissions,
  pagination, request semantics, errors, and empty states. No form or action-column changes apply.

## Implementation and execution checkpoint

- **U1 — Header help and verification:** completed.
- **Next action:** none; this bounded plan is closed.
- **Blocker:** none.
- **Execution:** native inline in the current feature checkout; no new worktree or PR.
- **Owned files:** report page and its component/browser tests, focused i18n entries, the Revenue
  Report row in `apps/admin/docs/ai/page-guardrail-recipes.md`, and this plan.
- Existing unrelated WIP, including other entries in `translations.ts`, stays intact and uncommitted.

## Verification contract

Select **L2** because the new local Tooltip interaction changes presentation behavior. Update the
existing report suite to prove that the removed guidance is absent, each help Button belongs to
its column, focus reveals the correct localized explanation, switching language does not fetch,
and committed currency labels, query/permission/error/export boundaries still work.

Use the existing report Browser Mode suite for native hover/focus and desktop/narrow layout because
portal positioning and header wrapping cannot be established by jsdom. Run only these focused
suites, changed-file ESLint/Prettier, the i18n checker, and one Admin typecheck. Record any unrelated
existing failure without expanding to full build/E2E.

## Completion evidence

- Component suite: `bun run test src/pages/reports/order-report-page.test.tsx` — 9 passed.
  The pre-implementation run failed for the expected missing help Button and retained scope Alert.
- Native browser suite: `ADMIN_I18N_BROWSER_PROFILE=desktop bun x rstest run -c
rstest.i18n-browser.config.ts src/pages/reports/order-report-page.browser.test.tsx` — 3 passed;
  repeat with `ADMIN_I18N_BROWSER_PROFILE=narrow` — 3 passed at 390px. Both runs cover Chinese and
  English hover/focus, focus departure, header spacing, popup bounds, dates, and unchanged requests.
- `bun run typecheck` from `apps/admin` — passed once after production code stabilized.
- Changed-file ESLint — passed for the report page, its two suites, and `translations.ts`.
- Changed-file Prettier with `--ignore-path /dev/null` — passed for the code, translations, and plan.
  The explicit ignore override is necessary because root `.prettierignore` excludes Admin and plans.
- `bun test tools/check-admin-i18n.test.ts` — 8 passed; added copy uses literal `t` calls and reuses
  the existing net definition and `About {metric}` label.
- `git diff --check` — passed. The translation diff against the pre-task copy contains only the two
  new definitions and the removal of the obsolete scope message.
- Simplification: one code-quality fix applied (translate the metric metadata once before mapping);
  reuse and efficiency passes found no further warranted changes.
- Code review: completed, no actionable findings; receipt at
  `/tmp/compound-engineering-501/ce-code-review/20261001-000133-2ead60ed/report.md`.
- Final amount columns are 180px, and the table scroll width is 1420px to accommodate the icons.
  Existing user WIP and these local edits remain uncommitted. No product pointer or release state
  changed.
