# Formal storefront publication

U7 publishes an approved immutable Catalog Release + Experience Snapshot. The candidate manifest retains its original purpose, ID and exact raw-byte digest. Publication authorization is separate service state; it does not freeze a REL candidate or grant DC/PG approval.

## Producer and consumers

The shared contract is `packages/contracts/src/storefront-publication.ts`. A publication identity binds Catalog Release ID, manifest/source digest, approved Snapshot ID/content digest, frozen Contact version, Experience version, Theme ID/version and Platform contract version. The source environment remains the owning API environment. Ordinary requests activate only that environment.

| Route                                                              | Credential                                       | Result                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `GET /admin/storefront-experiences/drafts/:id/publication-context` | Human session, `themes.read`                     | Current exact approval, publication history and freshly checked active receipt   |
| `POST /admin/storefront-publications`                              | Human session, `themes.publish`, idempotency key | Persist exact approved intent before dispatch; return queued request             |
| `POST /admin/storefront-publications/rollback`                     | Human session, `themes.publish`, idempotency key | New request for a successfully activated prior identity and saved Worker version |
| `GET /admin/storefront-publications/:id`                           | Human session, `themes.read`                     | Request state; historical success alone does not mean currently live             |
| `GET /admin/storefront-publications/active`                        | Human session, `themes.read`                     | Active pointer plus current public version observation                           |
| `GET /build/storefront-publications/:id`                           | Existing `BUILD_MANIFEST_TOKEN`                  | Public live build input from retained exact approved bytes                       |
| `POST /build/storefront-publications/:id/status`                   | Existing `BUILD_MANIFEST_TOKEN`                  | Run-bound building, activation or failure callback                               |

`themes.approve` never authorizes activation. Build credentials never create human publication authorization. Existing ordinary private candidate/public build endpoints remain fail closed.

## Delivery

The existing build hook receives the catalog release ID, publication ID, source environment, operation and optional restore Worker version ID. It dispatches the existing protected `deploy.yml` workflow with `publication_id` and `source_environment`; existing callers without these fields retain their old path. Missing hook/configuration is a recoverable failed request, not a live receipt.

The runner reads the public input from the source API, verifies the raw Catalog digest and canonical Snapshot digest, and hands it to the existing public compiler. The public build uses the approved live renderer and frozen Contact without fixture data, Preview credentials or noindex. The generated marker contains only immutable identity and source environment. `/.well-known/shoppp-release` adds the current Cloudflare version metadata at runtime and disables caching. The marker omits the publication request ID so the same artifact can be validated in staging and restored without rebuilding.

Hosted validation binds its report and artifact digest to this input. Production-source artifacts are validated in isolated staging before the existing production gates permit deployment of the same bytes. Staging proof must not send an activation callback to the production producer. Preparing compatible staging Commerce data is REL DC2 work; this path does not mirror production D1 data or rewrite IDs.

Public browser, accessibility and performance gates retain this approved input and reuse the generated artifact. Product routes, names and canonical origin come from the input; the ordinary fixture profile remains separate. The current hosted public purchase proof covers `fashion-store` and checks the configured representative product against REL-prepared staging IDs, options, USD price and inventory before deployment. An unsupported renderer or mismatched staging fixture fails before mutation; it does not alter product membership or select a candidate template. The protected proof receives the same run, validated commit and observed public identity from the delivery runner; the older rollback-rehearsal latency entry point retains its separate authority.

Commerce proof runs before the final activation callback. The public Worker attaches its compiled Catalog ID through `X-Storefront-Catalog-Release` and its manifest digest to API requests, replacing caller-supplied catalog headers. `X-Preview-Catalog-Release` remains exclusive to private preview isolation. Public product lookup and new cart lines use the currently installed catalog; existing public carts retain their own qualified historical catalog for reads, quantity updates and checkout. Adding a new catalog's line to an older cart still rejects mixed catalog pricing.

