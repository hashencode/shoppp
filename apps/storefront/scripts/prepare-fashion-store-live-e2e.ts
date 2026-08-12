import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalCatalogReleaseSchema } from "@shoppp/contracts";

const root = resolve(import.meta.dir, "..");
const fixtureRoot = resolve(root, "fixtures/experience/.generated");
const fixtureInput = JSON.parse(
  await readFile(resolve(fixtureRoot, "fashion-store-preview-input.json"), "utf8"),
);
const releaseFixture = JSON.parse(await readFile(resolve(root, "fixtures/release.json"), "utf8"));

const productIds = new Map(
  releaseFixture.products.map((product: { slug: string }, index: number) => [
    product.slug,
    `prod_01JFASHIONLIVE${String(index + 1).padStart(10, "0")}`,
  ]),
);
const collectionIds = new Map(
  releaseFixture.collections.map((collection: { slug: string }, index: number) => [
    collection.slug,
    `col_01JFASHIONLIVE${String(index + 1).padStart(11, "0")}`,
  ]),
);
const catalogRelease = canonicalCatalogReleaseSchema.parse({
  ...releaseFixture,
  collections: releaseFixture.collections.map(
    (collection: { productSlugs: string[]; slug: string }) => ({
      ...collection,
      id: collectionIds.get(collection.slug),
      productIds: collection.productSlugs.map((slug) => productIds.get(slug)),
    }),
  ),
  generatedAt: "2026-08-12T00:00:00.000Z",
  products: releaseFixture.products.map((product: { collectionSlugs: string[]; slug: string }) => ({
    ...product,
    collectionIds: product.collectionSlugs.map((slug) => collectionIds.get(slug)),
    id: productIds.get(product.slug),
  })),
  redirects: releaseFixture.redirects.map((redirect: Record<string, unknown>) => ({
    ...redirect,
    status: 301,
  })),
  routes: [
    "/",
    ...releaseFixture.collections.map(({ slug }: { slug: string }) => `/collections/${slug}`),
    ...releaseFixture.policies.map(({ slug }: { slug: string }) => `/policies/${slug}`),
    ...releaseFixture.products.map(({ slug }: { slug: string }) => `/products/${slug}`),
  ],
  schemaVersion: 2,
});
const input = {
  catalogRelease,
  environment: "preview",
  expectedOrigin: fixtureInput.expectedOrigin,
  inputIdentity: {
    catalogReleaseId: catalogRelease.releaseId,
    experienceSnapshotId: fixtureInput.snapshot.id,
    experienceVersion: fixtureInput.snapshot.version,
    platformContractVersion: fixtureInput.snapshot.platformContractVersion,
    themeId: fixtureInput.snapshot.themeId,
    themeVersion: fixtureInput.snapshot.themeVersion,
  },
  presentationMode: "live",
  snapshot: fixtureInput.snapshot,
  themeId: fixtureInput.themeId,
};

await writeFile(
  resolve(fixtureRoot, "fashion-store-live-e2e-input.json"),
  `${JSON.stringify(input, null, 2)}\n`,
);
