# Local-First CI U3 Evidence

Date: 2026-08-24
Unit: CI-U3
Implementation commit: `93b3f88f056865a1c504b33f19f1f924aa015a66`
Tree: `44dbbe7e482b94135d5ad3f87739dd719dc6161f`

CI-U3 added the checked optional-runner operations contract without registering a runner, changing a
service, or handling credentials. The contract keeps the advisory CI identity disjoint from FS-U8,
requires a dedicated non-admin account, and binds execution to a human-approved exact SHA through
the host-owned `ACTIONS_RUNNER_HOOK_JOB_STARTED` dispatcher before repository checkout.

## Verification

- Primary checkout: 12 focused CI-U3/workflow tests passed with 110 assertions; Prettier, ESLint,
  repository typecheck, and `git diff --check` passed.
- Clean clone at the exact commit/tree, with GitHub environment variables absent: the same 12
  focused tests passed. The clone was clean before dependency installation and was trashed after the
  run.
- Clean-clone typecheck did not execute because the device's Homebrew Node binary could not load
  `libsimdjson.26.dylib`; the identical repository typecheck completed successfully in the primary
  checkout. This is retained as a host-toolchain observation, not a product-test failure.
- Three independent simplification reviews covered reuse, quality, and efficiency. Reuse and
  efficiency found no actionable issue. Quality findings about concrete pre-job hook admission,
  stale pointer wording, and greedy test expressions were fixed and re-reviewed as closed.
- The pre-existing staged FS-U8/IAM patch in `tools/deploy-workflow.test.ts` retained patch ID
  `cd7b6d3cbdba7647f39bca8b7826b3954bf12028` before and after the CI-U3 commit.

## Human-only boundary retained

Registration tokens, runner/service installation, host-policy mutation, credential inspection,
listener enablement, and live compromise drills were not performed. The runbook makes those explicit
operator actions and does not treat their absence as repository-contract failure.
