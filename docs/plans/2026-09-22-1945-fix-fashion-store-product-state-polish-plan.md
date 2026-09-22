---
title: Fashion Store Product State Polish - Plan
type: fix
status: completed
date: 2026-09-22
topic: fashion-store-product-state-polish
artifact_contract: ce-unified-plan/v1
product_contract_source: user-approved-follow-up-audit
execution: code
---

# Fashion Store Product State Polish - Plan

## Goal Capsule

- **Objective:** Correct the user-approved follow-up Product-page findings D05, D06, D08, D09, and D11 without reopening the completed D01-D04 fix.
- **Upstream authority:** The user-approved 2026-09-22 follow-up audit governs this bounded scope. The Fashion Store source template remains the visual reference where it does not conflict with truthful data or accessibility.
- **Inherited baseline:** The completed D01-D04 plan remains frozen. FS-F14 stays active at U1.1 and is not advanced by this independent fix.
- **Explicit exclusions:** Do not change D07 form focus styling or D10 Add-to-cart hover animation. Preserve the intentional Header treatment, removed Footer copyright/legal strip, removed Compare action, and previously excluded review-content-density differences.
- **Execution profile:** Implement and verify in the current checkout. No worktree, product-pointer update, candidate change, deployment, PR, or commit belongs to this plan.

### Execution Checkpoint

- **Classification:** Independent bounded fix; does not become the active product plan.
- **Current unit:** Complete — U1 through U3 are verified.
- **Completed units:** U1 regression contract; U2 scoped state fixes; U3 desktop and 390px browser verification.
- **Next concrete action:** None for this bounded plan. D07 and D10 remain excluded by the user's decision.
- **Blocker:** None.

### Completion Evidence

- Focused Product unit suite: 16 passed, 0 failed.
- Nuxt typecheck, scoped ESLint, and `git diff --check`: passed.
- Browser verification: no historical-snapshot fallback; 17px/32px rating legend; truthful disabled Ask/Share; cumulative four-star hover preview; brand-yellow Footer hover; 44px small-screen rating, option, quantity, and secondary-action targets; no horizontal overflow; no console errors.
- Full Storefront unit invocation: 332 passed and five unrelated pre-existing repository-state contract tests failed outside this plan's files and behavior. The generated Fashion preview state was restored after the run.
- Post-fix quality: simplification skipped because the implementation files already contained the D01-D04 work; targeted manual review found no residual issue in D05/D06/D08/D09/D11. No commit or PR was created, per this plan's execution profile.

## Requirements

- R1 (D05). A release without rating-band data must not expose internal historical-snapshot terminology or fabricate per-star votes. The review overview keeps truthful aggregate information and omits the unavailable distribution.
- R2 (D06). `Your rating*` uses the same 17px label typography and line height as the adjacent source-matched form labels.
- R3 (D08). Unavailable Ask and Share controls are visibly and semantically unavailable, use a non-interactive cursor, and do not present hover affordance; enabled controls retain the source-like treatment.
- R4 (D09). Enabled Footer links receive the source-like brand-yellow hover treatment. Disabled Footer placeholders remain visually inert.
- R5 (D11). Rating hover previews the cumulative 1-through-N selection, while selected and focus-visible states remain truthful. Small-screen rating, option, quantity, and secondary-action controls receive improved touch target dimensions without changing the accepted D01 tab composition, whose source-matched 37px controls already exceed the WCAG 2.5.8 minimum.
- R6. D01-D04, D07, D10, review submission, product selection, keyboard tab behavior, related-product hover, and intentional product customizations do not regress.

## Implementation Units

### U1. Encode the approved state contract

- **Files:** Existing Fashion Store Product unit/E2E tests.
- **Approach:** Replace the obsolete technical-fallback assertion and add focused typography, disabled-affordance, Footer hover, cumulative-rating-hover, and small-screen target assertions.
- **Verification:** The new assertions fail for the confirmed pre-fix behavior.

### U2. Apply the minimal state fixes

- **Files:** Fashion Store Product page and scoped integration CSS; shared Footer only if markup is needed.
- **Approach:** Omit unavailable distribution UI, normalize the legend, style disabled secondary actions, scope enabled Footer hover, implement cumulative star hover, and enlarge small-screen hit areas. Leave D07 and D10 untouched.
- **Verification:** U1 assertions pass and focused unit/type/lint checks remain green.

### U3. Verify source parity and exclusions

- **Files:** Browser evidence only unless a confirmed gap requires a scoped test correction.
- **Approach:** Inspect desktop and small-screen default/hover/selected/disabled states, confirm no technical fallback, and prove D07/D10 were not changed.
- **Verification:** Clean console, no horizontal overflow, and source-comparison evidence for the approved states.
