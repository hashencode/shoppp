# Release runbook

## Planning vocabulary

Shoppp uses three separate delivery states. An implementation unit (`U`) completes scoped product
behavior. A development-candidate gate (`DC`) proves the selected capabilities together against one
immutable candidate. A production gate (`PG`) records named human and environment authorization for
that same candidate. A green U or DC must never be reported as production approval.

The normative boundaries are in
[`docs/architecture/delivery-units-and-candidate-gates.md`](../architecture/delivery-units-and-candidate-gates.md).
The current candidate identity and DC/PG verdicts live in
[`docs/progress/development-candidate-readiness.md`](../progress/development-candidate-readiness.md).
Active feature plans own implementation status and the next concrete action. Existing progress
documents remain retained evidence sources; the candidate ledger links plans and evidence rather
than duplicating their unit queues.

Shoppp is one product with a shared theme platform. Its current product template names are
`fashion-store` and `decor-store`; the older `fashion` implementation is retired, while
`decor-store` currently uses the legacy internal code ID `decor`. Template-focused plans, branches,
worktrees, and deployment profiles do not create separate products. A candidate records its
product-approved Candidate Template Matrix, one Activation Target, and any non-blocking
Compatibility Observation Set separately.

DC and PG are mandatory only for a build intended for production promotion. They do not gate an
ordinary feature U, a local preview, or a development-only build. Every production promotion must
use one immutable candidate that passed all applicable DC gates and then received every required PG
approval; DC does not create product scope and PG does not replace engineering verification.

## Release contract

### Pre-DC entry conditions

Do not start formal candidate validation while required product behavior or its validation
machinery is still being implemented. Before DC1:

- the intended Product Contract scope, required capabilities, and approved deferrals are explicit;
- every required U is `Complete` in its owning active plan;
- the Candidate Template Matrix, single Activation Target, and any Compatibility Observation Set
  are known; and
- the release validator can reject tracked and untracked non-ignored changes and bind the complete
  candidate identity into its report.

The current Fashion Store U13 result is a narrow topology proof. It does not replace U12 complete
deployed-Commerce implementation or U8 test-environment acceptance. Until those units and the
candidate-identity validator changes are complete, the command below is a local integration check,
not formal DC1 evidence.

After the entry conditions pass, every candidate starts from a clean commit and runs:

```sh
bun run release:validate -- --release-id <release-id>
```

### GitHub-first release authority

The [GitHub-first availability and recovery](github-first-release-availability.md) runbook is the
operational authority for provider-state classification, the complete dependency inventory,
formal-release pause rules, missing/expired artifact refusal, and the fresh exact-SHA recovery
audit. This release runbook owns the normal protected validation and deployment procedure; it must
not be used to bypass a degraded-state stop.

The maintained replacement path dispatches `Deploy immutable commerce release` from the protected
default-branch workflow with an exact full `source_sha`, optional governed `source_ref`, and immutable
`release_id`. A credential-free job first verifies the workflow ref, authorized actor, and input
syntax. The reusable hosted validator then independently proves that the exact source is reachable
from the protected default branch or equals the repository-configured frozen-candidate ref before
the `staging` environment exposes its Catalog read credential.

Full validation runs the unchanged 17-gate `release:validate` contract on GitHub-hosted Linux x64.
The weekly schedule has no dispatch inputs, so the repository Actions variable
`SCHEDULED_CATALOG_RELEASE_ID` must name an existing approved immutable Catalog release. If the
variable is absent or unsafe, credential-free preflight fails before the `staging` environment is
entered; scheduled validation never falls back to fixtures or structural mode.
The resulting validation attestation binds commit/tree, GitHub run and attempt, hosted toolchain,
unchanged release-report digest, and every deployable-artifact digest. Only the artifact uniquely
named for that source and the same caller run and attempt is downloaded. Staging and production
recompute the report, attestation, deployable-map, and individual artifact digests before the first
Cloudflare or D1 operation. Missing, expired, altered, cross-run, rebuilt, or branch-tip-substituted
input stops deployment. GitHub Actions, billing, protected-environment, or artifact failure pauses
formal release; local and historical Intel output cannot substitute for this proof.

