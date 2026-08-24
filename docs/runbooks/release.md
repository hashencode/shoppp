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

### Provider-neutral full-validation capsule

Native macOS output is useful developer feedback but is not candidate authority. The provider-neutral
path builds the exact clean committed source into a `linux/amd64` capsule and invokes the unchanged
17-gate `release:validate` contract without GitHub Actions, its API, or its artifact store:

```sh
bun run release:validate:capsule -- --probe
SHOPPP_RELEASE_OPERATOR_CONTEXT=approved \
  bun run release:validate:capsule -- \
  --release-id <release-id> \
  --output-directory <absolute-empty-evidence-directory>
```

The `approved` marker records that the command is running in the dedicated release-operator context;
it does not grant product, candidate, DC, PG, deployment, or production authority. Do not set it in
ordinary developer or persistent-runner profiles. The entry point rejects any populated `GITHUB_*`
identity or ambient token, secret, password, private-key, or credential variable. Structural full
validation needs no Catalog or deployment credential. A later strict candidate run may receive only
the separately authorized read-only, candidate-scoped Catalog input defined by the candidate policy;
that credential path is not enabled by this command yet.

The build context is produced by `git archive` from `HEAD`, includes a generated commit/tree identity,
and rejects tracked and untracked checkout changes before Docker starts; ignored-material candidate
identity remains governed by the later REL/CI-U7 source-input policy. The
Dockerfile binds that identity into the image and fails if the archive identity and build arguments
differ. It uses the amd64 platform manifests for Bun 1.3.5
(`sha256:7985c11f2d6f8b3cd67cfe6e4da08151102a63db596b79bcaed5e9a50965276e`) and Playwright
1.62.0 (`sha256:02bbb2155cd7109e3e9c741941097ed1608cf8b6fa44ee2595896da2bdc1f471`). The declared
gate/tool dependencies live in `containers/release-validation/manifest.json`.

The host Docker socket is used only to build and start the ephemeral capsule and is never mounted
inside it. The image build uses network access to populate only the lockfile-governed Bun package
cache; it proves that no `node_modules` tree enters the runtime image. The unchanged
reproducible-install gate therefore rebuilds a clean install tree from that cache while the 17-gate
runtime uses `--network none`. Direct Ubuntu packages are exact-version pinned, and the image build
fails unless the declared Bun, Playwright, platform, package, command, and browser inventory matches.
The container drops Linux capabilities, enables `no-new-privileges`, has
bounded process and shared-memory settings, and receives only `CI`, `RELEASE_ID`, and one evidence
bind mount. The report is finalized with no overwrite. Missing
Docker/OrbStack service, amd64 emulation, registry/bootstrap network, image, tool, browser, font,
workspace cleanliness, or evidence finalization is an infrastructure failure and never a pass.

Before capsule output becomes formal candidate evidence, compare a same-source capsule run with the
hosted Ubuntu adapter: exact commit/tree, the 17 selected gate names and commands, Bun/Playwright
versions, final status, report schema, and every required artifact digest must match. Timestamps,
durations, execution IDs, and attempt lineage may differ but must be explicitly classified rather
than removed silently. Any unexplained gate, toolchain, report, or artifact drift invalidates the
capsule result. Updating either base digest, Bun, Playwright, system packages, lockfiles, or the gate
manifest requires a clean rebuild, negative preflight checks, and a new same-source parity record.
The release report is accompanied by `<release-id>.capsule.json`, which retains source commit/tree,
immutable image ID, capsule-manifest digest, actual tool/package/browser inventory, report digest,
exit code, and failure class. The builder reuses the single local tag
`shoppp-release-capsule:local-cache` for layer caching, then runs by the inspected immutable image ID.
After finalizing a passing new receipt it attempts to remove only the exact previous capsule image ID;
failed or infrastructure-classified runs retain that previous replay image.
Docker safely refuses if another tag or container still references it. Never use broad image or
system pruning as capsule cleanup.

This command contributes DC1 local evidence. It does not by itself satisfy the deployed-commerce,
template-compatibility, activation-target, recovery, or production-authorization gates. Before
running it for a formal
candidate, record the exact commit, Product Contract revisions, required capability set, approved
deferrals, Catalog Release, Candidate Template Matrix and versions, Activation Target, immutable
Experience Snapshot identity and digest, platform contract, and staging environment in the
candidate ledger. A later code, configuration, policy, fixture, migration, deployable-output, or
normative acceptance-document change creates a new candidate or invalidates the affected DC
evidence. An editorial-only amendment may retain the candidate only when it changes no requirement,
security boundary, acceptance criterion, evidence meaning, owner, or invalidation rule, and the
ledger records unchanged inputs and output digests.

The command performs the locked install, formatting, lint, type, theme-contract, unit, Worker,
admin-browser, representative-catalog, configured template-matrix, production-build, static-output,
end-to-end, accessibility, and performance gates. Formal DC1 use additionally requires that the
configured blocking matrix equals the frozen Candidate Template Matrix. Non-target cross-template
regression runs occur in DC3 and are recorded as non-blocking observations. The command also checks
staging/production isolation and writes `artifacts/releases/<release-id>.json` with the commit,
individual gate outcomes, and SHA-256 digests for all three production deployable outputs and D1
migrations. Preview artifacts and credentials are rejected from the production report. Until the
Pre-DC validator work records the remaining identity fields, this report is supporting integration
evidence rather than a complete candidate identity record.
The build gate prebundles all three Worker entrypoints. Deployment uses those saved bundles with
Wrangler `--no-bundle`; deploy jobs never rebuild Worker code.

Never put Cloudflare, Stripe, email-provider, Turnstile, administrator passwords, sessions, or service credentials in source, workflow
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

1. fetches the approved catalog manifest, builds and hashes one clean candidate including each
   prebundled Worker;
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

- VoiceOver and NVDA announcements and focus behavior for product, cart, checkout errors, order
  confirmation, admin fulfillment, and refund;
- responsive checks on representative current iOS Safari and Android Chrome devices;
- Stripe test dashboard confirmation that one successful Checkout Session produced one order and
  that refund totals reconcile;
- password login/reset/change behavior, the real-human evidence ID and reviewer, service
  principal `machine` audit evidence, alert delivery, queue replay, D1 restore, and rollback;
- mobile Lighthouse scores and storefront JavaScript budget from the immutable candidate.

Production commerce stays disabled while any production launch gate in the implementation plan has
no named owner or evidence.
