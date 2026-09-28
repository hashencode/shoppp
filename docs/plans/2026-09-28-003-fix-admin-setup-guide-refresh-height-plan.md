---
title: Keep Setup Guide Height Stable During Recheck
type: fix
date: 2026-09-28
status: completed
plan_role: independent
execution: code
---

# Keep Setup Guide Height Stable During Recheck

This bounded follow-up inherits the completed setup guidance work in `2026-09-28-002-fix-admin-setup-guide-guidance-plan.md`. It changes only the guide's loading layout. Product sequence, readiness checks, permission rules, candidate scope, and release authority remain unchanged; `REL-Pre-DC` stays active.

The Recheck and Retry actions measure the current summary card and step list before requesting fresh results. While either response is pending, those surfaces retain their prior minimum height. Old counts, reasons, and editor links are still cleared from the visible current result. After the new responses settle, the minimum heights are released and the new step expansion follows the current checks.

Verification: a browser regression holds the recheck response, confirms the previous reason is hidden, and checks that the summary card and expanded guide do not shrink during loading. The focused Admin page tests, browser guide suite, Admin typecheck, ESLint, and Prettier checks pass.
