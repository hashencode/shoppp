---
title: Compact Manual Guidance in the Store Setup Guide
type: fix
date: 2026-09-29
status: completed
plan_role: independent
execution: code
---

# Compact Manual Guidance in the Store Setup Guide

## Scope and authority

This bounded UI fix follows `2026-09-29-001-fix-admin-setup-guide-task-placement-plan.md`. It removes the repeated standalone manual-verification sections while retaining storefront preview and test-order guidance within their respective step descriptions. The original setup guide's R8 still requires both manual reminders. The 13 automatic checks, step statuses, permission-filtered destinations, stable recheck height, active `REL-Pre-DC` plan, and release gates are unchanged.

## Result

Step 5 now gives one short manual preview instruction with authorized theme and policy links beside it. Step 6 gives one test-order instruction with an Orders link for reviewing the result. There is no extra manual-verification heading or repeated paragraph below the check list. These instructions are not counted as passed checks.

## Verification

Focused Admin tests, desktop and mobile browser checks, Admin typecheck, lint, formatting, and diff checks cover the compact guidance, authorized links, and unchanged recheck layout. No candidate or DC/PG status changes.
