# Cross-Border DTC Commerce Implementation Progress

This file is the execution ledger for
`docs/plans/2026-07-30-001-feat-cross-border-dtc-commerce-platform-plan.md`.
The plan remains the read-only authority.

## Current state

- Active unit: U13 — Provision staging and prove release readiness end to end
- Branch: `codex/feat-cross-border-dtc`
- Goal mode: active
- Last updated: 2026-07-30

## Unit ledger

| Unit | Status          | Verification evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1   | Complete        | Red: checker module missing. Green: frozen install, format, lint, typecheck, 3 boundary tests, build discovery, and aggregate release command.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| U2   | Complete        | Imported 200 allowlisted blobs from `fdd1935…`; repeatability/exclusion 2/2, upstream 233/233, browser 8/8, typecheck and build passed; source status hash unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| U3   | Complete        | Invariant red baselines observed. Domain/contracts 21/21, fixture 1/1, workerd+D1 6/6; Wrangler applied 46 statements, reapply no-op, FK and Drizzle checks passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| U4   | Complete        | Proof-first API moved from missing entrypoint to workerd 8/8; JWT, identity, RBAC audit, errors, request IDs, redaction, idempotency, AE6/AE8 and build passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| U5   | Complete        | Worker 15/15, D1 6/6, admin 237/237, real-browser 8/8, Playwright publication 2/2, lint/typecheck/build/format pass; catalog, R2, preview, release/build correlation and reason audit verified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| U6   | Complete        | Full release manifest is build-token protected; Worker 16/16, storefront 4/4, static 9 routes, browser 3/3, WCAG/keyboard 4/4; Lighthouse home/collection/product ≥94 performance, ≥98 accessibility, ≥96 best practices, 100 SEO; JS 146,323/204,800 bytes.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| U7   | Complete        | Guest-token cart, live API truth, stale-price acknowledgement, limits, address validation, zero-tax port, and flat/weight/free/unavailable shipping pass Worker 21/21, domain 21/21, storefront 6/6, desktop/mobile browser, static 9+2, and performance gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| U8   | Complete        | Atomic multi-line D1 groups, lifecycle triggers/events, five-minute expiry schedule, oversell policy, and append-only reasoned adjustments pass 50-way concurrency, boundary expiry, replay, permission, ledger reconciliation, Worker 28/28, admin 239/239, browser 8/8, typecheck, build, lint, format, and table-width gates.                                                                                                                                                                                                                                                                                                                                                                               |
| U9   | Complete        | Card-only Stripe Hosted Checkout behind a provider port, 30-minute reservation/session parity, raw HMAC verification, provider-truth reconciliation, replay-safe immutable paid orders, failure/expiry release, sanitized audit records, and expiring opaque guest access pass Worker 38/38, all unit/type/build/static gates, browser 9/9, WCAG 4/4, and Lighthouse/JS budgets.                                                                                                                                                                                                                                                                                                                               |
| U10  | Complete        | Searchable immutable order facts, independent payment/order/fulfillment timelines, monotonic fulfillment with tracked shipment, provider-reconciled partial/full refunds, cancellation stock return, reasoned confirmations, idempotency, and AE5/AE6 permissions pass Worker 46/46, D1 6/6, admin 241/241, browser 5/5 + storefront 9/9, type/build/lint/format/table-width gates.                                                                                                                                                                                                                                                                                                                            |
| U11  | Complete        | D1 transactional outbox, privacy-minimal Cloudflare Queue payloads, stable Workflow identities, five customer templates, replaceable idempotent email adapter, asynchronous payment-provider reconciliation, append-only bounded attempts, retry/DLQ handling, masked operator visibility, and audited same-identity replay pass Worker 64/64, D1 6/6, admin 243/243, browser 6/6 + storefront 9/9, type/build/lint/format/table-width gates.                                                                                                                                                                                                                                                                  |
| U14  | Complete        | Immutable environment/test-mode reporting facts, integer minor-unit gross/refund/net/count/AOV definitions, explicit currency and IANA/DST windows, prior-window labels, reconcilable order drill-down, stable search/pagination, permission/ownership/expiry/audit controls, and bounded asynchronous fixed-length CSV streaming to isolated R2 pass Worker 71/71, D1 6/6, admin 246/246, browser 7/7, type/build/lint/format/table-width gates.                                                                                                                                                                                                                                                              |
| U12  | Complete        | Credential-scoped checkout rate limiting, exact-origin/body guards, action/hostname-bound Turnstile, centralized recursive redaction, structured request/Analytics Engine telemetry, no-store admin responses, server-verified launch gates, runtime commercial settings, stable audit browsing, six complete configurable policy disclosures, hashed-subject privacy operations with seven-day R2 exports and immutable retention decisions, and a scheduled D1-to-R2 Workflow with isolated seeded restore reconciliation pass Worker 83/83, D1 6/6, admin 246/246 + browser 8/8, storefront 8/8, Playwright 16/25 applicable, WCAG 4/4, Lighthouse/bundle, type/build/lint/format/static/table-width gates. |
| U13  | Staging partial | All three staging Workers, Cloudflare data resources, Access allow/deny identities, CI deployment credentials, immutable catalog fixture, remote D1 migrations, public routes, rotating Access JWKS verification, Stripe test-mode secrets/webhook, Cloudflare Email Service binding, and a successful D1/R2 backup plus isolated restore drill are provisioned. The full local gate passes (tools 27/27, Worker 98/98, admin 249/249, storefront 18/18, contracts 7/7, domain 24/24, seed 1/1, plus lint/typecheck/build). Provider-backed purchase/refund/retry, email receipt, alert delivery, rollback rehearsal, and manual accessibility/device evidence remain pending.                                 |

