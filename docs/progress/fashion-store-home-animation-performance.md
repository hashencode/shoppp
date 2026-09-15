---
title: Fashion Store Home animation performance evidence
date: 2026-09-11
plan: FS-F6
unit: FS-F6-U1
---

# Fashion Store Home animation performance evidence

U1 establishes a motion-enabled Chromium path separate from the reduced-motion Lighthouse suite.
It does not change production motion behavior.

## Fixed measurement contract

- Profiles: desktop 1440×900 at DPR 2 and mobile 390×844 at DPR 3.
- Environment: Playwright Chromium, one worker, 4× CPU throttling, two warmed navigations.
- Visible window: three manually triggered 4.2-second Hero runs per profile.
- Per-run limits: requestAnimationFrame interval p95 ≤ 50ms and maximum ≤ 100ms.
- Aggregate limits: median Paint Lifecycle ≤ 250ms, Layerize ≤ 250ms, and RunTask ≤ 1,200ms.
- Offscreen window: 10.2 seconds with every Home motion owner outside the viewport, compared with
  an equivalent reduced-motion idle trace at no more than 120% of its Paint Lifecycle, Layerize,
  and RunTask totals.
- Lifecycle limits: no semantic-index, CSS-animation-time, Hero phase, or Hero layer-style progress.

Each run emits a JSON attachment containing the environment and Chromium identity, raw per-run
frame and trace totals, medians, thresholds, offscreen owner snapshots, and reduced-motion idle
comparison. Wrong browser, viewport, DPR, CPU rate, missing trace/frame data, missing owner, or fewer
than three repetitions fails closed.

## U1 baseline result

The checked-in harness is intentionally a red contract against the diagnosed pre-U2 behavior. The
desktop profile was run against the current local combined Fashion/Decor Home and produced all
three visible runs plus the aggregate and offscreen report:

- Visible rAF maximums: 142.3ms, 98.6ms, and 47.8ms; run 1 exceeded the 100ms limit.
- Visible medians: Paint Lifecycle 42.060ms, Layerize 236.924ms, RunTask 3,228.107ms; RunTask
  exceeded the 1,200ms limit.
- Normal offscreen versus reduced idle: Paint Lifecycle 39.045ms versus 0ms and Layerize 207.179ms
  versus 2.932ms (3.5184ms with the 20% allowance).
- While fully offscreen, the Hero advanced from index 0/idle to index 1/layer-busy and its layer
  styles changed. Decor promotional and client marquee animation times advanced from 1,839.3ms to
  12,465.4ms.

The final U1 run used Chromium 151 and normalized its `PrePaint` lifecycle event with the older
`RunPaintLifecyclePhase` name without changing the fixed budget. It completed both profiles:

- Desktop visible maximums were 142.8ms, 29.9ms, and 38.0ms; median Paint Lifecycle was 132.001ms,
  Layerize 163.855ms, and RunTask 2,215.279ms.
- Mobile visible maximums were 93.2ms, 26.7ms, and 317.6ms; the third run's p95 was 72.2ms. Median
  Paint Lifecycle was 76.396ms, Layerize 156.591ms, and RunTask 984.278ms.
- Fully offscreen desktop work recorded 182.443ms Paint Lifecycle, 279.511ms Layerize, and
  2,284.221ms RunTask versus reduced-motion idle totals of 2.919ms, 1.014ms, and 264.480ms.
- Fully offscreen mobile work recorded 195.987ms Paint Lifecycle, 205.314ms Layerize, and
  1,407.252ms RunTask versus reduced-motion idle totals of 9.051ms, 2.001ms, and 759.905ms.
- In both profiles the Hero advanced from index 0/idle to index 1/layer-busy, changed layer styles,
  and both Decor marquee animation clocks advanced while every owner was fully offscreen.

The complete report is therefore a deterministic red contract for U2/U3 rather than a harness
failure. Test-result JSON attachments remain the authoritative per-run payload. The focused
source/config contract protects the separate path without changing `e2e/performance.spec.ts` or
its Lighthouse policy.

## U2-U3 implementation and performance result

Each Home automatic-motion owner now has independent positive-intersection state. Hero and the
Decor collection stop Swiper autoplay offscreen; the Hero pauses its owned GSAP timeline without
taking global ticker ownership; the Fashion, Decor promotional, and Decor client marquees release their CSS
animations and promotion hints while offscreen. Document-hidden and reduced-motion reasons remain
composed with viewport and collection-focus reasons.

