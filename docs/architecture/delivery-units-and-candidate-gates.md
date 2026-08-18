# Delivery Units, Development Candidates, and Production Gates

## Purpose

Shoppp separates product implementation from candidate proof and production authorization. The
three layers answer different questions and must not be collapsed into one completion status.

| Layer                             | Question                                                           | Owns                                                                                                 | Completion meaning                                                            |
| --------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `U` — Implementation Unit         | What capability is being built?                                    | Product behavior, focused tests, and feature documentation                                           | The scoped capability is implemented and locally verified.                    |
| `DC` — Development Candidate gate | Does the selected combination behave as one trustworthy candidate? | Immutable candidate identity, integrated evidence, recovery, and environment isolation               | The candidate may enter production validation; it is not production-approved. |
| `PG` — Production Gate            | May this exact candidate change production?                        | Named human decisions, production resources, external-provider approval, and promotion authorization | Production promotion is authorized for the exact proven candidate.            |

The state transition is:

```text
Product scope recorded
  -> every required U complete in its owning active plan
  -> selected into an immutable candidate
  -> applicable DC gates pass
  -> development candidate ready
  -> PG owners approve the same candidate
  -> production promotion
```

## U rules

- U-IDs remain local to their owning plan. Existing U-IDs are historical authority and are never
  renamed or renumbered to fit this vocabulary.
- A plan may split execution beneath a stable unit into decimal child stages such as `U1.1`,
  `U1.2`, and `U1.3`. These child labels clarify reconciliation, gap implementation, and focused
  verification; they do not create new product requirements, replace the parent U, or become DC
  completion authorities on their own.
- A U ends in a product- or operator-observable capability. Focused integration evidence may be
  part of the unit, but candidate-wide release evidence is not its completion authority.
- Completing every U in one feature does not make a multi-application candidate ready. It only
  makes that feature eligible for selection into a candidate.
- Commit names, green focused tests, and the presence of implementation code do not by themselves
  make a U complete. The owning active plan must record the unit's observable outcome and focused
  verification in its execution checkpoint.
- A feature plan may include a historical U whose goal was release readiness. Keep that unit and
  its evidence unchanged; map its evidence into the appropriate DC gate instead of rewriting it.

## Documentation authority

Shoppp records volatile delivery status once:

- The active feature plan owns its current unit, per-unit status, blocker, next concrete action,
  and implementation tail.
- `docs/progress/` stores retained test, deployment, run, review, and operational evidence. An
  evidence document may describe the result it proves, but it does not maintain a duplicate
  current-unit queue.
- The candidate ledger owns only Pre-DC eligibility, frozen candidate identity, DC evidence, and PG
  state. It does not track ordinary implementation-task progress.
- Product and architecture documents define stable scope and dependency relationships. The product
  master plan additionally owns one synchronized active-plan/current-stage pointer and the
  product-level sequence; it does not copy the child plan's complete unit or evidence tables.
- The active child plan remains authoritative when a temporary pointer mismatch is discovered. The
  mismatch is repaired in the master plan as the next documentation action.

A successor plan names its upstream product and architecture authorities, inherited completed
baseline, implemented-but-unaudited evidence, explicit supersessions, parallel same-product plans,
and tail owner. Stable R/F/AE/KTD/U identifiers remain unchanged wherever the governed behavior
still exists. A later plan supersedes only the conflicts it identifies; omission is not deletion.

An active plan checkpoint changes in the same change that moves a unit between statuses, changes
the current or next unit, changes execution order because of a blocker, or completes the plan. An
internal fix that leaves those facts unchanged adds evidence where needed without creating status
churn.

## Product and template model

- Shoppp is one product. Its current product template names are `fashion-store` and `decor-store`;
  they are parallel implementations within the same theme platform, not competing projects.
- The older internal template ID `fashion` is retired and has been removed from active runtime,
  fixture, registry, catalog, Admin-selection, and build surfaces. Historical plans and aggregate
  inventory evidence may still name it; it is not supported, activation-eligible,
  candidate-blocking, or a source of current product requirements.
- `decor-store` is the product name for the existing Decor Store implementation. The code currently
  uses the legacy internal ID `decor`; that ID must be migrated deliberately before a
  `decor-store` activation candidate is frozen. It does not denote a second product template.
- Branches and worktrees organize implementation. Their names and commit placement do not define
  product scope, template support, candidate membership, or production activation.
- The **Candidate Template Matrix** is selected explicitly for one immutable candidate and records
  only the template IDs and versions whose compatibility is required for that candidate. Registry
  presence, product membership, historical evidence, or code existence does not add a template to
  this blocking matrix.
