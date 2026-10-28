---
title: Resolve Admin layout changes against current form lifecycle
type: fix
status: completed
date: 2026-10-20
---

# Scope and authority

Independent bounded conflict resolution, authorized on 2026-10-20. Preserve the current
720px role Drawer, save/confirmation/close/refresh lifecycle and compatibility URL, while
integrating the local permission tree and navigation split layout. Reconcile the local
feedback/layout additions with the current container and Card rules. Historical 2026-10-11
plans and verification records remain frozen; this plan owns only integration and new evidence.
The product master, active REL plan, candidate scope and product sequence are unchanged.

Baseline: `1c7ae747b24e7caf47ca584ffa861c937051296f`, branch
`codex/fix-new-arrival-icon`. The index already contains local docs, layouts, tests, translations,
historical plans/evidence and `.idea/workspace.xml`; four paths are unmerged. Do not stash,
discard or commit this pre-existing work. Keep the existing checkout. After verification stage
the four resolved paths and this integration's tests/docs, preserving unrelated index entries.
No commit, push, PR or deployment belongs to this task.

# Implementation and verification

- U1: Resolve the role page and navigation page; preserve sync locks and permission checks,
  role reduction confirmation, detail retry, full permission baseline/reset and readonly browsing.
  Share field content between the Drawer and compatibility page; the Drawer stacks its sections.
- U2: Reconcile ai-rules/guardrail plus automatically merged references. Form save results retain
  §3.1 ownership; independent-page split layouts do not override Drawer sizing or Card boundaries.
- U3: Verify and review the integration, then stage the resolved paths and integration tests/docs.

Admin **L2**: focused `iam-pages.test.tsx` and `navigation-page.test.tsx`; extend the existing
role Drawer integration tests for leaf-only payload, permission reduction, reset and readonly
browsing, close/refresh and detail recovery. Run the existing IAM Drawer Browser Mode suite for
720px layout, permission tree and close/reset behavior; cover the navigation split layout in a
focused browser check if needed. Run changed-file ESLint/Prettier, translation check and one final
Admin typecheck. No app-wide build/test run. Capture the initial conflict-marker failure, final
results and manual integration review under `docs/progress/`.

# Execution checkpoint

| Unit | Status   |
| ---- | -------- |
| U1   | complete |
| U2   | complete |
| U3   | complete |

All units complete. No remaining action or blocker. The four conflicts are resolved and the
integration-owned source/tests/docs are staged; no commit or push was made. Final verification:
69/69 focused component tests, 2/2 browser tests, 8/8 translation tests, Admin typecheck,
changed-file lint/format, local doc references and index/diff checks passed. Evidence and the
targeted manual review are retained in
`docs/progress/2026-10-20-admin-layout-merge-resolution-verification.md`.
This completed execution body is frozen. Tail owner: this independent plan; product authority
and pre-existing unrelated work are unchanged.
