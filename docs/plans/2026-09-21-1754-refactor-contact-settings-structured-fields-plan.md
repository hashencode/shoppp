---
title: Refactor contact settings structured fields
date: 2026-09-21
type: implementation-plan
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Contact settings structured fields

## Goal Capsule

- **Objective:** Operators can configure contact hours, time zone, and the storefront's supported social links through constrained controls that prevent invalid or inconsistent public contact data.
- **Means:** Replace free-text contact fields with shared time-zone options, structured weekly service windows, and a four-platform social enum while making the API generate audit and social display text (KTD1–KTD4).
- **Authority:** This independent bounded plan inherits the current contact-settings behavior and the repository accessibility rules. It does not change the active product plan, candidate scope, or master-plan pointer.
- **Execution profile:** Implement and verify in the existing checkout; no worktree, commit, push, or pull request is part of this plan.
- **Stop conditions:** Stop if preserving stored free-text hours would require silently inventing a schedule, or if another dirty change overlaps a required hunk and cannot be preserved.

---

## Product Contract

### Summary

Contact settings use a single-column standard form, but several values remain unconstrained. This change makes time zones searchable selections throughout Admin, models service hours as weekday and time ranges, fixes social platforms to Facebook, Dribbble, Twitter, and Instagram, derives their display names, and removes the operator-authored change reason.

### Problem Frame

Free-text time zones and service hours create avoidable validation and display inconsistencies. Free-text social platform and label fields also allow values the Fashion Store cannot represent consistently, while the contact update reason asks operators to supply metadata that the system already knows.

### Key Decisions

- session-settled: **The supported social set is Facebook, Dribbble, Twitter, and Instagram.** Governs R5 and R6.
- session-settled: **Contact settings remain a one-column form.** Governs R8.

### Requirements

**Time zones and service hours**

- R1. Every Admin time-zone field uses the same searchable IANA time-zone option source rather than a text input or a short hard-coded list.
- R2. Contact service hours are entered as one or more weekday ranges paired with start/end times.
- R3. A time zone is required when service windows exist and absent when no service hours are configured.
- R4. Existing stored free-text service hours remain readable and are never silently converted into invented structured hours.

**Social links and audit behavior**

- R5. A social link platform can only be Facebook, Dribbble, Twitter, or Instagram, selected from a dropdown.
- R6. The system derives the visible social label from the selected platform; operators only enter the destination URL and publication state.
- R7. Contact updates no longer ask for or accept an operator-authored change reason; the API records a stable system-generated audit reason.

**Form behavior**

- R8. The contact settings form remains single-column, preserves list ordering controls, readonly behavior, reset confirmation, conflict recovery, and first-error scrolling.

### Acceptance Examples

- AE1. An operator adds Monday–Friday, 09:00–18:00 in Asia/Shanghai and the storefront renders a readable weekly range with that time zone. Covers R1–R3.
- AE2. An older profile containing free-text service hours still loads and displays that text until an operator explicitly replaces it with ranges. Covers R4.
- AE3. An operator chooses Instagram, enters an HTTPS URL, and saves without entering a separate label or change reason; the public contact payload contains the canonical Instagram label and the audit entry contains the system reason. Covers R5–R7.

### Scope Boundaries

- This change does not add new social networks or editable social display labels.
- This change does not redesign storefront contact layout or reporting date semantics.
- This change does not alter reason requirements for unrelated sensitive actions such as report exports.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Export one Admin time-zone option helper built from `Intl.supportedValuesOf('timeZone')`, with `UTC`, the current/saved zone, and a compatibility fallback included deterministically.
- KTD2. Represent new service hours as a discriminated structured weekly schedule; normalize previously stored strings into an explicit legacy-text variant so no schedule is guessed.
- KTD3. Normalize legacy social platform casing at the contract boundary, restrict canonical values to four lowercase identifiers, enforce platform uniqueness, and derive the public label from a shared mapping.
- KTD4. Keep an optional ignored request reason only as a transition input if needed for old callers, while Admin omits it and the API writes a constant audit reason.

### Sequencing

