# Source-Equivalence Acceptance System Reference

This reference explains how to run and interpret the executable acceptance system. It is not a
second reconstruction workflow. The only normative workflow is
[Source-Equivalent HTML Template Porting](../runbooks/source-equivalent-html-template-port.md); if
the two documents disagree, the runbook wins.

## System boundaries

The acceptance implementation has three technical layers:

1. Theme data: `source-contract.ts` and `behavior-contract.ts` describe source identity, regions,
   selectors, triggers, outcomes, branches, fallbacks, owners, and evidence states.
2. Shared engine: inventory scanners, browser probes, capture modes, geometry/pixel comparison, and
   evidence verification remain theme-neutral.
3. Page adapter: add one only when shared probes cannot express the source behavior. Record its ID
   and reason in the behavior contract; selector differences alone are data, not custom code.

Fashion Store is the worked example. Its policy, source entries, digests, routes, contract exports,
focused states, and commands are registered in
`tools/storefront-source-equivalence-policy.json`.

The acceptance system does not activate a production theme, connect live commerce, or publish a
private preview artifact. Deleted theme implementations are not valid preview targets.

## Commands and scope

Run the smallest useful level while implementing:

```sh
# One declared state; final evidence remains outstanding.
bun run accept:source-equivalence -- \
  --scope focused --theme fashion-store --state search-open --mode interaction

# Every declared state for the current page.
bun run accept:source-equivalence -- --scope page --theme fashion-store

# Cross-page debugging before release-candidate freeze.
bun run accept:source-equivalence:shadow -- --theme fashion-store

# Build once and bind the candidate artifact, commit, tree, and policy.
bun run --cwd apps/storefront build:preview:fashion-store
bun run source-equivalence:rc -- freeze \
  --theme=fashion-store --artifact=apps/storefront/.output/public

# Verify the immutable candidate and commit-bound evidence.
bun run accept:source-equivalence -- \
  --scope repository --evidence=<report-directory> --commit=<exact-commit-sha> \
  --rc-manifest=<rc-manifest>
```

Use `--dry-run` before a long batch. Focused, page, theme, and shadow scopes intentionally report
`fullEvidenceOutstanding: true`; none is releasable evidence. Shadow is the one full-suite debugging
pass before RC freeze. Repository scope refuses to start without commit-bound fidelity evidence and
rejects commit, tracked-tree, policy, or artifact drift.

| Level        | Operational purpose                          | Normal matrix                                     |
| ------------ | -------------------------------------------- | ------------------------------------------------- |
| `focused`    | Develop or repair one observable state       | One page/state/mode                               |
| `page`       | Converge one page                            | Every declared state for that page                |
| `shadow`     | Find cross-page regressions before RC freeze | Contracts plus deduplicated full-page behavior    |
| `repository` | Verify an already-stable immutable candidate | Full-SHA evidence and mandatory frozen RC binding |

Page commands are contract-owned and resolve to the smallest existing test family. Pages that share
one source spec share that test family honestly. Theme, shadow, and repository scopes use one theme
command instead of multiplying the full browser build by page count. Fashion Store acceptance uses
isolated loopback ports and restores the generated active-theme file to its exact pre-run bytes.

Do not use repository acceptance as a debugging loop. Any code, contract, fixture, policy, or
artifact change after freeze invalidates the RC and requires a new page/shadow pass and freeze.

## Local preview operations

Prepare and serve the current page on a loopback-only address:

```sh
bun run --cwd apps/storefront dev:fashion-store
```

For a built artifact, use `apps/storefront/scripts/serve-static.ts`. Keep immutable source captures
separate from implementation captures and record the exact commit, source identity, ports, and
evidence path. Restore the production fallback after review:

```sh
bun run --cwd apps/storefront prepare:experience
bun run verify:themes
```

Never create `approval.json` merely because automation passed. It requires explicit approval of the
live preview and side-by-side evidence and does not activate or promote a theme.

## Evidence-mode payload fields

The normative runbook decides which modes apply and when they pass. Current reports provide these
logical fields for the selected mode, although their serialized names may differ by adapter:

| Mode           | Required evidence                                                                            |
| -------------- | -------------------------------------------------------------------------------------------- |
| `static`       | Frozen geometry, typography, visible copy, assets, screenshots, and pixel differences        |
| `temporal`     | Real elapsed time, initial/in-flight/settled position, duration/easing, and loop observation |
| `interaction`  | Trigger, visible outcome, dismissal, focus behavior, and unchanged route where applicable    |
| `scroll-fixed` | Monotonic progress, stable fixed geometry, threshold visibility, and return to top           |
| `fallback`     | Reduced motion, no-JS readability, capability failure, teardown, and remount                 |

## Capability evidence payloads

Use these authoring templates for Tier A capabilities declared by the normative runbook. Map them
to the existing contract and report schema; do not claim a field is enforced until the verifier has
a controlled negative test for it.

### Carousel

