# Catalog Release Protocol

## Authority and lifecycle

Operators edit mutable catalog drafts. Preview uses a short-lived signed token and does not change
public state. Publish validates the complete catalog, writes one immutable release manifest, and
starts one build with the release ID and request ID.

The release lifecycle is:

```text
approved -> building -> deployed
                     \-> failed
```

`apps/api/src/publishing/releases.ts` owns these transitions. A build-trigger failure moves the
release directly to `failed`. Once a build starts, the deployment workflow must call
`POST /build/catalog/releases/:releaseId/status` with the dedicated build credential and a stable
`Idempotency-Key`. The only accepted results are `deployed`, or `failed` with a bounded failure
code. Terminal releases cannot transition again.

## Immutable build input

The build reads only:

```text
GET /build/catalog/releases/:releaseId
Authorization: Bearer <BUILD_MANIFEST_TOKEN>
```

Strict release validation requires the URL to be on the staging API origin, to end in the selected
release ID, and to use a token of at least 32 characters. `prepare-release.ts` filters the manifest
to published products/collections and generates complete HTML routes, segmented sitemaps, robots
rules, redirects, and a route manifest containing the same release ID.

The validated storefront assets and Worker bundle are hashed into the release report. Staging and
production deployment use those saved files with `wrangler versions upload --no-bundle`; promotion
does not regenerate the catalog.

## Success and failure behavior

- Staging marks a release `deployed` only after browser journeys, latency gates, rollback, and
  restoration of the validated versions succeed.
- Candidate validation, staging deployment, or staging proof failure records `failed`.
- A failed release increments operational health and leaves the prior storefront version live.
- Admin catalog rows show the terminal status and build correlation ID.
- Machine callbacks are authenticated, idempotent, audited, private/no-store, and cannot mutate a
  terminal result.

Recovery follows `docs/runbooks/catalog-publication.md`; immutable artifact promotion and rollback
follow `docs/runbooks/release.md` and `docs/runbooks/rollback.md`.
