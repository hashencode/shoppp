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

const selectedReleasePolicyProof = {
  description: "This notice exists only in the selected live preview Catalog Release.",
  effectiveDate: "2026-08-14",
  sections: [
    {
      body: "Selected-release policy content must never fall back to the generated default Catalog.",
      heading: "Selected release authority",
    },
  ],
  slug: "live-preview-policy-proof",
  title: "Live preview policy proof",
};

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
    resolvedTemplates: fixtureInput.snapshot.resolvedTemplates.map((template) => ({
      ...template,
      sections: template.sections.map((section) => ({
        ...section,
        settings: {
          ...section.settings,
          ...(template.pageType === "home"
            ? {
                "announcement-text": "Live Experience announcement",
                "footer-contact-copy": "Live Experience footer support",
                "header-contact-copy": "Live Experience header support",
              }
            : {}),
          ...(template.pageType === "content"
            ? {
                "order.help-copy": "Live Experience order help",
                "order.policy-link": {
                  label: "Order privacy policy",
                  target: {
                    kind: "internal",
                    reference: { id: "policy.privacy", kind: "policy" },
                  },
                  targetBehavior: "same-window",
                },
                "policy.document": { id: "policy.shipping", kind: "policy" },
                "policy.help-copy": "Live Experience policy help",
                "policy.related-link": {
                  label: "Related returns policy",
                  target: {
                    kind: "internal",
                    reference: { id: "policy.returns", kind: "policy" },
                  },
                  targetBehavior: "same-window",
                },
              }
            : {}),
        },
      })),
    })),
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
    mediaOrigins: [],
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
  const liveReleaseFixture = {
    ...releaseFixture,
    policies: [...releaseFixture.policies, selectedReleasePolicyProof],
    site: {
      ...(releaseFixture.site as Record<string, unknown>),
      name: "Shoppp live preview",
      origin: "https://live-policy.example.test",
    },
  } satisfies FashionStoreReleaseFixture;
  const input = fashionStoreLiveBuildInput(fixtureInput, liveReleaseFixture);
  await writeFile(
    resolve(fixtureRoot, "fashion-store-live-e2e-input.json"),
    `${JSON.stringify(input, null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
