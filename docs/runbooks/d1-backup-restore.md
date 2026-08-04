# D1 Backup and Restore

## Scheduled backup

The API Worker's free Cron trigger runs daily at `0 0 * * *` and starts one deterministic
`D1BackupWorkflow` instance per UTC date. This avoids the Workers Paid requirement for a Workflow's
built-in `schedules` field while retaining durable Workflow retries and audit state. The Workflow
calls the D1 export REST API in polling mode and streams the SQL dump to the
environment-specific `BACKUP_BUCKET` under
`d1/<environment>/<date>/<workflow-instance>.sql`. `d1_backup_runs` records the database ID,
object key, status, and timestamps.

`D1_REST_API_TOKEN` is an environment-owned Worker secret, scoped to the target Cloudflare account.
Cloudflare's D1 export operation requires `D1 Edit`; `D1 Read` can inspect the database but cannot
start an export. Every initial and follow-up export request must include
`output_format: "polling"`, and follow-up requests also include the returned `current_bookmark`.
The Workflow polls every 15 seconds for at most 40 attempts so the export remains active while
bounding database unavailability. A response with an inner `error` is terminal even when the HTTP
status is 200 and the top-level `success` value is true.

Set or rotate the secret without placing it in shell history:

```sh
cd apps/api
bunx wrangler secret put D1_REST_API_TOKEN --env staging
```

After changing the token, redeploy the API so the Workflow version receives the new secret:

```sh
bunx wrangler deploy --env staging
```

Run and inspect an on-demand staging backup with a unique audit ID:

```sh
bunx wrangler workflows trigger shoppp-staging-d1-backup \
  --env staging \
  --id manual-YYYY-MM-DD-NNN
bunx wrangler workflows instances describe shoppp-staging-d1-backup \
  manual-YYYY-MM-DD-NNN \
  --env staging
```

## Isolated staging restore drill

Never restore over staging or production. Create a disposable D1 database whose name contains
`staging-restore`, download a selected staging SQL object from R2 through an approved operator
session, and import it:

This is a time-bounded recovery target, not a third shared environment. It must never be referenced
by Wrangler environment configuration, local development, CI, Access, or a standing Worker binding.
Record its owner and deletion deadline before creation; delete it after the reviewed drill. The only
shared remote databases remain the test `shoppp-staging` D1 and production `shoppp-production` D1.

```sh
cd apps/api
bunx wrangler d1 create shoppp-staging-restore-YYYYMMDD
bunx wrangler d1 execute shoppp-staging-restore-YYYYMMDD --remote --file=/approved/path/staging-backup.sql
bunx wrangler d1 execute shoppp-staging-restore-YYYYMMDD --remote --command="PRAGMA quick_check; PRAGMA foreign_key_check;"
```

Run the implemented reconciliation query set against the restored binding: database quick check,
zero foreign-key violations, inventory conservation, order arithmetic, and line/order currency
consistency. The local proof for the same checks is:

```sh
cd apps/api
bunx vitest run test/operations/d1-backup.test.ts
```

Record source object key, backup run ID, target database ID, operator, import result, reconciliation
counts, start/end timestamps, and deletion approval. Delete the disposable database only after
evidence is reviewed. Production Time Travel is a separate break-glass action and requires an
approved bookmark and incident commander.

## Media recovery check

Product media metadata keeps the original R2 key in `product_media.r2_key`. Select a representative
published object, download it read-only from the environment's `MEDIA` bucket, and verify its type,
byte length, digest, and public delivery response. Record the key and results with the D1 drill.
Never overwrite or delete the source object during a recovery check.
