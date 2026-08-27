---
title: Shoppp Product Master Plan
type: refactor
date: 2026-08-13
topic: shoppp-product-master-plan
execution: knowledge-work
plan_role: product-master
current_plan: 2026-08-11-001-feat-fashion-store-functional-integration-plan.md
current_unit: FS-U8.2
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
| `DS` | The `decor-store` product template | [Decor Motion and Responsive Parity](2026-08-12-002-fix-decor-motion-responsive-parity-plan.md) for home correction; branch-qualified `codex/feat-decor-store-source-parity:docs/plans/2026-08-19-1518-feat-decor-store-page-suite-plan.md` for the remaining-page tail |
| `REL` | Candidate proof and production-promotion policy | [Development Candidate Readiness](2026-08-12-003-refactor-development-candidate-readiness-plan.md) |
| `CI` | Repository validation plus GitHub-first release delivery | [GitHub-First CI/CD Transition](2026-08-26-1756-refactor-github-first-ci-transition-plan.md) while the temporary bridge is active; [Long-Term CI Resilience and GitHub-First Delivery](2026-08-19-1737-refactor-local-first-ci-plan.md) after hand-back |

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
- **Current parent unit:** `FS-U8` — complete Fashion Store test-environment acceptance.
- **Current child stage:** `FS-U8.2` — close bounded gaps from fresh reconciliation. The repaired
  runner and complete local Fashion, Admin, accessibility, performance, scale, static, security,
  and environment matrix are green. The bounded runner, Fashion staging IAM/API, expiring operator,
  deterministic retry source draft, and refreshed `u8-20260825a` run manifest are prepared.
  Twenty-four browser/preflight attempts made no immutable candidate; attempts 22 and 24 retained
  excluded mutable failed-attempt successor and exposed missing isolated-port
  forwarding, a login-readiness locator mismatch, and an exact Fashion development-origin mismatch;
  tested harness `e1a55e18` plus API version `284c7b70` close the launch, origin, login, exact
  context-Card release identity, bounded staging-session cold-start, and repeated invalid-summary
  focus and keyboard resource-selection gaps.
  The prepared retry source's missing reference is schema-valid but absent, its correction is audited,
  and the authenticated draft read passes before the next human attempt.
  A mis-targeted residual test-browser window exposed the first generated password in attempt 9; it
  was immediately invalidated and replaced, the residual browser was removed, and sessions are zero.
- **Next action:** Prepare a fresh audited source, freeze harness `ed91c980` and refreshed manifests,
  reprovision the cleaned operator, and rerun through successor, VoiceOver, Preview, approval, and
  terminal p95 before `FS-U8.3` verification.
- **Blocker:** Fashion staging's authenticated ephemeral build hook now hands builds only to the
  protected self-hosted CD workflow without GitHub-hosted runner billing. Attempt 29 exposed the
  missing competing-save response barrier; harness `91e5db24` now serializes the proven competing
  PUT `200` before requiring the stale PUT `409` and conflict recovery UI.
  The remaining operational dependency is starting the already-registered isolated macOS U8 runner
  listener after the next exact Preview job is queued; ordinary staging and production remain
  excluded.
- **Following sequence:** Complete `FS-U8`; `FS-U3`, `FS-U4`, `FS-U7`, `FS-U9`, `FS-U10`,
  `FS-U11`, `FS-U12`, and `FS-U13` remain completed dependency baselines rather than queued units.
- **Candidate state:** Pre-DC blocked. DC/PG do not begin until all capabilities selected for the
  candidate are complete in their owning plans.

Parallel Decor execution is complete without replacing the product-level Fashion pointer:

- **Parallel plan:** `DS-P1` — Decor Store Remaining Page Suite on branch
  `codex/feat-decor-store-source-parity`.
- **Current parent/child stage:** `DS-P1` complete — U1-U7 are closed with all fourteen Decor
  secondary routes source-compared, behavior-verified, readiness-gated, and browser-verified.
- **Next action:** None in DS-P1. Any real catalog, cart, checkout, payment, authentication, order,
  form-submission, persistence, production-integration, or candidate work requires its owning plan;
  this completion does not change Fashion, REL, DC, or PG scope.