In staging only, the API can read `/.well-known/shoppp-release/catalog` from its configured storefront origin and verify the current runtime version, exact Catalog bytes, digest and source environment. This qualifies only the currently installed public artifact for staging proof, including a production-source artifact absent from staging D1. It does not create an activation receipt. Production Commerce requires the successful publication qualification. A private preview, missing public marker or mismatched digest cannot use this path.

The deployment runner confirms one Worker version at 100% traffic and the public marker, then submits the receipt with environment, exact identity, Worker/deployment ID, run/attempt/commit and report/artifact digests. The producer checks its own configured storefront origin and performs a compare-and-swap against the previous active request. Duplicate identical callbacks are harmless; changed or stale run attempts and previous-pointer mismatches fail closed.

Before deploying, capture the exact previous Worker version. On post-deployment observation or receipt failure, restore that version and verify the previous public identity. A failed restoration leaves an unresolved request and no claim that either version is currently live. Active queries recheck the actual public marker; unavailable or mismatched observations do not yield an online label.

Retain the nonsecret baseline in the same protected workflow's artifacts before mutation. Forced job termination can prevent automatic restoration; the retained baseline supports an explicitly authorized exact-version recovery. A terminated job or unavailable observation is not evidence that the old shop was restored.

Ordinary input-retention or preparation failures submit the original run's failed callback only before the delivery step begins. The producer verifies the current baseline before allowing a new attempt; an unavailable or changed storefront keeps the request unresolved. After delivery starts, only the runner's retained-baseline recovery owns the outcome. Cleanup or evidence-upload failures cannot overwrite a completed activation.

Rollback uses a new authorized request and an existing successful receipt in the same environment. It restores that saved exact Worker version through the same protected workflow, verifies it and records a new activation receipt. It does not rebuild content or roll back D1 migrations, API versions or Queues.

Exact-version rollback does not run the destructive purchase proof again. New publication proof reuses staging operational fixtures and service provisioning from the existing release policy, retains its evidence, and removes the run-scoped synthetic failure/invitation rows after the attempt.

## Retention and Commerce

Publication request rows and the environment's active pointer are operational state, not a second release/candidate evidence ledger. Original immutable manifest and approved Snapshot bytes remain authoritative. A successful activation grants public Commerce consumption of that catalog independently of the private preview lease. Historical activated catalogs remain valid for existing carts; they do not determine the current online badge. Authorized catalog media and snapshots must be retained for exact-version recovery.

Local U7 tests prove these boundaries and consumers. Actual hosted execution, candidate identity, DC and production PG remain owned by REL.

## Environment setup and interrupted-run recovery

Apply migration `0039_storefront_publications.sql` and deploy the updated API before using the Admin consumer. The existing build-hook dispatcher must forward `publicationId` as workflow input `publication_id`, and `sourceEnvironment` as `source_environment`, alongside the Catalog Release ID. A production request still needs the existing explicit promotion, recent backup and human-access approvals; an incomplete gate produces `production_gate_required`, not a successful activation.

If a protected delivery is forcibly terminated, inspect the current producer state and Worker before authorizing recovery. Retrieve `publication-input-<run>-attempt-<attempt>` and `publication-baseline-<target>-<publication>-<run>-attempt-<attempt>` from that exact run (90-day retention). Use its original `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT` and `RELEASE_EXPECTED_COMMIT`, its `PUBLICATION_ID`/`SOURCE_ENVIRONMENT`, and the authorized target's `ACTIVATION_ENVIRONMENT`, `API_URL`, `STOREFRONT_URL`, `STOREFRONT_WORKER_NAME` and existing protected Cloudflare/build credentials:

```sh
bun tools/storefront-publication.ts recover \
  --metadata /path/to/original/publication.json \
  --baseline /path/to/original/baseline.json
```

The command rejects a completed request, a changed run or a different target, restores the retained exact version, verifies its current marker and submits the original run's failed/recovered callback. For production-source staging proof, add `--proof-only`; use staging Cloudflare credentials without the production build token. This restores staging only and sends no production callback. Failed verification keeps the request unresolved. Recovery is an environment operation requiring its own authorization; this documentation does not authorize it.
