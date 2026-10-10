# Formal storefront publication

U7 publishes an approved immutable Catalog Release + Experience Snapshot. The candidate manifest retains its original purpose, ID and exact raw-byte digest. Publication authorization is separate service state; it does not freeze a REL candidate or grant DC/PG approval.

## Producer and consumers

The shared contract is `packages/contracts/src/storefront-publication.ts`. A publication identity binds Catalog Release ID, manifest/source digest, approved Snapshot ID/content digest, frozen Contact version, Experience version, Theme ID/version and Platform contract version. The source environment remains the owning API environment. Ordinary requests activate only that environment.

| Route | Credential | Result |
| --- | --- | --- |
| `GET /admin/storefront-experiences/drafts/:id/publication-context` | Human session, `themes.read` | Current exact approval, publication history and freshly checked active receipt |
| `POST /admin/storefront-publications` | Human session, `themes.publish`, idempotency key | Persist exact approved intent before dispatch; return queued request |
| `POST /admin/storefront-publications/rollback` | Human session, `themes.publish`, idempotency key | New request for a successfully activated prior identity and saved Worker version |
| `GET /admin/storefront-publications/:id` | Human session, `themes.read` | Request state; historical success alone does not mean currently live |
| `GET /admin/storefront-publications/active` | Human session, `themes.read` | Active pointer plus current public version observation |
| `GET /build/storefront-publications/:id` | Existing `BUILD_MANIFEST_TOKEN` | Public live build input from retained exact approved bytes |
| `POST /build/storefront-publications/:id/status` | Existing `BUILD_MANIFEST_TOKEN` | Run-bound building, activation or failure callback |

`themes.approve` never authorizes activation. Build credentials never create human publication authorization. Existing ordinary private candidate/public build endpoints remain fail closed.

## Delivery

The existing build hook receives the catalog release ID, publication ID, source environment, operation and optional restore Worker version ID. It dispatches the existing protected `deploy.yml` workflow with `publication_id` and `source_environment`; existing callers without these fields retain their old path. Missing hook/configuration is a recoverable failed request, not a live receipt.

The runner reads the public input from the source API, verifies the raw Catalog digest and canonical Snapshot digest, and hands it to the existing public compiler. The public build uses the approved live renderer and frozen Contact without fixture data, Preview credentials or noindex. The generated marker contains only immutable identity and source environment. `/.well-known/shoppp-release` adds the current Cloudflare version metadata at runtime and disables caching. The marker omits the publication request ID so the same artifact can be validated in staging and restored without rebuilding.

Hosted validation binds its report and artifact digest to this input. Production-source artifacts are validated in isolated staging before the existing production gates permit deployment of the same bytes. Staging proof must not send an activation callback to the production producer. Preparing compatible staging Commerce data is REL DC2 work; this path does not mirror production D1 data or rewrite IDs.

The deployment runner confirms one Worker version at 100% traffic and the public marker, then submits the receipt with environment, exact identity, Worker/deployment ID, run/attempt/commit and report/artifact digests. The producer checks its own configured storefront origin and performs a compare-and-swap against the previous active request. Duplicate identical callbacks are harmless; changed or stale run attempts and previous-pointer mismatches fail closed.

Before deploying, capture the exact previous Worker version. On post-deployment observation or receipt failure, restore that version and verify the previous public identity. A failed restoration leaves an unresolved request and no claim that either version is currently live. Active queries recheck the actual public marker; unavailable or mismatched observations do not yield an online label.

Rollback uses a new authorized request and an existing successful receipt in the same environment. It restores that saved exact Worker version through the same protected workflow, verifies it and records a new activation receipt. It does not rebuild content or roll back D1 migrations, API versions or Queues.

## Retention and Commerce

Publication request rows and the environment's active pointer are operational state, not a second release/candidate evidence ledger. Original immutable manifest and approved Snapshot bytes remain authoritative. A successful activation grants public Commerce consumption of that catalog independently of the private preview lease. Historical activated catalogs remain valid for existing carts; they do not determine the current online badge. Authorized catalog media and snapshots must be retained for exact-version recovery.

Local U7 tests prove these boundaries and consumers. Actual hosted execution, candidate identity, DC and production PG remain owned by REL.