1. Change contracts and compatibility normalization first.
2. Update API persistence/public projection and audit behavior.
3. Update shared Admin time-zone controls and the Contact form.
4. Update storefront formatting and all affected fixtures/tests.

### Risks & Dependencies

- Stored contact profiles may contain arbitrary free-text hours; the legacy variant is required to avoid data loss.
- `Intl.supportedValuesOf` availability differs by runtime, so the helper must have a deterministic fallback and include the current value.
- Existing dirty changes in Contact page and its tests are part of the immediately preceding form-layout work and must be preserved; unrelated dirty files must not be modified.

---

## Implementation Units

### U1. Contract and API normalization

- **Goal:** Establish canonical structured hours, fixed social platforms, derived labels, and system audit reasons without losing old stored hours.
- **Requirements:** R2–R7
- **Files:** `packages/contracts/src/platform.ts`, `packages/contracts/test/platform-contact.test.ts`, `apps/api/src/settings/contact-profile.ts`, `apps/api/test/operations/contact-profile.test.ts`
- **Approach:** Add reusable schedule/social schemas and labels, normalize legacy persisted shapes before validation, enforce uniqueness, and generate the contact audit reason server-side.
- **Test Scenarios:** Weekly schedules validate; malformed ranges fail; legacy text survives reads; unknown/duplicate social platforms fail; canonical labels and audit reason are emitted.
- **Verification:** Run focused contracts and API contact-profile tests plus type checking/build checks.

### U2. Admin constrained controls

- **Goal:** Replace free text with standard single-column controls and share complete time-zone options across Admin.
- **Requirements:** R1–R3, R5–R8
- **Files:** `apps/admin/src/shared/utils/time-zones.ts`, its tests, Contact settings page/tests, Dashboard page/tests, Order report page/tests, and affected translations/e2e fixture.
- **Approach:** Reuse one searchable time-zone option builder, use weekday/time range controls for weekly hours, use a fixed platform Select with derived hidden data, and remove the reason card and payload field.
- **Test Scenarios:** All zones remain selectable, structured hours save, legacy hours require explicit replacement, duplicate social platforms are rejected, labels/reason are not editable, readonly mode remains correct.
- **Verification:** Run focused component tests, Admin lint/type checks, and the existing Contact browser scenarios.

### U3. Storefront projection and regression verification

- **Goal:** Render the new service-hours model and canonical social data without regressing existing contact surfaces.
- **Requirements:** R2–R6
- **Files:** Fashion Store live-contact component, shared contact consumers only where needed, theme-engine/contact tests, and contact fixtures.
- **Approach:** Format weekly ranges for shoppers, retain legacy text rendering, and continue using the canonical derived label for all public social links.
- **Test Scenarios:** Weekly and legacy hours render truthfully; visible location/social ordering is retained; hidden entries remain excluded.
- **Verification:** Run focused Storefront tests and the repository build/test commands covering changed packages.

---

## Verification Contract

| Scope | Command or check | Done signal |
|---|---|---|
| Contracts | Focused `packages/contracts` contact tests | Canonical and compatibility schemas pass |
| API | Focused `apps/api/test/operations/contact-profile.test.ts` | Read, update, audit, conflict, and validation cases pass |
| Admin | Focused Contact, Dashboard, Order Report unit/browser tests | Constrained controls and payloads behave as specified |
| Storefront | Focused live-contact and theme-engine tests | Weekly/legacy hours and social labels render correctly |
| Static quality | Repository lint/typecheck/build commands for affected workspaces | No new TypeScript, ESLint, or formatting failures |
| Diff review | Inspect only files touched by this plan | No unrelated dirty changes are overwritten or included |

---

## Definition of Done

- U1 is done when the contract accepts canonical weekly hours and four social platforms, preserves legacy text explicitly, and the API supplies the audit reason.
- U2 is done when all Admin time-zone controls share the full option source and Contact settings expose only structured hours and fixed social choices in one column.
- U3 is done when the storefront truthfully renders canonical and legacy hours and all focused regression suites pass.
- The final diff contains no abandoned implementation path, debug output, or edits to unrelated dirty files.
