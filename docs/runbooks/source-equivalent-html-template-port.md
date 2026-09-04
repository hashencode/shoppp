# Source-Equivalent HTML Template Porting

## Purpose

Use this workflow when an existing HTML template must become an actual Shoppp theme without losing
its visible content, responsive behavior, interaction states, typography, or original assets.
This is a source-equivalent port, not a screenshot-inspired redesign.

This file is the single normative reconstruction workflow. Operational command syntax, evidence
schemas, and runner troubleshooting live in the non-normative
[Source-equivalence acceptance system reference](../reference/source-equivalence-acceptance-system.md).
If the reference and this runbook disagree, this runbook wins.

The authority order is fixed:

1. Original HTML for structure, order, copy, semantics, and link intent.
2. Shared, responsive, and demo-specific CSS for the resolved cascade.
3. Runtime and plugin initialization for observable behavior and timing.
4. Original assets, local fonts, icon glyphs, intrinsic dimensions, and retina variants.
5. A live original page for computed-style, geometry, and temporal measurements.
6. Screenshots for verification only.

Never use an existing approximation or a screenshot as the implementation baseline.

## Repository boundaries

The port must continue to use the Theme Engine, manifest, preset, namespaced registry, fixtures,
Nuxt routes, and theme asset resolver. A normal theme must not change the renderer. Do not ship
unreviewed upstream global styles or runtime, demo handlers, remote fonts, placeholder media, or
substitute assets.

Choose and record one implementation strategy for each source capability:

- preserve the complete, reviewed, hash-pinned source capability inside the selected-theme
  isolation boundary; or
- rebuild its observable state transitions with scoped framework code and semantic controls.

Do not silently mix fragments of the two strategies. A capability includes its source DOM, default
CSS state, initializer, generated classes/DOM, inline geometry, responsive branches, and teardown.
Keeping a hiding rule such as `cursor: none` while omitting the runtime-created replacement is a
failed capability, not an acceptable partial port.

Declare the equivalence scope before work begins. A page is either:

- **source-equivalent:** every visible region, state, breakpoint, and destination has source-backed
  evidence; or
- **platform-complete:** it satisfies Shoppp route and capability contracts but is not represented
  as a reproduction of the supplied page.

Do not silently mix these standards within one route.

## Stage-gated workflow

### Gate 0: Scope and Definition of Done

Record the source identity and revision, entry documents, allowed page types, forbidden runtime,
canonical viewports, interaction states, thresholds, and any known intentional difference. Name a
single theme as the active implementation unit; complete it before starting another.

Separate the work into explicit milestones: source-equivalent reconstruction, platform integration,
repository stabilization, theme promotion, and legacy-theme cleanup. Do not make deletion or
promotion a hidden consequence of completing the reconstruction.

Set the default visible-content difference budget to zero. Any new, removed, or rewritten visible
copy or control requires a source citation or a pre-approved waiver. Typed application intents and
accessibility improvements do not automatically authorize new visible UI.

Set an authored-override budget before implementation. Every non-source CSS rule must be classified
as framework integration, documented accessibility adaptation, or approved source deviation.
Unclassified visual rules fail immediately; crossing the agreed rule/byte review threshold requires
human approval so the port cannot silently turn into another handwritten theme.

Exit evidence:

- immutable source identity and ownership approval;
- explicit source-equivalent page list;
- implementation and acceptance routes;
- implementation strategy and owner for every runtime-bearing capability;
- zero unapproved visible-content differences;
- authored-override classification and review threshold recorded;
- no unresolved scope decision.

### Gate 1: Executable original

Serve the complete upstream package root from one stable origin. Confirm all local dependencies,
images, fonts, and initialization files load. Wait for `document.fonts.ready`, decoded images, and
lazy content before measuring. Provide a deterministic seam to pause or seek autoplay and motion.

Operate the original page, not only its HTML. Exercise every link, button, pointer cursor, hover-only
container, dropdown, overlay, carousel, marquee, sticky control, progress indicator, timer, resize
branch, and scroll action. Read the relevant source JavaScript as a behavioral specification even
when it will not execute in the application.

Exit evidence:

- zero failed local requests, broken images, or external font fallbacks;
- source origin and entry URLs recorded;
- initial and named states can be reproduced on demand.

### Gate 2: Source inventory and contract

Walk the original document in order. Keep three explicit contracts rather than one undifferentiated
inventory:

