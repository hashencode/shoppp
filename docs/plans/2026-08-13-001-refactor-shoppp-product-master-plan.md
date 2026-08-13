---
title: Shoppp Product Master Plan
type: refactor
date: 2026-08-13
topic: shoppp-product-master-plan
execution: knowledge-work
plan_role: product-master
current_plan: 2026-08-11-001-feat-fashion-store-functional-integration-plan.md
current_unit: FS-U1.1
---

# Shoppp Product Master Plan

## Purpose and authority

This is the product-level entry point for Shoppp. It preserves the complete plan lineage, identifies
the authority for each product area, and gives one current execution pointer and one next action.
It does not copy the requirement, unit, test, or evidence tables owned by its child plans.

Authority is divided deliberately:

- This master plan owns the product map, plan relationships, global aliases, active-plan pointer,
  product-level sequencing, and supersession history.
- Each active child plan remains authoritative for its requirements, parent U definitions,
  detailed unit status, blocker, focused evidence, and implementation tail.
- `docs/progress/` retains execution evidence without owning a second implementation queue.
- The candidate plan and candidate ledger own Pre-DC, immutable candidate identity, DC evidence,
  and PG state only after product implementation is eligible for candidate selection.

When the active plan, current parent U or child stage, next action, product-level order, or plan
classification changes, update this master pointer in the same change as the owning child plan.
The child plan wins if a temporary mismatch is discovered; repairing the master pointer is then the
next documentation action.

## Product model

Shoppp is one cross-border DTC commerce product with these product areas:

| Alias | Product area | Current authority |
| --- | --- | --- |
| `COM` | Commerce, catalog, cart, checkout, orders, fulfillment, provider and recovery behavior | [Cross-Border DTC Commerce Platform](2026-07-30-001-feat-cross-border-dtc-commerce-platform-plan.md) |
| `THEME` | Versioned manifests, registries, configuration, preview lifecycle and template isolation | [Versioned Storefront Theme Platform](2026-07-30-002-feat-versioned-storefront-theme-platform-plan.md) |
| `IAM` | Admin authentication, users, roles, authorization and environment isolation | [Multi-User Admin Access](2026-08-04-001-feat-multi-user-admin-access-plan.md) |
| `AI` | Reviewable AI assistance in product editing | [AI-Assisted Product Form](2026-08-04-002-feat-ai-assisted-product-form-plan.md) |
| `FS` | The `fashion-store` product template | [Fashion Store Functional Integration](2026-08-11-001-feat-fashion-store-functional-integration-plan.md) |
| `DS` | The `decor-store` product template | [Decor Motion and Responsive Parity](2026-08-12-002-fix-decor-motion-responsive-parity-plan.md) |
| `REL` | Candidate proof and production-promotion policy | [Development Candidate Readiness](2026-08-12-003-refactor-development-candidate-readiness-plan.md) |

`fashion-store` and `decor-store` are templates in the same product and shared theme platform. The
older `fashion` reimplementation is retired and is not a third product template. The existing code
ID `decor` denotes `decor-store` during a deliberate migration period; it does not denote another
template.

## Identifier model

Child-plan U-IDs remain stable and local. This master plan qualifies them with the product-area
alias when a cross-plan reference would otherwise be ambiguous:

- `FS-U1.1` means child stage `U1.1` in the Fashion Store Functional Integration plan.
- `DS-U1` means parent `U1` in the Decor Motion and Responsive Parity plan.
- `COM-U4` means parent `U4` in the Cross-Border DTC Commerce plan.

The alias is a navigation prefix, not a renumbering. Existing R/F/AE/KTD/U identifiers and their
historical evidence remain unchanged inside the owning plans.

## Current execution pointer

- **Active product plan:** `FS` — [Fashion Store Functional Integration](2026-08-11-001-feat-fashion-store-functional-integration-plan.md).
- **Current parent unit:** `FS-U1` — shared functional contracts.
- **Current child stage:** `FS-U1.1` — reconcile the existing implementation and evidence against
  the complete U1 contract before writing additional business code.
- **Next action:** Finish `FS-U1.1`. Enter `FS-U1.2` only for confirmed gaps; otherwise advance to
  `FS-U1.3`, run focused verification, and record parent `FS-U1` complete.
- **Following feature unit:** `FS-U2`, then the dependency order recorded by the active child plan.
- **Candidate state:** Pre-DC blocked. DC/PG do not begin until all capabilities selected for the
  candidate are complete in their owning plans.