- **Blocker:** None. Unavailable remote placeholder image content is governed as a deterministic
  local-asset adaptation and is excluded from exact image-content parity claims.
- **Isolation:** The temporary worktree at `.worktrees/decor-store-source-parity` owns this
  concurrent checkout until the page-suite work is merged or explicitly abandoned; its lifecycle
  record is retained in shared Git metadata.

Parallel CI infrastructure planning is temporarily routed through a bounded bridge without replacing
either product implementation pointer:

- **Parallel plan:** `CI-GH` — GitHub-First CI/CD Transition, a temporary child bridge of `CI`.
- **Current parent/child stage:** Active `CI-GH-U4` — obtain complete pre-removal GitHub-hosted full
  validation and protected staging rollback/reconciliation proof. CI-GH-U1–U3 completed repository
  authority, hosted-validation, and exact same-run deployment binding without changing the 17 gates
  or Lighthouse thresholds. `CI-U7.3` remains incomplete, and its missing Intel restore remains
  missing.
- **Next action:** Integrate the proof-marker default-deny test correction, then use that exact clean
  protected-default source to prepare a new immutable ordinary-staging successor and run it through
  `deploy.yml` with rollback rehearsal enabled and production disabled. Retain all 17 hosted gates,
  exact artifact binding, staging proof, Worker/proof-marker restoration, D1 reconciliation, and
  restored-state evidence. Do not reuse any terminal failed successor, remove old implementation,
  or trigger production.