- **structural parity:** DOM, content, assets, styles, breakpoints, and initial geometry;
- **behavioral parity:** user-visible state transitions and runtime dependencies; and
- **absence parity:** source-visible content that may not be silently added, removed, or rewritten.

For every visible region record:

- HTML range and contributing selector families;
- exact copy, counts, link intent, and control semantics;
- asset identity, intrinsic size, crop, object position, and 1x/2x pairing;
- computed font family, real weight, size, line height, letter spacing, and text width;
- colors, borders, radii, shadows, visibility, and bounding boxes;
- desktop, laptop, tablet, and mobile composition;
- pointer, keyboard, touch, focus, dismissal, disabled, and reduced-motion behavior;
- motion direction, easing, duration, delay, loop, autoplay, pause, midpoint, exit, and interruption.

Before implementing the first page, build a cross-page surface census across every declared source
entry. Record each repeated surface in one ownership map:

| Field                 | Required value                                                                |
| --------------------- | ----------------------------------------------------------------------------- |
| Surface ID            | Stable header, card, overlay, filter, carousel, or footer identity            |
| Source signatures     | DOM/class, data/action ownership, behavior, style, and responsive signatures  |
| Consumer routes       | Every source and implementation route that renders the surface                |
| Variants              | Only source-proven differences and the field that selects each difference     |
| Implementation owner  | The one component or module allowed to render the surface                     |
| Consumer verification | Cross-route style/geometry/behavior signature and one visual per real variant |

Two current source consumers with the same DOM, data/action ownership, and behavior signature make
a shared component mandatory. Similar-looking surfaces with different ownership or behavior remain
separate until their common contract is proven; do not create a configurable abstraction for a
hypothetical future variant. This census is a bounded identity/ownership pass, not full visual
acceptance for every page. Page contracts may compose an owned shared surface but must not copy its
markup, control reset, or interaction logic.

For every actionable or stateful element, add a behavior-ledger row:

| Field              | Required value                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Source selector    | Exact element or selector family                                                            |
| Role               | Navigation, external link, form, overlay trigger, state control, carousel, or scroll action |
| Triggers           | Load, timer, hover, focus, click, keyboard, touch, resize, or scroll                        |
| Initial state      | Classes, attributes, computed visibility, and geometry                                      |
| Capability chain   | DOM, CSS, initializer, generated state/geometry, fallback, and teardown                     |
| Observable outcome | Open, close, move, focus, visibility, or navigation result                                  |
| Branches           | Breakpoint, pointer/touch, keyboard, and reduced-motion behavior                            |
| Owner              | Preserved source runtime, framework adapter, approved adaptation, or explicit deferral      |
| Evidence           | Focused outcome assertion and named-state/temporal capture                                  |

Every row must be classified as `reproduced`, `approved adaptation`, or `explicitly deferred`.
Store structure and content in `source-contract.ts`; keep behavioral rows in a dedicated contract
when that makes completeness easier to verify. Fixtures, preset order, named states, and browser
tests must derive from these contracts, not from an older implementation or the implementation
under test.

Use capability-specific evidence instead of reducing every interaction to “the state changed”:

- **Carousel:** source-visible control set, active item, thumbnail/track coupling, direction,
  duration, easing, in-flight displacement, settled transform, autoplay, pause, interruption, and
  loop-boundary behavior.
- **Filter:** selected value, active presentation, result IDs and count before/after, combination
  behavior, focus retention, and reset/toggle outcome.
- **Overlay:** trigger identity, displayed item/index, geometry/crop, backdrop, source-visible
  controls, caption/counter, scroll lock, focus, all dismissal paths, and mobile composition.
- **Shared surface:** owner, consumer routes, source variants, semantic substitutions, computed
  control signature, and at least one non-home interaction state.

Exit evidence:

- every visible region and state is named;
- every string, link, asset, font role, and breakpoint is represented;
- every source behavior has an owner, fallback, and outcome-based test;
- every repeated surface has one owner, an explicit consumer matrix, and no page-local duplicate;
- the behavior ledger and fidelity matrix contain the same declared states;
- source-only, implementation-only, and changed visible text all fail without a current waiver;
- source-contract tests fail against an incomplete implementation.

### Gate 3: Asset and font provenance

