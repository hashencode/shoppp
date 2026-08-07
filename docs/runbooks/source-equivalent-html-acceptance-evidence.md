# Source-equivalence acceptance evidence

This guide explains how to run and interpret the executable acceptance system. The normative port
workflow remains [Source-Equivalent HTML Template Porting](source-equivalent-html-template-port.md).

## Contract boundaries

Use three layers, in this order:

1. Theme data: `source-contract.ts` and `behavior-contract.ts` describe source identity, regions,
   copy, selectors, triggers, outcomes, branches, fallbacks, and evidence states.
2. Shared engine: inventory scanners, browser probes, capture modes, geometry/pixel comparison, and
   evidence verification must remain theme-neutral.
3. Page adapter: add an adapter only when the shared probes cannot express the source behavior.
   Record the adapter ID and reason in the behavior contract. Selector differences alone are data,
   not a reason for custom code.

Fashion Store is the worked example. Its source is the independent Crafto template root under
`templates/`; the implementation lives under `apps/storefront/app/themes/fashion-store/`. Their paths,
entry digest, behavior contract, browser config, focused states, and page command are registered in
`tools/storefront-source-equivalence-policy.json`.

This workflow does not activate a production theme, connect live commerce, or publish a private
preview artifact. Deleted theme implementations are not valid preview targets.

## Verification cadence

Run the smallest useful level while implementing:

```sh
# One failed state; final evidence remains outstanding.
bun run accept:source-equivalence -- \
  --scope focused --theme fashion-store --state search-open --mode interaction

# All acceptance for the current page.
bun run accept:source-equivalence -- --scope page --theme fashion-store

# Contracts, full theme matrix, and commit-bound fidelity reports.
bun run accept:source-equivalence -- \
  --scope repository --evidence=<report-directory> --commit=<exact-commit-sha>
```

Use `--dry-run` before a long batch. Keep browser workers within the policy maximum and use one
worker for heavy full-page/named-state work. A filtered focused pass is not releasable evidence; the
runner says `fullEvidenceOutstanding: true` for focused and page runs. Repository acceptance
refuses to start without commit-bound fidelity evidence.

## Local preview and visual approval

Prepare and serve the current page on a loopback-only address:

```sh
bun run --cwd apps/storefront dev:fashion-store
```

For a built artifact, use `apps/storefront/scripts/serve-static.ts` or another loopback-only static
server. Keep immutable source captures separate from implementation captures, and record the exact
commit, source identity, ports, and evidence path in the handoff. Restore the production fallback
after review with:

```sh
bun run --cwd apps/storefront prepare:experience
bun run verify:themes
```

Do not create `approval.json` until the user explicitly accepts the live preview and side-by-side
evidence. Passing automation is not visual approval and does not activate or promote a theme.

The five evidence modes answer different questions:

| Mode           | Required evidence                                                                            |
| -------------- | -------------------------------------------------------------------------------------------- |
| `static`       | Frozen geometry, typography, visible copy, assets, screenshots and pixel differences         |
| `temporal`     | Real elapsed time, before/after position or index, positive displacement, loop observation   |
| `interaction`  | Trigger action, visible outcome, dismissal, focus behavior, unchanged route where applicable |
| `scroll-fixed` | Monotonic progress, stable fixed geometry, threshold visibility, return to top               |
| `fallback`     | Reduced motion, no-JS/static readability, capability failure, teardown and remount           |

## Evidence identity and triage

Final reports must include the reviewed commit, capture time, independent source and implementation
URLs, route/region/state, viewport, DPR, capture mode, matrix-owned threshold, geometry, and retained
diagnostics. Reports older than the allowed window, using the wrong source entry, captured in the
wrong mode, missing matrix cells, or containing failures are rejected.

Triage failures in this order:

1. Source identity or digest mismatch: stop; the authority changed.
2. Missing contract/candidate/state: correct intake before page code.
3. Behavioral probe failure: reproduce the user-visible outcome on source and implementation.
4. Geometry/style/copy mismatch: inspect structured diagnostics before screenshots.
5. Pixel mismatch: inspect heatmap and ranked crops only after deterministic diagnostics.
6. Ambiguous residual: use model-assisted visual review on the few ranked crops, then require a
   human decision for any waiver.

Do not loosen a threshold to make one page pass. Any intentional difference requires a narrow,
approved, expiring policy waiver.

## Runner routing

Runner selection is a cost and risk decision, not a quota:

| Runner | Use                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------- |
| Sol    | Ambiguous source interpretation, cross-cutting architecture, escaped-defect diagnosis, final review |
| Terra  | Routine implementation, repository investigation, test repair, and Luna fallback                    |
| Luna   | Optional narrow, repeatable batch work when actually exposed by the environment                     |

Keep Sol and Terra as the normal two levels. Luna is optional: use it only for independent,
low-ambiguity, long-running batches whose inputs and expected output are explicit. If Luna is not
available, route that work to Terra. Do not spawn an agent merely to satisfy this table; for small
tasks, coordination costs and merge risk exceed model savings.

Suitable Luna batches include deterministic asset inventory summaries, repeated screenshot crop
classification, and mechanical report normalization. Do not use it for source-authority decisions,
shared contract design, coupled page edits, or final defect diagnosis.

## Human checkpoints

Review source and implementation together after header/hero/product, after the first carousel and
timed surface, after the complete desktop page including edge controls, and after the mobile and
fallback passes. A human-discovered miss first becomes a behavior-contract row and controlled
failing fixture; only then fix the page.

## Post-port metrics

Record this block in the task handoff or follow-up solution document:

```yaml
theme: THEME_ID
source_revision: SHA256_OR_REVISION
elapsed_hours:
behaviors_at_intake: 0
behaviors_added_after_intake: 0
automation_escapes: 0
approved_visible_differences: 0
ledger_maintenance_minutes: 0
custom_adapter_count: 0
runner_usage:
  sol_tasks: 0
  terra_tasks: 0
  luna_tasks: 0
  luna_fallbacks_to_terra: 0
longest_gate:
  name: ""
  seconds: 0
```

Compare these metrics after the next two ports. Growth in post-intake behaviors or automation
escapes means source inventory is still incomplete. Growth in adapter count means shared probes may
need extension. High ledger effort with no prevented defects means simplify the contract. Record
gate duration so platform/build work is visible instead of being misattributed to page fidelity.
