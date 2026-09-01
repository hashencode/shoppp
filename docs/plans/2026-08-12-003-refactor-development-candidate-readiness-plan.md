---
title: Shoppp Development Candidate Readiness - Plan
type: refactor
date: 2026-08-12
topic: development-candidate-readiness
execution: knowledge-work
status: blocked
blocked_by: pre-dc-implementation-readiness
---

# Shoppp Development Candidate Readiness - Plan

## Goal Capsule

- **Objective:** Give Shoppp one bounded answer to whether a selected immutable build is ready for
  production validation without treating feature completion or human approval as the same state.
- **Baseline:** The repository contains substantial commerce, IAM, release, recovery, source-
  equivalence, and template evidence. That evidence is reusable foundation, not proof that every
  business capability or template integration is complete.
- **Boundary:** U remains the product implementation unit, DC owns cross-feature candidate proof,
  and PG owns human/environment production authorization.
- **Stop conditions:** Stop before DC1 while any required implementation unit is incomplete, lacks
  a completion verdict in its owning active plan, or the validator cannot bind the full candidate
  identity. Stop before candidate execution if the commit, Product Contract scope, Catalog Release,
  Candidate Template Matrix, Activation Target, Experience input, platform contract, or
  environment is mutable or ambiguous. Stop before promotion while any required PG lacks a named
  owner and evidence.

## Product and template model

Shoppp is one product with two current product template names: `fashion-store` and `decor-store`.
The older `fashion` implementation is retired and excluded from candidates. `decor-store` is the
product name for the implementation that currently uses the legacy internal ID `decor`; the two
names do not represent separate templates. Plans, branches, and worktrees do not create products or
candidate dependencies.

The candidate records three separate template dimensions:

- **Candidate Template Matrix:** the product-approved template IDs and versions whose compatibility
  is required for this immutable candidate. Registry presence alone never adds an entry.
- **Activation Target:** the one template receiving complete live-Commerce, experience, operator,
  and promotion acceptance for this release. The current candidate identity supports exactly one
  target because one Experience Snapshot binds one template ID and version. Multi-target candidates
  require a later explicit candidate-identity contract change.
- **Compatibility Observation Set:** non-target templates optionally exercised during DC3 to detect
  shared-platform regressions. These observations are recorded but are not candidate-blocking.

For a `fashion-store`-only candidate, `decor-store` is not in the Candidate Template Matrix unless a
later explicit candidate decision adds it. Decor Store visual, motion, responsive, page-suite, or
activation work therefore does not block that Fashion Store candidate.

## Scope

### In scope

- One immutable candidate identity spanning the Product Contract scope, storefront, admin, API,
  migrations, Catalog Release, Candidate Template Matrix, Activation Target, and approved
  Experience input.
- Local release validation, deployed staging commerce proof, template-matrix compatibility,
  activation-target acceptance, rollback, restore, and environment-isolation evidence.
- A single candidate ledger that links active feature plans and existing operational evidence
  without becoming a second implementation tracker.

### Outside scope

- New commerce, IAM, theme, or administration behavior.
- Production theme activation or migration decisions.
- Product capabilities explicitly deferred by the frozen Product Contract scope, including the
  requirements-only AI product form until an implementation plan selects it.
- Product support decisions, destructive deletion of the retired `fashion` package, or migration of
  the internal `decor` ID to `decor-store`. Those require bounded implementation work outside DC.
- A second test runner, evidence database, persistent candidate control plane, or duplicate release
  workflow.

## Pre-DC implementation readiness

DC is validation-only. DC1 remains blocked until all of the following are true:

- the product-level capability set for the intended release is explicit, including approved
  deferrals and non-applicable items;
- every U required by that capability set, the Candidate Template Matrix, and the Activation
  Target is `Complete` in its owning active plan with focused verification evidence;
- no required capability is `Not started`, `Initial implementation`, `In progress`, unaudited, or
  inferred complete only from commit names or historical green tests;
- the complete validation machinery required by those units is implemented before it is rerun as
  candidate evidence; and
- `release:validate` rejects tracked and untracked non-ignored changes and can require, verify, and
  persist the complete candidate identity in its immutable report.

Fashion Store U12 and U8 are complete in their owning plan as of 2026-09-01 and no longer block
Pre-DC. Current blockers are the unaudited product-level capability set and approved deferrals,
reconciliation of every selected capability against its owning plan, and candidate-identity fields
not yet fully enforced by `release:validate`. Existing U13 evidence remains a narrow deployed
product-lookup, fresh-cart, and stable-variant-add proof rather than candidate evidence.

### Executable source-input authority

The release operator approved this REL-owned policy on 2026-08-25 for CI-U7 portable evidence:

- the only executable candidate input is a clean `git archive` produced from one approved exact
  commit object and bound to that commit's tree SHA;
- candidate preparation rejects tracked changes and every untracked non-ignored path before
  finalization, even though those bytes are excluded from the archive;
