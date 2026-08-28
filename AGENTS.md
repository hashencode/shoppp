# Repository delivery-document rules

These rules apply to work in this repository.

- Before plan-scoped implementation, identify the active feature plan and read its execution
  checkpoint.
- A successor plan must name its upstream product authority, inherited baseline, explicit
  supersessions, parallel plans, and tail ownership. Preserve stable R/F/AE/KTD/U identifiers where
  their governed behavior still exists.
- A stable U may use decimal execution child stages such as `U1.1` reconciliation, `U1.2` gap
  implementation, and `U1.3` verification. Child stages clarify the next action but never replace
  the parent U or become candidate completion authority.
- The active feature plan is the only authority for its current unit, per-unit status, blocker,
  next concrete action, and implementation tail.
- Update that checkpoint in the same change that moves a unit between statuses, changes the current
  or next unit, changes execution order because of a blocker, or completes/reopens the plan.
- Do not update volatile status for an internal fix that leaves those facts unchanged. Add focused
  test, deployment, run, review, or operational evidence under `docs/progress/` when retention is
  useful.
- Progress/evidence files must not maintain a second current-unit queue. Candidate-readiness files
  track only Pre-DC eligibility, frozen candidate identity, DC evidence, and PG state.
- `docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md` is the product master plan. It
  owns the product map, complete plan register, global aliases, active-plan pointer, product-level
  sequence, and supersession history. Child plans still own detailed U status and evidence.
- Update the master pointer in the same change that changes the active plan, current parent U or
  decimal child stage, next concrete action, product-level order, plan classification, or tail
  owner. Do not copy full child unit tables or per-test evidence into the master plan.
- Commit subjects, branches, worktrees, and narrow probes are supporting trace, not completion
  authority.
- Shoppp is one product. Current product template names are `fashion-store` and `decor-store`; the
  older `fashion` implementation is retired, and `decor-store` currently maps to the legacy code ID
  `decor` until a deliberate migration. Implementation boundaries do not create products or make
  `decor-store` block a `fashion-store`-only candidate.
- Formal cross-template regression belongs to DC3. Non-target compatibility observations do not
  block a candidate unless that template is explicitly included in the frozen Candidate Template
  Matrix.
- Keep one long-lived primary Shoppp worktree for ordinary development. A branch or worktree name
  does not limit that checkout to one template, and Fashion Store and Decor Store do not require
  permanent separate worktrees.
- Create a temporary worktree only for actual concurrent isolation. Record its branch/ref, owner,
  purpose, and cleanup condition when it is created; remove the checkout when that condition is met
  without inferring any product, template, U, DC, or PG status change.
- Removing a worktree never authorizes deleting or merging its branch, PR, tag, evidence, or product
  plan. Validate exact paths, links, dirty content, and ref reachability before destructive cleanup.
- Before removing a dirty worktree, stop known writers and retain the exact tracked, untracked, and
  material ignored-path manifests plus the removal command. A force removal requires an exact-path,
  plan-scoped approval and cannot be inferred from a prior cleanup or from branch containment alone.
- Shoppp currently has one developer. Ordinary development does not require a pull request: use
  local verification and the governed branch/main workflow without creating or waiting for an
  unnecessary PR. Create a PR only when the user explicitly requests one or a concrete
  multi-contributor, external-review, or repository-policy requirement makes it useful.
