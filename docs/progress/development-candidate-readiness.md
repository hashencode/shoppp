# Shoppp Development Candidate Readiness

Authority: [`docs/plans/2026-08-12-003-refactor-development-candidate-readiness-plan.md`](../plans/2026-08-12-003-refactor-development-candidate-readiness-plan.md).
Vocabulary: [`docs/architecture/delivery-units-and-candidate-gates.md`](../architecture/delivery-units-and-candidate-gates.md).

Last reviewed: 2026-08-13.

This file is the candidate-status authority, not the product's daily implementation tracker. While
Pre-DC is blocked, it links the active feature plans that own changing unit status. It is updated
when candidate eligibility, candidate identity, a DC result, or a PG result changes—not after every
implementation task.

## Candidate decision

**Development-candidate work is blocked at Pre-DC implementation readiness.** No candidate is
currently frozen. The repository contains strong historical commerce, IAM, template, and staging
evidence, but that evidence does not establish that every business capability required for the next
release is complete.

Shoppp's current product template names are `fashion-store` and `decor-store`. The older `fashion`
implementation is retired; `decor-store` currently uses the legacy internal code ID `decor`.
Candidate planning must record a product-approved Candidate Template Matrix and one Activation
Target. Registry presence alone does not make a template candidate-blocking.

## Status vocabulary

- **Not audited:** Candidate scope or eligibility has not been reconciled against the owning active
  plans and retained evidence.
- **Initial implementation:** Some behavior or tests exist, but the unit's Definition of Done is not
  yet satisfied.
- **Complete:** The owning active feature plan records the observable capability and focused
  verification as complete.
- **Blocked:** A later stage cannot start because a required earlier status or tool is incomplete.
- **Pending:** Required for the selected candidate, but no current-candidate evidence exists.
- **Partial:** Relevant evidence exists, but it is historical, narrower than the gate, or not bound
  to the current candidate.
- **Candidate proven:** The exact selected candidate passed the gate with retained evidence.
- **Human pending:** Engineering evidence exists; a named human decision remains.
- **Production pending:** Production resources or explicit promotion authority remain.

## Pre-DC implementation readiness

| Prerequisite                       | Status                 | Owning source/current signal                                                                                                                                                                                                      | DC entry result                                                                                                                                                                                                          |
| ---------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product capability scope           | Not audited            | Product Contracts and active plans cover substantial P0, IAM, template, and staging work.                                                                                                                                         | Reconcile the intended release capability set, owning U units, approved deferrals, and current evidence without inferring completion from commit names.                                                                  |
| Required implementation completion | Blocked                | The [Fashion Store functional-integration plan](../plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md) is `in_progress`; its execution checkpoint owns the current unit and records U12 and U8 as incomplete. | Every required active plan is `completed`, every selected U is complete in that plan, and focused evidence is linked. The candidate ledger does not copy the feature's unit table.                                       |
| Candidate Template Matrix          | Not frozen             | The next candidate's product-approved blocking template scope is not selected.                                                                                                                                                    | Record exact registry IDs and versions explicitly. For a `fashion-store`-only candidate, exclude retired `fashion` and non-target `decor-store`.                                                                         |
| Activation Target                  | Not selected           | Template-specific implementation and acceptance evidence exists.                                                                                                                                                                  | Select exactly one target under the current single-Experience-Snapshot candidate identity.                                                                                                                               |
| Compatibility Observation Set      | Not selected           | Decor Store has parallel evidence under the current internal ID `decor`.                                                                                                                                                          | Optionally record `decor-store` DC3 observations; they cannot block a `fashion-store`-only candidate.                                                                                                                    |
| Candidate identity tooling         | Initial implementation | `release:validate` records commit, release ID, gate results, artifact digests, and environment-isolation mode.                                                                                                                    | Reject tracked and untracked non-ignored changes and persist Product Contract scope, Catalog Release, Candidate Template Matrix, Activation Target, Experience identity/digest, platform contract, and staging identity. |

DC1 cannot begin until every required row is complete and every required U is `Complete` in its
owning active plan.

## Candidate identity

| Field                         | Current value                              |
| ----------------------------- | ------------------------------------------ |
| Commit                        | Not frozen                                 |
| Catalog Release               | Not selected                               |
| Product Contract scope        | Not frozen                                 |
| Required capability set       | Not frozen                                 |
| Approved deferrals            | Not frozen                                 |
| Candidate Template Matrix     | Not frozen — intended `fashion-store` only |
| Activation Target             | Not frozen — intended `fashion-store`      |
| Compatibility Observation Set | Optional `decor-store` DC3 observation     |
| Experience Snapshot           | Not selected                               |
| Platform contract version     | Not selected                               |
| Staging environment           | Not selected for the next candidate run    |

Pre-DC readiness must pass before these fields may be frozen. DC1 must then replace every `Not
selected` or `Not frozen` value before candidate execution begins.

