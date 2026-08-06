# Storefront Theme Promotion

## Decision boundary

Fashion 2 remains an isolated private-preview experiment under the `fashion-2` theme ID. Passing
source provenance, fidelity, lifecycle, accessibility, performance, and regression gates records
the branch as **promotion-eligible**. A green fidelity report is not a promotion instruction. It
must not rename a theme, rewrite an approved snapshot, select a production experience, or create an
approval record.

Promotion and abandonment are explicit human decisions. Record the decision owner, reviewed
evidence commit, capture identity, accepted exceptions, and migration or removal change before
either path begins.

## Evidence required for eligibility

- The original `fashion` source and the `fashion-2` implementation have matching commit-bound
  initial and named-state evidence at the approved viewport/DPR matrix.
- Full-page changed-pixel ratios are at or below 1%, declared geometry is within 2 CSS pixels, and
  asset, console, hydration, keyboard, reduced-motion, runtime-failure, and remount checks pass.
- Fashion, Decor, Fashion 2, and production-fallback builds pass their existing static,
  interaction, accessibility, performance, and selected-theme isolation gates.
- Fashion 2 alone contains the approved source cascade and reviewed jQuery/vendor capabilities;
  no build executes the upstream `main.js` application entrypoint.
- The evidence bundle identifies the exact commit and contains no `approval.json` unless a human
  reviewer creates it during a later approval workflow.

## Promote

Create a separate migration plan. It must decide whether the candidate becomes the stable
`fashion` package at `themeVersion: 2.0.0` or remains a differently named product. The plan must
also define configuration compatibility, snapshot migration, generated-catalog changes, preview
fixture migration, stored experience compatibility, rollout cohorts, monitoring, and rollback.

Promotion requires a new reviewed change and explicit approval. Do not mutate existing immutable
snapshots. Produce successor snapshots, dry-run their migration, prove current customer selections
remain resolvable, then use the normal storefront activation and release controls.

## Abandon

If the human decision is to abandon the experiment, remove the `fashion-2` descriptor, manifest,
registry, preset, fixture builder, source-import policy entries, source tree, preview scripts,
capture descriptor, budgets, tests, and experiment documentation on its branch. Regenerate the
catalog and rerun source-equivalence, current-theme, and production-fallback isolation gates.

Abandonment must not edit the current Fashion or Decor package and does not require a production
rollback because the experiment was never activated.

## Rollback before a decision

Until promotion is separately approved, rollback is branch-local removal of the Fashion 2
experiment. Preserve the evidence long enough for review, restore the generated preview fixture to
the current Fashion selection, and verify the production fallback contains no preview theme. A
failed or incomplete gate leaves the experiment isolated and records the blocking evidence; it
never lowers current-theme budgets or silently promotes partial work.
