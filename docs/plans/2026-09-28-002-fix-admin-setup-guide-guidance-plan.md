---
title: Restore Store Setup Guide Progress and Guidance
type: fix
date: 2026-09-28
status: completed
plan_role: independent
execution: code
---

# Restore Store Setup Guide Progress and Guidance

## Scope and authority

This is a bounded independent correction to the Admin guide. It inherits the completed `ADM-SETUP` six-step, 13-check readiness contract and the `FS-F14` permission-filtered destination contract. It supersedes only `FS-F14-U9`'s decision to show the guide as a deep-link index without readiness; it does not change product sequence, candidate scope, release gates, or the active `REL-Pre-DC` pointer. The completed predecessor plans remain historical evidence.

The guide shows the existing 13 current server checks, their passed/action/unavailable/restricted states and reasons, and six ordered steps. Each step links to the currently authorized editor returned by the destination API. A step with any non-passing check opens automatically. Rechecking clears stale conclusions until the new response arrives. The count describes these checks only; newer Identity, Policy, Content, Navigation, Collection, and Theme publication and candidate state remain owned by their editors. A passed count is never presented as full store or release readiness.

## Completion and evidence

- Admin reads `/admin/settings/setup-guide` for users with `settings.read` and `/admin/settings/setup-guide/destinations` for every authenticated guide visitor.
- The step UI groups editor links by task, preserves deployment basenames, and still allows partial-permission visitors to reach authorized editors.
- Focused Admin tests cover incomplete configuration, grouped links, retry, stale-result clearing, and permission filtering. The existing Workers test preserves the 13-check endpoint and the permission-filtered destination endpoint.
- Verified on 2026-09-28: `bun run --cwd apps/admin test src/pages/home/welcome-page.test.tsx` (6 passed), `bun run --cwd apps/admin test:e2e e2e/setup-guide.spec.ts` (desktop, mobile, retry: 3 passed), `bun run --cwd apps/api test:workers test/operations/setup-guide.test.ts` (3 passed), Admin typecheck, targeted ESLint, and Prettier checks passed.
- Active product execution stays at `REL-Pre-DC`; this correction does not freeze a candidate or advance DC/PG.
