# Fashion Store Live Catalog Evidence

This file retains focused evidence for FS-F8. Execution status, current-unit ownership, blockers, and next action remain authoritative only in the FS-F8 plan and the product master pointer.

## 2026-09-14 — U6 remote development reset

### Outcome

- The user-authorized destructive reset completed against the exact `shoppp-fashion-staging` D1 database and the exact Fashion staging media and preview-artifact R2 buckets.
- The first activation build exposed two local orchestration defects after the database replacement: an empty generated redirect array inferred as `never[]`, then a missing preview-mode environment value during static verification. Both were repaired locally and the same immutable `building` activation was resumed without a second database reset or repeated product-media upload.
- The terminal receipt reported `status=already_applied`, `activationResumed=true`, 13 shopper products, 24 variants and sellable variants, 18 media/dimension checks, and zero foreign-key violations.

### Remote identities and digests

- Catalog version: `fashion-store-live-2026-09-13-v1`.
- Manifest digest: `5e3a81859866ffdb1599eb2f2dff23ef0b34a5c77fa6a530d33a050569776766`.
- Shopper release: `fashion-store-live-2026-09-13-v1-shopper-release`, terminal status `deployed`.
- Acceptance release: `fashion-store-live-2026-09-13-v1-acceptance-release`, terminal status `approved`.
- Preview build: `preview-build-on-store-live-catalog-v1-852d741f58b05941-1`, terminal status `deployed`.
- Artifact digest: `f9d7ab8877f7951aff9a3e49a60092c4a5855fce2de95de3ccbe264f8b8c7300`.
- Artifact prefix: `snapshots/snapshot-fashion-store-live-catalog-v1/fashion-store-live-2026-09-13-v1-shopper-release/f9d7ab8877f7951aff9a3e49a60092c4a5855fce2de95de3ccbe264f8b8c7300`.

### Preservation and cleanup evidence

- Post-reset D1 readback returned four `admin_identities` and two `admin_sessions`, matching the pre-reset counts; the terminal IAM fingerprint was `aeefe49cb8a4525fb9f12a3eb8ca8edfcd8fa5f58a6f8cf0ddf53455856e3eb3`.
- D1 readback returned 14 total products and 25 total variants because the private unavailable acceptance identity is intentionally stored alongside the 13-product/24-variant shopper catalog. `product_media` contains 18 rows.
- `PRAGMA foreign_key_check` returned no rows.
- Worker secret inventory retains `AUTH_TOKEN_SECRET` and the shared Fashion acceptance credential. The short-lived reset credential and `FASHION_CATALOG_RESET_ENABLED` are absent after success.
- The API health endpoint returned HTTP 200. The private preview root returned HTTP 401 without a preview session, as required.

### Local verification retained with the run

- `bun test tools/run-fashion-staging-catalog-reset.test.ts` — 11 passed, 0 failed.
- Tools and workspace typecheck — passed, including API, Admin, Storefront, contracts, DB, and domain packages.
- Storefront generation prerendered the reviewed Fashion catalog routes; static preview verification passed before artifact upload and activation.