## Staging provisioning evidence

- The feature branch is pushed to `hashencode/shoppp`; the `staging` and `production` GitHub
  environments exist. Required reviewers are intentionally not enabled in the current phase.
  Production is staging-only by default and requires a second explicit dispatch, exact
  `PROMOTE <release-id>` confirmation, and an approved recent backup ID.
- Cloudflare D1 databases, preview databases, isolated R2 buckets, notification queues and DLQs
  exist for both named environments. The staging D1 has all 11 migrations applied. Migrations
  0005-0007 use trigger syntax accepted by the remote D1 migration splitter and retain the same
  abort invariants; a read-only remote query confirms ledger entries 1-11 and the deployed
  `SELECT RAISE ... WHERE` trigger bodies for inventory, payment/order convergence, fulfillment,
  and order transitions. The local workerd/D1 suite passes.
- Analytics Engine is enabled with `shoppp_staging_observability`. A staging Turnstile widget is
  bound to the API Worker; its secret was written directly to Worker secret storage and only its
  public site key is committed.
- The staging API, admin, and storefront are deployed at
  `shoppp-api-staging.hashencode.workers.dev`,
  `shoppp-admin-staging.hashencode.workers.dev`, and
  `shoppp-storefront-staging.hashencode.workers.dev`. API health and runtime Turnstile config
  return successfully. API version `a1808b98-b5bf-4701-913e-94f19a908042` is deployed at 100%.
  Cloudflare Access protects the admin with a Service Auth policy: an allowlisted service token
  reaches `/api/admin/session` as the seeded `admin` identity, while both anonymous traffic and a
  second non-allowlisted service token receive 403. The API verifies the real service-token JWT
  shape (`type=app`, stable `common_name`) against the configured Access issuer and audience using
  the rotating remote JWKS endpoint; unknown signing key IDs trigger a refresh, and focused tests
  cover malformed service identities and key rotation.
- Staging contains a deployable Atlas Carry-on commercial-journey fixture with USD/EUR prices,
  exactly one unit of inventory, US shipping, an R2-hosted media asset, launch configuration, and
  the deployed immutable catalog release `representative-release-2026-07-30`. The live product API,
  media URL, product page, order shell, and three Worker health/routes return successfully.
- A live checkout probe exposed manually seeded short shipping identifiers that bypassed the admin
  contract and caused `PUT /api/cart/shipping` to return 422 before Turnstile or payment handling.
  The zone, method, and launch-configuration references were repaired to contract-valid public IDs,
  with machine audit event `staging.shipping_identifier.repair`. Remote `quick_check` is `ok`,
  foreign-key checking is clean, and the same browser flow now returns 200 with
  `canCheckout=true`, the selected $13.50 method, and an authoritative $142.50 total. The launch
  configuration contract now rejects malformed shipping method identifiers before persistence.
- The GitHub `staging` environment contains the three application URLs, immutable release ID,
  build-manifest token, Cloudflare account ID, authorized/prohibited Access credentials, and an
  active one-year account-owned Cloudflare API token with Workers, D1, R2, and Queue deployment
  permissions. Secrets were written directly to GitHub/Worker secret stores and are not committed.
- Stripe test-mode secret and webhook signing credentials are stored only as Worker secrets. The
  Stripe webhook points to the staging API and subscribes to completed, expired, asynchronous
  success, and asynchronous failure Checkout events. Cloudflare Email Service sends from
  `orders@cdncdncdn.online` only to the verified launch destination `364461035@qq.com`; no external
  email-provider endpoint or paid email plan is required for this constrained launch path.
