---
title: Contact Settings Single-column Form - Plan
type: fix
status: completed
date: 2026-09-21
topic: contact-settings-single-column
artifact_contract: ce-unified-plan/v1
product_contract_source: user-correction
execution: code
---

# Contact Settings Single-column Form - Plan

## Goal Capsule

- **Objective:** Render every Contact Settings field group as a single-column form while keeping the outer section cards full width.
- **Authority:** This bounded successor supersedes only the compact/wide body split and two-column field layout in `2026-09-21-1548-fix-contact-settings-form-layout-plan.md`. That completed plan remains authoritative for the standard state gate, fixed toolbar, validation focus, permissions, and preserved Contact behavior.
- **Execution profile:** Implement and verify in the current checkout without changing the active product plan, master pointer, API, routes, translations, or contact behavior.

## Requirements

- R1. Global channels, locations, social links, and change reason use the standard compact aligned card-body width.
- R2. No Contact Settings field grid switches to two columns at desktop breakpoints.
- R3. Full-width outer cards, alignment preferences, fixed actions, validation, reset, save, conflict recovery, permissions, and request payloads remain unchanged.

## Implementation Unit

### U1. Convert Contact Settings to one field column

- **Files:** `apps/admin/src/pages/settings/contact-settings-page.tsx`, `apps/admin/src/pages/settings/contact-settings-page.test.tsx`, `apps/admin/e2e/setup-guide.spec.ts`.
- **Approach:** Remove the desktop two-column grid classes and the spacer used by the old paired layout. Change locations and social card bodies from `wide` to `compact`. Update focused component and browser geometry assertions to require the same compact width across sections.
- **Verification:** Focused Contact component tests, changed-file lint/format, `build:test`, and the existing desktop/mobile Contact Playwright journey.
