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

### Fashion U12 protected prerequisites

The complete Fashion journey uses only the `fashion-staging` deployment profile. Before dispatch,
an authorized operator must independently verify and record all of the following without copying a
secret into logs or artifacts:

- the API Worker is `shoppp-api-fashion-staging`, D1 is `shoppp-fashion-staging`, and the private
  Worker is `shoppp-storefront-fashion-preview` with separate `PREVIEW_AUTH` and `COMMERCE_API`
  bindings to the dedicated Fashion API;
- every pending prerequisite migration through `0020_fashion_staging_acceptance.sql` and the
  matching API lifecycle routes are already deployed to that isolated environment after an exact
  D1 backup and restore-readiness check, and `FASHION_U12_ACCEPTANCE_TOKEN` is configured only on
  the Fashion API and the protected GitHub environment;
- Stripe is in sandbox mode; success and cancel URLs use the exact private Fashion origin; the
  signed webhook targets the Fashion API; Turnstile is required with a Fashion-hostname test site
  key and a configured server secret; and email delivery is isolated or deliberately suppressed;
- the canonical single-variant, multi-variant, unavailable product, selected variant, warehouse,
  Catalog Release, Experience Snapshot, artifact, commit, and canonical Catalog digest variables
  all resolve to the approved Fashion seed lineage.

A repository change does not satisfy these deployed prerequisites. The user-approved standing
FS-U12 authority covers only the governed Fashion preparation and Preview operations below when the
repository scope verifier passes. Setting or rotating secrets, touching unrelated resources, and
ordinary staging or production remain outside that authority. Never substitute those environments
when a Fashion prerequisite is missing.

The governed remote preparation path is
`.github/workflows/prepare-fashion-staging-u12.yml`. It is not an ordinary preview workflow and it
must not be dispatched from a local-only authorization. Before dispatch, the operator must:

1. configure the exact `fashion-staging` environment variables emitted by
   `bun run prepare:fashion-staging-u12 --output-dir=<local-path>`;
2. configure the protected-environment credentials `CLOUDFLARE_ACCOUNT_ID`,
   `CLOUDFLARE_API_TOKEN`, `FASHION_U12_ACCEPTANCE_TOKEN`,
   `FASHION_U12_ADMIN_SERVICE_TOKEN`, `FASHION_U12_GITHUB_ADMIN_TOKEN`,
   `FASHION_U13_SERVICE_TOKEN`, `PREVIEW_BUILD_TOKEN`, `STRIPE_SECRET_KEY`,
   `TURNSTILE_SECRET`, and configure the corresponding Fashion API and
   Preview Worker secrets without reusing ordinary staging or production credentials;
3. create or verify the enabled Stripe sandbox endpoint at
   `https://shoppp-api-fashion-staging.hashencode.workers.dev/webhooks/stripe` with
   `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`;
4. verify the exact `fashion-staging` GitHub environment, actor/run evidence, and fixed
   `fashion-staging-preview` concurrency group without relying on unavailable reviewer metadata; and
5. verify that current `main` descends from authority baseline
   `79fbee07f60245b036b5a4d42858227502947a5c`, every later commit subject ends in `(U12)`, and every
   changed path is in the workflow's explicit FS-U12 allowlist. A failing scope check requires a new
   authority decision before any mutation.

The preparation dispatch has no per-run confirmation string. It first proves the standing scope,
then proceeds only after Worker/GitHub credential-name checks and sandbox-provider checks. It exports
the exact Fashion D1, restores that export into a disposable local database, runs a foreign-key
check, and uploads `fashion-u12-d1-backup-<commit-sha>` before applying any migration. It then
applies only the collision-free, deterministic three-archetype seed, creates and validates a
Catalog-bound draft, approves an immutable Experience Snapshot, starts a build from that approved
snapshot, and records fresh Cloudflare, GitHub, Stripe, migration, schema, seed, and build evidence.
The workflow does not set or rotate a secret and fails if a prerequisite is absent.
Re-running preparation at the same authorized commit reuses the approved Snapshot lineage while a
run-specific build idempotency key creates a new build attempt; it never reopens or mutates a
terminal failed build.

Retain both the preparation run ID and the SHA-256 printed for `readiness.json`. Dispatch
`.github/workflows/preview-storefront.yml` with the exact `build_id`, `snapshot_id`,
`readiness_run_id`, and `readiness_digest`. Before its first R2 upload or Worker deployment, that
workflow downloads the preparation artifact by run ID, verifies its digest and age, reruns the
readiness verifier, and proves that commit, build, and snapshot identities match the dispatch. A
missing, stale, mismatched, or unprotected readiness record is a hard stop.

### Locked journey and cleanup protocol

Dispatch `.github/workflows/preview-storefront.yml` only after the prerequisites are green. The
workflow computes the canonical Catalog digest, records the content-addressed artifact digest and
commit, then acquires one database-enforced `fashion-staging` acceptance lock before U13 or browser
mutation. Acquisition records the exact inventory baseline and rejects active reservations,
backorders, insufficient sellable stock, another live run, or an expired run that has not been
explicitly reconciled.

