# Release runbook

## Release contract

Every candidate starts from a clean commit and runs:

```sh
bun run release:validate -- --release-id <release-id>
```

The command performs the locked install, formatting, lint, type, unit, Worker, admin-browser,
representative-catalog, production-build, static-output, end-to-end, accessibility, and performance
gates. It also checks
staging/production isolation and writes `artifacts/releases/<release-id>.json` with the commit,
individual gate outcomes, and SHA-256 digests for all three deployable outputs and D1 migrations.
The build gate prebundles all three Worker entrypoints. Deployment uses those saved bundles with
Wrangler `--no-bundle`; deploy jobs never rebuild Worker code.

Never put Cloudflare, Stripe, email-provider, Turnstile, or Access credentials in source, workflow
defaults, build arguments, or the report. Repository configuration contains non-routable
placeholders until an owner supplies the real resource IDs and domains. The deployment workflow
uses strict environment validation, so placeholders and any staging/production crossover stop the
release before upload.

## One-time environment setup

An infrastructure owner must:

1. Replace the test and production placeholder domains and Cloudflare resource IDs in the three
   Wrangler configurations. Keep exactly two shared remote D1 databases: `shoppp-staging` for local
   development, remote-dependent tests, and the test deployment; `shoppp-production` only for
   production. Do not create or bind a shared remote development database.
2. Configure the GitHub `staging`, `staging-human-access`, and `production` environments. Test and
   production each receive their own Cloudflare API credential. `staging-human-access` must require
   a named reviewer who is accountable for running the real-human IdP/MFA proof before approval.
   Production promotion remains off by default and additionally requires an exact confirmation
   phrase and a recent approved backup ID.
3. Add test URLs, representative product/order identifiers, authorized and prohibited Access
   service identities, a CI-only Stripe test card, and the staging API's `BUILD_MANIFEST_TOKEN` as
   environment-owned values. The same manifest token must be configured as a secret on the staging
   API Worker and in the GitHub `staging` environment.
4. Put Worker secrets in Cloudflare with `wrangler secret put --env <environment>`. Confirm the
   Stripe webhook points to that environment's `/webhooks/stripe` endpoint. Replace each API
   environment's `TURNSTILE_SITE_KEY` placeholder with the public key paired to that environment's
   secret; staging and production keys must be distinct. Automated staging journeys may use
   Cloudflare's official testing pair with `TURNSTILE_TEST_MODE=true`; the isolation verifier
   rejects that mode in production.
5. Configure distinct deny-by-default test and production Access applications, approved IdP
   assignment groups, enforced MFA posture, and whole-hostname policies. Store only service token
   references in configuration; token values belong in environment-owned GitHub secrets. Follow
   `admin-access.md` for bootstrap, service mapping, revocation, and evidence.
6. Seed the representative catalog (at least 1,000 products and 5,000 variants), one last-unit
   purchase fixture, roles, launch settings, shipping zones, and policy text.
7. Before the first storefront release only, apply test migrations and bootstrap the test API
   Worker from a locally validated commit so the immutable catalog-manifest endpoint is available.
   Later releases use the existing last-known-good API endpoint.
8. Configure alerts for Worker errors, Access denial spikes, mapped IAM denials, failed catalog
   builds, queue exhaustion, webhook verification failures, backup failures, and the performance
   signals in the operations runbook.

Before applying migration `0011_shipping_country_zone_guard.sql`, run this read-only query in the
target environment:

```sql
SELECT szc.country_code, COUNT(*) AS active_zone_count
FROM shipping_zone_countries szc
JOIN shipping_zones sz ON sz.id = szc.zone_id
WHERE sz.status = 'active'
GROUP BY szc.country_code
HAVING COUNT(*) > 1;
```

The expected result is zero rows. Any result is a deployment stop: retain the backup, reconcile the
duplicate active assignments under an approved operations change, rerun the query, and only then
apply the migration. After deployment, repeat the query and verify
`shipping_country_active_insert_guard`, `shipping_country_active_update_guard`, and
`shipping_zone_activation_guard` exist in `sqlite_schema`. The triggers are safe to retain if
application code is rolled back because they enforce the pre-existing single-active-zone
invariant.

