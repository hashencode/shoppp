# Catalog Publication Recovery

## Failed build

1. In Admin → Catalog, open the affected product and inspect the release/build correlation ID.
2. Confirm completeness: active variant, price in every enabled currency, media alt text, shipping
   weight, SEO fields, and all six policy disclosures.
3. Fix the draft and publish again with a new explicit reason. Do not mutate an approved release
   manifest.
4. Verify the static build contains the product, collection, canonical URL, sitemap entry, policy
   pages, and permanent redirects.
5. Keep the previous immutable storefront artifact serving until the replacement passes gates.

The deployment workflow reports one terminal result to
`POST /build/catalog/releases/<release-id>/status` with `BUILD_MANIFEST_TOKEN` and a stable
`Idempotency-Key`. Do not edit the release row manually. A `deployed` result is valid only after
staging journeys, latency, rollback, and restore pass; a failed candidate, deployment, or proof
uses a bounded failure code and becomes visible in operational health.

## Verification

```sh
cd apps/api
bunx vitest run test/catalog/catalog.test.ts test/publishing/build-manifest.test.ts
cd ../storefront
bun run build
bun run verify:static
```

Rollback means redeploying the last-known-good immutable static artifact; it is never an edit to a
published snapshot.