Add only reviewed files to `tools/storefront-theme-source-manifest.json`, then use
`tools/import-storefront-theme.ts`. Record source path, revision, license, digest, dimensions, alt
text, and retina relationship. Inspect font metadata and supported weight ranges; synthetic weights
and unexplained fallback requests fail the gate.

Exit evidence:

- imported bytes match recorded hashes;
- intrinsic dimensions and retina variants match the source;
- font family and real weights resolve locally.

### Gate 4: Prove the harness can fail

Before production implementation, introduce a controlled fixture mismatch and show that the
contract, geometry, or pixel gate rejects it. A harness that only proves elements exist, images
decode, or the page has no overflow is insufficient.

Also prove that the harness rejects:

- an implementation-only visible sentence or control;
- a control present in the DOM but hidden by missing runtime state;
- an initialized carousel whose visible card count or width is wrong;
- a timer-driven surface whose index or transform does not change; and
- a source-animated carousel whose index changes but whose track has zero transition duration,
  teleports between final transforms, or replaces slides with `display` toggles;
- an implementation-only navigation button, overlay control, caption, or counter that is absent
  from the equivalent source state;
- a filter whose control becomes active but whose result IDs/count do not change or reset;
- an image overlay that opens the wrong source item, reports the wrong counter, omits scroll lock,
  or uses source-incompatible control/backdrop geometry;
- a shared semantic control that passes on the first route but regains user-agent appearance,
  background, border, padding, or font on another registered consumer; and
- a state declared in the behavior ledger but absent from the fidelity matrix.

The harness must capture structured DOM inventory, visible copy, links, image properties,
computed styles, text metrics, geometry, motion state, route scroll state, console errors, failed
requests, screenshots, heatmaps, and ranked diagnostic crops.

Exit evidence:

- a known geometry or style defect fails for the expected selector/property;
- an over-threshold synthetic image change fails and retains diff evidence;
- known absence-parity and behavioral defects fail on their observable outcome;
- test-only CSS does not hide or disable the capability in its own acceptance capture;
- stale or mismatched capture identity is rejected.

### Gate 5: Shared application foundations

Implement shared behavior only when it is independent of theme presentation. This normally
includes interaction scheduling, lifecycle cleanup, route-scroll policy, deterministic motion
control, and font readiness. Keep theme-specific DOM, transforms, timing, and visual rules inside
the theme.

New routes start at the top, browser history restores saved positions, and hash navigation waits
for rendered targets.

Classify each anchor before framework routing takes ownership. Search triggers, dropdown controls,
back-to-top links, and other state controllers must not be converted into navigation merely because
the source used an `<a>` element.

Exit evidence:

- timer/listener disposal tests pass;
- pointer, keyboard, and swipe normalize to semantic actions;
- route top, history restoration, and hash navigation pass.

### Gate 6: Implement in source order

Build header and hero first, then body sections, overlays, sticky controls, and footer. For each
region use this loop:

```text
source evidence -> failing contract -> Vue implementation -> computed style/geometry
-> named interaction state -> regional visual diff -> four-viewpoint pass -> lock region
```

Use intrinsic control sizing and flexible parents. Do not hide font or wrapping defects with fixed
widths. Do not replace hover with click, a track with `v-show`, or a plugin timeline with a final
static frame. Every actionable-looking control must work for its declared inputs.

Implement each behavior-ledger row as a complete capability. A library global, initializer call,
item count, or generated class is diagnostic evidence only; completion requires the expected user-
visible result. Use capability-specific ready/failure states instead of one global runtime-ready
flag that can mask partial initialization.

Treat a shared component as a cross-route contract, not only shared markup. Presentation rules for
the shared surface must be owned by a component-root selector or a documented theme-global token;
they must not depend on the body class of the first page where the component was implemented. When
source anchors, inputs, or plugin-generated controls become semantic framework buttons, explicitly
compare and reset the browser defaults that changed (`appearance`, background, border, padding,
font, and color) before applying source styles. Render each shared component in every consumer
context and fail on a computed-style, geometry, or overflow signature that differs without a
source-backed reason.
The ownership map from Gate 2 must be resolved before the first consumer is implemented. Add a
contract or static check that rejects a page-local duplicate of an owned surface; visual similarity
alone is not permission to create a second renderer.

Do not add source-absent visible success, failure, loading, empty-state, or accessibility copy.
Prefer semantic markup and non-visual ARIA where it preserves the source. Register and approve any
necessary visible deviation before implementing it.

