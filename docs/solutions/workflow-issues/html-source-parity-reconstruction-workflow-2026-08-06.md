---
title: Preventing behavioral gaps in source-equivalent HTML reconstruction
date: 2026-08-06
category: docs/solutions/workflow-issues
module: storefront-html-source-parity
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - "Reconstructing a supplied HTML template inside a component framework"
  - "Porting source markup and CSS while selectively replacing the source JavaScript runtime"
  - "Claiming source parity for animated, hover-driven, fixed, or transient interface states"
  - "Adapting source controls to framework routing or typed application actions"
symptoms:
  - "Source-dependent cursor CSS hid the native pointer because its companion custom-cursor runtime was omitted"
  - "Carousel and marquee markup was present but did not move or expose the source card layout"
  - "Sticky social controls and scroll progress existed in the DOM but remained visually inactive"
  - "Search and mini-cart controls looked complete but had no source-equivalent open state"
  - "Framework-authored feedback copy appeared even though it was absent from the source"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
related_components:
  - fashion-store-theme
  - source-runtime-adapter
  - browser-fidelity-testing
  - content-parity-contract
tags:
  - html-reconstruction
  - source-parity
  - interaction-inventory
  - visual-regression
  - runtime-adapter
  - content-fidelity
---

# Preventing behavioral gaps in source-equivalent HTML reconstruction

## Context

The Fashion Store reconstruction showed that mechanically preserving source HTML, class names, CSS,
fonts, icons, and assets is substantially more reliable than rebuilding a page from screenshots.
It also exposed an important limit: static structural parity is not behavioral parity.

The supplied source distributed observable behavior across three layers:

1. HTML classes and `data-*` configuration;
2. CSS that often started controls in a hidden or inactive state; and
3. `main.js` and plugins that created elements, added state classes, wrote inline geometry, and
   advanced time-based motion.

The implementation retained much of the first two layers while selectively replacing the third.
The acceptance contract primarily recorded selectors, section order, and item counts. As a result,
it could prove that a carousel, sticky rail, search form, or cart existed without proving that a
user could see or operate it.

Human review found the omissions in several waves: custom cursor fallback, collection layout and
autoplay, continuous marquees, side controls, search, mini-cart, and finally implementation-only
feedback copy. Earlier reconstruction sessions followed the same pattern: static rendering was
relatively quick, while missing runtime behavior and integration stabilization consumed most of
the remaining effort. (session history)

The recurring root cause was a missing workflow artifact: an exhaustive behavior ledger mapping
each source affordance from trigger and dependency to observable outcome and acceptance evidence.

## Guidance

### Treat the source as three parity contracts

Do not use a single “source contract” as a catch-all. Record and verify three distinct layers:

- **Structural parity:** DOM order, classes, attributes, copy, assets, CSS order, breakpoints, and
  initial geometry.
- **Behavioral parity:** every load, timer, hover, focus, click, keyboard, touch, resize, and scroll
  transition that changes what a user can observe.
- **Absence parity:** no implementation-only visible text, controls, alerts, badges, toasts, empty
  states, or other visual content without an approved exception.

The successful mechanical-preservation approach should remain the default. Recent work retained
465 of 473 source classes, whereas the older handcrafted theme had almost no direct class overlap.
That reduced drift, but it did not remove the need to reconstruct runtime state. (session history)

### Build a source behavior ledger before implementation

Inspect the running original and its JavaScript before adapting controls. Each actionable or
stateful source element gets one row with at least these fields:

| Field                  | Required evidence                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Source selector        | Exact element or selector family                                                              |
| Role                   | Navigation, overlay trigger, carousel, state control, external link, form, or scroll action   |
| Triggers               | Load, timer, hover, focus, click, keyboard, touch, resize, or scroll                          |
| Initial state          | Visible geometry, classes, attributes, and computed style                                     |
| Dependencies           | DOM, CSS rule, runtime initializer, generated DOM/classes, inline geometry, and teardown      |
| Result                 | User-observable open, close, move, focus, visibility, or navigation outcome                   |
| Responsive branches    | Desktop, tablet, mobile, pointer, and touch behavior                                          |
| Accessibility branches | Keyboard, focus restoration, and reduced motion                                               |
| Ownership              | Preserved source runtime, framework-native adapter, approved adaptation, or explicit deferral |
| Acceptance             | Focused browser test and named-state capture proving the outcome                              |

