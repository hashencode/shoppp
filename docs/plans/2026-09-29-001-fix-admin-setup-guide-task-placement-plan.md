---
title: Place Setup Guide Actions Beside Their Tasks
type: fix
date: 2026-09-29
status: completed
plan_role: independent
execution: code
---

# Place Setup Guide Actions Beside Their Tasks

## Scope and authority

This bounded Admin fix inherits the completed six-step, 13-check guide from `2026-09-28-002-fix-admin-setup-guide-guidance-plan.md`, stable recheck layout from `2026-09-28-003-fix-admin-setup-guide-refresh-height-plan.md`, and check-level action links from `2026-09-28-004-feat-admin-setup-guide-action-links-plan.md`. It changes only where explanatory actions appear and which authorized editor links accompany manual tasks. The active `REL-Pre-DC` product pointer, automatic check criteria, permissions, and release gates do not change.

## Result

Payment credential and runtime binding guidance appears inside its affected check row. Storefront preview and test order are separate manual verification tasks inside their relevant steps, explicitly excluded from the 13 automatic checks. Preview links to themes and policy content when authorized. Test ordering starts in the test storefront; the Admin Orders link is for reviewing the resulting order only. No Admin page is falsely presented as an environment binding editor or test checkout launcher.

## Verification

Focused Admin tests cover affected-row placement, task links, and the absence of a false checkout action. Admin typecheck, formatting, and browser checks verify the existing guide interaction and recheck layout. This independent fix does not change candidate or DC/PG status.
