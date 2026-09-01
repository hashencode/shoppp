---
title: Cloud-Only Shared CI Execution - Plan
type: refactor
date: 2026-09-01
topic: cloud-only-shared-ci-execution
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
plan_role: ci-successor
---

# Cloud-Only Shared CI Execution - Plan

## Goal Capsule

- **Objective:** Remove the last shared Shoppp self-hosted execution target before Fashion U8
  freezes a new exact-main candidate.
- **Means:** Move the existing post-commit validation jobs to GitHub-managed Ubuntu runners while
  preserving their triggers, concurrency, immutable event-SHA checkout, dependency lock, reports,
  and release semantics.
- **Upstream product authority:** The
  [Shoppp Product Master Plan](2026-08-13-001-refactor-shoppp-product-master-plan.md) remains the
  product-level authority. The completed
  [Long-Term CI Resilience and GitHub-First Delivery plan](2026-08-19-1737-refactor-local-first-ci-plan.md)
  supplies the historical CI baseline; the completed
  [GitHub-First CI/CD Transition](2026-08-26-1756-refactor-github-first-ci-transition-plan.md)
  supplies the hosted release path inherited here.
- **Inherited baseline:** Preserve the current post-commit `push`, schedule, and manual dispatch
  boundaries; exact event-SHA checkout; pinned actions; Bun lockfile install; advisory/full lane
  commands; concurrency; report identity; and the separation from release promotion, REL, DC, and
  PG authority.
- **Explicit supersessions:** This successor supersedes only future self-hosted execution in
  `.github/workflows/post-commit-ci.yml` and the operational portions of
  `docs/runbooks/local-first-ci.md` that instructed an operator to maintain that runner. It does not
  rewrite historical runner evidence, reopen completed CI units, change a validation gate, or
  authorize staging or production mutation.
- **Parallel plans:** Fashion Store remains active at `FS-U8.2` and owns its U8-specific workflows,
  operator boundary, staging evidence, and completion verdict. REL remains blocked. Decor remains
  complete and unchanged.
- **Tail ownership:** This successor owns only the shared post-commit cloud migration and its
  focused proof. After integration and one exact hosted execution prove the preserved contract, it
  returns execution to `FS-U8.2`; the completed CI plan retains historical CI authority.

## Execution Checkpoint

- **Current parent/child stage:** `CCI-U1.2` — the workflow and governance tests are implemented in
  the current FS-U8 delivery change; both post-commit jobs now select `ubuntu-latest`, while their
  event, source-binding, gate, and report contracts remain unchanged.
- **Status:** In progress — implementation prepared; exact-main integration and hosted run evidence
  are not yet available.
- **Next concrete action:** Integrate the reviewed shared/U8 migration into exact `main`, observe one
  resulting hosted post-commit run for that exact source, retain its run and runner-image identity,
  and then mark `CCI-U1` complete and hand the sequence back to the fresh `FS-U8.2` freeze.
- **Blocker:** Remote proof cannot exist before the reviewed change is integrated into `main`. Local
  tests, branch names, and commit subjects are supporting evidence only.
- **Tail:** `CCI-U2` records the exact hosted run and handback; no continuing CI queue remains after
  that evidence is retained.

## Units

| Unit | Status | Completion authority | Next action |
| --- | --- | --- | --- |
| `CCI-U1` — migrate shared post-commit execution | In progress — U1.2 implementation prepared | Workflow source contains no self-hosted target; pinned-action, immutable-source, trigger, concurrency, and gate tests pass; one exact-main GitHub-hosted run records the expected runner image and result | Integrate and capture the exact hosted run |
| `CCI-U2` — reconcile and hand back | Pending | Master classification and sequence identify this plan as complete and return tail execution to `FS-U8.2`; no self-hosted registration is inferred, created, or required by this plan | Start only after CCI-U1 remote proof |

## Verification Contract

- `tools/ci-workflow.test.ts` proves both post-commit jobs use GitHub-hosted Ubuntu while preserving
  the existing trigger, concurrency, exact-checkout, dependency, gate, and report contracts.
- `tools/local-first-ci-runbook.test.ts` proves the former self-hosted operating procedure is
  historical and cannot authorize a new account, listener, or developer-machine fallback.
- Every maintained action reference remains pinned to one full commit SHA.
- `git diff --check` and focused workflow tests pass before integration.
- Completion additionally requires the exact-main GitHub run ID, source SHA, job result, and
  GitHub-hosted runner-image identity. A local run cannot substitute for that evidence.

## Scope Boundaries

- No production deployment, staging mutation, candidate selection, DC/PG transition, account
  creation, runner registration, or runner-tier escalation is authorized.
- A product, test, authentication, or configuration failure stays a product/configuration failure;
  it cannot trigger fallback to self-hosted execution.
- FS owns the transitive U8/U12/Preview trust split and human-operator boundary. This plan owns only
  the shared post-commit runner selection and its handback.
