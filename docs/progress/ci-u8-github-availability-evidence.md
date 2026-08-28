# CI-U8.3 GitHub-first availability evidence

This file retains focused implementation and verification evidence for CI-U8.3. It is not a second
current-unit queue; the active CI plan owns current status, blocker, next action, and tail.

## 2026-08-28 — availability boundary and retained recovery verification

- **Scope:** Published the four GitHub-first availability states, the provider dependency inventory,
  formal-release pause rules, fail-closed artifact handling, and fresh exact-SHA recovery audit.
  Linked the boundary from the existing local CI and release runbooks. No workflow, release gate,
  environment, credential, candidate, staging resource, or production resource changed.
- **Proof-first contract:** `tools/local-first-ci-runbook.test.ts` was strengthened before the
  runbook implementation. Its first run failed with `ENOENT` for
  `docs/runbooks/github-first-release-availability.md`, proving the contract was not already present.
  After implementation and review hardening, `bun test tools/local-first-ci-runbook.test.ts`
  passed 9 tests and 163 expectations.
- **Retained recipe contract:**
  `bun test tools/deploy-workflow.test.ts tools/staging-rollback-baseline.test.ts` passed 40 tests and
  529 expectations. The suite proves same-run verification before staging mutation, staging-only
  defaults, production/rehearsal conflict refusal, exact pre-mutation Worker/D1 capture, pending-
  migration refusal, exact Worker and release-lifecycle restoration, run-scoped D1 reconciliation,
  restored-safe-state verification, and distinct success/failure outcome recording.
- **Repository verification:** `bun test tools` passed 353 tests and 1,736 expectations;
  `bun run typecheck`, `bun run lint`, focused Prettier checks, and `git diff --check` also passed.
- **Read-only GitHub observation:** `gh run view 33073613728` reported the retained exact-source
  workflow as `completed` / `success` for SHA
  `40cfdec8021aca5b7e78fc9be27553ba620d0511`. Preflight, hosted validation, same-run input
  verification, staging deployment, staging proof, and `restore-staging-baseline` all remain
  successful. Human access, production approval, and production promotion remain skipped.
- **Retained artifact availability:** GitHub's run-artifact API reported validation artifact
  `9647589810`, staging baseline `9647619915`, test D1 backup `9647623150`, staging evidence
  `9647708396`, and staging restoration `9647733730` with `expired=false`. Their declared expiries
  remain 2026-09-03, 2026-09-26, or 2026-11-25 according to artifact class.
- **Operational verdict:** The retained non-production rollback/reconciliation proof is still
  visible and internally consistent with the repository contract. It is historical proof, not a
  reusable deployment input and not authority for a future incident. A GitHub availability or
  artifact incident now fails closed and returns through `recovery-audit` with a new exact-SHA
  hosted run. This verification performed no workflow dispatch and no staging or production
  mutation.