```yaml
controls:
  source: []
  implementation: []
initial:
  active_index: 0
  track_transform: ""
in_flight:
  elapsed_ms: 0
  track_transform: ""
settled:
  active_index: 0
  track_transform: ""
transition:
  duration_ms: 0
  easing: ""
autoplay:
  delay_ms: 0
  pauses_on: []
loop_boundary:
  continuous: false
thumbnail_coupling:
  active_index: 0
  track_transform: ""
```

Source-missing controls must be absent. An index change with zero duration, no positive in-flight
displacement, or `display` replacement is a temporal failure.

### Filter

```yaml
selection:
  group: ""
  value: ""
  combined_with: []
before:
  result_ids: []
  result_count: 0
after:
  result_ids: []
  result_count: 0
  active: false
reset:
  result_ids: []
  result_count: 0
combination:
  result_ids: []
  result_count: 0
focus_retained: false
```

Changing only the active style while the result IDs/count remain unchanged is a behavior failure.

### Overlay

```yaml
trigger:
  item_id: ""
  index: 0
displayed:
  item_id: ""
  index: 0
  caption: ""
  counter: ""
geometry:
  backdrop_opacity: 0
  image_box: {}
  controls: {}
scroll_locked: false
dismissal:
  close: false
  escape: false
  backdrop: false
focus:
  initial: ""
  restored_to: ""
mobile_composition: {}
```

The trigger and displayed item/index must match. Dialog visibility alone is never sufficient.

### Shared surface

```yaml
surface_id: ""
owner: ""
variant: ""
consumer_routes: []
semantic_substitutions: []
control_signature:
  appearance: ""
  background: ""
  border: ""
  padding: ""
  font: ""
  color: ""
geometry: {}
overflow: ""
non_home_state: ""
```

Every registered consumer must match the source-backed signature for its declared variant. A body
selector from the first page is not shared styling evidence.

## Controlled-defect fixture templates

Gate 4 uses source-backed synthetic defects. Each fixture must fail for the named reason before the
implementation is allowed to pass:

```yaml
- id: carousel-teleport
  mutation: keep the final index change but set track transition duration to zero
  expected_failure: STATE_OR_BEHAVIOR_FAILURE

- id: filter-active-without-results
  mutation: apply the selected style without changing result IDs/count
  expected_failure: STATE_OR_BEHAVIOR_FAILURE

- id: overlay-wrong-trigger-index
  mutation: open the overlay with a different item/index and omit document scroll lock
  expected_failure: STATE_OR_BEHAVIOR_FAILURE

- id: shared-control-home-only-reset
  mutation: remove the component-root reset and retain it only under the home body selector
  probe_route: one registered non-home consumer
  expected_failure: PAGE_ACCEPTANCE_FAILURE
```

The fixture mutates only test-owned input or capture state and restores exact pre-run bytes in
`finally`. Never weaken production code, source captures, or policy thresholds to manufacture the
failure.

## Evidence identity

Final reports include the reviewed commit, capture time, independent source and implementation
URLs, route/region/state, viewport, DPR, capture mode, policy-owned threshold, geometry, and retained
diagnostics. Reports with stale timestamps, wrong source entries, wrong modes, missing matrix cells,
self-relaxed thresholds, or failures are rejected.

## Failure triage

Triage in this order:

1. Source identity or digest mismatch: stop; the authority changed.
2. Missing contract/candidate/state: correct intake before page code.
3. Behavioral probe failure: reproduce the user-visible source and implementation outcomes.
4. Geometry/style/copy mismatch: inspect structured diagnostics before screenshots.
5. Pixel mismatch: inspect heatmaps and ranked crops after deterministic diagnostics.
6. Ambiguous residual: use model-assisted review on the few ranked crops and require a human
   decision for any waiver.

The runner reports `RC_IDENTITY_MISMATCH`, `CONTRACT_MISMATCH`,
`STATE_OR_BEHAVIOR_FAILURE`, `PAGE_ACCEPTANCE_FAILURE`, `EVIDENCE_MISMATCH`, or
`TRANSIENT_INFRASTRUCTURE_FAILURE` and emits the narrow rerun command. Retry only a recognized
transient infrastructure failure once with `--retry-transient=1`; never retry a deterministic
failure until its cause changes.

Shared capture readiness covers fonts, eager/lazy images, image decoding, stable geometry, focus,
pointer, Escape, and scroll reset. Page adapters remain responsible for drawers, filters,
carousels, storage, and fixtures because generic cleanup can create a state absent from the source.

Thresholds are policy-owned. Any intentional difference requires a narrow, approved, expiring
waiver; do not loosen a threshold for one page.

## Runner routing

Runner selection is a cost and risk decision:

| Runner | Use                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------- |
| Sol    | Ambiguous source interpretation, cross-cutting architecture, escaped-defect diagnosis, final review |
| Terra  | Routine implementation, repository investigation, test repair, and Luna fallback                    |
| Luna   | Optional narrow repeatable batches when exposed by the environment                                  |

Do not spawn an agent to satisfy this table. Use Luna only for independent, low-ambiguity batches
with explicit inputs and outputs, such as asset inventory summaries, repeated crop classification,
or mechanical report normalization. Keep source-authority decisions, shared contract design,
coupled page edits, and final diagnosis with Sol or Terra.