- The **Activation Target** is the template receiving complete candidate-specific experience,
  live-Commerce, operator, and promotion evidence in this release. The current identity contract
  supports exactly one target because one Experience Snapshot binds one template ID and version.
  That target must be in the Candidate Template Matrix.
- A non-target product template may be exercised in DC3 as a **compatibility observation**. Its
  result is recorded but does not block the candidate unless the frozen candidate explicitly added
  that template to the Candidate Template Matrix. Therefore `decor-store` does not block a
  `fashion-store`-only candidate.
- A template still under implementation must be marked as such in its owning active plan and cannot
  be selected as an Activation Target until its required U units are complete.

## DC rules

- DC work adds validation depth, not product scope. A product behavior discovered as missing during
  DC execution returns to the owning feature plan or receives a new U.
- DC gates apply only to the product capabilities and Candidate Template Matrix recorded in the
  candidate. Explicitly deferred capabilities remain visible in the frozen business scope; a
  failing or unfinished capability cannot be silently reclassified as deferred during DC.
- Every DC result binds the exact commit, Product Contract revisions, required capability set,
  approved deferrals, Catalog Release, Candidate Template Matrix and versions, Activation Target,
  Experience input, platform contract, environment, and evidence artifact relevant to that gate.
- A prior staging run remains useful historical evidence, but it does not prove a later candidate
  when a code, configuration, policy, fixture, migration, or deployable-output change can affect
  that gate. An editorial documentation amendment does not force a rerun only when it changes no
  requirement, security boundary, acceptance criterion, evidence meaning, owner, or invalidation
  rule, and the unchanged candidate inputs and output digests are recorded. A normative document
  change invalidates the affected DC evidence.
- One structured candidate ledger is the candidate-status authority. Active feature plans remain
  the implementation-status authorities, and evidence documents are linked rather than copied.
- DC gates reuse `release:validate`, the existing deployment workflows, source-equivalence
  acceptance, and current runbooks. They do not create a second QA platform.
- Evidence invalidation is gate-scoped. The candidate ledger must name which changed surface makes
  which DC stale instead of resetting every gate indiscriminately.
- Formal cross-template regression belongs to DC3. A feature U may run focused local regression as
  implementation evidence, but another template's incomplete visual or interaction work cannot be
  inserted into that U's completion contract.

## PG rules

- DC and PG are mandatory only when an immutable candidate is being prepared for production
  promotion. They do not gate ordinary feature implementation, local preview, or completion of an
  individual U.
- A production promotion must pass every applicable DC gate and every required PG. A candidate that
  is not intended for production may stop after its scoped development evidence without inventing
  PG work.
- PG status is owned by named people or environment authorities, not inferred from a green CI run.
- Merchant eligibility, legal policy, production resources, real-device and screen-reader review,
  alert reception, backups, and final promotion approval remain PG concerns.
- A PG approval must reference the same immutable candidate that passed DC. Rebuilding after
  approval creates a different candidate and invalidates the approval.
- Production remains unchanged when any required PG is missing, rejected, expired, or bound to a
  different candidate.

## Authority and complexity budget

Authority flows one way: Product Contracts define behavior, U plans implement it, DC plans prove
the selected result, and PG owners authorize production. A downstream DC or PG document cannot
silently strengthen product requirements.

A new persistent state machine, counter, lease, topology restriction, or release-blocking matrix
requires all of the following before it enters a DC gate:

1. a concrete observed failure or named high-impact threat;
2. evidence that the existing bounded control is insufficient;
3. the smallest proposed control and its lifecycle cost; and
4. a measurement that confirms or retires the added mechanism.

Unmeasured low-probability concerns are recorded as follow-up observations, not candidate blockers.

## Current authorities

- Product master plan:
  [`docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md`](../plans/2026-08-13-001-refactor-shoppp-product-master-plan.md)
- Active Fashion Store implementation:
  [`docs/plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md`](../plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md)
- Candidate execution plan: [`docs/plans/2026-08-12-003-refactor-development-candidate-readiness-plan.md`](../plans/2026-08-12-003-refactor-development-candidate-readiness-plan.md)
- Candidate status: [`docs/progress/development-candidate-readiness.md`](../progress/development-candidate-readiness.md)
- Release procedure: [`docs/runbooks/release.md`](../runbooks/release.md)
- Theme promotion boundary: [`docs/runbooks/storefront-theme-promotion.md`](../runbooks/storefront-theme-promotion.md)
