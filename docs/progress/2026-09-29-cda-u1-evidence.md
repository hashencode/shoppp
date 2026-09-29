# CDA U1 bounded contract and storage evidence

Date: 2026-09-29. Scope: CDA only; REL-Pre-DC remains the active product checkpoint. No candidate, deployment or promotion is advanced.

## Frozen interface and storage decisions

- Endpoints: POST `/platform/traffic/identity` with `{releaseId}` returns `{ticket,expiresAt}`; POST `/platform/traffic/events`; GET `/admin/reporting/traffic`; GET `/admin/reporting/products`.
- Identity: automatic random first-party HttpOnly, Secure, SameSite=Lax cookie, 365-day lifetime. Store only environment-scoped HMAC digest. Keep the signing/derivation key version available through existing identity expiry when rotating keys. Browser reset/new browser is a new anonymous visitor; UV is browser identity, not a claim to identify a human across devices.
- Server-signed ticket binds identity, environment and expiry, valid for one hour. Event payload is immutable across retries, has random UUID and bounded release/route/product dimensions; never accepts raw URLs, email or account IDs. Reject expired tickets before writes. Dedup UUIDs are retained at least two hours and increment both PV dimensions atomically with the dedup insertion. A fresh ticket must not be substituted for retries of an old event. Reject timestamps/claims outside signed ticket authority.
- Server receipt minute is the aggregation bucket. PV key `(minute, product dimension)`; increment site total once and product total once if applicable. Retain minimal historical public release reference for product-name resolution. UV primary key `(minute, visitor_digest)` merges repeated visits within the minute. Window UV uses DISTINCT, daily UV is calculated separately; never sum daily UV for full-window total. Summaries and UV associations have no fixed 90-day expiry.
- Minute buckets support contemporary IANA midnight boundaries, including half-hour and quarter-hour offsets and DST. Data collection begins now; pre-collection historical second-offset zones cannot contain collected data. No historical timezone backfill is claimed.
- Read window matches existing financial resolver: end-start <=366 days (367 inclusive dates). Top products <=10, event body <=4 KiB (HTTP layer), ticket <=2048 chars, IDs <=160 chars. Begin with 60 events/minute per visitor plus trusted network abuse limiting; respond with explicit throttling, never claim perfect counts for rejected abuse. Cleanup dedup in bounded batches of 500. These are initial operational guards, not measured hosted throughput guarantees.

## Authority inspection

`apps/api/src/publishing/releases.ts` saves manifest_json and distinguishes public publication. `apps/api/src/storefront-experience/catalog-resources.ts` parses saved release manifests; candidate releases are explicitly separate in `candidate-releases.ts`. Resolve current links from the latest successfully deployed public release in the current environment, sorted by deployment time and ID, before checking product membership. A product removed from that latest manifest has no current link even if an older manifest contains it. Resolve historical names from a verified public release referenced by aggregated traffic, then order-line snapshot, then explicit archived-product short ID fallback. Do not use a private candidate manifest as public-name/link authority. Report path is nullable and restricted to a relative route; storefrontOrigin comes from controlled server configuration.

## Reproducible probe

Run `python3 docs/progress/2026-09-29-cda-u1-probe.py` (stdlib SQLite and zoneinfo only). Local in-memory synthetic workload: 500,000 UV associations, 250,000 PV rows, 10,000 distinct visitor identities. Full tested-window distinct query: 109.09 ms in the initial run. SQLite uses a covering `(bucket,visitor)` index range and temporary DISTINCT B-tree. This establishes a viable small-store query shape, not D1 network latency or a production capacity benchmark; U6 must verify deployed query costs and representative store distribution before claiming capacity.

Assertions passed: A three visits/B two visits yields UV=1/PV=5; next-day A yields range UV=1/PV=6, A=4/B=2; retry does not increment; injected transactional failure rolls back dedup and counts. Boundary checks: New York spring day 23h, autumn day 25h; Kolkata and Kathmandu minute-aligned 24h windows with half/quarter-hour UTC boundaries. Daily rows remain independently countable and no retention filter excludes >90-day data.

## Contract red/green

`bun test packages/contracts/test/analytics.test.ts`: initial red (missing analytics module), then green: 3 tests, 20 assertions. Covers invalid dates/time zones/windows, prohibited currency on traffic, product dimension consistency, prohibited raw fields, separate UV/PV and safe nullable public paths. Contract tests validate protocol shape; endpoint atomicity and expiry require U4 integration tests.
