---
title: GitHub-Managed Cloud Runner Successor
type: refactor
date: 2026-08-28
topic: github-managed-cloud-runner-successor
execution: implementation
plan_role: successor
status: in_progress
current_unit: CI-CLOUD-U3
---

# GitHub-Managed Cloud Runner Successor

## Authority and lineage

- **Upstream product authority:** [Shoppp Product Master Plan](2026-08-13-001-refactor-shoppp-product-master-plan.md).
- **Inherited baseline:** [Long-Term CI Resilience and GitHub-First Delivery](2026-08-19-1737-refactor-local-first-ci-plan.md), complete through `CI-U11.1`, plus the completed [GitHub-First CI/CD Transition](2026-08-26-1756-refactor-github-first-ci-transition-plan.md). Their retained exact-run and recovery evidence remains historical authority.
- **Explicit supersessions:** This plan supersedes only future execution behavior in inherited `R9`, `R12`, `R15`, `KTD3`, `CI-U3`, `CI-U4`, and the operational portions of the old local-runner runbook that allowed a persistent or temporary self-managed runner. It does not rewrite their historical decisions, runs, failures, artifacts, or completion status.
- **Preserved identifiers:** Inherited `R1`–`R8`, `R10`–`R11`, `R13`–`R14`, `R16`–`R32`, `KTD1`–`KTD2`, `KTD4`–`KTD12`, and completed `CI-U1`, `CI-U2`, `CI-U5`–`CI-U12` retain their governed meaning wherever the behavior still exists. `CI-CLOUD-*` identifiers govern only this successor delta.
- **Parallel plan:** [Fashion Store Functional Integration](2026-08-11-001-feat-fashion-store-functional-integration-plan.md) remains the active feature authority at `FS-U8.2`. It owns U8-specific callers, operator state, evidence, status, and completion; this successor does not complete or renumber Fashion units.
- **Tail ownership:** This plan owns shared validation, post-commit execution, the repository-wide current-workflow runner policy, and handoff of the cloud-only baseline to `FS-U8.2`. The Fashion plan owns U12 recovery, U8 preparation/refresh/acceptance, Preview, deployment evidence, and the remaining formal-acceptance tail.

## Execution Checkpoint

- **Current unit:** `CI-CLOUD-U3` — integrate and verify the successor on exact `main`.
- **Status:** In progress. `CI-CLOUD-U1` and `CI-CLOUD-U2` are complete and integrated; candidate or release completion is not implied.
- **Completed and integrated:** Every current workflow job selects fixed `ubuntu-24.04`; dynamic and self-managed runner selectors are absent; every third-party Action is pinned to a full SHA. Migration SHA `f94d2e35` and formatting correction `db6a5b67` reached exact `main`; runs `33233110420` and `33233272802` both executed on the fixed hosted image and retained exact reports. The active runbook and static contracts encode the capability-preflight and fail-closed escalation policy.
- **Blocker:** Neither hosted run passed. The first found one repository formatting error; the second exposed a date-expired theme-test fixture plus the undeclared developer-host `woff2_decompress` dependency and concurrent shared-output behavior. The corrective lockfile, font audit, regression test, and fixture changes are locally green but not yet integrated, so `CI-CLOUD-U3` still lacks a successful exact-main run and same-run passing report.
- **Next concrete action:** Integrate the corrective diff into exact `main` without a PR; observe the resulting fixed-image post-commit run; verify exact SHA, action pins, successful conclusion, and same-run report artifact; append focused evidence under `docs/progress/`; then mark `CI-CLOUD-U3` and this plan complete and return tail ownership to `FS-U8.2` in the master pointer.
- **Following action:** Freeze the new U8 candidate/harness/manifest identities and execute fresh U12 readiness, operator preparation, approval, refresh, Preview, and separate acceptance from the Fashion plan.
- **Last reviewed:** 2026-08-29 after two exact-main hosted runs proved the fixed runner path and report upload, then failed on repository formatting and cross-platform test/tool assumptions. The corrective diff is locally verified; no staging mutation is claimed.

## Requirements