The Hero no longer animates or statically retains blur. Its source ledger remains separately frozen
at the inherited values. The passing runtime variant keeps all eight layers, every delay, their
order, final state, and the 3.6-second total span; only the overlapping product, title, price, CTA,
and next-layer durations are 400ms. One-field product variants at 600ms, 500ms, and 400ms did not
leave a repeatable RunTask margin, so the selected variant is the smallest tested overlap reduction
that passed both fixed profiles with stable room.

The final production-static Chromium 151 run used 4× CPU throttling, two warmed navigations, one
unscored warmed Hero transition, and three scored 4.2-second runs per profile:

- Desktop median: Paint Lifecycle 89.425ms, Layerize 125.589ms, RunTask 702.471ms. Individual rAF
  maximums were 59.4ms, 32.5ms, and 28.5ms; p95 values were at most 26.1ms.
- Mobile median: Paint Lifecycle 112.112ms, Layerize 172.688ms, RunTask 945.505ms. Individual rAF
  maximums were 42.3ms, 27.6ms, and 26.2ms; p95 values were at most 26.1ms.
- All five owners stayed fully offscreen with unchanged semantic indices, phases, CSS animation
  clocks, and Hero layer styles across every 10.2-second sample. Normal and reduced-motion idle
  each recorded 0ms of page-attributable Paint, Layerize, and RunTask work.
- Raw idle RunTask remains in the JSON report for audit. Event inspection attributed its 1-3ms
  medians to Chromium memory monitoring, parkable-image management, Mojo IPC, and trace bookkeeping,
  rather than page timers, functions, animation frames, paint, or layerization.

Focused verification passed: 28 motion/theme contract tests, storefront TypeScript, relevant
ESLint, the production build/static verification embedded in the performance server, three Hero
behavior cases (busy input/final state, composed offscreen suspension, one-cycle/remount), and both
fixed motion profiles.

## U4 regression reconciliation and remaining blocker — 2026-09-13

The user accepted the current overall Home styling. The obsolete Services image assertion was
therefore reconciled without changing the accepted UI: the Home regression now verifies the four
exact icon-component identities, their visible copy, count, SVG presence, and viewport containment.
Services alone is no longer compared against the historical PNG pixels; the other six inherited
Fashion regions retain the existing strict regional pixel thresholds.

The combined Home matrix passed with 8 tests passed and 12 intentionally skipped. The isolated
Home presentation also passed its desktop, tablet, mobile, width-policy, and no-JavaScript targets.
The regression now treats CSS-animation release (`animation-name: none`) as the deliberate paused
state, composes document and viewport pause reasons, and scrolls stable section owners rather than
moving animation tracks.

Fresh performance and build evidence remains green:

- Stable mobile Lighthouse passed all six Fashion routes. Home passed its automatic cold-start
  retry with performance 1.00, LCP 1,126.97ms, CLS 0, and TBT 66ms.
- The fixed motion harness passed both profiles. Desktop medians were Paint Lifecycle 148.273ms,
  Layerize 168.218ms, and RunTask 937.450ms; its three maximum frame intervals were 34.4ms, 26.3ms,
  and 26.2ms. Mobile medians were 114.219ms, 188.590ms, and 881.309ms; its maxima were 26.3ms,
  26.2ms, and 28.3ms. Every offscreen page-attributable metric remained 0ms with unchanged owner
  state.
- Storefront typecheck, focused ESLint, theme-catalog verification, production build, production
  static verification, and `git diff --check` passed.

The full `test:fashion-store` gate is not green, so U4 and the REL handback remain open. Its unit
and live-Commerce layers passed (50/50 and 15/15). The subsequent desktop suite reached 80 passes
and one expected skip before the run was stopped after six independent failures exposed the
unfinished Home product-merchandising successor outside FS-F6's animation-only authority:

- source-inventory selectors capture nested Decor regions as if they were the ten legacy siblings;
- the generic Fashion configuration collects the dedicated motion spec under an unsupported project;
- the shared Header test expects a populated mini-cart on Home, while the successor renders zero
  fixture lines there;
- 28 rendered merchandising controls have no interaction-ledger row;
- the static Home test counts every nested `<section>` (19) against the top-level expectation (11);
- the successor introduces serious accessibility failures, including unnamed image-only links and
  undersized product-title targets.

Changing content, Commerce truth, accessibility semantics, interaction ownership, or responsive
geometry would cross FS-F6's explicit stop conditions. U4 is therefore blocked until REL (or a
named successor Home-integration plan) completes those contracts and returns a green full Fashion
gate; FS-F6 can then perform final review and hand execution back to REL-Pre-DC.

## U4 final verification and REL handback — 2026-09-13