- ignored, generated, cached, downloaded, or caller-selected workspace bytes are never executable
  candidate input; a future exception requires a versioned REL policy and an exact-byte manifest,
  and none is approved by this decision;
- the source archive, commit, tree, lockfile, execution-capsule manifest, release report, and every
  retained deployable artifact are digest-bound in the signed evidence bundle; and
- a locally verified bundle prepares evidence only. It does not select a candidate, complete DC/PG,
  or authorize staging or production mutation.

## Candidate selection

Before DC1 begins, the release owner records:

- exact commit and clean-worktree state;
- authoritative Product Contract revisions, required capability set, and approved deferrals;
- immutable Catalog Release ID;
- the product-approved Candidate Template Matrix with exact registry IDs and versions;
- the single Activation Target for the release;
- any non-blocking Compatibility Observation Set;
- immutable Experience Snapshot ID and platform contract version;
- staging environment identity.

Changing the capability set, Candidate Template Matrix, or Activation Target changes the candidate.
A failed or unfinished capability cannot be removed from the frozen scope merely to retain a green
DC verdict.

## Development Candidate gates

### DC1. Freeze the immutable candidate

**Purpose:** Prove every downstream gate is evaluating the same source and deployable output.

**Uses:** `bun run release:validate`, Catalog release/build protocol, release report, migration
digests, and Cloudflare version tags.

**Pass criteria:**

- the worktree is clean and the commit is recorded;
- tracked and untracked non-ignored worktree changes are both rejected;
- the release report records every required local gate, SHA-256 digest, Product Contract scope,
  Catalog Release, Candidate Template Matrix and versions, Activation Target, Experience Snapshot
  identity and digest, platform contract, and staging identity;
- storefront, admin, API, and migrations are the saved outputs later deployed to staging;
- Catalog Release, template matrix, activation, and Experience identities match the generated
  storefront; and
- no preview credential or mutable draft is represented as production-candidate input.

**Does not own:** Feature fixes, theme promotion, or production approval.

### DC2. Prove the deployed commerce and administration chain

**Purpose:** Show the candidate works through the real staging storefront, API, Worker, D1, Queue,
Workflow, Stripe test mode, and authenticated admin boundaries.

**Uses:** The existing immutable-commerce deployment workflow, activation-target staging workflow,
IAM evidence, and payment reconciliation runbook.

**Pass criteria:**

- catalog discovery, product selection, cart, authoritative shipping, checkout, signed payment
  convergence, order lookup, fulfillment, refund, and notification outcomes pass for the selected
  candidate scope;
- authorized human and service identities succeed while prohibited identities fail;
- retained evidence names the candidate inputs, run, environment, and resulting immutable order
  using redacted non-bearer identifiers; every artifact or external evidence link records its access
  owner, retention class, and deletion policy; and
- unexpected skips, fixture-owned live facts, or mocked final browser APIs fail the gate.

**Does not own:** Production credentials or provider eligibility approval.

### DC3. Prove template compatibility and activation quality

**Purpose:** Show the Candidate Template Matrix remains compatible with Shoppp and the Activation
Target preserves its approved structure, behavior, accessibility, responsiveness, static content,
performance, and Commerce authority. Run any non-target cross-template regression here rather than
inside feature-U completion.

**Uses:** Source-equivalence acceptance, template matrices, accessibility/performance gates, static
verification, and template-isolation checks.

**Pass criteria:**

- every Candidate Template Matrix entry passes platform contract, build, static-output, fixture and
  credential exclusion, isolation, and baseline regression checks;
- the Activation Target passes its full applicable experience and live-Commerce acceptance;
- structural, behavioral, absence-parity, temporal, responsive, keyboard, touch, reduced-motion,
  no-JavaScript, and source-identity checks applicable to the Activation Target pass;
- the candidate evidence is regenerated after any tracked theme, policy, fixture, or acceptance
  change; and
- any Compatibility Observation Set result is recorded separately and cannot fail the candidate;
  for a `fashion-store`-only candidate, a failing or incomplete `decor-store` observation creates
  follow-up work without changing the Fashion Store verdict; and
- source reconstruction, live Commerce integration, promotion, and legacy cleanup remain distinct
  decisions.

**Does not own:** Choosing the Activation Target, adding or removing product templates, deleting the
retired `fashion` package, or migrating the `decor` internal ID.

### DC4. Prove isolation, failure behavior, and recovery

**Purpose:** Demonstrate that candidate failure does not corrupt production authority or remove the
last-known-good service.

**Uses:** Environment-isolation verifier, failed-publication path, D1 backup/restore drill, Queue/DLQ
replay, version rollback, and immutable artifact restoration.

**Pass criteria:**

