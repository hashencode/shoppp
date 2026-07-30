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

The private workflow requires exact `build_id` and `snapshot_id` inputs issued by the API. It:

1. validates both IDs and the API, Admin handoff, and preview origins;
2. fetches the immutable build input from
   `GET /build/storefront-experiences/snapshots/<snapshot-id>`;
3. builds one allowlisted theme, verifies static output and selected-theme bundle isolation;
4. uploads files beneath the content-addressed snapshot prefix;
5. deploys the preview access Worker with exact preview and handoff origins;
6. reports `deployed` or `failed` to
   `POST /build/storefront-experiences/builds/<build-id>/status` with a stable idempotency key.

The preview environment owns its Cloudflare account token, build token, service token, private R2
bucket, Worker service binding, and origins. Do not reuse staging or production commerce
credentials.

## Failure and recovery

- A validation or build failure leaves production unchanged. Inspect the build correlation ID and
  bounded failure code, correct the package or draft, validate again, and start a new attempt.
- A `401` or `403` at the preview origin usually means the grant is absent, wrong-origin, expired,
  revoked, or already redeemed. Request a new grant; do not reuse or expose the old one.
- A digest mismatch is a hard stop. Delete no shared prefix and do not alter the callback. Rebuild
  the same immutable input and investigate the artifact contents.
- Expired artifacts, grants, and sessions are removed by the API cleanup lifecycle. The Worker
  cannot traverse or read another snapshot prefix.

## Approval and non-activation

Approve only the exact currently validated draft version with an explicit reason. Approval records
an immutable snapshot and audit event. It does not activate a theme in production. The public
storefront must continue to build as `production-fallback` with no preview route, fixture data,
credential, artifact, analytics, or cache entry.