Exit evidence:

- regional contract and visual gates pass at each viewport and DPR;
- no missing section, inert control, substitute asset, or accidental text wrap remains.
- no component-owned control falls back to a user-agent border, background, padding, or font in any
  registered consumer route;
- at least one named interaction state for every shared overlay is captured from a non-home route.

### Gate 7: Route and data integration

Verify every category, product, utility, CTA, footer, account, cart, and policy target. Product cards
must use real theme slugs and the selected page fixture. Route changes must update the rendered page
type immediately and clear transient header/menu state.

Exit evidence:

- every source-visible link intent has a tested destination;
- theme pages do not fall through to sample product data;
- route-scroll lifecycle passes across all supported page types.

### Gate 8: Incremental acceptance

Run acceptance in five modes:

1. **Static visual:** freeze motion only for geometry, typography, and pixel comparison.
2. **Temporal:** run real autoplay and continuous motion; sample visible index/transform/position,
   transition duration/easing, and at least one in-flight frame before and after elapsed time and
   across the loop boundary. An index-only change or instantaneous final transform is not motion
   parity.
3. **Interaction:** exercise hover, focus, click, Escape, outside click, keyboard, and touch.
4. **Scroll/fixed:** keep sticky rails and progress controls visible; verify thresholds, progress,
   fixed geometry, and back-to-top without route changes.
5. **Fallback:** cover no-JS, individual capability failure, reduced motion, and remount cleanup.

Static visual stabilization must not count as evidence that motion exists. Test-only CSS must not
hide a component in the only mode responsible for validating that component.

Allocate evidence by risk so rigor does not become indiscriminate runtime cost:

1. **Tier A — dynamic/shared:** carousels, filters, overlays, commerce controls, and shared shell
   surfaces require their full capability schema, temporal/interaction evidence, and all distinct
   source variants. Shared control signatures run on every consumer route.
2. **Tier B — repeated static:** one structural/visual proof per distinct source variant plus the
   cross-route ownership/signature matrix; identical consumers do not repeat full-page captures.
3. **Tier C — unique static:** source contract, regional geometry/copy/assets, responsive cells,
   and one regional visual comparison; no synthetic interaction matrix is created.

Within each mode, run validation at four levels:

1. Failed region/state only: source contract, focused browser assertion, computed style, geometry,
   and diagnostic crop.
2. Current page: all regions, states, viewports, DPR 1/2, no-JS, reduced motion, keyboard, touch,
   accessibility, and runtime diagnostics.
3. Shadow repository: all contracts and deduplicated page behavior, without generating final
   evidence. Use this once after all page-level failures pass and before freezing the candidate.
4. Final repository: verify the frozen commit/tree/build/policy identity, then run one full-page
   matrix, theme E2E, static build, selected-theme isolation,
   bundle budget, Lighthouse, lint, typecheck, unit tests, and non-mechanical review.

Do not rerun an already passing full matrix for every local correction. Run the shadow pass once
after all failed regions pass, freeze the exact release-candidate build, and generate commit-bound
final evidence once. Any tracked-code, policy, fixture, or build-artifact change invalidates the
freeze and returns the work to the page/shadow loop.

Before accepting the matrix, automatically compare it with the behavior ledger. Missing tests,
captures, selectors, or states fail; “not represented in the matrix” is not a valid pass condition.

### Gate 9: Live review and handoff

Open the original and implementation at matching viewports and states. The evidence bundle must be
commit-bound and contain source URL, implementation URL, route, region/state, viewport, DPR,
capture time, thresholds, structured measurements, diff bounds, heatmap, and ranked crops.
Named-state aggregate reports must contain every state declared by the theme contract at all four
canonical viewports, including geometry evidence. Regional report sets must use the matrix-owned
threshold and contain every declared viewport/DPR combination for each represented route/region.
Missing, duplicate, unknown, self-relaxed, or wrong-source identities fail evidence verification.

Approval never follows from a low full-page ratio alone. A missing menu or incorrect route remains
a failure even when aggregate pixels are under budget.

Do checklist-driven side-by-side review during implementation, not only at handoff:

1. header, hero, and one representative product card;
2. the first carousel and first time-based animation;
3. the full desktop page, including edge rails and scroll controls; and
4. mobile plus hover/focus/scroll/timer/remount states.

