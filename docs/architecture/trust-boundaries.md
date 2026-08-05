# Trust Boundaries

## Boundary map

| Boundary             | Credential                               | Server-side enforcement                                                                                                                                                          | Sensitive-data rule                                                                 |
| -------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Public catalog       | None                                     | Published release and live catalog validation                                                                                                                                    | Public catalog facts only; cacheable by route policy                                |
| Guest cart and order | Opaque `CartToken` or order-access token | Hash lookup, expiry, use-case validation, private/no-store responses                                                                                                             | Tokens never enter URLs except the guest order route and are normalized out of logs |
| Checkout submission  | Cart token, origin, Turnstile token      | Exact storefront origin, 32 KiB body cap, credential-scoped rate limit, single-use Siteverify action/hostname check                                                              | Hosted payment only; no raw card data                                               |
| Aggregate analytics  | Exact storefront origin                  | 1 KiB body cap, independent rate limit, allowlisted event and normalized route class                                                                                             | No URL, slug, guest token, cookie, IP, device, session, or personal identifier      |
| Stripe webhook       | Provider signature                       | Raw-body HMAC verification, provider event uniqueness, monotonic convergence                                                                                                     | Payload is hashed; credentials and payloads are excluded from ordinary logs         |
| Admin human          | Email/password and opaque session cookie | Salted password verification, enabled human D1 identity, current role permission, and the exact deployed admin origin or explicit local development origin for browser mutations | Private/no-store; authentication denials and IAM mutations are audited              |
| Admin service        | Environment-owned Bearer credential      | SHA-256 token lookup, enabled service D1 identity, current role permission; service identities cannot activate invitations or change human passwords                             | Token values never enter D1, logs, artifacts, or the human user list                |
| Build machine        | Dedicated bearer secret                  | Release-scoped manifest endpoint and approved release status                                                                                                                     | Build credential is separate from shopper/admin credentials                         |
| Theme preview        | One-time grant, then host-only session   | Exact Admin/preview origins, private artifact prefix, grant/session expiry, non-indexable no-store responses                                                                     | Grant is POST-only; only digests persist; no credential enters URLs or logs         |
| Queue and Workflow   | Cloudflare binding identity              | Minimal stable IDs, D1 claim/deduplication, bounded retry and DLQ                                                                                                                | No personal data in queue payloads                                                  |
| D1 export Workflow   | Account-scoped D1 export token           | Scheduled Workflow, environment-specific database ID and R2 bucket                                                                                                               | Token is a Worker secret; backup content never enters logs                          |

## Environment isolation

There are exactly two shared remote identity/data planes. Local authenticated development,
remote-dependent automated tests, and the test deployment use `shoppp-staging`, the test D1. Only
production uses `shoppp-production`, the production D1. Their IDs, credentials, backups, Worker
names, admin hostnames, password-signing secrets, and service credentials are
distinct. A disposable local Miniflare database is not a shared remote environment. No shared
remote development D1 exists, and no development command can select production.

Other stateful resources remain environment-owned: test and production have distinct R2 buckets,
rate-limit namespaces, Analytics Engine datasets, queues, Workflows, origins, webhook secrets,
email settings, and storefront/admin deployments. Startup and release validation reject a
test/production crossover, a production-named non-production binding, or any third shared remote
development database identity.

Production secrets are configured with `wrangler secret put` and are intentionally absent from
source. A production configuration is not launch-ready until the server confirms payment and
webhook credentials, all policies have human legal approval, live payment mode is selected, and
placeholder policy domains are gone.

## Logging and analytics

Every request receives an `x-request-id`. Structured request events contain only environment,
method, normalized route, status, duration, and a redacted error classification. Query strings,
opaque order tokens, email, address, phone, authorization, cookies, provider secrets, and
card-like values are removed before console or Analytics Engine emission. Page analytics contain
only a normalized route class; cart creation, checkout start, and confirmed purchase are counted
at idempotent server milestones. Private endpoints set `Cache-Control: private, no-store`.

Missing or malformed sessions and service credentials are emitted only as redacted authentication
events; they cannot amplify writes to D1. Once an identity is mapped, authentication and permission denials are written to the
application audit trail. Human actors use `admin`; service actors use `machine`.

## Data lifecycle

Published commerce snapshots, order lines, payment events, inventory ledger entries,
notification attempts, and privacy-request events are append-only or mutation-constrained in D1.
Privacy access exports use a dedicated R2 bucket and expire after seven days. Correction and
deletion requests never rewrite legally required financial snapshots; the verified subject is
stored as a SHA-256 reference and the retention decision is appended and audited.