Every created cart and checkout attempt is registered to the run. Cleanup can expire or release
only those registered mutable precursors (including reservation groups derived from a registered
checkout); paid orders remain append-only and their public references are retained in the report.
Inventory restoration uses an auditable manual-adjustment ledger entry and must reconcile the exact
on-hand, reserved, backordered, and oversell baseline. A journey assertion and a cleanup failure are
stored separately, and either fails acceptance.

The browser verifies the exact hosted Stripe Checkout product and total but does not enter a card or
interact with Stripe's region-limited agent-payment steering. The acceptance-token-protected
`settle` action is available only on the exact Fashion namespace, during a current active lease, for
a registered `staging`/test-mode Stripe checkout attempt. It creates and confirms an idempotent
Stripe sandbox PaymentIntent using Stripe's test PaymentMethod, expires the unpaid hosted Session,
and feeds the verified IDs, amount, and currency through the normal payment-reconciliation and
order-creation path. A live key, mismatched Session, unregistered attempt, expired lease, failed test
payment, or failed Session expiry is a hard stop. No browser card credential or `STRIPE_TEST_CARD`
secret is used.

After the main cleanup, the workflow acquires a second namespaced lock, opens a fresh browser,
proves that the representative product can still create and add to a new cart, registers that cart,
and cleans the postcondition run. The final verdict requires U13, the no-interception archetype and
sandbox-payment journey, both cleanups, and the fresh-session postcondition to pass.

If a runner terminates before cleanup, do not acquire a replacement lock or issue ad hoc deletion.
After its lease expires, pass that exact run ID as `recovery_run_id`; startup reconciliation claims
only the expired run, executes the same registered-resource cleanup, and records its result before a
new lock can be acquired. If reconciliation cannot restore the recorded baseline, stop and retain
the run row, resource ledger, before/after inventory, original journey failure, and cleanup failure
for operator disposition.

The operator flow is: select a deployed canonical Catalog Release; edit only manifest-declared
presentation fields; save with an optimistic version; validate; build a private preview; confirm the
visible Catalog/Experience/theme/platform identity; open it through a one-time POST grant; then
approve the exact immutable Experience Snapshot. Changing the Catalog Release invalidates prior
preview evidence and approval readiness but preserves unsaved draft edits.

Stop after evidence is recorded. Production activation, monitoring, rollback, and legacy-trigger
cleanup are intentionally outside this runbook.

## Fashion U8 cloud-only operator acceptance

Every U8 automation job runs on the fixed GitHub-hosted `ubuntu-24.04` image. The credential-free
authority job checks the exact base repository, `workflow_dispatch`, `main`, full candidate and
harness SHAs, reviewed harness digest, and authorized actor before any protected job starts. The
protected job then validates GitHub OIDC claims for the exact Fashion staging audience. A local
machine, VM, container runtime, account, or runner listener has no execution authority.

The original U12 readiness commit and digest are historical baseline evidence, not the post-CI U8
candidate. If that artifact has expired, rerun governed U12 preparation and its ordinary Preview/U12
lifecycle on current exact `main`; never reconstruct the bytes from a summary. Set the protected
`FASHION_U8_CANDIDATE_SHA`, `FASHION_U8_HARNESS_SHA`, and
`FASHION_U8_HARNESS_MANIFEST_DIGEST` values to the reviewed identities before U8 dispatch.

Dispatch `prepare-fashion-staging-u8.yml` with `operation=prepare`, the fresh U12 evidence, frozen
Catalog Release, and an existing Fashion Store source draft. Preparation verifies the U12 artifact,
creates a non-secret manifest, writes an immutable server-side `awaiting_operator` record, uploads
the manifest, and exits. It does not create an identity, session, password, or runner-held browser,
and it does not wait for a human.

The existing named staging operator signs in normally and opens the source draft. The Admin editor
shows the bound run ID, U12 baseline, Catalog Release, expiry, and allowed action. The operator
executes the ordinary product path: edit presentation fields, save, validate, create the private
preview, inspect conflict/recovery state when applicable, and approve the exact run-bound successor.
Application-owned automated coverage remains authoritative for keyboard behavior, focus,
accessible name/role/state, field-error association, truthful status semantics, non-color cues,
responsive layouts, and Axe checks. Do not attach a password, browser storage, screenshot, trace,
HAR, recording, or free-form human evidence to the workflow.

After approval, separately dispatch the same workflow with `operation=refresh`, the exact
preparation run/artifact, and operator run ID. The hosted job reads the server-side named-operator,
Snapshot, content digest, and audit evidence; mismatched, expired, rejected, or cross-run evidence
fails closed. It creates a fresh build and dispatches `preview-storefront.yml` on exact `main`.

After that Preview run deploys the attested build, separately dispatch
`accept-fashion-staging-u8.yml` with the refresh run/artifact and operator run ID. Acceptance reads
the same server-side evidence, verifies the deployed identities, runs the terminal p95 and cleanup,
and consumes the approval only on success. Retain the 30-day manifests, attestation, Snapshot/audit
references, terminal report, cleanup result, and append-only attempt ledger. A retry must use the
same governed evidence lineage; it must not create a new staging account or hide an earlier failure.
