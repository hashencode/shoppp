---
title: Direct Actions in the Store Setup Guide
type: feat
date: 2026-09-28
status: completed
plan_role: independent
execution: code
---

# Direct Actions in the Store Setup Guide

## Scope and authority

This bounded Admin interaction update inherits the completed six-step, 13-check guide and the permission-filtered destination response from `2026-09-28-002-fix-admin-setup-guide-guidance-plan.md`, plus the stable recheck layout from `2026-09-28-003-fix-admin-setup-guide-refresh-height-plan.md`. It supersedes the step-bottom destination buttons with check-level actions and a secondary index for areas outside the automatic checks. The active `REL-Pre-DC` product pointer, check criteria, permissions, release gates, and candidate scope do not change.

Each step header uses an icon with a readable tooltip and accessible status name. A `needs_action` check links directly to its relevant authorized editor and, where available, its fixed section anchor. Passed, unavailable, and restricted checks have no action arrow. Missing payment credentials, Turnstile bindings, and backup bindings name the deployment maintainer as the next actor. Payment mode remains an Admin action when that is the actual issue. The secondary index groups unmeasured editors; visitors without `settings.read` instead see all of their authorized editors there. Opening an editor never counts as passing a check.

## Verification

Verified on 2026-09-28: focused Admin tests (9 passed) cover direct links, section anchors, no misleading credential links, and permission-filtered destinations. Browser tests (4 passed) cover desktop and mobile guided navigation, return flow, and recheck height. Admin typecheck, targeted lint, and formatting checks pass. This work does not freeze a candidate or advance DC/PG.