Every row must end in `reproduced`, `approved adaptation`, or `explicitly deferred`. A blank owner
or acceptance cell fails intake.

Do not classify anchors only by tag name. A source `<a>` may be navigation, a search trigger,
dropdown control, or back-to-top action. Framework routing must not take ownership until the
ledger classifies its actual role.

### Validate complete capabilities, not isolated fragments

Many template features are capability pairs or chains:

```text
source DOM + default CSS + runtime initializer + generated state/geometry + cleanup
```

Either preserve/rebuild the complete chain or remove its trigger and provide a complete fallback.
For example, keeping `cursor: none` without creating the custom cursor is invalid. If the product
decision is to keep the native cursor, remove the hiding trigger and test the computed cursor on
hover.

Use independent readiness and failure states for each capability. A global “runtime ready” flag or
the presence of `swiper-initialized` does not prove that collection sizing, marquee motion, search,
cart, sticky controls, and scroll progress all work.

### Verify observable outcomes

Presence and implementation details are supporting evidence, not completion criteria.

| Capability          | Insufficient assertion                     | Required outcome assertion                                                                                             |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Collection carousel | Slide count or initialized class           | Visible cards and card width at each breakpoint; index/transform changes; loop and controls work                       |
| Marquee             | Swiper exists or paused screenshot matches | Position changes between timed samples; loop boundary is continuous; reduced-motion content is complete                |
| Search              | Search markup exists                       | Overlay opens, input receives focus, dismissal paths work, focus returns, URL stays unchanged                          |
| Mini-cart           | Dropdown markup exists                     | Hover/focus/click reveals the source card; content matches; leave/focus-out closes it                                  |
| Sticky social rail  | Nodes exist                                | Source state class, opacity, position, visibility, and links match                                                     |
| Scroll progress     | Progress element exists                    | It becomes visible after the threshold, grows monotonically, approaches 100%, and click returns to top without routing |

Time-based acceptance should sample the user-visible position or index before and after elapsed
time. It must not merely inspect timer configuration.

### Separate static and live acceptance modes

Use different capture modes for different questions:

1. **Static visual mode** may pause animation for stable geometry, typography, and pixel comparison.
2. **Temporal mode** runs real autoplay and continuous motion and compares timed samples.
3. **Interaction mode** exercises hover, focus, click, Escape, outside click, touch, and keyboard.
4. **Scroll/fixed mode** keeps side rails and progress controls visible and validates their states.
5. **Fallback mode** covers no-JS, capability failure, and reduced motion.

Test-only CSS must not hide a component in the only capture intended to validate that component.
Freezing animation cannot count as evidence that motion exists.

### Set the visible-content difference budget to zero

Visible source copy is authoritative. The default budget for implementation-only visible text is
zero, including success messages, accessible status text that is visually rendered, loading copy,
empty states, and preview-only notifications.

Typed application intent may be emitted internally without adding visible UI. Accessibility
enhancements should prefer semantic markup and non-visual ARIA when that preserves source output.
Any visible addition, deletion, or rewrite requires a narrow exception ledger entry and human
approval before implementation.

### Keep reconstruction separate from platform promotion and cleanup

Use explicit milestones:

1. source-equivalent reconstruction;
2. framework/platform integration;
3. repository regression stabilization;
4. theme promotion;
5. legacy-theme deletion and cleanup.

Combining these makes failures harder to attribute and lets deletion or catalog work distract from
fidelity. Prior sessions showed that availability checks and build stabilization could consume
substantial effort while proving little about source behavior. (session history)

### Add checklist-driven human checkpoints

Human review is a required gate, but it should not first happen after all automated evidence passes.
Compare the original and implementation at matching viewports after:

1. header, hero, and one representative product card;
2. the first carousel and first time-based animation;
3. the full desktop page, including both edge rails;
4. mobile plus hover/focus/scroll/timer/remount states.

Review against the behavior ledger rather than free-form browsing. Any human-discovered omission
must add a source-contract row and a regression test before it is fixed.