For shared surfaces, visually review every distinct source variant, not every identical consumer.
Use the automated consumer-route signature matrix to cover identical routes and open at least one
shared transient state outside the home page.

Any issue found by human review must first add or correct a contract row and regression test, then
receive the implementation fix. This prevents the same category from reappearing elsewhere.

After handoff, record the number of behaviors added after intake, defects that escaped automation,
visible-content exceptions, and time spent maintaining the ledger. Review these signals after the
next port; reduce or automate ledger detail if a smaller source-derived capability inventory proves
equally effective. The ledger is a selected countermeasure whose value must be measured, not a
ceremonial document.

Record this block at handoff so workflow cost and escaped-defect classes remain visible:

```yaml
theme: THEME_ID
source_revision: SHA256_OR_REVISION
elapsed_hours: 0
behaviors_at_intake: 0
behaviors_added_after_intake: 0
automation_escapes: 0
shared_surface_escapes: 0
state_contract_escapes: 0
duplicate_implementations_removed: 0
approved_visible_differences: 0
ledger_maintenance_minutes: 0
custom_adapter_count: 0
longest_gate:
  name: ""
  seconds: 0
```

Growth in post-intake behaviors, shared-surface escapes, or state-contract escapes means Gate 2 is
still incomplete. High ledger effort without prevented defects means simplify the selected Tier B/C
evidence rather than weakening Tier A outcome checks.

## Standard acceptance policy

The machine-readable policy lives in
`tools/storefront-source-equivalence-policy.json`. Its maximum baseline thresholds are:

| Measurement                         |                          Maximum |
| ----------------------------------- | -------------------------------: |
| Numeric computed-style delta        |                          `0.5px` |
| Named geometry edge/dimension delta |                            `2px` |
| Full-page height delta              |                           `0.5%` |
| Named-state changed pixels          | `0.5%` at channel tolerance `16` |
| Full-page changed pixels            | `1.0%` at channel tolerance `16` |

Text-raster budgets for small controls or dense typography do not waive computed-style and geometry
checks. Any intentional semantic or visual difference requires a registered waiver.

## Waivers

A waiver must be narrow and machine-readable. It requires:

- stable ID, theme, route, and region;
- exact difference and why source equivalence cannot be used;
- owner and approver;
- expiration date;
- corresponding `waiverId` on the fidelity region.

Waivers cannot cover missing content, inert controls, substitute assets, wrong navigation, broken
responsive states, failed runtime diagnostics, or unexplained layout drift. Expired, unused,
unknown, or target-mismatched waivers fail `verify:source-equivalence`.

Visible-content waivers must additionally record the exact source text, implementation text,
reason the source cannot be preserved, and explicit human approval. Framework conventions alone
are not sufficient justification.

## Resource and analysis policy

- Browser, screenshot, and image-analysis work shares a maximum of two workers.
- Heavy full-page and named-state batches default to one worker.
- Check system load, memory pressure, active browser processes, and listening ports before a batch.
- Reuse required origins and close duplicate task-owned services.
- Clean browser, context, page, server, and child processes in `finally` on success or failure.
- Use local pixel/style/geometry analysis for bulk pass/fail decisions.
- Model inspection is limited to a small number of ranked ambiguous crops.

## Commands

Create an intake-only theme skeleton:

```sh
bun run scaffold:source-equivalent-theme -- \
  --theme=atelier \
  --label="Atelier" \
  --source-entry=demo-atelier-store.html \
  --source-identity=atelier-template-v1
```

The scaffold deliberately contains failing intake markers and no guessed styling. Complete its
contract, fixtures, preset route set, assets, tests, policy entry, and catalog registration before
using it as a theme.

Verify policy, harness self-tests, waiver registration, and matrix contracts:

```sh
bun run verify:source-equivalence
```

Use the policy-driven acceptance runner for iteration. A focused run intentionally reports that
final evidence is still outstanding:

```sh
bun run accept:source-equivalence -- \
  --scope focused --theme fashion-store --state search-open --mode interaction

bun run accept:source-equivalence -- --scope page --theme fashion-store

bun run accept:source-equivalence -- \
  --scope repository --evidence=<report-directory> --commit=<full-commit-sha> \
  --rc-manifest=<frozen-rc-manifest>
```

