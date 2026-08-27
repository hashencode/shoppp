# GitHub-first CI transition evidence

This file retains non-secret operational observations for the GitHub-first bridge. It is not a
second current-unit queue; the active checkpoint in
[`2026-08-26-1756-refactor-github-first-ci-transition-plan.md`](../plans/2026-08-26-1756-refactor-github-first-ci-transition-plan.md)
alone owns current status, blockers, and next action.

## Pre-removal eligibility observation — 2026-08-27

### Repository implementation available

- CI-GH-U1 authority reconciliation: `c09f05a7`.
- CI-GH-U2 reusable hosted validation and attestation contract: `dafeb412`.
- CI-GH-U3 same-run protected deployment binding: exact commit
  `de03d93a416cdcf0dcfdd6dd4d7ed57ab45c1460`.
- The U2/U3 focused contract suite passed locally with 49 tests, TypeScript tool checking passed,
  both workflow YAML files parsed, every maintained validation/deployment action used a full commit
  SHA, no workflow requested a write-capable `GITHUB_TOKEN`, and the release gate list plus
  Lighthouse threshold file remained unchanged.
- These local results prove repository implementation only. They are not GitHub-hosted validation,
  staging deployment, rollback, or release evidence.

### Protected-default integration not yet present

At `2026-08-27 09:44:33 +0800`, `origin/main` resolved to exact commit
`63b71c824ff2ac5852c7cd9bae951e286603f1dd`. It did not contain CI-GH-U1–U3, so the bridge's own
credential-free default-branch workflow preflight could not authorize the new path. No branch,
default ref, environment, or remote content was changed during this observation.

### GitHub-hosted execution blocker

- `gh run list --workflow full-validation.yml` returned no runs. No hosted validation or deployment
  was dispatched from this worktree.
- GitHub Actions run `32830213920` for exact commit
  `3d63fb8cee2a8af853ae0528a793e33542c35019` completed as failure on 2026-08-25. Its `quality` job
  (`97746978847`) had zero steps. The job annotation states that it was not started because recent
  account payments failed or the spending limit needed to be increased.
- The repository exposes `staging`, `staging-human-access`, and `production` GitHub environments, in
  addition to the independent `fashion-staging` environment. This observation inspected environment
  names and policy metadata only; it did not read, write, rotate, or print any secret or variable.

### Evidence classification and stop boundary

CI-GH-U4 still lacks every required operational result: a passing exact-SHA hosted 17-gate run,
bound attestation/report/deployable artifacts, controlled mismatch refusal, captured pre-mutation
Worker and D1 baseline, staging deployment and post-deployment checks, rollback or forward
reconciliation, and verification of the restored safe staging state. The billing failure and missing
protected-default integration are blocker evidence, not substitutes for those results. CI-GH-U5 is
therefore not authorized, and no Docker, Intel, capsule, candidate-evidence, signing, retention, or
restore implementation was removed. No staging or production mutation occurred.

## Local review remediation — 2026-08-27

Commit `57ce4d9e` applies the actionable findings from the structured local review without changing
the bridge checkpoint or crossing the CI-GH-U4 dependency boundary. The remediation moves deploy
credentials behind a protected-code, same-run artifact verification job; restores the idempotent
validation-failure callback in the protected `staging` environment; makes scheduled validation
fail closed without an approved immutable Catalog release ID; limits the Catalog credential to the
release-validation step and gate; validates report and attestation JSON at runtime; and verifies
the complete nine-artifact inventory plus refusal cases.

After remediation, the focused workflow and verifier suite passed with 84 tests and 599
expectations, the complete `tools` suite passed with 367 tests and 1,534 expectations, TypeScript
tool checking and repository lint passed, both workflow YAML files parsed, boundary checking and
`git diff --check` passed, and every external Action reference in the maintained workflows remained
pinned to a full commit SHA. The release contract still contains exactly 17 gates and the existing
Lighthouse thresholds were not changed.

These are local implementation and review results only. They do not prove a GitHub-hosted run,
staging deployment, rollback/reconciliation, Intel execution, retention, restoration, signing, or
production behavior, and they do not relax the CI-GH-U4 blocker recorded above.