## Staging and promotion

Dispatch `Deploy immutable commerce release` with the approved immutable catalog release ID. The
strict staging build fetches that exact manifest from the staging API; absence, an ID mismatch, a
cross-origin source, or a short/missing token stops the release before any upload.

Allocate an external evidence ID for the human Access proof and pass it as
`human_access_evidence_id`. The record may be created before dispatch, but it is not complete until
the reviewer appends the results described in `admin-access.md`. The workflow:

1. fetches the approved catalog manifest, builds and hashes one clean candidate including each
   prebundled Worker;
2. exports the test D1 into a short-retention workflow artifact, lists pending migrations, uploads
   the already validated tagged Cloudflare Versions without sending them traffic, and verifies at
   least one enabled protected human against either the legacy or dynamic IAM schema;
3. applies migrations against the explicit `shoppp-staging --env staging` target, requires zero
   foreign-key violations and the protected human again, then deploys the saved versions;
4. runs the service-principal access proof and the root test browser suite against public
   storefront, Access-protected admin/API, Stripe test mode, queues, and the representative catalog;
5. reports the catalog release as `deployed` through the authenticated, idempotent build callback
   only after the staging journeys, latency gate, rollback, and validated-version restore pass;
6. pauses at the reviewer-protected `staging-human-access` environment. A real test IdP account must
   complete the MFA path without exporting credentials, cookies, or browser storage state. The job
   records the reviewer and external evidence ID as a separate artifact;
7. reports candidate validation, staging deployment, or staging proof failure as `failed`, which
   preserves the previous live storefront and raises the catalog health signal;
8. ends after test proof by default; production cannot run unless a named human dispatches the
   workflow with `promote_production=true`, types `PROMOTE <release-id>`, and supplies a recent
   approved production backup ID;
9. after those approval inputs pass, queries the explicit `shoppp-production --env production`
   target and requires the named backup to be `ready`, production-owned, and completed within the
   prior 24 hours before applying migrations;
10. uploads the production-bound saved versions without sending them traffic, lists migrations, and
    requires at least two enabled protected humans against either the legacy or dynamic IAM schema
    before changing D1; it then applies production migrations, requires zero foreign-key violations
    and the same two-administrator invariant, and deploys the same release tag. The production job runs
    `release:validate -- --promotion`; this hashes the downloaded outputs and requires an exact match
    with staging evidence. It does not rebuild environment-sensitive or nondeterministic output.

The IAM migration is expand-contract for the rollback window: trigger-maintained legacy identity
columns keep the immediately preceding API version readable while the new API uses typed principals
and `role_id`. The staging rollback rehearsal must call the protected `/api/admin/session` endpoint,
not only `/health`, before restoring the validated release tag.

The storefront obtains its environment-specific Turnstile public key at runtime from the same-origin
`/api/platform/config` endpoint. This keeps the static storefront byte-identical across staging and
production while preserving separate Turnstile key/secret pairs. Missing or inconsistent challenge
configuration fails closed and disables checkout.

Record the workflow URL, release report, Cloudflare version IDs, staging journey report, approver,
Stripe reconciliation, Access result, alert-delivery test, backup ID, and production smoke result in
the release ticket. A failure before production leaves the existing production deployments
untouched.

## Required manual evidence

The release owner records:

- VoiceOver and NVDA announcements and focus behavior for product, cart, checkout errors, order
  confirmation, admin fulfillment, and refund;
- responsive checks on representative current iOS Safari and Android Chrome devices;
- Stripe test dashboard confirmation that one successful Checkout Session produced one order and
  that refund totals reconcile;
- Cloudflare Access allow/deny behavior, the real-human IdP/MFA evidence ID and reviewer, service
  principal `machine` audit evidence, alert delivery, queue replay, D1 restore, and rollback;
- mobile Lighthouse scores and storefront JavaScript budget from the immutable candidate.

Production commerce stays disabled while any production launch gate in the implementation plan has
no named owner or evidence.
