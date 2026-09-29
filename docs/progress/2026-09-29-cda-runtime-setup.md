# CDA runtime setup

This is deployment preparation, not deployment evidence. No hosted database, Worker, secret, candidate, DC or PG state was changed during implementation.

## Runtime requirements

- Apply database migration `0039_commerce_analytics.sql` before enabling the new API build.
- `TRAFFIC_ENABLED=true` enables automatic collection. This is an operational switch, not a shopper consent flow. Shared staging and production configuration default to enabled; the preview-only `fashion-staging` configuration remains disabled.
- Provision `TRAFFIC_KEYS_JSON` as a Worker secret separately for each environment. It is a JSON object mapping key IDs to independently generated secret strings of at least 32 characters. The checked-in active ID is `v1` (`TRAFFIC_ACTIVE_KEY_ID`); no secret value belongs in Git or browser configuration.
- `TRAFFIC_RATE_LIMITER` must exist in hosted environments. Missing signing keys or quota binding fails collection closed; shopping continues. The same-origin storefront gateway forwards the identity cookie and traffic calls to the API.
- `STOREFRONT_ORIGIN` must be the public storefront origin, distinct from `PREVIEW_ORIGIN`. The release must already have a validated public, successfully deployed manifest. Preview traffic is rejected independently by the build flag, preview gateway and API.

## Rotation and data lifecycle

Add a new key to the secret object, then select its ID with `TRAFFIC_ACTIVE_KEY_ID`. Retain each previous key for at least 365 days after it last issued an identity cookie; existing cookies keep their original digest and therefore their UV identity. Removing a still-needed key changes affected browsers' identity and is not routine rotation.

Identity cookies last 365 days, tickets one hour, retry records two hours. Each browser request attempt has a ten-second deadline; timeout releases initialization and the event queue, and an event retry retains the same ID and ticket. Each successful event insertion atomically retires at most one expired retry record, so sustained accepted traffic does not outpace cleanup. The scheduled handler also removes at most 500 expired retry records per invocation when traffic is idle. PV aggregates and the minimum UV/time associations have no automatic 90-day deletion. Cookie clearing, different devices, blocked requests and unrecognized bots affect browser-based counts; the dashboard does not identify natural persons or promise complete traffic.

## Local verification boundary

Worker tests provision isolated keys, manifests and rate-limit stubs; no production secret is needed. Built-storefront browser tests intercept traffic requests to verify hydration, page entry and refresh behavior. Collector-to-report tests use the real D1 migration and real manifest validation. Local SQLite scale probes are evidence of query shape and correctness, not hosted performance guarantees.
