# Trust Boundaries

## Boundary map

| Boundary             | Credential                               | Server-side enforcement                                                                                             | Sensitive-data rule                                                                 |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Public catalog       | None                                     | Published release and live catalog validation                                                                       | Public catalog facts only; cacheable by route policy                                |
| Guest cart and order | Opaque `CartToken` or order-access token | Hash lookup, expiry, use-case validation, private/no-store responses                                                | Tokens never enter URLs except the guest order route and are normalized out of logs |
| Checkout submission  | Cart token, origin, Turnstile token      | Exact storefront origin, 32 KiB body cap, credential-scoped rate limit, single-use Siteverify action/hostname check | Hosted payment only; no raw card data                                               |
| Stripe webhook       | Provider signature                       | Raw-body HMAC verification, provider event uniqueness, monotonic convergence                                        | Payload is hashed; credentials and payloads are excluded from ordinary logs         |
| Admin                | Cloudflare Access assertion              | Access JWT, enabled D1 identity, role permission inside each use case                                               | Private/no-store; denied actions are audited                                        |
| Build machine        | Dedicated bearer secret                  | Release-scoped manifest endpoint and approved release status                                                        | Build credential is separate from shopper/admin credentials                         |
| Queue and Workflow   | Cloudflare binding identity              | Minimal stable IDs, D1 claim/deduplication, bounded retry and DLQ                                                   | No personal data in queue payloads                                                  |
| D1 export Workflow   | Account-scoped D1 export token           | Scheduled Workflow, environment-specific database ID and R2 bucket                                                  | Token is a Worker secret; backup content never enters logs                          |

## Environment isolation

Development, staging, and production have distinct Worker names, D1 IDs, R2 buckets, rate-limit
namespaces, Analytics Engine datasets, queues, Workflows, Access audiences, origins, webhook
secrets, email settings, and storefront/admin deployments. Startup rejects a resource namespace
that does not contain its declared environment, and rejects non-production bindings that name
production.

Production secrets are configured with `wrangler secret put` and are intentionally absent from
source. A production configuration is not launch-ready until the server confirms payment and
webhook credentials, all policies have human legal approval, live payment mode is selected, and
placeholder policy domains are gone.

## Logging and analytics

Every request receives an `x-request-id`. Structured request events contain only environment,
method, normalized route, status, duration, and a redacted error classification. Query strings,
opaque order tokens, email, address, phone, authorization, cookies, provider secrets, and
card-like values are removed before console or Analytics Engine emission. Private endpoints set
`Cache-Control: private, no-store`.

## Data lifecycle

Published commerce snapshots, order lines, payment events, inventory ledger entries,
notification attempts, and privacy-request events are append-only or mutation-constrained in D1.
Privacy access exports use a dedicated R2 bucket and expire after seven days. Correction and
deletion requests never rewrite legally required financial snapshots; the verified subject is
stored as a SHA-256 reference and the retention decision is appended and audited.
