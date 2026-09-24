---
title: Release Cart Assertion Alignment - Plan
type: fix
status: completed
date: 2026-09-24
topic: release-cart-assertion-alignment
execution: code
---

# Release Cart Assertion Alignment

## Scope and authority

- **Objective:** Restore the release unit gate after the production fallback cart journey replaced the old live-cart journey, while retaining an actual release-ID check for live Commerce.
- **Classification:** Independent bounded test fix. The active `REL-Pre-DC` product checkpoint, FS-F14 completion, candidate status, and DC/PG authority do not change.
- **Inherited baseline:** Commit `15307fe9` deliberately changed `cart.spec.ts` to verify that production fallback sends no Commerce request. The previous release unit test still required that file to contain `process.env.RELEASE_ID`.

## Requirements

- R1. Release validation continues to test build-only catalog credentials and reuse of the validated build for browser gates.
- R2. The live Fashion Store Commerce journey verifies that the add-to-cart request carries the exact Catalog Release ID used by its build input.
- R3. The fallback journey remains free of a fabricated Commerce request or release-ID reference.

## Execution checkpoint

- **Current unit:** Complete — U1 and U2 verified.
- **Next concrete action:** None within this bounded fix. Repository-level release validation remains a separate local evidence run.
- **Blocker:** None within this bounded fix.

## Units and evidence

- **U1 — Move the assertion to the behavior owner:** Remove the stale `cart.spec.ts` text check from `tools/release-validate.test.ts`; assert the captured live add-to-cart request's `releaseId` equals the generated build input's Catalog Release ID in `apps/storefront/e2e/fashion-store-live-commerce.spec.ts`.
- **U2 — Verify:** The focused live browser journey passed (1/1); all `tools/release-validate.test.ts` tests passed (34/34); the repository tools suite passed (456/456); scoped Prettier and `git diff --check` passed. The browser fixture's generated tracked files were restored to their clean pre-run state.