## Why This Matters

A page can be pixel-close at rest, contain the expected number of nodes, and load its libraries
without reproducing the experience. Fashion Store demonstrated several variants of this false positive:

- source CSS hid the native pointer while the replacement cursor runtime was absent;
- Swiper-shaped markup existed while one card occupied the full collection width;
- marquees looked plausible in a frozen frame but never moved;
- social and progress controls existed but remained transparent or test-hidden;
- search and cart looked actionable but their source state transitions were not owned anywhere;
- tests explicitly required feedback copy that the source never contained.

The most dangerous outcome is not merely a missing feature; it is a passing test suite that certifies
an incomplete contract. Outcome-driven behavioral tests and absence parity remove that false
confidence.

## When to Apply

- A complete HTML/CSS/JavaScript template is being migrated into Vue, Nuxt, React, or another SPA.
- The source uses Swiper, Bootstrap dropdowns, GSAP, Isotope, jQuery, or similar runtime plugins.
- The page contains custom cursors, hover-only UI, overlays, preview carts, sticky rails, progress
  controls, autoplay, marquees, or back-to-top behavior.
- CSS starts content hidden until JavaScript adds a class or inline style.
- Framework routing or typed actions may compete with source control semantics.
- The delivery is described as a reproduction, clone, port, or source-equivalent page.

Purely static pages may reduce the runtime portion, but they still require structure, content,
assets, breakpoints, link intent, and absence-parity checks.

## Examples

### Search behavior ledger row

```yaml
selector: .search-form-icon
role: overlay-trigger
trigger: click
initial: .search-form-wrapper hidden
source_effect: body adds show-search-popup
owner: framework adapter
expected:
  - overlay visible
  - input focused
  - URL unchanged
close:
  - close button
  - Escape
  - outside click
  - focus restored
tests:
  - desktop pointer
  - mobile touch
  - keyboard
```

### Collection acceptance row

```yaml
selector: .swiper.slider-three-slide
source:
  autoplay_ms: 4000
  loop: true
acceptance:
  desktop_visible_slides: 4
  tablet_visible_slides: 3
  small_visible_slides: 2
  mobile_visible_slides: 1
  temporal: index and track transform change after elapsed time
  interaction: keyboard and pointer advance one slide
  fallback: reduced-motion layout remains complete and readable
```

### Absence-parity rule

```text
source-only visible text         -> fail
implementation-only visible text -> fail
changed visible text             -> fail
approved exception ID            -> allow and report
screen-reader-only integration   -> separate accessibility review
```

## Related

- [Source-equivalent HTML template porting](../../runbooks/source-equivalent-html-template-port.md)
- [Fashion Store source-parity plan](../../plans/2026-08-06-001-feat-fashion-store-source-parity-plan.md)
- [Storefront theme visual acceptance](../../design/storefront-theme-visual-acceptance.md)
- [Storefront theme onboarding](../../runbooks/storefront-theme-onboarding.md)

## Implemented prevention

The workflow now has executable enforcement rather than checklist-only guidance:

- `behavior-contract.ts` owns triggers, outcomes, branches, fallbacks, evidence states, and approved
  adaptations; the fidelity matrix derives its page states from that contract.
- The independent template under `templates/` is digest-bound in the policy and is rejected if it
  points back into the implementation tree.
- Source inventory separates visible copy from accessibility copy and reports source-only,
  implementation-only, and rewritten text.
- Shared browser probes validate search, cart preview, multi-card collection geometry and movement,
  continuous motion, native cursor, scroll progress, and back-to-top outcomes.
- Capture CSS is acceptance-mode aware. Temporal evidence cannot freeze motion, and scroll/fixed
  evidence cannot hide the control it is supposed to test.
- Fashion Store controlled fixtures replay every escaped defect found in human review, including the
  source-absent “Product added to the preview cart.” sentence.
- `bun run accept:source-equivalence` provides focused, page, and repository scopes from policy data;
  the normal release validator remains the CI entry point.

For the next reconstruction, add a contract row before implementing a discovered behavior. When a
human finds a miss, first make the corresponding controlled fixture fail, then fix the page. This
keeps the acceptance system from learning the current implementation instead of the source.
