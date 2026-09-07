# Storefront Theme Retirement Inventory

Use this runbook only for the aggregate data gate owned by an active retirement plan. It does not
authorize migrations, row reads, updates, deletes, deployment, or runtime-package removal.

## Safety boundary

1. Confirm the owning plan and exact retired runtime identity.
2. Enumerate unique staging and production D1 database IDs from `apps/api/wrangler.jsonc`; dedupe
   aliases that resolve to the same ID.
3. Run `wrangler whoami` and require the account ID to match the configured resources.
4. Query `sqlite_master` for the governed tables. A failed query is not absence; an authorized empty
   schema result is evidence only for the named tables in that database.
5. Build aggregate queries against the deployed schema, not only the newest local migration.
6. Select counts and lifecycle labels only. Never select IDs, JSON, origins, digests, timestamps,
   business fields, or credential material.
7. Require successful query metadata with `changed_db: false` and `rows_written: 0`.
8. Stop physical runtime deletion if any count is non-zero or any required environment is
   inaccessible. Record the aggregate result and obtain the owning plan's explicit disposition.

## Exact identity query surfaces

For FRT, the filter is exact `theme_id = 'fashion'`. For FS-R3, run independent rows for exact
`theme_id = 'decor'` and exact `theme_id = 'decor-store'`; never use a prefix, `LIKE`, JSON search,
or a combined display label. The governed surfaces are:

- `storefront_experience_drafts` directly;
- `storefront_experience_validations` and `storefront_experience_migrations` through their draft;
- `storefront_experience_snapshots` directly;
- `storefront_preview_builds` through either its input identity or immutable snapshot;
- `storefront_preview_grants` and `storefront_preview_sessions` through their snapshot/build.

Retain totals and every schema-supported lifecycle state. For the current schema vocabulary those
include validation `valid/invalid`, migration `dry_run/approved`, snapshot `preview/approved`, build
`pending/building/deployed/failed/expired`, grant `active/redeemed/expired` plus `revoked` when the
column exists, and session `active/expired` plus `revoked` when the column exists.

For a freeze-backed retirement, also retain aggregate `SUM(draft.version)`, `MAX(draft.updated_at)`,
`MAX(build.updated_at)`, row totals, active grant/session totals, and uncleaned artifact totals at
the freeze baseline and at the immediate pre-removal recheck. These are aggregate change detectors;
do not retain an individual record timestamp or version.

## Environment and artifact reconciliation

1. Read every named API environment, D1 binding, and `PREVIEW_ARTIFACTS` binding from checked-in
   Wrangler configuration. The root/default environment may alias a named environment; dedupe only
   by exact provider database or bucket identity.
2. Compare the configured set with provider D1, R2, and Worker deployment metadata. Classify each
   unmatched entry explicitly. A provider-only preview database with no governed tables may be
   recorded as an empty Wrangler preview resource; a configured Worker or bucket that does not
   exist is an undeployed surface, not a successful runtime query.
3. Require the write freeze on every deployed API Worker that can reach a governed database. A
   configured environment with no Worker and no governed tables has no current write surface, but
   remains listed so later provisioning cannot inherit stale retirement assumptions.
4. Use build-to-snapshot lineage for artifact counts. Bucket-wide object totals are namespace
   metadata, not proof that an object belongs to a retired identity; never infer theme ownership
   from an opaque object key or approximate prefix.

## Exact Decor write freeze

The FS-R3 freeze is the API policy in
`apps/api/src/storefront-experience/retirement-policy.ts`. Both exact IDs must receive
`storefront_theme_package_retired` before a lifecycle mutation. Immutable draft, snapshot, build,
payload, and audit reads remain available. Security revocation may remain available, but automated
expiry cleanup must skip retired snapshot lineage so the freeze does not create post-freeze row or
artifact deltas.

## Evidence record

Record UTC/local execution time, authorization result, unique environment/database identity,
schema presence, query shape, aggregate counts, and mutation metadata under `docs/progress/`.
Explicitly distinguish rejected/unauthorized attempts from the successful evidence used for the
gate. The progress record must not become a second current-unit queue.

## After a zero-data gate

A complete zero-data record authorizes only the next unit named by the owning retirement plan. It
does not itself delete code, fixtures, catalogs, builds, or remote rows. Before physical package
removal, the owning checkpoint must also prove source/reference independence and exact clean-path
deletion safety. After removal, retain this aggregate evidence and historical identity wording;
do not rerun or reinterpret the inventory as authorization for an unrelated remote cleanup.