The completed repository-cleanup work does not replace this product-development pointer. `WTC-U1`
through `WTC-U3` left one long-lived Shoppp checkout while preserving the Decor branch and PR as an
independently resumable development line. The queued `FRT` plan may prove its data gate, rename the
Crafto comparison label, and delete the old Fashion runtime without waiting for Decor code
integration.

## Product-plan register

Status terms in this table are intentionally conservative. `Implemented/evidenced, not audited`
means useful code or evidence exists but no current authority proves the entire original contract
complete. It must not be promoted to `Complete` from a branch name, commit subject, or passing
focused test alone.

| Alias | Plan | Product role | Current classification | Tail authority |
| --- | --- | --- | --- | --- |
| `COM` | [Cross-Border DTC Commerce Platform](2026-07-30-001-feat-cross-border-dtc-commerce-platform-plan.md) | Root product and Commerce contract | Product authority; repository contains substantial implementation, but full-plan completion is not asserted here | Its own contract until a named Commerce successor supersedes it |
| `THEME` | [Versioned Storefront Theme Platform](2026-07-30-002-feat-versioned-storefront-theme-platform-plan.md) | Shared template-platform contract | Inherited platform authority; completion not re-audited | Later template plans extend only their named behavior |
| `THEME-H1` | [Fashion and Decor Theme Fidelity](2026-07-30-003-fix-fashion-decor-theme-fidelity-plan.md) | Early visual-correction plan | Historical; its looser resemblance standard is superseded | Source-equivalent plans own later fidelity requirements |
| `THEME-H2` | [Source-Equivalent Fashion and Decor](2026-07-31-001-refactor-source-equivalent-fashion-decor-plan.md) | Source-equivalent home strategy | Historical implemented baseline; current template identities and later plans supersede named details | `FS` and `DS` own their current template tails |
| `IAM` | [Multi-User Admin Access](2026-08-04-001-feat-multi-user-admin-access-plan.md) | Admin identity and authorization | Implemented/evidenced, not audited against the complete plan | This plan until a named IAM successor is created |
| `AI` | [AI-Assisted Product Form](2026-08-04-002-feat-ai-assisted-product-form-plan.md) | AI product-editing contract | Requirements-only and deferred until the product form stabilizes | This requirements contract; implementation planning has not started |
| `INT-H1` | [Safe Local Branch and Worktree Integration](2026-08-05-001-refactor-safe-local-integration-plan.md) | Historical branch/worktree integration | Historical integration baseline; its observed 2026-08-05 topology is stale | A new bounded worktree-convergence plan must own future cleanup |
| `FS-H1` | [Fashion Store Source-Parity Home](2026-08-06-001-feat-fashion-store-source-parity-plan.md) | Fashion Store home baseline | Complete and inherited; its former only-template decision is superseded | `FS` owns current Fashion Store work |
| `THEME-H3` | [HTML Reconstruction Acceptance Automation](2026-08-07-001-feat-html-reconstruction-acceptance-automation-plan.md) | Shared reconstruction acceptance tooling | Complete and inherited | Feature plans own their own acceptance outcomes |
| `FS-H2` | [Fashion Store Complete Page Suite](2026-08-07-002-feat-fashion-store-page-suite-plan.md) | Fifteen-page presentation and route baseline | Implemented/evidenced, not audited as complete functional behavior | `FS` reconciles the inherited implementation |
| `FS` | [Fashion Store Functional Integration](2026-08-11-001-feat-fashion-store-functional-integration-plan.md) | Current Fashion Store implementation | **In progress — current `FS-U1.1`** | This plan owns the current unit, next action and Fashion Store tail |
| `FS-F1` | [Fashion Store Integration Remediation](2026-08-12-001-fix-fashion-store-integration-remediation-plan.md) | Corrective child of `FS` | Named fixes and narrow U13 evidence are inherited; no broader parent completion claim | `FS` owns remaining integration and final completion |
| `DS` | [Decor Motion and Responsive Parity](2026-08-12-002-fix-decor-motion-responsive-parity-plan.md) | Parallel `decor-store` correction | Parallel implementation plan; completion is not asserted here | This plan or a named `decor-store` successor |
| `REL` | [Development Candidate Readiness](2026-08-12-003-refactor-development-candidate-readiness-plan.md) | Pre-DC/DC/PG policy and execution | Blocked by unfinished selected product implementation | Candidate ledger after an immutable candidate is frozen |
| `FRT` | [Retired Fashion Runtime Decommission](2026-08-13-002-refactor-retired-fashion-runtime-plan.md) | Old runtime-template retirement | Queued supporting code plan; does not replace `FS-U1.1` | Owns runtime `fashion` deletion, actual-data inventory, and the `fashion-store-source` comparison-label migration |
| `WTC` | [Shoppp Worktree Convergence](2026-08-13-003-refactor-worktree-convergence-plan.md) | Local worktree simplification | Complete with evidence-retention limitation — one long-lived Shoppp checkout remains; Decor branch and PR are retained | Historical evidence and its non-reconstructible raw-manifest limitation are in `docs/progress/worktree-convergence.md`; future temporary checkout lifecycle follows `AGENTS.md` |
| `MASTER` | This plan | Whole-product navigation, lineage and active pointer | Active product authority | Updated with every product-level pointer or classification change |