The retained CI-GH-U4 run supplies the required pre-removal hosted validation, staging deployment,
post-deployment checks, and rollback/reconciliation proof. Repository definitions still require a
fresh exact-source run; they never substitute for operational evidence or authorize production.

Credential ownership is role-based and environment-specific:

- the **staging read credential owner** maintains and rotates only the staging
  `BUILD_MANIFEST_TOKEN` used by strict validation and authenticated status callbacks;
- the **staging deployment credential owner** maintains a least-privileged Cloudflare credential
  scoped to staging Workers and `shoppp-staging` D1; and
- the **production deployment credential owner** separately maintains a least-privileged Cloudflare
  credential scoped to production Workers and `shoppp-production` D1.

The three values must be distinct, environment-owned, absent from repository content and artifacts,
and rotated after operator turnover, suspected disclosure, provider policy change, or scope change.
Record only the rotation date, owner role, and affected environment outside workflow logs. **Emergency
revocation:** disable the affected GitHub environment secret and revoke the provider credential
before rerunning any job; preserve the failed run identity, rotate the credential, re-check scope,
and start a new exact-SHA caller run rather than resuming a credential-exposed attempt.

### Retained GitHub release evidence

The authoritative full-validation and deployment path is the protected GitHub workflow. It retains
the exact source commit and tree, all 17 gate results, the release report, validation attestation,
deployable artifact digests, hosted toolchain identity, staging proof, deployment receipt, and
rollback evidence under the workflow retention policy. These GitHub artifacts are the only
maintained release-evidence transport; local reports remain developer diagnostics and cannot
substitute for the hosted run.

Candidate selection, DC, PG, production approval, backup verification, deployment receipts, and
rollback authority remain governed by their existing plans and protected environments. No portable
capsule, Intel runner, independent signing ceremony, or provider-neutral restore command is part of
the active release path. Historical evidence remains historical and is not an executable
instruction.

## One-time environment setup

An infrastructure owner must:

1. Replace the test and production placeholder domains and Cloudflare resource IDs in the three
   Wrangler configurations. Keep exactly two shared remote D1 databases: `shoppp-staging` for local
   development, remote-dependent tests, and the test deployment; `shoppp-production` only for
   production. Do not create or bind a shared remote development database.
2. Configure the GitHub `staging`, `staging-human-access`, and `production` environments. Test and
   production each receive their own Cloudflare API credential. When the repository plan supports
   environment protection, `staging-human-access` should require a named reviewer who is
   accountable for running the real-human password-login proof. On plans that do not support
   required reviewers for private repositories, the workflow records the named workflow-dispatch
   actor and external evidence ID instead. Production promotion remains off by default and
   additionally requires an exact confirmation phrase and a recent approved backup ID.
3. Add test URLs, representative product/order identifiers, authorized and prohibited application
   service credentials, a CI-only Stripe test card, and the staging API's `BUILD_MANIFEST_TOKEN` as
   environment-owned values. The same manifest token must be configured as a secret on the staging
   API Worker and in the GitHub `staging` environment.
4. Put Worker secrets in Cloudflare with `wrangler secret put --env <environment>`. Confirm the
   Stripe webhook points to that environment's `/webhooks/stripe` endpoint. Replace each API
   environment's `TURNSTILE_SITE_KEY` placeholder with the public key paired to that environment's
   secret; staging and production keys must be distinct. Automated staging journeys may use
   Cloudflare's official testing pair with `TURNSTILE_TEST_MODE=true`; the isolation verifier
   rejects that mode in production.
