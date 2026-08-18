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

## Exact-Fashion query surfaces

For FRT, the filter is exact `theme_id = 'fashion'` and the governed surfaces are:

- `storefront_experience_drafts` directly;
- `storefront_experience_validations` and `storefront_experience_migrations` through their draft;
- `storefront_experience_snapshots` directly;
- `storefront_preview_builds` through either its input identity or immutable snapshot;
- `storefront_preview_grants` and `storefront_preview_sessions` through their snapshot/build.

Retain totals and every schema-supported lifecycle state. For the current schema vocabulary those
include validation `valid/invalid`, migration `dry_run/approved`, snapshot `preview/approved`, build
`pending/building/deployed/failed/expired`, grant `active/redeemed/expired` plus `revoked` when the
column exists, and session `active/expired` plus `revoked` when the column exists.

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
