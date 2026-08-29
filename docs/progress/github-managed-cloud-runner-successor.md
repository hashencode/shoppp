# GitHub-Managed Cloud Runner Successor Evidence

This file retains focused execution evidence for
`docs/plans/2026-08-28-001-refactor-github-managed-cloud-runner-successor-plan.md`. It does not own
the current unit, next-action queue, Fashion status, candidate eligibility, DC, or PG state.

## 2026-08-28 local implementation verification

- Working branch: `codex/fs-u8-cloud-only-migration`; exact integration SHA not yet assigned.
- All current workflow jobs are statically verified as fixed `ubuntu-24.04`; dynamic and
  self-managed runner selectors are absent.
- Every current external Action reference is pinned to a full 40-character SHA.
- Credential-free authority tests reject fork, PR, `pull_request_target`, non-main, cross-repository,
  unauthorized actor, partial SHA, and workflow/harness mismatch cases.
- Protected Fashion jobs depend on credential-free verification, name the `fashion-staging`
  Environment, request `id-token: write`, check out the immutable event SHA, prove `HEAD` before
  OIDC retrieval, and validate the exact GitHub OIDC audience, issuer, lifetime, repository, owner,
  actor, event, ref, Environment subject, and workflow ref before mutation.
- U8 preparation writes `awaiting_operator` and exits. Operator state tests prove no identity or
  session creation, exact registration replay after response loss, conflicting replay rejection,
  real approved-U12/deployed-Catalog lineage, conflict-successor transfer, run-specific immutable
  Snapshot/audit capture, atomic Snapshot/audit/operator transition, expiry before approval, expiry
  after approval, cross-run refusal, and exact idempotent consumption.
- Preview re-reads the exact unexpired, unconsumed server-side approval immediately before mutation;
  the Admin editor shows the exact run, U12 baseline, frozen Catalog Release, state, and allowed action
  without exposing an account or credential, and locks the Catalog selector for an active run.
- Full local verification passed: 362 repository tool tests; 303 Admin Rstest tests with one worker;
  202 API Worker tests; 13 database Worker tests; 276 Storefront tests; 28 contract tests; 29 domain
  tests; the database scale seed; repository-wide typecheck; repository-wide lint and import
  boundaries; all eight workflow YAML parses; and `git diff --check`.
- The default parallel Admin run repeatedly completed its assertions but hit a React scheduler
  callback after jsdom teardown (`window is not defined`). The same complete 303-test suite passed
  with the existing runner and `--pool.maxWorkers 1 --maxConcurrency 1`; this is retained as a local
  test-runner cleanup issue and did not trigger runner escalation.
- The first direct Workers command was blocked by the host Homebrew Node's missing
  `libsimdjson.26.dylib`. The same suites passed with the bundled Node runtime after generating the
  ignored Nuxt type configuration. This was classified as local infrastructure failure and did not
  change the governed runner class.

No GitHub-hosted workflow, staging mutation, operator run, candidate freeze, or production action is
claimed by this evidence. Exact-main post-commit proof remains required before successor closure.

## 2026-08-29 first exact-main hosted execution

- `main` advanced by fast-forward from `dc746220` to migration SHA `f94d2e35`; no pull request was
  created.
- Historical run `33156226300` for `dc746220` remained queued on the retired
  `self-hosted, macOS, ARM64, shoppp-main-nonsecret` selector and occupied the
  `post-commit-main` concurrency group. It was cancelled rather than starting or recreating a local
  runner.
- Exact-SHA run `33233110420`, job `99049480569`, then started on fixed GitHub-hosted
  `ubuntu-24.04`. Immutable checkout, `HEAD` identity verification, Bun setup, and exact report
  upload passed.
- The repository `ci:post-commit` command failed in `format:check` because
  `docs/progress/development-candidate-readiness.md` required Prettier table-width normalization.
  This is an application/repository check failure, not a runner capability failure; the runner class
  remains unchanged.
- The failed same-run report artifact is retained by GitHub. A formatting correction and a fresh
  exact-main hosted run are required before `CI-CLOUD-U3` can close.
