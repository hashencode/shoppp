# Fashion Store one-time development catalog reset

This runbook exists only for the reviewed `fashion-store-live-v1` development reset. It is not a
bulk-import interface and must not be adapted to another manifest, environment, database, bucket,
or media origin.

## Immutable target

| Resource            | Required identity                                                  |
| ------------------- | ------------------------------------------------------------------ |
| Cloudflare account  | `449e7f42fe4c4e55d5c674e2e7c57c8d`                                 |
| Worker              | `shoppp-api-fashion-staging`                                       |
| Namespace           | `shoppp-fashion-staging`                                           |
| D1                  | `shoppp-fashion-staging` / `eb1ca4ef-3121-4d02-b20e-e619eac1cecc`  |
| R2                  | `shoppp-fashion-staging-media`                                     |
| Preview artifact R2 | `shoppp-fashion-staging-preview-artifacts`                         |
| Media origin        | `https://pub-4e1c398c57fa4b9f9781bc1abcb507a5.r2.dev`              |
| API origin          | `https://shoppp-api-fashion-staging.hashencode.workers.dev`        |
| Private storefront  | `https://shoppp-storefront-fashion-preview.hashencode.workers.dev` |

The runner and Worker both attest this complete identity. A mismatch is a stop condition.

## D1 boundary

Preserve exactly these tables:

- `settings`
- `admin_permission_definitions`
- `admin_roles`
- `admin_role_permissions`
- `admin_identities`
- `admin_invitations`
- `admin_password_credentials`
- `admin_sessions`
- `admin_password_reset_tokens`
- `admin_login_throttles`
- `admin_service_credentials`

Keep `d1_migrations` as boot-critical schema state. Every other application table is disposable:

`audit_events`, `cart_lines`, `carts`, `catalog_releases`, `categories`, `checkout_attempts`,
`collection_products`, `collections`, `d1_backup_runs`, `fashion_staging_acceptance_resources`,
`fashion_staging_acceptance_runs`, `fashion_staging_catalog_migrations`,
`fashion_staging_operator_runs`, `fulfillment_events`, `idempotency_claims`, `inventory_items`,
`inventory_reservation_events`, `inventory_reservation_groups`, `inventory_reservations`,
`notification_attempts`, `notification_jobs`, `order_addresses`, `order_events`, `order_lines`,
`orders`, `payment_events`, `price_lists`, `prices`, `privacy_request_events`, `privacy_requests`,
`product_categories`, `product_media`, `product_variants`, `products`, `refund_events`, `refunds`,
`report_exports`, `shipping_methods`, `shipping_zone_countries`, `shipping_zones`,
`stock_ledger_entries`, `storefront_experience_drafts`, `storefront_experience_migrations`,
`storefront_experience_snapshots`, `storefront_experience_validations`,
`storefront_preview_builds`, `storefront_preview_grants`, `storefront_preview_sessions`, and
`warehouses`.

The reset refuses to run if the live schema has any unknown application table or is missing an
expected table. It snapshots the preserved-table digest before clearing data, temporarily removes
only triggers owned by disposable tables, clears all disposable tables in one deferred-FK D1 batch,
restores those trigger definitions, and checks the IAM digest again before loading the catalog.

## R2 boundary

The new prefix is the manifest's exact `catalog/fashion-store/<catalog-version>` prefix. Before D1
reset, all 18 new objects must already match their source bytes and MIME type. During reset the
Worker lists only `catalog/fashion-store/`; keys outside the new prefix are deleted individually.
Any malformed key under that root stops the reset. Objects outside that root, including theme-owned
assets, are never deletion candidates.

## One-time execution

1. Apply all repository D1 migrations to Fashion staging. In particular, `0024` and `0025` must no
   longer be pending.
2. Capture the preflight IAM fingerprint before password/session/service-token probes. Confirm no
   Fashion acceptance, operator, Catalog Release build, or Experience build is active.
3. Configure `FASHION_CATALOG_RESET_ENABLED=true` for the Fashion staging Worker and create a random
   reset-only `FASHION_CATALOG_RESET_TOKEN`. Do not replace or revoke `FASHION_ACCEPTANCE_TOKEN`.
4. Deploy the temporary reset route from the exact reviewed revision.
5. In a protected shell, provide only:
   `FASHION_CATALOG_RESET_API_ORIGIN`, `FASHION_CATALOG_RESET_ACCEPTANCE_TOKEN`,
   `FASHION_CATALOG_RESET_TOKEN`, and
   `FASHION_CATALOG_RESET_CONFIRM=RESET_REVIEWED_FASHION_STAGING_CATALOG`.
6. Run `bun tools/run-fashion-staging-catalog-reset.ts`. Before any R2 write, the runner proves both
   credentials through the reset-only preflight, loads the repository-owned manifest, and asks the
   API which exact reviewed media keys are missing. It uploads only missing keys without an
   overwrite flag and, after any upload, repeats media preflight before performing the one-time
   reset and verifying the resulting catalog and public media bytes. It then asks the API
   for the exact reviewed shopper build input, builds and statically verifies that artifact in a
   disposable local copy of the current checkout, packages it with the existing preview packager,
   uploads the content-addressed files to the fixed private preview-artifact bucket, records the
   deployment, and verifies that the active D1 build points at the uploaded digest and prefix. The
   disposable copy is removed and the reset-only Worker secret is deleted on every terminal path.
   Only a successfully verified activation also deletes the temporary
   `FASHION_CATALOG_RESET_ENABLED` secret; a post-delete failure leaves maintenance enabled for
   repair-forward with a fresh reset token.
7. Accept completion only after the runner has fetched all 18 exact public media URLs without API
   authorization and matched each response's MIME type, byte length, and SHA-256 checksum to the
   reviewed repository file. Confirm the printed receipt reports 13 shopper products, 24 sellable
   variants, 18 media rows, zero foreign-key violations, the unchanged IAM digest, the destructive
   response's exact deleted table/media counts, and non-null `activeBuildId`,
   `activeArtifactDigest`, and `activeArtifactPrefix` values for the reviewed shopper release.
8. Probe the existing password account, existing browser session, and existing service credential.
   Only their documented `last_seen_at` or `last_used_at` timestamps may change.
9. Confirm both temporary reset secrets are absent after successful activation. The successful
   reset receipt also makes the destructive route return `410`; removing the enablement and reset
   token makes it unavailable.

The existing private preview Worker reads the active artifact prefix from Fashion staging D1, so
this operation uploads and activates the artifact without redeploying that Worker. Do not invoke or
adapt the retired U12 preview workflow: its frozen readiness identity is unrelated to this one-time
catalog reset. The runner needs the existing shared Fashion acceptance token, the temporary reset
token, and an authenticated local Wrangler session authorized to upload to both fixed R2 buckets and
delete the temporary reset authorization secrets. It does not need the historical preview-build
callback token or an Admin password/service credential.

Any failure after deletion is repaired forward by rerunning this exact reviewed reset after fixing
the reported cause. If the reset and activation completed but their final response was lost, the
rerun compares the persisted catalog, build, artifact digest, and artifact prefix with catalog
verification, rechecks all public media, returns a `terminalRecovered` receipt, and removes both
temporary secrets. If the catalog reset persisted with its deterministic build still in `building`,
the rerun verifies the persisted catalog and build identity, skips the destructive reset, repeats
the idempotent activation preparation, and returns an `activationResumed` receipt after deployment.
Do not restore the old catalog or old commerce history. If terminal cleanup
cannot delete the reset-only token, delete that token before any investigation continues. After a
successful activation, also remove a lingering reset-enablement secret before handback. Never delete
the shared Fashion acceptance credential.