- **Blocker:** No external billing blocker remains. Controlled mismatch run `33045559474` was safely
  refused before quality or Cloudflare staging jobs. Exact-source rehearsal run `33045612910` passed
  both source preflights and exposed the missing Catalog-token declaration, which `bd53945a` fixed.
  Commit `5b2e9d73` aligned the governance test. Exact-source run `33046259704` passed all 17 gates and
  same-run input verification, captured exact Worker/D1 baseline artifacts and a D1 export, then
  correctly refused rollback rehearsal because staging has pending migrations `0018`–`0022`. Its
  recovery job restored all three Workers, reconciled D1, and verified safe state; no new Worker or
  production version was deployed. The pending migrations at that point required the named standard
  staging-only forward-alignment recipe before another rollback rehearsal. Forward-alignment run
  `33048142888` for exact source `9928ae85` subsequently passed both preflights, all 17 gates,
  same-run input verification, the D1 backup, migrations `0018`–`0022`, integrity and protected-admin
  checks, and deployment of the three validated staging Workers. Its proof failed when the first
  cart-line mutation correctly rejected the legacy `representative-release-2026-07-30` manifest as
  noncanonical. The current blocker is integration of fail-closed build-time manifest validation and
  creation of a new immutable canonical ordinary-staging successor; the legacy release is not to be
  rewritten. Source validation `ea1f065e` and protected preparation `750b25cb` are integrated, but
  preparation run `33051564144` failed before insertion because the legacy staging product and
  collection primary keys do not satisfy the canonical public-ID schema. It retained the D1 backup
  and created no successor row or production mutation. The tested correction deterministically
  projects canonical manifest IDs while retaining the actual legacy product ID only for the D1
  foreign key. Corrected protected run `33051894271` then passed backup, collision refusal, canonical
  generation, immutable insertion, endpoint read-back, D1 state verification, and receipt retention
  for successor `staging-canonical-2026-08-27-ci-gh-u4`. Exact-source rehearsal run `33052078852`
  then passed both credential-free preflights but failed in the existing `representative-catalog`
  quality gate before any staging credential or mutation: its scale generator violated canonical v2
  identity, reciprocal-link, redirect-status, and route requirements. The successful failure callback
  transitioned that immutable successor to terminal `failed`, and every staging, restoration, and
  production job was skipped. The current dependency is integration of the scale-fixture correction,
  protected preparation of a new immutable successor, and its exact-source hosted/staging rollback
  rehearsal. Correction commit `88528d05` is integrated, and protected preparation run
  `33053063337` passed its staging D1 backup, collision refusal, canonical generation, immutable
  insertion, endpoint read-back, exact D1 state verification, and receipt retention for successor
  `staging-canonical-2026-08-27-ci-gh-u4-b`. Exact-source rehearsal run `33053216917` then passed both
  preflights, all 17 gates, exact deployment-input binding, staging baseline/backup/migration safety,
  protected administrator checks, and all three Worker deployments. The public journey failed
  because later browser gates had rebuilt and overwritten the successor storefront with the default
  legacy release, so its cart-line request was correctly rejected as noncanonical. Worker
  restoration, D1 reconciliation, and restored safe-state verification all passed; production was
  skipped and the successor is terminal failed. Exact-artifact reuse correction `7730951f` is
  integrated without widening Catalog credential exposure. Protected preparation run `33055956466`
  passed its staging D1 backup, collision refusal, canonical projection, immutable insertion,
  protected endpoint read-back, exact D1 state verification, and receipt retention for successor
  `staging-canonical-2026-08-27-ci-gh-u4-c`. The current dependency is only its exact-source
  hosted/staging rollback rehearsal and retained evidence. Exact-source run `33056208460` then
  passed both preflights and the first 14 unchanged gates, including the successor production build
  and static verification. `browser-journeys` exercised the preserved successor artifact correctly,
  but its cart test still hard-coded the predecessor release ID and rejected the correct successor
  request. The failure callback passed; all staging, restoration, human, and production jobs were
  skipped, and the successor is terminal failed. The current dependency is integration of the
  release-aware journey assertion, protected preparation of a new immutable successor, and its
  exact-source rehearsal. Release-aware assertion commit `91202e94` is integrated. Protected
  preparation run `33058031666` passed its staging D1 backup, collision refusal, canonical
  projection, immutable insertion, protected endpoint read-back, exact D1 state verification, and
  receipt retention for successor `staging-canonical-2026-08-27-ci-gh-u4-d`. The current dependency
  is only its exact-source hosted/staging rollback rehearsal and retained evidence. Exact-source run
  `33058180318` then passed both preflights, all 17 unchanged gates, same-run deployment-input
  binding, staging baseline/backup/migration safety, protected administrator checks, and all three
  staging Worker deployments. Public proof reached the correct successor storefront but the API
  correctly refused its still-building Catalog Release; the workflow had deferred `deployed` until
  after proof, creating a lifecycle cycle. Exact Worker restoration, D1 reconciliation, and restored
  safe-state verification passed; human and production jobs were skipped, and the successor is
  terminal failed. The current dependency is integration of a staging-only correlation marker that
  preserves `building`, is removed before the existing terminal callback during rehearsal, and is
  never accepted by production, protected preparation of a new immutable successor, and its
  exact-source rehearsal. Proof-marker correction `91f1b838` is integrated without a migration or
  lifecycle-state change. Protected preparation run `33061325008` passed its staging D1 backup,
  collision refusal, canonical projection, immutable insertion, protected endpoint read-back, exact
  D1 state verification, and receipt retention for successor
  `staging-canonical-2026-08-27-ci-gh-u4-e`. The current dependency is only its exact-source
  hosted/staging rollback rehearsal and retained evidence. Exact-source run `33061506493` passed
  both preflights and the first eight unchanged gates. Worker integration proved the staging
  proof-marked cart path returns 200, but the new default-deny test forced the complete staging
  binding set to `production`, producing an unrelated configuration 500 instead of the expected
  Catalog 422. The validation failure callback passed; all staging, restoration, human, and
  production jobs were skipped, and the successor is terminal failed. The current dependency is
  integration of a direct helper-level default-deny assertion, protected preparation of a new
  immutable successor, and its exact-source rehearsal. Hosted
  validation run `33041884429` passed all 17
  gates for exact source `b1ea32e33335e964f1578af057e87a008ab27df0`, but it did not provide the
  missing pre-mutation Worker capture or restored staging state. CI-GH-U4 and the dependency boundary
  therefore remain open until the rollback-capable exact source passes the full hosted/staging
  exercise; local, historical Intel, and Codex Cloud output cannot replace it.
