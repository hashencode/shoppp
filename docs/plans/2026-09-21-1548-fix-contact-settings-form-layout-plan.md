---
title: Contact Settings Form Layout - Plan
type: fix
status: completed
date: 2026-09-21
topic: contact-settings-form-layout
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Contact Settings Form Layout - Plan

## Goal Capsule

- **Objective:** Admin operators can use Contact Settings as a consistent first-level form page that makes effective use of desktop width without weakening narrow-screen usability or existing contact-management behavior.
- **Means:** Keep `CustomPageRecipe` as the first-level heading owner and compose the existing form-state, content-width, validation-scroll, and fixed-toolbar primitives locally (KTD1-KTD3).
- **Authority:** This is an independent bounded Admin repair. `docs/plans/2026-09-18-1128-feat-contact-management-plan.md` remains authoritative for contact data and publication behavior, while `docs/plans/2026-09-21-1059-refactor-store-settings-navigation-plan.md` remains authoritative for the settings navigation hierarchy.
- **Execution profile:** Implement in the primary checkout without a new worktree or pull request. The repair does not change the active product-plan pointer, candidate state, deployment state, or release sequence.
- **Stop conditions:** Stop if the repair requires an API or contract change, a new shared page recipe, or a change to Contact data, publication, permission, conflict, or audit semantics.

---

## Product Contract

### Summary

Contact Settings will use the established first-level form composition instead of constraining the entire page to a hand-written centered width. Section cards will span the page content area, while each card body uses the standard width and alignment contract appropriate to its fields.

### Problem Frame

`ContactSettingsPage` places `mx-auto max-w-5xl` on `CustomPageRecipe`, so the heading, state blocks, form, and every section card share one page-level cap. The page also hand-writes form-state branches, first-error focus, and inline save/reset actions even though Admin already provides standard primitives for these concerns.

The result differs from the documented multi-Card form contract: outer cards should remain full width, content width belongs inside each card body, and form alignment must respect the operator's left/center/right preference.

### Requirements

**Page and section layout**

- R1. The Contact Settings page shell and its section cards must use the available AppShell content width instead of a page-level `max-w-5xl` cap.
- R2. Global channels and change-reason content must use the standard compact form-body width, while the nested location and social-link editors must use the standard wide form-body width.
- R3. Every constrained section body must honor the existing left, center, and right form-content alignment preference.

**Form behavior**

- R4. The first-level heading must remain visible in permission, loading, load-error, and normal states, with one heading and no detail-page back header.
- R5. Writers must retain the existing load, edit, validation, save, reset, conflict comparison, and replace-with-latest flows; readers must retain a disabled form with no submission path.
- R6. Validation failure must use the shared whole-page first-error scroll and focus contract, and saving must prevent duplicate submission without discarding the draft.
- R7. Editable mode must expose one fixed bottom save/reset toolbar using the existing form action semantics; read-only mode must not render that toolbar.

**Compatibility and verification**

- R8. Dynamic location and social-link rows must retain their current add, reorder, remove, visible-state, and unsaved-value behavior without changing their request payload.
- R9. Desktop and narrow layouts must avoid horizontal page overflow, keep section content readable, and leave the fixed toolbar reachable without covering the final form content.
- R10. The repair must not change routes, navigation metadata, translations, API calls, request payloads, contact contracts, storefront rendering, or publication behavior.

### Acceptance Examples

- AE1. **Covers R1-R3.** Given a desktop viewport, each Contact Settings card spans the available content column; channel and reason fields use compact aligned bodies, while location and social editors can use the wider standard body.
- AE2. **Covers R4-R7.** Given a writer loads the page, the route heading remains visible and a fixed save/reset toolbar appears; invalid location data scrolls and focuses the first invalid field before any request is sent.
- AE3. **Covers R5, R7-R8.** Given a writer reorders unsaved locations or socials, reset restores the saved values through the standard confirmation flow, while save sends the same complete versioned payload as before.
- AE4. **Covers R4-R5, R7.** Given an operator has `settings.read` without `settings.write`, all values remain visible and disabled, and no fixed save/reset toolbar or write request is available.
- AE5. **Covers R5, R8-R10.** Given a save receives a conflict, the draft remains visible, comparison and replace-with-latest still work, and the page remains free of horizontal overflow at desktop and mobile widths.

### Scope Boundaries

