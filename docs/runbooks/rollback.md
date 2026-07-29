# Rollback runbook

## When to roll back

Rollback immediately for purchase failure, inventory oversell, duplicate order/payment effects,
invalid static HTML, broken Access protection, cross-environment traffic, sustained error-budget
breach, or a migration that makes the deployed application unsafe. Stop catalog publication while
the incident is active.

## Worker and static application rollback

Identify the last-known-good version ID from the previous passing release record. Do not guess a
version or rebuild old source.

```sh
cd apps/api
bunx wrangler rollback <version-id> --env <staging|production> \
  --message "<incident-id>: <reason>" --yes

cd ../admin
bunx wrangler rollback <version-id> --env <staging|production> \
  --message "<incident-id>: <reason>" --yes

cd ../storefront
bunx wrangler rollback <version-id> --env <staging|production> \
  --message "<incident-id>: <reason>" --yes
```

Each application rolls back independently. If an API contract is incompatible with the current
clients, roll back API first to a backward-compatible version, then admin and storefront. Verify
`/health`, one public product, a cart quote, the protected admin entry, security/cache headers, and
the release identifier after every rollback.

## Failed catalog publication

A failed storefront build never deploys. Leave the last-known-good storefront version serving,
inspect the catalog release failure code and build correlation ID in admin, correct the catalog or
build configuration, then create a new release. Never change a failed release record to deployed or
reuse its idempotency key.

## Data rollback

D1 migrations are forward-only. Never use application rollback as an excuse to reverse or delete
commerce facts. For a destructive or corrupting migration:

1. disable writes and preserve the affected database;
2. follow `d1-backup-restore.md` to restore the last verified export into a new isolated D1 database;
3. reconcile order, payment, refund, inventory, audit, outbox, and idempotency totals;
4. bind a non-production Worker to the restored database and run the verification contract;
5. obtain incident commander and data owner approval before changing a production binding.

Record start/end time, actor, reason, old and restored version IDs, backup ID, verification evidence,
customer impact, and follow-up action. Confirm alerts fire during the rehearsal and resolve only
after the known-good deployment and data reconciliation are stable.