- **Tail:** `CI-GH-U4` through `CI-GH-U7`, then return to `CI-U8.3` for the GitHub-first
  release-availability/recovery boundary, followed by `CI-U11.1` steady-state review. The transition
  preserves all 17 release gates, Lighthouse thresholds, exact-SHA binding, protected deployment,
  rollback, and REL/DC/PG authority while removing future Docker/Intel/provider-independent release
  obligations.

The 2026-08-17 activation reverified exactly one registered Shoppp worktree at `8a3723d4` and a
separately reachable Decor branch. The product master explicitly accepts that observable topology
as satisfying FRT's operational one-worktree dependency. This does not mark WTC-U1 or WTC-U2
complete, reconstruct their missing historical raw evidence, merge Decor code, or change candidate
scope.

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
| `FS` | [Fashion Store Functional Integration](2026-08-11-001-feat-fashion-store-functional-integration-plan.md) | Current Fashion Store implementation | **Active — current `FS-U8.2`; U12 complete with governed test-environment proof** | This plan owns `FS-U8` and the remaining Fashion Store tail |
| `FS-F1` | [Fashion Store Integration Remediation](2026-08-12-001-fix-fashion-store-integration-remediation-plan.md) | Corrective child of `FS` | Named fixes and narrow U13 evidence are inherited; no broader parent completion claim | `FS` owns remaining integration and final completion |
| `DS` | [Decor Motion and Responsive Parity](2026-08-12-002-fix-decor-motion-responsive-parity-plan.md) | Parallel `decor-store` correction | Parallel implementation plan; completion is not asserted here | This plan or a named `decor-store` successor |
| `DS-P1` | `codex/feat-decor-store-source-parity:docs/plans/2026-08-19-1518-feat-decor-store-page-suite-plan.md` | Parallel remaining-page source-parity successor | **Complete — DS-P1-U1-U7 closed 2026-08-19 with fourteen-route source, behavior, browser, build, performance, and repository evidence** | Completed authority for secondary-page replicas and focused evidence; inherited Decor plans continue to own home behavior, and future business integration requires a successor |
| `REL` | [Development Candidate Readiness](2026-08-12-003-refactor-development-candidate-readiness-plan.md) | Pre-DC/DC/PG policy and execution | Blocked by unfinished selected product implementation | Candidate ledger after an immutable candidate is frozen |
| `FRT` | [Retired Fashion Runtime Decommission](2026-08-13-002-refactor-retired-fashion-runtime-plan.md) | Old runtime-template retirement | **Complete — FRT-U1-U4 closed 2026-08-17 with zero-data, removal, retained-template, repository, and fresh-static evidence** | Completed authority for runtime `fashion` deletion, actual-data inventory, and the `fashion-store-source` comparison-label migration |
| `WTC` | [Shoppp Worktree Convergence](2026-08-13-003-refactor-worktree-convergence-plan.md) | Local worktree simplification | Incomplete after re-audit — current one-worktree topology is verified, but WTC-U1/U2 lack reconstructible pre-removal evidence; WTC-U3 remains complete | Historical evidence and the 2026-08-14 re-execution audit are in `docs/progress/worktree-convergence.md`; future temporary checkout lifecycle follows `AGENTS.md` |
| `CI` | [Long-Term CI Resilience and GitHub-First Delivery](2026-08-19-1737-refactor-local-first-ci-plan.md) | Historical and post-bridge CI authority | **Temporarily paused at incomplete `CI-U7.3`; CI-U1–U3, CI-U7.1–U7.2, and CI-U12 remain complete; resumes at `CI-U8.3` only after CI-GH hand-back** | Retains completed CI history, then owns the GitHub-first availability boundary and `CI-U11.1` review; it does not own the current transition unit while the bridge is active |
| `CI-GH` | [GitHub-First CI/CD Transition](2026-08-26-1756-refactor-github-first-ci-transition-plan.md) | Temporary CI route-switch bridge | **Active — CI-GH-U1–U3 are integrated on `origin/main`; current `CI-GH-U4` has passing hosted 17-gate and forward-alignment evidence plus a protected canonical staging successor, and now requires the exact-source rollback/reconciliation exercise; Docker/Intel/provider-independent implementation remains** | Owns CI-GH-U1–U7, exact transition supersessions, pre-removal and post-removal non-production hosted/staging proof, and hand-back to `CI-U8.3`; no product, candidate, DC/PG, or production-promotion authority |
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
6. The Decor Store Remaining Page Suite supersedes only the home plan's deferral of secondary
   pages. It does not supersede accepted home behavior, the parallel home motion/correction plan,
   future product-framework integration ownership, candidate scope, or production-promotion policy.