- Do not add or modify contact fields, validation rules, API schemas, persistence, permissions, audit behavior, conflict semantics, storefront output, previews, or releases.
- Do not add a top-level-form mode to `BasicCrudFormRecipe` or create another shared page recipe for a single consumer.
- Do not alter Store Settings grouping, breadcrumbs, menu selection, setup-guide destinations, or route metadata.
- Keep the current text-labeled location and social row actions. Migrating them to `SortActionGroup` is deferred because that shared icon-only control does not currently accept application-owned accessible names.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Compose existing primitives locally.** Keep `CustomPageRecipe` outside the form-state boundary and reuse the same top-level form composition as Commercial Settings. Do not extend `BasicCrudFormRecipe` or add a new recipe. (session-settled: user-approved — chosen over extending or creating a shared top-level form recipe: the user confirmed the bounded local-composition approach.) Governs R1, R4-R7, R10.
- KTD2. **Place width on Card bodies, not the page or Form root.** Use `FORM_CARD_BODY_WIDTH_CLASS_NAME.compact` for global channels and change reason, and `.wide` for the nested location and social editors. This follows the multi-Card contract and preserves alignment preferences. Governs R1-R3, R9.
- KTD3. **Adopt standard form-state and action primitives without changing domain ownership.** Use `TemplateFormStateGate`, `FORM_ERROR_SCROLL_OPTIONS`, and `FormSubmitToolbar`; keep contact-specific save errors and conflict recovery inside the form because they describe domain state rather than page loading. Governs R4-R8.
- KTD4. **Treat existing Contact tests as characterization coverage.** Preserve their request, permission, conflict, ordering, localization, and no-overflow assertions, then add structural and real-browser evidence for the new layout and fixed toolbar. Governs R5-R10.

### Sequencing and Constraints

1. Extend the focused component test expectations before changing the page so the current contact payload and state behavior remain explicit.
2. Recompose the page with existing primitives and move width constraints to section bodies in one local change.
3. Verify the final geometry and toolbar behavior in the existing Contact browser journey at desktop and mobile widths.

### Risks and Dependencies

- `TemplateFormStateGate` uses the standard Admin permission and load-state presentation. The implementation must retain one route heading and a usable retry path while avoiding any change to authorization decisions.
- `FormSubmitToolbar` introduces the standard reset confirmation. Tests must verify that cancelling preserves the draft and confirming restores the last loaded values.
- Fixed toolbar overlap is a real mobile risk. The existing `CustomPageRecipe` bottom padding remains required, and browser verification must exercise the final fields and actions near the page bottom.
- The work depends only on existing Admin primitives and current Contact fixtures. No external service or package change is required.

### Sources and Research

- `apps/admin/src/pages/settings/contact-settings-page.tsx` is the target page and owns the existing contact-specific state and submission behavior.
- `apps/admin/src/pages/settings/launch-settings-page.tsx` is the direct first-level settings-form composition precedent.
- `apps/admin/src/shared/template-kit/form/form-content-width.ts`, `apps/admin/src/shared/template-kit/form/template-form-state-gate.tsx`, and `apps/admin/src/shared/components/form-submit-toolbar.tsx` own the reusable layout, state, and action contracts.
- `apps/admin/docs/ai/ai-rules.md` and `apps/admin/docs/ai/page-guardrail-recipes.md` require full-width outer cards, section-local content widths, shared alignment classes, first-error scrolling, and fixed form actions.
- `apps/admin/docs/testing-standards.md` classifies this page-local behavior and layout repair as `L2`, with focused tests, changed-file checks, final typecheck, and browser coverage where CSS behavior matters.

---

## Implementation Units

### U1. Recompose Contact as a standard first-level form

- **Goal:** Replace the hand-written page-width and form-shell behavior with the established first-level settings-form composition.
- **Requirements:** R1-R8, R10; AE1-AE4.
- **Dependencies:** None.
- **Files:** `apps/admin/src/pages/settings/contact-settings-page.tsx`, `apps/admin/src/pages/settings/contact-settings-page.test.tsx`.
- **Approach:** Apply KTD1-KTD3. Remove the page-level width class, keep `CustomPageRecipe` as the heading owner, place the page content behind the standard form-state gate, use shared validation scrolling, assign compact or wide body classes to each section, and move editable actions into `FormSubmitToolbar`. Keep contact-specific conflict alerts, comparison, replacement, API calls, and payload normalization in their current domain boundary.
- **Execution note:** Start by strengthening the existing component tests around payload equality, read-only submission blocking, reset confirmation, and conflict draft retention before recomposing the JSX.
- **Patterns to follow:** `apps/admin/src/pages/settings/launch-settings-page.tsx`, `apps/admin/src/shared/template-kit/recipes/basic-crud-form-recipe.tsx`, and the current Contact conflict-recovery tests.
- **Test scenarios:**
  - Assert the page root no longer carries `mx-auto` or `max-w-5xl`, while every section card remains present under one level-4 route heading.
  - Assert the global channels and reason Card bodies use the compact width and alignment contract, and the location and social Card bodies use the wide contract.
  - Submit invalid dynamic-row data and assert the first invalid field receives focus with no PUT request.
  - Edit fields, cancel reset confirmation, and assert the draft remains; confirm reset and assert the last loaded values return without a PUT request.
  - Save a valid reordered profile and assert the complete request remains versioned and structurally equal to the existing contract.
  - Force a save conflict and assert the draft, compare action, and replace-with-latest recovery remain available.
  - Render with read-only permission and assert fields are disabled, forced submission sends no request, and the fixed toolbar is absent.