`focused` runs one policy-declared browser state, `page` runs the current page contract, and
`repository` runs deterministic source-equivalence checks, the existing theme matrix, and
commit-bound fidelity evidence validation. It refuses to report completion without both
`--evidence`, a full `--commit`, and `--rc-manifest`. Regional and named-state capture commands
must record the frozen manifest's artifact SHA-256 with `--artifact-digest` so the verifier rejects
evidence produced by a different build.
Use `--dry-run` to inspect commands and outstanding evidence without launching a browser. The
machine-readable page routing lives in `tools/storefront-source-equivalence-policy.json`; do not
add theme conditionals to the orchestration script.

Verify retained reports before handoff:

```sh
bun tools/verify-source-equivalent-themes.ts \
  --evidence=artifacts/theme-fidelity/final \
  --commit="$(git rev-parse --short HEAD)" \
  --max-age-hours=48
```

Then run the standard theme and repository gates described in
`docs/runbooks/storefront-theme-onboarding.md`.

Evidence artifact fields, command details, failure triage, and runner routing are documented in the
non-normative
[Source-equivalence acceptance system reference](../reference/source-equivalence-acceptance-system.md).

## Shared component style ownership

- Keep required control resets, internal state styling, and responsive rules with their owning
  component. Vue scoped styles are preferred; inherited theme tokens and upstream design rules
  stay in theme CSS. Check selector specificity and child-component boundaries when moving CSS.
- Shell defaults describe an ordinary page. Home opts into its identity explicitly; preserve
  intentional shared layout differences through a named prop/variant rather than a Home ancestor
  selector reaching into shared controls. Page CSS owns external section placement and spacing.
- For a shared-style fix, reproduce the computed-style failure on an inner page first. Check Home
  and an inner route, actual open/focused/hovered states, navigation/history reuse, and both sides
  of the component's display breakpoint. Static screenshots that hide the control are insufficient.
- Reuse the existing capture and comparison tools. Keep source files and approved baselines intact;
  compare matched component regions before and after ownership-only migrations. Do not duplicate
  primitive-library interaction or accessibility behavior merely to fix a style dependency.

## Fashion Store dependency boundary

- Route ordinary icons through `FashionStoreIcon.vue`, carousels through
  `FashionStoreCarousel.vue`, synchronized product media through `FashionStoreProductGallery.vue`,
  quantities through `FashionStoreQuantityInput.vue`, and hints through `FashionStoreTooltip.vue`.
  Preserve documented page variants as inputs to those components instead of creating parallel
  engines.
- Keep Swiper and Bootstrap versions exact. Load their CSS once through
  `themes/fashion-store/styles/vendor.css`; dynamically import Bootstrap Modal JavaScript only from
  the product lightbox. Do not restore jQuery, the monolithic vendor bundle, icon fonts, remote
  fonts, or component-level duplicate Swiper CSS.
- Package-CSS replacement can remove legacy utility classes even when screenshots initially look
  unchanged. Recheck hidden text, focus helpers, responsive display utilities and state classes in
  live and no-JavaScript output; Fashion Store uses Bootstrap 5's `visually-hidden` utility.
- Dependency updates must retain the approved minimum-version implementation targets and rerun the
  actual available-engine matrix, live/fixture commerce boundaries, source-region comparisons,
  cumulative resource probe, static budget and performance checks. See
  `docs/progress/fashion-store-dependency-maintenance.md` for the exact update checklist.

## Handoff checklist

- Equivalence scope and source revision are explicit.
- Source contract covers every visible region, state, breakpoint, link, asset, and motion branch.
- Behavior ledger covers every actionable/stateful source element and matches the acceptance matrix.
- Cross-page surface census assigns one owner and a consumer/variant matrix to every repeated surface.
- Carousel, filter, overlay, and shared-surface states satisfy their capability-specific evidence.
- Asset provenance and local font inspection pass.
- Controlled harness mismatches fail as expected.
- Static, temporal, interaction, scroll/fixed, and fallback modes pass at focused, page, and final levels.
- All actionable controls work with declared pointer/keyboard/touch behavior.
- Route destinations and scroll lifecycle pass.
- There is no unapproved implementation-only visible text or control.
- No prohibited runtime, remote font, placeholder, or inactive-theme asset ships.
- Evidence matches the reviewed commit and uses distinct source/implementation origins.
- Intentional differences have current, approved, used waivers.
- Original and implementation are open for final browser review.