7. DC/PG are mandatory production-promotion policy for an immutable candidate. They do not gate
   ordinary U implementation, local preview, or a non-production development proof.
8. The Long-Term CI plan preserves repository-owned fast/post-commit commands and completed
   self-hosted/capsule/evidence history, but its future release authority is GitHub-first: direct
   hosted full validation, GitHub run/attempt artifacts, protected environments, and fail-closed
   release pause during GitHub unavailability. PR automation remains optional and deferred. The plan
   does not supersede feature checkpoints, candidate selection, DC/PG gates, credential and approval
   boundaries, rollback, or production-promotion authority.
9. The GitHub-First CI/CD Transition plan temporarily owns the route switch and explicitly
   supersedes the future Docker, Intel, provider-independent evidence, alternate-CD, and
   GitHub-independent release obligations it names. It preserves completed CI history and all
   release-quality, exact-source, protected-deployment, rollback, credential, REL, DC, PG, and
   production-approval boundaries. On closure it returns tail ownership to `CI-U8.3`, followed by
   `CI-U11.1`, rather than becoming a second permanent CI plan.

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

## Product-level follow-up plans

### 1. Completed Retired Fashion runtime decommission

[Retired Fashion Runtime Decommission](2026-08-13-002-refactor-retired-fashion-runtime-plan.md)
completed authorized aggregate inventory for possible `theme_id=fashion` data, the
`fashion-store-source` comparison-label migration, registry and catalog removal, old implementation
deletion, and retained-template verification. Its zero-row result removed speculative compatibility
work; the completed plan remains the inherited retirement authority.

### 2. Worktree convergence

[Shoppp Worktree Convergence](2026-08-13-003-refactor-worktree-convergence-plan.md) treats the
former worktrees as implementation containers, not product boundaries. Four redundant local
checkouts are absent and the Decor branch and commits remain independently resumable, but the
required pre-removal raw manifests and removal commands were not retained. WTC-U1 and WTC-U2 are
therefore not complete; the 2026-08-14 rerun verifies only the current one-worktree state. Future
short-lived task worktrees are allowed only when concurrent work requires them and must carry a
cleanup condition and retained pre-removal evidence.

### 3. Decor Store identity migration

Plan the internal `decor` to `decor-store` migration separately. It does not block Fashion Store
implementation or a `fashion-store`-only candidate, but it must be complete before a
`decor-store` Activation Target is frozen.

### 4. Decor Store remaining page suite

The branch-qualified Decor Store Remaining Page Suite continues from the accepted home-only
`decor-store` baseline and owns exactly the fourteen non-home Crafto Decor source entries. It runs
in parallel with Fashion execution from a temporary worktree, preserves the home runtime boundary,
and keeps Product, Wishlist, Cart, Checkout, and Account replicas fixture-backed and
presentation-only. It does not connect the replica pages to current catalog, cart, checkout,
authentication, payment, provider, or order capabilities; later product-framework integration is
owned by a successor plan. Its reconstruction process reuses the existing shared source-equivalence
policy, inventory/capture tools, behavior verifier, orchestrator, and home-era Decor runner unchanged
by default. Shared implementation changes require a concrete failing Decor source case and remain the
smallest regression-covered adaptation; unrelated Fashion live/business workflow is omitted. No
second workflow is created. Order and policy surfaces have no dedicated Decor source entry and remain
outside this page-replication scope.

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
- `FS-U8.2` is the single current product execution pointer and matches the active child plan.
- The old `fashion` implementation, `decor-store` naming, DC/PG scope, and worktree policy are stated
  without changing product behavior in code.
- No historical plan is marked complete without an owning completion statement.
- Future product-level status changes have an explicit same-change update rule.