- **Verification:** The focused Contact component suite proves the structural contract and all preserved state, permission, validation, request, reset, and conflict behavior.

### U2. Verify responsive geometry and fixed actions in the browser

- **Goal:** Prove the wider section layout and standard toolbar work in real desktop and mobile rendering without overflow or inaccessible actions.
- **Requirements:** R1-R3, R7-R9; AE1-AE5.
- **Dependencies:** U1.
- **Files:** `apps/admin/e2e/setup-guide.spec.ts`.
- **Approach:** Extend the existing Contact editor browser scenario rather than creating a second fixture. At desktop width, assert the outer section cards use the available AppShell content width while their bodies respect compact and wide caps; at mobile width, assert responsive collapse, no horizontal overflow, and reachable fixed actions. Exercise one alignment preference change through the existing application setting and verify the constrained body moves without changing its width contract.
- **Patterns to follow:** The existing desktop/mobile Contact editor loop in `apps/admin/e2e/setup-guide.spec.ts` and the form-alignment behavior owned by `apps/admin/src/shared/contexts/theme-context.tsx`.
- **Test scenarios:**
  - At 1440px, compare card and content-container geometry and assert the card is not capped at the former page width.
  - Verify compact and wide Card bodies remain within their standard maximum widths and follow the active center alignment.
  - Change the form-content preference to left or right and assert the constrained bodies move accordingly without affecting the full-width cards.
  - At 390px, add dynamic rows, reach the final reason field and fixed toolbar, and assert the document and AppShell content have no horizontal overflow.
  - Submit invalid rows from the fixed toolbar and verify browser focus moves to the first invalid field; complete the fields and verify one save request.
  - Load as a read-only operator and verify values remain accessible while the fixed toolbar is absent.
- **Verification:** The focused Playwright Contact scenario passes for desktop English and mobile Chinese, with geometry assertions and no-overflow checks on the built Admin candidate.

---

## Verification Contract

This is an Admin `L2` repair because production changes remain local to one page and reuse shared components without modifying them.

| Gate                              | Command                                                                                                                                                                                                                                             | Proves                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Focused component tests           | `bun run --cwd apps/admin test -- src/pages/settings/contact-settings-page.test.tsx`                                                                                                                                                                | Page composition, widths, heading/state behavior, validation focus, reset, permission, payload, conflict recovery, and localization. |
| Changed-file lint                 | `bunx eslint apps/admin/src/pages/settings/contact-settings-page.tsx apps/admin/src/pages/settings/contact-settings-page.test.tsx apps/admin/e2e/setup-guide.spec.ts`                                                                               | Changed TypeScript and TSX files satisfy repository lint rules.                                                                      |
| Changed-file format               | `bunx prettier --check docs/plans/2026-09-21-1548-fix-contact-settings-form-layout-plan.md apps/admin/src/pages/settings/contact-settings-page.tsx apps/admin/src/pages/settings/contact-settings-page.test.tsx apps/admin/e2e/setup-guide.spec.ts` | The plan and changed source and test files satisfy formatting rules.                                                                 |
| Type safety and browser candidate | `bun run --cwd apps/admin build:test`                                                                                                                                                                                                               | TypeScript project checks and the browser candidate build pass; this replaces a separate typecheck.                                  |
| Focused browser journey           | `bun run --cwd apps/admin test:e2e -- e2e/setup-guide.spec.ts --grep "contact editor"`                                                                                                                                                              | Real-browser desktop/mobile layout, alignment, validation focus, fixed actions, save behavior, and no-overflow evidence.             |

Do not run full Admin or monorepo suites unless the implementation changes a shared primitive, consumer inventory becomes unbounded, or a focused failure cannot be isolated. If a shared primitive must change, reclassify the work to `L3` and map all consumers before proceeding.

---

## Definition of Done

- U1 and U2 are complete in dependency order, and every requirement is covered by focused component or browser evidence.
- Contact Settings no longer applies a page-level centered maximum width; section cards span the available content area and their bodies use the standard compact/wide alignment contract.
- Editable mode uses the standard fixed save/reset toolbar and first-error scroll behavior; read-only mode exposes no write action.
- Existing contact loading, permission, validation, save, reset, conflict, dynamic-row, localization, request-payload, and no-overflow behavior remains correct.
- The final Admin code state passes the `L2` verification gates, with `build:test` serving as the typecheck-containing gate.
- Contact APIs, contracts, Storefront code, navigation metadata, active product-plan checkpoint, master-plan pointer, candidate state, deployment state, and release sequencing remain unchanged.
- No abandoned page recipe, shared-component experiment, duplicate state layer, or other dead-end code remains in the diff.