## Development Candidate ledger

| Gate                                                | Status  | Reusable foundation                                                                                                                                                                                    | Remaining candidate evidence                                                                                                                                                                              |
| --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DC1 — Immutable candidate                           | Blocked | Catalog release protocol, saved Worker bundles, release digests, and no-rebuild promotion foundations exist.                                                                                           | Complete Pre-DC implementation and identity-tooling prerequisites, then freeze the full business and template identity from a clean tracked-and-untracked worktree.                                       |
| DC2 — Deployed commerce and administration          | Blocked | The P0 commerce chain, IAM human/service boundaries, Stripe test order/refund, queues, and rollback journeys have historical staging evidence. The private Fashion topology has a deployed U13 runner. | After DC1, rerun the complete activation-target chain against the exact candidate. U12/U8 implementation must be complete before DC1; U13 cannot substitute for it.                                       |
| DC3 — Template compatibility and activation quality | Blocked | Fashion Store and Decor Store have retained source-equivalence, page-suite, accessibility, and performance foundations; old `fashion` is retired.                                                      | After DC1, run blocking quality gates for the Candidate Template Matrix and the single Activation Target. Run any `decor-store` non-target regression as a separately recorded, non-blocking observation. |
| DC4 — Isolation and recovery                        | Blocked | Historical staging proof covers failed publication, last-known-good preservation, rollback/restore, D1 integrity, Queue replay, and resource isolation.                                                | After DC1 and deployed candidate state exist, prove exact-version rollback and artifact availability; reuse drills only when their owning surfaces and acceptance semantics remain unchanged.             |

## Production Gate ledger

These rows cannot become satisfied through CI alone. PG1-PG4 owner assignment and readiness
preparation may proceed during U and DC work, but their final approvals must bind the exact proven
candidate.

| Gate                               | Status             | Remaining authority/evidence                                                                                                         |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| PG1 — Merchant and provider        | Human pending      | Merchant entity, Stripe eligibility, settlement/sellable currencies, payouts, webhook ownership, and final reconciliation acceptance |
| PG2 — Legal and market             | Human pending      | Product category, tax treatment, policy text, cookie/analytics behavior, and shipping-country allowlist                              |
| PG3 — Production infrastructure    | Production pending | Exact production resource isolation, domains, secrets, external alert destination, current backup, and protected GitHub environments |
| PG4 — Operations and accessibility | Human pending      | Support/escalation ownership, representative iOS/Android, VoiceOver/NVDA, provider dashboard, and human-receivable alert evidence    |
| PG5 — Promotion                    | Production pending | Named approver, exact immutable candidate, complete DC evidence, recent approved backup, and explicit promotion confirmation         |

## Evidence sources

- [`docs/progress/cross-border-dtc-commerce-progress.md`](cross-border-dtc-commerce-progress.md)
- [`docs/progress/definition-of-done-evidence.md`](definition-of-done-evidence.md)
- [`docs/progress/multi-user-admin-access-evidence.md`](multi-user-admin-access-evidence.md)
- [`docs/progress/fashion-decor-source-equivalent-progress.md`](fashion-decor-source-equivalent-progress.md)
- [`docs/progress/fashion-store-page-suite-qa.md`](fashion-store-page-suite-qa.md)
- [`docs/plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md`](../plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md)
- [`docs/runbooks/release.md`](../runbooks/release.md)
- [`docs/runbooks/storefront-theme-testing.md`](../runbooks/storefront-theme-testing.md)
- [`docs/runbooks/storefront-theme-promotion.md`](../runbooks/storefront-theme-promotion.md)

## Update rules

- Update current unit, next action, and U completion in the owning active feature plan, not here.
- Do not update this ledger for an implementation task that leaves Pre-DC eligibility unchanged.
  Update it when an active plan completes, reopens, or otherwise changes candidate eligibility.
- Never infer U completion from a commit subject, branch name, green subset of tests, or deployed
  probe narrower than the unit's Definition of Done.
- Record the Candidate Template Matrix from an explicit product decision and resolve every entry
  to the registry at the frozen commit. Record the single Activation Target and any non-blocking
  Compatibility Observation Set separately; branch and worktree placement changes none of them.
- Update a DC row only from evidence bound to the frozen candidate identity above.
- Link existing evidence; do not copy full requirement tables into this ledger.
- A candidate-affecting code, configuration, policy, fixture, migration, or deployable-output
  change resets only the affected DC rows to `Pending` or `Partial`.
- An editorial-only amendment may retain DC evidence when it changes no requirement, security
  boundary, acceptance criterion, evidence meaning, owner, or invalidation rule, and unchanged
  candidate inputs and output digests are recorded. Normative documentation changes invalidate the
  affected evidence.
- A missing PG never changes a passed DC result; it changes only production authorization.
