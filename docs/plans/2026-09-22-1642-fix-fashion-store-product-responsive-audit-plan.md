---
title: Fashion Store Product Responsive Audit Corrections - Plan
type: fix
status: completed
date: 2026-09-22
topic: fashion-store-product-responsive-audit
artifact_contract: ce-unified-plan/v1
product_contract_source: user-approved-audit
execution: code
---

# Fashion Store Product Responsive Audit Corrections - Plan

## Goal Capsule

- **Objective:** Correct the four user-approved Product-page audit defects (D01-D04) against the Fashion Store source template at desktop, tablet, and small-screen breakpoints.
- **Authority:** The revised state audit at `/Users/studio/.codex/visualizations/2026/09/22/01a0c808-5a3b-7513-b0b0-bbbcad08c372/product-page-state-audit/audit.md` owns the accepted defect list. The source template `templates/Crafto - The Multipurpose HTML5 Template/html/demo-fashion-store-single-product.html` owns the affected responsive composition.
- **Inherited baseline:** FS-F12 continues to own Product content/review publication behavior. FS-F14 remains the active product successor at U1.1 and is not advanced or changed by this independent fix.
- **Scope boundary:** Preserve the intentionally customized Header, the intentionally removed Footer copyright/legal strip, and the intentionally removed Compare action. Do not treat content-density observations R01-R03 as implementation scope.
- **Execution profile:** Implement and verify in the current checkout. No worktree, product-pointer update, candidate change, deployment, or PR belongs to this plan.

### Execution Checkpoint

- **Classification:** Independent bounded fix; does not become the active product plan.
- **Current unit:** None — the independent fix is complete.
- **Completed units:** U1 — D01-D04 implementation and verification.
- **Next concrete action:** Hand back to FS-F14 U1.1 without changing its checkpoint or the product master pointer.
- **Blocker:** None.

### Completion Evidence

- Product, contract, API, database migration, type, lint, and formatting checks pass.
- Browser QA covers the 767/768 tab transition, desktop/mobile review form, blank/invalid review submission, small-screen Ask/Share flow, and live Footer Quick contact width.
- Source and implementation captures plus the final state audit are retained in `docs/progress/fashion-store-product-responsive-audit/` and `design-qa.md`.
- Independent code review completed; all confirmed P1/P2 findings were resolved before closure.

## Requirements

- R1 (D01). Product tabs remain one horizontal row at 768-991px and become one vertical column below 768px, matching the source template instead of the current two-column grid.
- R2 (D02). Add a review includes required name, email, rating, review body, and agreement fields. Desktop uses the source 5/5/2 field proportions and 9/3 agreement/submit row; small screens place Submit review below the agreement and align it to the start.
- R3 (D02). Email and affirmative agreement enter the typed submission contract and are server-validated. Email remains transient and is not persisted; the acceptance time is retained privately with the pending review and never enters the published review display.
- R4 (D03). Live Quick contact keeps the same small-screen grid width as fixture-preview instead of being forced to a full row.
- R5 (D04). With Compare intentionally absent, Ask a question and Share retain template-like auto-width flow on small screens rather than each being forced to a full-width row.
- R6. Existing review moderation, idempotency, public review publication, Product behavior, intentional omissions, and non-target routes do not regress.

## Implementation Unit

### U1. Correct the approved responsive and review-form defects

- **Files:** Product page and scoped integration CSS, shared Footer, review contract/API/schema migration, and their focused storefront/API/database tests.
- **Approach:** Replace the invented two-column tab breakpoint with source breakpoints; remove the small-screen full-width action override; restore the source review form grid and native labeled validation; keep email transient while persisting consent acceptance; remove the live-only Footer width override.
- **Verification:** Focused contract/API/database tests, storefront unit/static/type checks, changed-file lint/format, responsive browser geometry at 320/390/575/768/992/1440, and a source-versus-implementation visual QA record.
