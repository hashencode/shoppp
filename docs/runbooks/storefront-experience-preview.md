# Storefront Experience Preview

## Operator flow

In Admin → Storefront → Themes, select an approved compatible package and preset. Edit only
schema-backed fields, ordering, and optional visibility. Save with a reason, validate the exact
saved version, then request preview. Invalid or stale drafts cannot produce a preview.

Preview builds move through `pending`, `building`, `deployed`, `failed`, and `expired`. Editing is
not locked while a build runs. Retry a failed or expired build from the same validated draft; the
API creates a new build attempt while retaining immutable snapshot identity.

When deployed, “Open authenticated preview” requests a one-time grant and submits it by `POST` to
the preview origin in a new tab. Never paste grants, cookies, artifact prefixes, or callback tokens
into a URL, ticket, chat, or log.

## Build workflow

The private workflow requires exact `build_id` and `snapshot_id` inputs issued by the API. GitHub
serializes every run through the protected `fashion-staging` environment and the single
`fashion-staging-preview` concurrency group. It:

1. validates both IDs and the API, Admin handoff, and preview origins;
2. fetches the immutable build input from
   `GET /build/storefront-experiences/builds/<build-id>` and verifies the exact snapshot and Catalog
   identity;
3. builds one allowlisted theme, verifies static output and selected-theme bundle isolation;
4. uploads files beneath the content-addressed snapshot prefix;
5. deploys the preview access Worker with exact preview and handoff origins;
6. reports `deployed` or `failed` to
   `POST /build/storefront-experiences/builds/<build-id>/status` with a stable idempotency key;
7. after `deployed`, runs U13 before reporting workflow acceptance.

U13 reads the expected Experience/Catalog tuple from that immutable build input. The protected
environment supplies the exact API, Admin handoff, and Preview origins; a least-privilege service
principal with `themes.preview` and `catalog.read`; a currency; and representative stable product
and variant IDs. The runner issues an existing one-time grant, redeems it at the Preview Worker,
checks that the authorized page visibly renders the exact tuple, verifies the representative
product and variant by stable ID, creates a fresh cart, and adds exactly one unit through the
private `/api` bridge. The returned Cart ID and exact variant line are the authoritative acceptance
evidence. Secret tokens, grants, sessions, and CartTokens are never written to the report.

The preview environment owns its Cloudflare account token, build token, service token, private R2
bucket, Worker service binding, and origins. Do not reuse staging or production commerce
credentials.

The protected `fashion-staging` GitHub environment must contain:

- variables `PREVIEW_API_URL`, `PREVIEW_HANDOFF_ORIGIN`, `PREVIEW_ORIGIN`,
  `FASHION_U13_CURRENCY`, `FASHION_U13_PRODUCT_ID`, and `FASHION_U13_VARIANT_ID`;
- secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `PREVIEW_BUILD_TOKEN`, and
  `FASHION_U13_SERVICE_TOKEN`.

`PREVIEW_BUILD_TOKEN` reports immutable build state. `FASHION_U13_SERVICE_TOKEN` belongs to the
separate least-privilege service principal that issues the one-time grant; do not substitute one
credential for the other.

Provision the persistent Fashion Workers, D1, R2 bucket, bindings, GitHub variables, and long-lived
credentials once through the explicit provisioning procedure. Ordinary build and U13 runs only
verify and reuse them; missing configuration fails before U13 performs a network mutation. Replace
a long-lived credential only for an explicit operator rotation or a security event.

### Fashion staging provisioning

The persistent non-production profile is:

- API Worker `shoppp-api-fashion-staging`;
- private Preview Worker `shoppp-storefront-fashion-preview`;
- D1 `shoppp-fashion-staging`;
- R2 buckets `shoppp-fashion-staging-media` and
  `shoppp-fashion-staging-preview-artifacts`;
- Preview bindings `PREVIEW_AUTH` and `COMMERCE_API`, both targeting the dedicated Fashion API.