- staging and production resources, credentials, callbacks, and provider targets do not cross;
- a failed publication leaves the prior storefront live and creates bounded operator evidence;
- the exact candidate can roll back to last-known-good and restore without rebuilding;
- backup integrity, foreign keys, inventory, order invariants, and restored counts reconcile; and
- exact-version rollback and saved-artifact availability are proved for the candidate; database
  restore and Queue replay evidence may be reused only when their schema, migration, backup,
  recovery, and queue surfaces are unchanged, still current, and explicitly linked as inherited.

**Does not own:** Destructive production restore authorization.

## Production Gates

DC/PG is a mandatory policy only for production promotion. It does not delay ordinary feature
implementation, local preview, or a parent U's focused completion. Any immutable build intended for
production must pass all applicable DC gates, and production must remain unchanged until every
required PG approves that same candidate. A development-only build may stop without PG work.

DC completion means **ready for production validation**, not **production ready**. PG1-PG4 owner
assignment and readiness preparation should begin during U work so legal, provider, infrastructure,
operations, and accessibility blockers surface early. Their final approvals still bind the exact
candidate. PG5 remains the terminal promotion authorization.

| Gate                             | Named authority        | Required decision/evidence                                                                                |
| -------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| PG1 Merchant and provider        | Merchant owner         | Entity eligibility, currencies, payouts, Stripe/webhook ownership, and reconciliation acceptance          |
| PG2 Legal and market             | Legal/compliance owner | Product category, tax, policy text, cookies/analytics, and shipping-country approval                      |
| PG3 Production infrastructure    | Infrastructure owner   | Production resources, domains, secrets, alert destination, backup, and GitHub environment protection      |
| PG4 Operations and accessibility | Operations owner       | Support/escalation, representative iOS/Android, automated keyboard/focus/semantic accessibility evidence, provider dashboard, and external alert reception |
| PG5 Promotion                    | Release approver       | Exact candidate, DC evidence, recent production backup, and explicit `PROMOTE <release-id>` authorization |

## Historical U-to-DC mapping

Historical U identifiers, dependencies, and retained evidence remain unchanged. Terminology may be
corrected when an older plan mistakes an implementation stream for a product boundary. Their
release-oriented evidence is consumed as follows:

| Existing authority                                      | Candidate use                                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-border commerce U13                               | Prior DC2 and DC4 staging evidence; rerun where candidate identity changed                                                               |
| Multi-user IAM U9 and evidence ledger                   | DC2 identity proof, DC4 isolation, and PG3/PG5 prerequisites                                                                             |
| Theme Platform U9 and retained Fashion/Decor evidence   | DC3 candidate-template evidence or non-blocking compatibility observations, according to frozen scope                                     |
| Fashion Store functional U13                            | Early DC2 private topology/add-to-cart evidence only                                                                                     |
| Fashion Store functional U12 and U8                     | Pre-DC implementation completion inputs; after completion, rerun their machinery against the exact Activation Target as DC2/DC3 evidence |
| Fashion Store page-suite U12                            | DC3 page and behavior evidence                                                                                                           |

No historical unit is renamed, renumbered, or marked incomplete solely because this mapping exists.

## Execution order

```text
Product scope and Candidate Template Matrix reconciled
  -> all required U units complete in owning active plans
  -> candidate identity tooling complete
  -> DC1 immutable candidate
  -> DC2 deployed chain + DC3 template/activation proof
  -> DC4 failure and recovery proof
  -> development candidate ready
  -> PG1-PG4 final candidate-bound approvals
  -> PG5 promotion authorization
  -> production promotion
```

PG1-PG4 readiness preparation runs in parallel with U and DC work; the diagram shows only their
final candidate-bound approval point.

DC2 and DC3 may run in parallel after DC1 when they do not share mutable staging fixtures. DC4 runs
after the saved candidate versions and required state exist. Any candidate-affecting code,
configuration, policy, fixture, migration, or deployable-output change creates a new candidate and
returns the process to DC1. An editorial documentation amendment may retain the candidate only when
it changes no requirement, security boundary, acceptance criterion, evidence meaning, owner, or
invalidation rule, and the ledger records unchanged inputs and output digests. A normative document
change invalidates the affected DC evidence.

## Definition of Done

- The vocabulary and authority rules in
  [`docs/architecture/delivery-units-and-candidate-gates.md`](../architecture/delivery-units-and-candidate-gates.md)
  are followed without rewriting historical plans.
- One exact candidate identity is recorded in
  [`docs/progress/development-candidate-readiness.md`](../progress/development-candidate-readiness.md).
- Pre-DC eligibility links every required U completion verdict from its owning active plan and
  records the Candidate Template Matrix, Activation Target, and any non-blocking Compatibility
  Observation Set separately.
- Applicable DC1-DC4 rows link machine-readable or retained evidence for that candidate.
- Approved deferrals and human-owned work are visible without allowing unfinished required behavior
  to disappear from the candidate verdict.
- Production promotion remains impossible until every required PG names the same candidate and has
  current evidence.