FS-F7 reconciled the six merchandising contracts, and FS-R4 then completed the canonical shared
Header/Footer verification before returning authority to FS-F6-U4. The previously recorded U4
blocker is therefore resolved. Final verification ran against the shared dirty checkout without
stashing, resetting, committing, creating a worktree, or widening candidate/release scope.

The complete final gate is green:

- Motion/theme contracts: 30 passed, 0 failed, with 421 assertions.
- Hero behavior: 18 applicable profile cases passed and 18 intentionally inapplicable cases
  skipped across desktop, laptop, tablet, and mobile projects.
- Combined and isolated Home lifecycle: each mode passed 12 cases with 12 intentional
  applicability skips.
- Stable six-route Fashion performance: passed with one-worker retry policy intact; Home's cold
  retry completed at performance 1.00, LCP 1,126ms, CLS 0, and TBT 66ms.
- Complete Fashion Store gate: Bun 53/53, live Commerce 15/15, generic static 288 passed with 252
  intended skips, both Home lifecycle matrices green, and all 15 behavior-report verification
  commands green.
- Accessibility: all 8 route/keyboard checks passed under the existing critical/serious Axe rule;
  no exclusion or severity rule changed.
- Root typecheck, focused ESLint and Prettier, theme-catalog verification, production build,
  production-static verification, impact-selector tests (7/7), impact dry-run, and
  `git diff --check` passed. The impact dry-run correctly selected the complete theme matrix for
  shared-infrastructure changes.

The final post-format fixed-profile motion run passed under the unchanged R7/R8 contract:

- Desktop 1440×900 at DPR 2 and 4× CPU: median Paint Lifecycle 109.171ms, Layerize 133.582ms, and
  RunTask 663.172ms. Per-run rAF maximums were 27.5ms, 33.3ms, and 32.4ms; p95 was at most 26.2ms.
- Mobile 390×844 at DPR 3 and 4× CPU: median Paint Lifecycle 145.879ms, Layerize 196.491ms, and
  RunTask 995.815ms. Per-run rAF maximums were 26.3ms, 26.2ms, and 26.3ms; p95 was at most 26.1ms.
- Fully offscreen page-attributable Paint Lifecycle, Layerize, and RunTask remained 0ms in both
  profiles with unchanged owner state. Raw offscreen RunTask was 3.539ms desktop and 1.860ms
  mobile.

An earlier independent final run also passed with desktop/mobile median RunTask of 666.125ms and
693.335ms respectively. The isolated 1,358ms desktop observation reported during FS-R4 did not
reproduce in either FS-F6 run; both final desktop samples have substantial margin below the
unchanged 1,200ms threshold. The mobile post-format sample is higher than the earlier run but still
passes every aggregate and per-run requirement, so no threshold exception or favorable-sample
substitution is used.

Human review used the same 1440×900 and 390×844 viewports. After the timed Hero sequence and first
visible marquee/product motion, both final states remained readable and compositionally complete;
the Header, controls, content, and responsive layout showed no clipping or horizontal overflow.
The mobile capture taken during the expected transition briefly showed its in-progress overlay,
then resolved to the clean final slide within the inherited sequence span.

Final diff review found no page-global motion state machine, duplicate observer, stale production
debugging code, abandoned timing variant, relaxed 1,200ms/250ms/50ms/100ms motion threshold, or
weakened Lighthouse, source-parity, or Axe rule. `useFashionStoreMotionViewport` remains the single
per-owner observer seam with cleanup and unsupported-observer fail-open behavior. Review verdict:
no actionable findings. FS-F6-U4 changes only evidence/governance and formatter-only normalization
of its three owned Hero/performance files; `behavior_changed=false` for this final-verification
stage.

FS-F6-U1 through U4 are complete with no blocker or implementation tail. The sole product pointer
returns to REL-Pre-DC for its existing deferred Home configuration/immutable-Preview successor and
capability/candidate-identity reconciliation. No candidate was frozen, and no DC, deployment, or PG
state advanced.

## Post-completion review follow-up — 2026-09-13

The formal delivery review confirmed and removed the remaining cross-owner risk in Hero suspension:
the composable now pauses and resumes only its owned timeline and never sleeps or wakes GSAP's
process-wide ticker. The dedicated motion gate subsequently passed both fixed profiles under the
unchanged budgets; mobile medians were Paint Lifecycle 47.266ms, Layerize 136.35ms, and RunTask
563.75ms, with offscreen page-attributed work remaining zero. The complete Fashion Store,
accessibility, production-build, static, type, impact, format, and diff gates also passed after all
review fixes. FS-F6 remains complete and `REL-Pre-DC` remains the sole active product pointer.