These names are configuration, not resources that a build creates. Before first deployment, list the
account's Workers, D1 databases, and R2 buckets and refuse any same-name resource whose identity does
not match the reviewed Wrangler configuration. Create only a missing named resource, apply the API
migrations once, install the API/Preview shared service token on both Workers, and install the
separate build callback and U13 service credentials. Seed the least-privilege U13 principal with only
`themes.preview` and `catalog.read`, then create an approved live snapshot whose visible home,
collection, and product instances use stable-ID Catalog bindings. Create a fresh immutable build for
that snapshot; never rewrite an earlier snapshot or build.

The GitHub `fashion-staging` environment is also persistent. GitHub does not expose or copy a secret
from another protected environment: even when `CLOUDFLARE_API_TOKEN` already exists under `staging`,
an operator must enter it separately under `fashion-staging`. Do not extract Wrangler's local OAuth
credential or substitute it as a CI token.

Verify the profile without printing values:

```sh
bun test tools/verify-environment-isolation.test.ts tools/deploy-workflow.test.ts
bunx wrangler deploy --config apps/api/wrangler.jsonc --env fashion-staging --dry-run
bunx wrangler deploy --config apps/storefront/wrangler.preview.jsonc --env fashion-staging --dry-run
bunx wrangler secret list --config apps/api/wrangler.jsonc --env fashion-staging
bunx wrangler secret list --config apps/storefront/wrangler.preview.jsonc --env fashion-staging
gh secret list --repo hashencode/shoppp --env fashion-staging
gh variable list --repo hashencode/shoppp --env fashion-staging
```

Ordinary preview builds do not run `wrangler d1 create`, `wrangler r2 bucket create`, service
credential provisioning, or secret rotation. A missing resource or secret is a failed verification,
not permission to recreate it during every run.

### Current deployed evidence

On 2026-08-12, build `preview-build-fashion-staging-live-1` deployed the exact tuple Catalog Release
`representative-release-2026-07-30`, Experience snapshot `snapshot-fashion-store-live-1` version 1,
theme `fashion-store` version `1.0.0`, and platform contract `1.0.0`. The real private-origin U13 run
`local-20260812-1` passed and created cart `cart_DD31857B249445F8B89B16FA25E8A3F9` containing one
`var_01J00000000000000000000000`. This report intentionally contains no grant, session, CartToken,
service token, or raw response body.

## Failure and recovery

- A validation or build failure leaves production unchanged. Inspect the build correlation ID and
  bounded failure code, correct the package or draft, validate again, and start a new attempt.
- A U13 failure occurs after the immutable artifact is recorded as `deployed`, but before workflow
  acceptance. Do not roll back or mark that artifact `failed`. Diagnose the failed stage and retry
  with a new GitHub run ID; the retry creates a new cart and new idempotency keys.
- A `401` or `403` at the preview origin usually means the grant is absent, wrong-origin, expired,
  revoked, or already redeemed. Request a new grant; do not reuse or expose the old one.
- A digest mismatch is a hard stop. Delete no shared prefix and do not alter the callback. Rebuild
  the same immutable input and investigate the artifact contents.
- Expired artifacts, grants, and sessions are removed by the API cleanup lifecycle. The Worker
  cannot traverse or read another snapshot prefix.
- U13 only creates a cart and adds one line. It does not reserve or decrement inventory, start
  payment, or create an order. There is intentionally no acceptance-run table, inventory baseline,
  cleanup scheduler, startup reconciliation, or durable recovery record; abandoned carts use the
  existing cart expiry lifecycle.

## Approval and non-activation

Approve only the exact currently validated draft version with an explicit reason. Approval records
an immutable snapshot and audit event. It does not activate a theme in production. The public
storefront must continue to build as `production-fallback` with no preview route, fixture data,
credential, artifact, analytics, or cache entry.
