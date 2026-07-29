# D1 Backup and Restore

## Scheduled backup

`D1BackupWorkflow` runs daily at `0 0 * * *`. It calls the D1 export REST API in polling mode and
streams the SQL dump to the environment-specific `BACKUP_BUCKET` under
`d1/<environment>/<date>/<workflow-instance>.sql`. `D1_REST_API_TOKEN` is a Worker secret with
permission only to export the target D1 database. `d1_backup_runs` records the database ID,
object key, status, and timestamps.

Set or rotate the secret without placing it in shell history:

```sh
cd apps/api
bunx wrangler secret put D1_REST_API_TOKEN --env staging
```

## Isolated staging restore drill

Never restore over staging or production. Create a disposable D1 database whose name contains
`staging-restore`, download a selected staging SQL object from R2 through an approved operator
session, and import it:

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