## Decision hierarchy and supersessions

1. The Commerce Product Contract governs Commerce, administration, provider, recovery, and
   production behavior unless a named successor explicitly supersedes a requirement.
2. The Theme Platform plan governs manifests, registries, configuration, preview lifecycle, and
   selected-template isolation where no later plan explicitly revises a detail.
3. Source-equivalent and template plans own their named visual, page, interaction, and functional
   additions without redefining Shoppp as separate products.
4. The Fashion Store Integration Remediation plan supersedes its source plans only for the explicit
   defects and narrow U13 boundary it names.
5. The Fashion Store Functional Integration plan is the current implementation-status authority
   for Fashion Store.
6. DC/PG are mandatory production-promotion policy for an immutable candidate. They do not gate
   ordinary U implementation, local preview, or a non-production development proof.

The 2026-08-13 product decision explicitly supersedes earlier wording that retained only
`fashion-store` and removed both `fashion` and `decor`:

- retain `fashion-store` as the current Fashion Store product template;
- retire the old `fashion` runtime implementation and rename the still-used Crafto comparison label
  to `fashion-store-source` so no product, runtime, or reference identity remains named `fashion`;
- retain Decor Store under the product name `decor-store`;
- treat code ID `decor` as that same template's legacy implementation identity until migration;
  and
- keep `decor-store` independent from a `fashion-store`-only candidate.

No plan may add or remove candidate support merely from product membership or code existence. The
frozen Candidate Template Matrix and Activation Target own candidate scope.

## Next product-level plans

### 1. Retired Fashion runtime decommission

[Retired Fashion Runtime Decommission](2026-08-13-002-refactor-retired-fashion-runtime-plan.md)
owns authorized aggregate inventory for possible `theme_id=fashion` data, the
`fashion-store-source` comparison-label migration, registry and catalog removal, old implementation
deletion, and retained-template verification. Zero real rows remove speculative compatibility work;
any non-zero result stops deletion until a separate explicit data disposition is approved.

### 2. Worktree convergence

[Shoppp Worktree Convergence](2026-08-13-003-refactor-worktree-convergence-plan.md) treats the
former worktrees as implementation containers, not product boundaries. It completed bounded
tracked, untracked, and material-ignored checks, removed four redundant local checkouts, and kept the
Decor branch and PR independently resumable without forcing code harvesting or a merge. The current
state is one long-lived primary worktree; future short-lived task worktrees are allowed only when
concurrent work requires them and must carry a cleanup condition.

### 3. Decor Store identity migration

Plan the internal `decor` to `decor-store` migration separately. It does not block Fashion Store
implementation or a `fashion-store`-only candidate, but it must be complete before a
`decor-store` Activation Target is frozen.

## Update contract

Update this master plan when any of the following changes:

- the active child plan;
- the current parent U or decimal child stage;
- the next concrete action or dependency order;
- a plan becomes complete, blocked, deferred, superseded, or reactivated;
- a new successor plan takes tail ownership; or
- product membership, candidate-policy scope, or an authority relationship changes.

Do not copy per-test results, unit-by-unit evidence, or the entire child execution table here.
Those remain in the owning plan or `docs/progress/`. This keeps the master pointer useful without
creating competing detailed ledgers.

## Definition of done for this master-plan revision

- All existing Shoppp plans appear in the register and retain their historical documents.
- Commerce, IAM, AI, Theme Platform, Fashion Store, Decor Store, integration, and release work are
  visible from one product entry point.
- `FS-U1.1` is the single current product-development pointer and matches the active child plan.
- The old `fashion` implementation, `decor-store` naming, DC/PG scope, and worktree policy are stated
  without changing product behavior in code.
- No historical plan is marked complete without an owning completion statement.
- Future product-level status changes have an explicit same-change update rule.
