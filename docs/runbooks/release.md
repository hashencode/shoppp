# Release runbook

## Release contract

Every candidate starts from a clean commit and runs:

```sh
bun run release:validate -- --release-id <release-id>
```

The command performs the locked install, formatting, lint, type, unit, Worker, admin-browser,
production-build, static-output, end-to-end, accessibility, and performance gates. It also checks
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

1. Replace the staging and production placeholder domains and Cloudflare resource IDs in the three
   Wrangler configurations with isolated resources.
2. Configure each GitHub `staging` and `production` environment with its own Cloudflare API
   credential. Configure `production` with required reviewers and prevent administrators from
   bypassing protection.
3. Add staging URLs, representative product/order identifiers, authorized and prohibited Access
   service identities, a CI-only Stripe test card, and the staging API's `BUILD_MANIFEST_TOKEN` as
   environment-owned values. The same manifest token must be configured as a secret on the staging
   API Worker and in the GitHub `staging` environment.
4. Put Worker secrets in Cloudflare with `wrangler secret put --env <environment>`. Confirm the
   Stripe webhook points to that environment's `/webhooks/stripe` endpoint. Replace each API
   environment's `TURNSTILE_SITE_KEY` placeholder with the public key paired to that environment's
   secret; staging and production keys must be distinct.
5. Seed the representative catalog (at least 1,000 products and 5,000 variants), one last-unit
   purchase fixture, roles, launch settings, shipping zones, and policy text.
6. Before the first storefront release only, apply staging migrations and bootstrap the staging API
   Worker from a locally validated commit so the immutable catalog-manifest endpoint is available.
   Later releases use the existing last-known-good API endpoint.
7. Configure alerts for Worker errors, failed catalog builds, queue exhaustion, webhook
   verification failures, backup failures, and the performance signals in the operations runbook.

## Staging and promotion

Dispatch `Deploy immutable commerce release` with the approved immutable catalog release ID. The
strict staging build fetches that exact manifest from the staging API; absence, an ID mismatch, a
cross-origin source, or a short/missing token stops the release before any upload. The workflow:

1. fetches the approved catalog manifest, builds and hashes one clean candidate including each
   prebundled Worker;
2. applies staging migrations, uploads tagged Cloudflare Versions, and deploys those saved versions;
3. runs the root staging browser suite against public storefront, Access-protected admin/API,
   Stripe test mode, queues, and the representative catalog;
4. pauses at the protected `production` environment;
5. after a named human approval and a confirmed recent production backup, uploads production-bound
   versions from the same commit and deploys the same release tag. The production job runs
   `release:validate -- --promotion`; this hashes the downloaded outputs and requires an exact match
   with staging evidence. It does not rebuild environment-sensitive or nondeterministic output.

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
- Cloudflare Access allow/deny behavior, alert delivery, queue replay, D1 restore, and rollback;
- mobile Lighthouse scores and storefront JavaScript budget from the immutable candidate.

Production commerce stays disabled while any production launch gate in the implementation plan has
no named owner or evidence.
