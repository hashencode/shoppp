---
title: Preserve Admin sidebar expansion across navigation
type: fix
date: 2026-10-11
execution: code
plan_role: independent
---

# Preserve Admin sidebar expansion across navigation

## Scope and authority

This bounded fix owns the Admin sidebar's expansion continuity during client-side navigation.
It inherits the merchant navigation baseline in
`2026-10-10-2307-refactor-admin-merchant-workflows-plan.md` and the existing Ant Design menu
composition. It supersedes only the route-dependent menu remount that clears expanded groups.
The active product plan remains REL-Pre-DC; product sequencing, permissions, route classification,
candidate scope, and deployment authority are unchanged. Local implementation and verification
belong to this plan, with no deployment or PR tail.

## Requirements and implementation

- R1. Navigating between pages preserves every previously expanded sidebar group.
- R2. A manually closed group remains closed during subsequent navigation and browser Back.
- R3. Direct entry still initially opens the active group and selects its child. Ant Design retains
  ownership of keyboard navigation, responsive collapse, popup behavior, and expansion restoration.
- KTD1. Remove the changing React key from the existing Menu so its internal expansion state survives
  route changes. Keep route-derived selection and initial default expansion.

## Execution checkpoint

- Status: Completed; the execution body is frozen.
- Completed unit: U1 — reproduced the reset, removed the Menu remount, and verified navigation continuity.
- Current unit and next action: None; local implementation and verification are complete.
- Blocker: None.
- Evidence: The new regression failed on the original code for both the root and `/admin` basename:
  previously expanded groups reported `aria-expanded=false` after navigating to Contact information.
  Removing the changing Menu key fixed both cases. Final verification passed as recorded below.

## Verification

Verification level L3: AppShell is shared route infrastructure. Production consumers are
`src/routes/router.tsx` → `src/routes/index.tsx` → the Admin application; the direct suites are
`src/shared/layout/app-shell.test.tsx`, `src/shared/layout/app-shell.browser.test.tsx`, and
`src/routes/antd-app-feedback.browser.test.tsx`. The route metadata consumer is covered by
`src/routes/index.test.tsx`. The Admin workspace depends on `@shoppp/contracts`, which is unchanged;
no other workspace imports this Admin-local shell.

Run the focused shell and route tests, the two shell-consuming Browser Mode suites for native
keyboard/collapse behavior, changed-file ESLint and Prettier, Admin typecheck once after stabilization,
and the scoped Git diff check. Strengthen the existing native-browser journey with expansion
assertions after cross-group navigation. No new accessibility protocol or app-wide test run is needed.

## Completion evidence

- `bun run test src/shared/layout/app-shell.test.tsx src/routes/index.test.tsx`: 50 tests passed,
  including expansion continuity, manual close, browser Back, direct entry, and `/admin` basename.
- `bun run test:browser src/shared/layout/app-shell.browser.test.tsx
  src/routes/antd-app-feedback.browser.test.tsx`: 3 native-browser tests passed, including keyboard
  cross-group navigation with four groups kept open and the existing sidebar-collapse behavior.
  The first attempt could not launch because the required Chromium headless shell was absent;
  installing the official Playwright shell resolved that environment dependency.
- Changed-file ESLint and Prettier, `bun run typecheck` in Admin, and `git diff --check`: passed.
- Targeted manual review of the fix-owned files found no residual issue. Simplification was skipped
  because production changes consist only of removing one key; the library retains its own expansion
  and collapse cache. Review stayed within this fix because `.idea/` was already untracked.
- This is local development evidence only. The active product pointer and release authorities remain
  governed by the existing master and REL plans.
