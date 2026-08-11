# Storefront Theme Testing

## Scope

This runbook verifies Fashion Store feature completion in local and isolated test environments. It
must not deploy production code, change traffic, read production credentials, or run a production
promotion workflow.

## Required input identity

Record one deployed canonical Catalog Release ID and one immutable Experience Snapshot ID together
with the Experience version, theme version, platform contract version, commit, and test origin.
Draft preview evidence must additionally record the draft version and artifact digest. Do not treat
a mutable draft as final acceptance evidence.

## Local gates

Run the contract, API Experience, Admin editor, storefront theme-engine, Fashion Store route,
Worker-compatible transaction, accessibility, static-output, bundle-budget, scale, typecheck, lint,
and import-boundary suites. Fixture-preview output must remain deterministic, while live mode must
contain no fixture fallback.

## Isolated test gate

Before any transactional test, run environment isolation verification and confirm that API, D1,
R2, preview, payment, email, challenge, origin, and credential bindings all identify the approved
non-production environment. Use deterministic namespaced products, carts, checkouts, and orders,
sandbox providers, and explicit cleanup.

The operator flow is: select a deployed canonical Catalog Release; edit only manifest-declared
presentation fields; save with an optimistic version; validate; build a private preview; confirm the
visible Catalog/Experience/theme/platform identity; open it through a one-time POST grant; then
approve the exact immutable Experience Snapshot. Changing the Catalog Release invalidates prior
preview evidence and approval readiness but preserves unsaved draft edits.

Stop after evidence is recorded. Production activation, monitoring, rollback, and legacy-trigger
cleanup are intentionally outside this runbook.