- The daily backup uses a free Worker Cron trigger to start the durable Workflow. A dedicated
  account-scoped user token with D1 Edit permission is stored as `D1_REST_API_TOKEN`; D1 Read was
  proven insufficient for the export operation. Initial and follow-up export requests both retain
  `output_format: "polling"`. Manual run `manual-2026-07-30-006` completed in 19 seconds and stored
  `d1/staging/2026-07-30/manual-2026-07-30-006.sql` in the isolated backup bucket. The 59,757-byte
  SQL object restored into disposable APAC D1 `942efd09-66dd-4a15-bba7-d928b5ed3476`; import ran
  166 queries, `PRAGMA quick_check` returned `ok`, foreign-key, inventory, order-total, and
  line-currency violations were zero, and source/restore counts matched. The disposable database
  was then permanently deleted. The R2 media object recorded by `product_media` also downloaded
  successfully and matched its public 1,119-byte response, proving the media recovery path.
- Cloudflare Static Assets rejects a wildcard order-shell rewrite as a loop. The storefront now
  resolves exactly one opaque `/orders/<token>` segment through its Worker asset binding, while
  preserving the browser URL and excluding `/orders/access`; focused route tests, the static build,
  and static SEO inspection pass.
- Staging remains non-releasable until the human Turnstile check and provider-backed
  purchase/refund/retry/email journeys are completed, the exhausted-notification and alert
  destinations are exercised, and rollback plus manual accessibility/device evidence are recorded.
  Staging and production may share this Cloudflare account because AE8 requires isolated resources,
  credentials, domains, and provider targets—not a distinct account ID.

## Final local hardening pass

- The storefront release is split into per-route generated modules and now proves all 1,027
  indexable representative routes at 1,000 products and 5,000 variants. The latest run completed
  generation in 21,684 ms; initial JavaScript stayed at 146,667-147,811 of 204,800 bytes gzip, and
  mobile Lighthouse performance was 94/95/95 with accessibility 98-100 and SEO 100.
- Catalog publication has an authenticated, idempotent terminal callback, a bounded build-hook
  timeout, concurrent same-result convergence, an atomic machine audit, and CI failure/deployed
  reporting. Shipping settings have complete contract/API/admin coverage, atomic reason audit, and
  a fail-closed migration guarding insert, update, and zone-activation country conflicts.
- Production admin authentication now ignores template credentials and derives the session from
  Cloudflare Access. The API-provided permission set is authoritative in navigation, guards, forms,
  and actions; stale session requests cannot restore a logged-out session.
- Privacy-safe funnel events record normalized page class, cart creation, checkout start, and
  provider-confirmed purchase without identifiers. Both webhook and queued provider-recovery paths
  emit purchase exactly once.
- The final review has no surviving local findings. Evidence:
  `/tmp/compound-engineering/ce-code-review/shoppp-20260730-full/review.json`.
- Local storefront browser gates now use the generated static artifact through a shared,
  gzip-capable test server that applies the release `_redirects` file. This keeps E2E,
  accessibility, and Lighthouse measurements on the exact deployable output while reserving the
  Wrangler Service Binding path for integration/staging validation; unmocked commerce API calls
  fail with 503 and the privacy-minimal analytics beacon is explicitly acknowledged.
- Latest local gates: tools 20/20; admin unit 249/249 and browser 8/8; storefront unit 18/18;
  contracts 7/7; domain 24/24; Worker API 93/93 and D1 6/6; admin Playwright 7/7; storefront
  Playwright 10/10 applicable; WCAG/keyboard 4/4; plus format, lint, typecheck, production build,
  static-output, bundle, representative-catalog, and Lighthouse gates.

## Human-owned production gates

- Merchant owner: merchant entity, Stripe eligibility, currencies, payout configuration, and webhook
  ownership.
- Legal/compliance owner: product-category compliance, tax treatment, policy text, tracking behavior,
  and shipping allowlist.
- Infrastructure owner: real isolated production resource IDs and domains, staging/production Access
  policies, Worker secrets, queues, alerts, backup schedule, and GitHub environment values.
- Operations owner: representative staging seed, authorized/prohibited identities, notification
  recovery fixture, support coverage, incident escalation, and real-device/manual accessibility
  evidence.
- Release approver: final approval of the immutable artifact and D1 backup that passed staging
  release validation and rollback rehearsal.

## Staging handoff

Staging infrastructure, the three Workers, Access policy/identities, deployment token, and one-unit
commercial fixture are provisioned. Stripe test mode, its webhook, the verified-destination
Cloudflare email binding, explicit production confirmation inputs, and the free Cron-to-Workflow
backup path are configured. The strict check continues to fail closed until provider-backed journey
references, alerts, rollback, and named human acceptance evidence exist.

After those inputs exist, dispatch `.github/workflows/deploy.yml`. It validates one clean candidate,
deploys tagged Cloudflare Versions, executes the provider-backed root staging suite and p95 checks,
rolls all three staging applications back to their last-known-good versions, restores the
candidate, and ends after staging by default. A separate explicitly confirmed dispatch may promote
the validated artifact to production. Evidence is stored as versioned release and browser artifacts.
