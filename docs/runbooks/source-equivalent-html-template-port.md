# Source-Equivalent HTML Template Porting

## Purpose

Use this workflow when an existing HTML template must become an actual Shoppp theme without losing
its visible content, responsive behavior, interaction states, typography, or original assets.
This is a source-equivalent port, not a screenshot-inspired redesign.

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
upstream global styles, unreviewed runtime, demo handlers, remote fonts, placeholder media, or
substitute assets. Reimplement observable behavior with scoped Vue state and semantic controls.

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

Exit evidence:

- immutable source identity and ownership approval;
- explicit source-equivalent page list;
- implementation and acceptance routes;
- no unresolved scope decision.

### Gate 1: Executable original

Serve the complete upstream package root from one stable origin. Confirm all local dependencies,
images, fonts, and initialization files load. Wait for `document.fonts.ready`, decoded images, and
lazy content before measuring. Provide a deterministic seam to pause or seek autoplay and motion.

Exit evidence:

- zero failed local requests, broken images, or external font fallbacks;
- source origin and entry URLs recorded;
- initial and named states can be reproduced on demand.

### Gate 2: Source inventory and contract

Walk the original document in order. For every visible region record:

- HTML range and contributing selector families;
- exact copy, counts, link intent, and control semantics;
- asset identity, intrinsic size, crop, object position, and 1x/2x pairing;
- computed font family, real weight, size, line height, letter spacing, and text width;
- colors, borders, radii, shadows, visibility, and bounding boxes;
- desktop, laptop, tablet, and mobile composition;
- pointer, keyboard, touch, focus, dismissal, disabled, and reduced-motion behavior;
- motion direction, easing, duration, delay, loop, autoplay, pause, midpoint, exit, and interruption.

Store this in `source-contract.ts`. Fixtures and preset order must derive from the contract, not
from an older implementation.

Exit evidence:

- every visible region and state is named;
- every string, link, asset, font role, and breakpoint is represented;
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

The harness must capture structured DOM inventory, visible copy, links, image properties,
computed styles, text metrics, geometry, motion state, route scroll state, console errors, failed
requests, screenshots, heatmaps, and ranked diagnostic crops.

Exit evidence:

- a known geometry or style defect fails for the expected selector/property;
- an over-threshold synthetic image change fails and retains diff evidence;
- stale or mismatched capture identity is rejected.

### Gate 5: Shared application foundations

Implement shared behavior only when it is independent of theme presentation. This normally
includes interaction scheduling, lifecycle cleanup, route-scroll policy, deterministic motion
control, and font readiness. Keep theme-specific DOM, transforms, timing, and visual rules inside
the theme.

New routes start at the top, browser history restores saved positions, and hash navigation waits
for rendered targets.

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

Exit evidence:

- regional contract and visual gates pass at each viewport and DPR;
- no missing section, inert control, substitute asset, or accidental text wrap remains.

### Gate 7: Route and data integration

Verify every category, product, utility, CTA, footer, account, cart, and policy target. Product cards
must use real theme slugs and the selected page fixture. Route changes must update the rendered page
type immediately and clear transient header/menu state.

Exit evidence:

- every source-visible link intent has a tested destination;
- theme pages do not fall through to sample product data;
- route-scroll lifecycle passes across all supported page types.

### Gate 8: Incremental acceptance

Run validation in three levels:

1. Failed region/state only: source contract, focused browser assertion, computed style, geometry,
   and diagnostic crop.
2. Current page: all regions, states, viewports, DPR 1/2, no-JS, reduced motion, keyboard, touch,
   accessibility, and runtime diagnostics.
3. Final repository: one full-page matrix, theme E2E, static build, selected-theme isolation,
   bundle budget, Lighthouse, lint, typecheck, unit tests, and non-mechanical review.

Do not rerun an already passing full matrix for every local correction. Re-run it once after all
failed regions pass.

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

Verify retained reports before handoff:

```sh
bun tools/verify-source-equivalent-themes.ts \
  --evidence=artifacts/theme-fidelity/final \
  --commit="$(git rev-parse --short HEAD)" \
  --max-age-hours=48
```

Then run the standard theme and repository gates described in
`docs/runbooks/storefront-theme-onboarding.md`.

## Handoff checklist

- Equivalence scope and source revision are explicit.
- Source contract covers every visible region, state, breakpoint, link, asset, and motion branch.
- Asset provenance and local font inspection pass.
- Controlled harness mismatches fail as expected.
- Focused, page, and final matrices pass in that order.
- All actionable controls work with declared pointer/keyboard/touch behavior.
- Route destinations and scroll lifecycle pass.
- No prohibited runtime, remote font, placeholder, or inactive-theme asset ships.
- Evidence matches the reviewed commit and uses distinct source/implementation origins.
- Intentional differences have current, approved, used waivers.
- Original and implementation are open for final browser review.
