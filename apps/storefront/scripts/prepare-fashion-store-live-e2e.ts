import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalCatalogReleaseSchema,
  experienceSnapshotSchema,
  type ExperienceSnapshot,
} from "@shoppp/contracts";

const root = resolve(import.meta.dir, "..");
const fixtureRoot = resolve(root, "fixtures/experience/.generated");

interface FashionStoreFixtureInput {
  expectedOrigin: string;
  snapshot: ExperienceSnapshot;
  themeId: string;
}

interface FashionStoreReleaseFixture {
  collections: Array<{ productSlugs: string[]; slug: string } & Record<string, unknown>>;
  policies: Array<{ slug: string } & Record<string, unknown>>;
  products: Array<{ collectionSlugs: string[]; slug: string } & Record<string, unknown>>;
  redirects: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export function fashionStoreLiveBuildInput(
  fixtureInput: FashionStoreFixtureInput,
  releaseFixture: FashionStoreReleaseFixture,
  expectedOrigin = fixtureInput.expectedOrigin,
) {
  const productIds = new Map(
    releaseFixture.products.map((product, index) => [
      product.slug,
      `prod_01JFASHIONLIVE${String(index + 1).padStart(10, "0")}`,
    ]),
  );
  const collectionIds = new Map(
    releaseFixture.collections.map((collection, index) => [
      collection.slug,
      `col_01JFASHIONLIVE${String(index + 1).padStart(11, "0")}`,
    ]),
  );
  const catalogRelease = canonicalCatalogReleaseSchema.parse({
    ...releaseFixture,
    collections: releaseFixture.collections.map((collection) => ({
      ...collection,
      id: collectionIds.get(collection.slug),
      productIds: collection.productSlugs.map((slug) => productIds.get(slug)),
    })),
    generatedAt: "2026-08-12T00:00:00.000Z",
    products: releaseFixture.products.map((product) => ({
      ...product,
      collectionIds: product.collectionSlugs.map((slug) => collectionIds.get(slug)),
      id: productIds.get(product.slug),
    })),
    redirects: releaseFixture.redirects.map((redirect) => ({ ...redirect, status: 301 })),
    routes: [
      "/",
      ...releaseFixture.collections.map(({ slug }) => `/collections/${slug}`),
      ...releaseFixture.policies.map(({ slug }) => `/policies/${slug}`),
      ...releaseFixture.products.map(({ slug }) => `/products/${slug}`),
    ],
    schemaVersion: 2,
  });
  const collection = catalogRelease.collections.find(({ status }) => status === "published");
  const product = catalogRelease.products.find(
    ({ status, variants }) =>
      status === "published" && variants.some((variant) => variant.status === "active"),
  );
  if (!collection || !product) {
    throw new Error("Fashion live preview requires one published collection and product.");
  }
  const snapshot = experienceSnapshotSchema.parse({
    ...fixtureInput.snapshot,
    bindings: [
      {
        id: "fashion-store-live-home-binding",
        instanceId: "fashion-store-home",
        kind: "catalog",
        reference: { id: collection.id, kind: "collection" },
        settingId: "fashion-store-live-home-resource",
      },
      {
        id: "fashion-store-live-collection-binding",
        instanceId: "fashion-store-collection",
        kind: "catalog",
        reference: { id: collection.id, kind: "collection" },
        settingId: "fashion-store-live-collection-resource",
      },
      {
        id: "fashion-store-live-product-binding",
        instanceId: "fashion-store-product",
        kind: "catalog",
        reference: { id: product.id, kind: "product" },
        settingId: "fashion-store-live-product-resource",
      },
    ],
    experienceId: "experience-fashion-store-live",
    id: "snapshot-fashion-store-live-1",
  });
  return {
    catalogRelease,
    environment: "preview" as const,
    expectedOrigin,
    inputIdentity: {
      catalogReleaseId: catalogRelease.releaseId,
      experienceSnapshotId: snapshot.id,
      experienceVersion: snapshot.version,
      platformContractVersion: snapshot.platformContractVersion,
      themeId: snapshot.themeId,
      themeVersion: snapshot.themeVersion,
    },
    presentationMode: "live" as const,
    snapshot,
    themeId: fixtureInput.themeId,
  };
}

async function main(): Promise<void> {
  const fixtureInput = JSON.parse(
    await readFile(resolve(fixtureRoot, "fashion-store-preview-input.json"), "utf8"),
  ) as FashionStoreFixtureInput;
  const releaseFixture = JSON.parse(
    await readFile(resolve(root, "fixtures/release.json"), "utf8"),
  ) as FashionStoreReleaseFixture;
  const input = fashionStoreLiveBuildInput(fixtureInput, releaseFixture);
  await writeFile(
    resolve(fixtureRoot, "fashion-store-live-e2e-input.json"),
    `${JSON.stringify(input, null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
