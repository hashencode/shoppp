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

## Fashion U8 bounded runner and human acceptance

U8 uses one temporary runner named `shoppp-fashion-u8-<run-id>` with the labels
`self-hosted`, `fashion-staging-preview`, and `fashion-staging-u8`. The runner and the headed Admin
browser must never share a macOS account. Before creating either credential, generate the canonical
harness manifest from the reviewed checkout, hash that exact JSON file, and run the standing-
authority verifier. Do not start the listener if the checkout, manifest, contract-test digest,
candidate-to-harness diff, or exact harness SHA differs from the reviewed record.
The original U12 readiness commit and digest remain historical baseline evidence; they do not become
the post-CI U8 candidate. The U8 preparation and refresh workflows verify that exact readiness
commit and artifact, prove that commit is an ancestor of the frozen exact-main U8 candidate, and
carry both identities independently through the refresh attestation.
Set the protected `fashion-staging` environment variables `FASHION_U8_CANDIDATE_SHA`,
`FASHION_U8_HARNESS_SHA`, and `FASHION_U8_HARNESS_MANIFEST_DIGEST` to that reviewed authority.
Every U8 workflow must match those values and its own `GITHUB_SHA` before executing harness code.

Create a dedicated standard, non-admin macOS account with a run-scoped name. Give its home and
runner directory no ACL granting access to the operator account, and verify from that account that
the operator home, `Library/Keychains`, browser profiles, shell configuration, and unrelated Shoppp
checkout are unreadable. Record only pass/fail and the exact account/runner names; never record
directory contents. The operator browser remains in the original account. Stop if any denial check
fails.

Download the Actions runner only into the dedicated account's empty run-scoped directory and verify
its published checksum. Configure it interactively for the exact repository, runner name, and three
labels. Paste the short-lived registration token only into a verified non-echo prompt: never put it
in argv, an environment variable, shell history, a file, clipboard history, terminal capture, or
evidence. If the installed runner version cannot accept the token without echo or argv exposure,
stop; do not weaken this boundary. Keep the listener stopped until the reviewed preparation dispatch
is queued. The preparation workflow dispatches Preview and exits so the single runner is released;
wait for that exact Preview run to finish before dispatching acceptance.

The human lane uses `ADMIN_DEVELOPMENT_PROFILE=fashion-staging` and the local same-origin Admin
gateway. Run operator reconciliation first, then apply the generated migration SQL only after its
confirmation gate. Enter the generated bootstrap password through the provisioning tool's no-echo
stdin prompt, and type it directly into the headed browser. The password and browser session must
not enter Playwright configuration, storage state, environment variables, screenshots, traces,
HARs, recordings, or retained artifacts. The structured VoiceOver record contains only the run,
harness, build, operator, expected/observed checkpoint summaries, timestamps, non-secret audit
references, and explicit pass/fail results.
Set `FASHION_U8_HUMAN_EVIDENCE_FILE` to a new run-scoped path before starting Playwright. The live
config fails closed unless `FASHION_U8_INTERACTIVE_ACCEPTANCE=1`, and the test writes the redacted
human evidence exactly once. Base64-encode the exact run-manifest and human-evidence bytes for the
preparation dispatch; the workflow decodes and hashes both, joins their candidate, harness, Catalog,
source draft, successor, content, and audit identities, and retains the joined bytes with the refresh
attestation. Do not copy or reserialize either JSON file before encoding it.

When retrying preparation or machine acceptance after a failed attempt, pass the prior run ID and a
non-empty corrective reason. The workflow restores the newest matching ledger artifact and refuses
to start unless its last event failed. Do not start a fresh ledger to hide an earlier attempt.

On success, failure, timeout, or interruption, run the operator cleanup SQL to revoke all sessions
and disable the run identity, then run reconciliation and fail closure if any U8-namespaced identity
is still enabled. Stop the runner listener, terminate only its verified child processes, remove its
repository registration interactively, and confirm the repository inventory contains no exact U8
runner name or `fashion-staging-u8` label. Retain the tracked/untracked/material-ignored manifests
for the exact runner directory, then move that directory to Trash. Remove the dedicated macOS
account only after proving it owns no other files or processes. These cleanup actions do not delete
branches, commits, artifacts, snapshots, audits, or plans.
