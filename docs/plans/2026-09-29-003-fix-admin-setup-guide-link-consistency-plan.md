---
title: Consistent Setup Guide Link Labels and Color
type: fix
date: 2026-09-29
status: completed
plan_role: independent
execution: code
---

# Consistent Setup Guide Link Labels and Color

## Scope and authority

This bounded Admin UI fix follows `2026-09-29-002-fix-admin-setup-guide-manual-guidance-plan.md`. It unifies check actions, manual task links, and the secondary destination index through one link component. It does not change destination authorization, automatic check results, step statuses, active `REL-Pre-DC` scope, or release gates.

## Result

Every actionable guide link uses blue text, an arrow, and the same translated “Go to {destination}” label. Section anchors remain on check-level links. Permission-filtered links remain absent when no destination is returned. This removes the prior difference between check actions (“Go to…”) and plain destination names.

## Verification

Focused Admin tests cover names and destination URLs. Desktop and mobile browser tests check the rendered blue color on both check and manual links, plus the existing recheck height behavior. Admin typecheck, lint, formatting, and diff checks pass. No candidate or DC/PG status changes.