5. Configure distinct test and production `AUTH_TOKEN_SECRET` values and service Bearer tokens.
   Store only service-token references in configuration; values belong in environment-owned
   secrets. Follow `admin-access.md` for bootstrap, rotation, recovery, and evidence.
6. Seed the representative catalog (at least 1,000 products and 5,000 variants), one last-unit
   purchase fixture, roles, launch settings, shipping zones, and policy text.
7. Before the first storefront release only, apply test migrations and bootstrap the test API
   Worker from a locally validated commit so the immutable catalog-manifest endpoint is available.
   Later releases use the existing last-known-good API endpoint.
8. Configure alerts for Worker errors, login throttling spikes, IAM denials, failed catalog
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

For a staging-only proof, leave `promote_production` false and omit
`human_access_evidence_id`. For production promotion, allocate an external evidence ID for the
human password-login proof and pass it as `human_access_evidence_id`. The record may be created
before dispatch, but it is not complete until the reviewer appends the results described in
`admin-access.md`. The workflow:

1. runs credential-free trusted-source preflight, calls the reusable hosted validator, and downloads
   only its same-run exact-source report, attestation, migrations, and prebundled Workers; it
   re-verifies every bound digest without rebuilding deployment output;
2. exports the test D1 into a short-retention workflow artifact, lists pending migrations, uploads
   the already validated tagged Cloudflare Versions without sending them traffic, and verifies at
   least one enabled protected human against either the legacy or dynamic IAM schema;
3. applies migrations against the explicit `shoppp-staging --env staging` target, requires zero
   foreign-key violations and the protected human again, then deploys the saved versions;
4. runs the service-principal credential proof and the root test browser suite against the public
   storefront, password-authenticated admin/API, Stripe test mode, queues, and representative catalog;
5. reports the catalog release as `deployed` through the authenticated, idempotent build callback
   only after the staging journeys, latency gate, and saved rollback-artifact availability check;
6. when production promotion is explicitly requested, enters the `staging-human-access`
   environment. A real named test account must complete password login without exporting
   credentials, cookies, or browser storage. The job records an environment reviewer when GitHub
   supplies one; otherwise it records the named workflow-dispatch actor. The evidence source and
   external evidence ID are preserved in a separate artifact;
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

The IAM schema migration remains additive, but API versions from before password authentication
cannot consume the current password sessions or service credentials. The staging gate therefore
does not briefly activate an authentication-incomplete version and mistake public health for a
valid rollback. It verifies that all saved versions still exist and retains the pre-migration D1
export. During this cutover, use a forward compatibility fix by default. Activate an older API only
when it independently proves a protected `/api/admin/session`, or after restoring the matching
verified D1 backup under the destructive-restore approval process.

The storefront obtains its environment-specific Turnstile public key at runtime from the same-origin
`/api/platform/config` endpoint. This keeps the static storefront byte-identical across staging and
production while preserving separate Turnstile key/secret pairs. Missing or inconsistent challenge
configuration fails closed and disables checkout.

Record the workflow URL, release report, Cloudflare version IDs, staging journey report, approver,
Stripe reconciliation, administrator authentication result, alert-delivery test, backup ID, and production smoke result in
the release ticket. A failure before production leaves the existing production deployments
untouched.

## Required manual evidence

The release owner records:

- automated keyboard, focus, accessible name/role/state, field-error association, status semantics,
  non-color cues, responsive behavior, and Axe results for shopper and operator paths;
- responsive checks on representative current iOS Safari and Android Chrome devices;
- Stripe test dashboard confirmation that one successful Checkout Session produced one order and
  that refund totals reconcile;
- password login/reset/change behavior, the real-human evidence ID and reviewer, service
  principal `machine` audit evidence, alert delivery, queue replay, D1 restore, and rollback;
- mobile Lighthouse scores and storefront JavaScript budget from the immutable candidate.

Production commerce stays disabled while any production launch gate in the implementation plan has
no named owner or evidence.
