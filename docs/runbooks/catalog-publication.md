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
