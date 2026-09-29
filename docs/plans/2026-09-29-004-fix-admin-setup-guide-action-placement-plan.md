---
title: Place Setup Guide Actions on Specific Rows
type: fix
date: 2026-09-29
status: completed
plan_role: independent
execution: code
---

# Place Setup Guide Actions on Specific Rows

## Scope and authority

This bounded Admin UI fix follows `2026-09-29-003-fix-admin-setup-guide-link-consistency-plan.md`. It sets one placement standard for actions in the six-step guide: step descriptions explain purpose and limits, while actionable links appear only on the specific automatic check or manual task row they serve. Manual tasks stay in their existing steps and remain outside the 13-check total. The active `REL-Pre-DC` product scope, check criteria, permissions, destination URLs, and release gates are unchanged.

## Result

Storefront preview and end-to-end test ordering have compact list rows with a visible manual label, authorized action links, and an explanatory line. No action link remains in the step-level description. Automatic check links still follow their check status. The separate manual-verification section does not return.

## Verification

Focused Admin tests check row-level ownership and link destinations. Desktop and mobile browser checks cover placement, blue link styling, and the existing recheck height behavior. Admin typecheck, lint, formatting, and diff checks pass. No candidate or DC/PG status changes.