- **CI-CLOUD-R1:** Every current automation job defaults to the fixed standard GitHub-hosted `ubuntu-24.04` image. No workflow accepts a dynamic runner input or self-managed label.
- **CI-CLOUD-R2:** A GitHub-hosted larger or OS-specific runner requires a side-effect-free preflight proving an OS, capacity, fixed-IP, or private-network need. Test, lint, build, application, authentication, staging, deployment, provider, or queue failure never qualifies.
- **CI-CLOUD-R3:** If a GitHub-managed runner cannot execute a job after a valid capability decision, execution stops for workflow or environment redesign. No developer machine, OrbStack instance, local account, runner listener, or self-managed runner is a fallback.
- **CI-CLOUD-R4:** Every third-party Action uses a reviewed immutable full SHA. Credential-free verification checks exact repository, base-repository/non-fork state, `workflow_dispatch`, `main`, authorized actor, and full candidate/harness identities before a protected environment is named.
- **CI-CLOUD-R5:** A protected Fashion job depends on the credential-free verifier, uses the `fashion-staging` GitHub Environment, requests `id-token: write`, and validates exact GitHub OIDC repository, owner, actor, event, ref, and audience claims before mutation.
- **CI-CLOUD-R6:** Shared/post-commit jobs have no Fashion or deployment credential. Human passwords, reusable browser state, and operator credentials never enter Actions.
- **CI-CLOUD-R7:** GitHub unavailability pauses formal release. Local or historical evidence may diagnose development but never substitutes for a fresh exact-SHA hosted run and same-run artifacts.
- **CI-CLOUD-R8:** The complete current workflow graph is statically tested for runner class, immutable action pins, authority ordering, protected Environment, and OIDC permission.

## Features

- **CI-CLOUD-F1:** Fixed-image shared and post-commit hosted execution.
- **CI-CLOUD-F2:** Repository-wide cloud-runner policy guard.
- **CI-CLOUD-F3:** Credential-free Fashion authority verifier plus protected Environment/OIDC boundary.
- **CI-CLOUD-F4:** Cloud-only operations runbook and exact-main completion evidence.

## Key Technical Decisions

- **CI-CLOUD-KTD1:** Use one fixed standard Ubuntu image across current workflows so updates are reviewed repository changes rather than moving-label drift.
- **CI-CLOUD-KTD2:** Keep capability selection explicit and pre-mutation; never implement failure-driven automatic escalation.
- **CI-CLOUD-KTD3:** Separate credential-free source/actor authority from protected Environment/OIDC execution. The verifier cannot read secrets or mint an OIDC token.
- **CI-CLOUD-KTD4:** Preserve the old CI plan as history while giving future shared/post-commit execution one named successor authority.
- **CI-CLOUD-KTD5:** Require a fresh exact-main hosted run before closing the successor, even when local contracts are green.

## Implementation Units

| Unit | Outcome | Status | Evidence / next result |
| --- | --- | --- | --- |
| `CI-CLOUD-U1` | Establish successor authority and fixed shared/post-commit executor | Complete | Successor plan, hosted post-commit image, updated cloud operations runbook, preserved inherited IDs, and exact-main integration |
| `CI-CLOUD-U2` | Enforce the current-workflow cloud-only policy | Complete | Repository-wide runner/action-pin test; credential-free authority and OIDC claim tests; integrated current-workflow graph |
| `CI-CLOUD-U3` | Integrate and prove the successor on exact `main` | In progress | Runs `33233110420` and `33233272802` retained failed exact reports; corrective diff needs integration, a successful exact-main report, and same-change checkpoint/master closure |

## Verification Contract

1. Parse every current workflow YAML file successfully.
2. Scan every job and prove `runs-on: ubuntu-24.04`; reject `self-hosted`, a dynamic expression, and moving image labels.
3. Scan every external `uses:` reference and require a 40-character commit SHA.
4. Run shared/post-commit and deployment workflow contract tests.
5. Run authority and OIDC rejection matrices covering fork, PR, `pull_request_target`, non-main, cross-repository, unauthorized actor, and mismatched workflow SHA.
6. Run affected API, database, Admin, and typecheck suites because the protected U8 graph consumes the successor boundary.
7. On exact `main`, require a successful post-commit run for the integrated SHA and retain its exact report artifact identity. A remote failure is classified; it does not change runner class.

## Definition of Done

- `CI-CLOUD-U1`–`CI-CLOUD-U3` are complete with no unresolved blocker.
- Every current workflow uses the fixed standard GitHub-hosted image and immutable Action pins.
- The credential-free verifier and protected Environment/OIDC stages are enforced by tests.
- The exact integrated `main` SHA has fresh successful hosted post-commit evidence and a retained report artifact.
- The active Fashion checkpoint and product master record successor closure and the returned `FS-U8.2` tail in the same change.
- No candidate, DC, PG, Fashion-unit, staging, or production completion is inferred from this infrastructure plan.
