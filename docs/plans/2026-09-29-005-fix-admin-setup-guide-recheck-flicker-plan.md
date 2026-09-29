---
title: Keep Setup Guide Results Visible During Recheck
type: fix
date: 2026-09-29
status: completed
plan_role: independent
execution: code
---

# Keep Setup Guide Results Visible During Recheck

## Scope and authority

This bounded Admin fix follows `2026-09-29-004-fix-admin-setup-guide-action-placement-plan.md`. It supersedes only the loading presentation in `2026-09-28-003-fix-admin-setup-guide-refresh-height-plan.md`: retain the last complete same-scope result during recheck instead of clearing content and imposing minimum heights. The original 13-check criteria, permission-filtered destinations, active `REL-Pre-DC` product plan, and release gates do not change.

## Result

Recheck starts both the checks and destination requests. The button shows loading while the current count, reasons, links, and panel expansion remain visible. Only after both requests settle does the guide publish the new snapshot. A failed check then clears the old conclusion and shows the error. A location, role, or permission scope change never reuses the previous snapshot.

## Verification

The browser regression was first observed failing because the old statistic disappeared during a delayed recheck. It now holds each response independently and verifies the old guide persists until both settle, then updates. The focused Admin tests cover failure recovery. Desktop and mobile guide cases, Admin typecheck, lint, formatting, and diff checks pass. No candidate or DC/PG status changes.
