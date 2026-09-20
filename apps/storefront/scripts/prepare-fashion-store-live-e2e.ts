import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalCatalogReleaseSchema,
  experienceSnapshotSchema,
  type ExperienceSnapshot,
} from "@shoppp/contracts";
import {
  applyFashionStoreHomeComposition,
  parseFashionStoreHomeDevelopmentProfile,
} from "../app/themes/fashion-store/successor/home-development-profile";

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
  products: Array<
    {
      collectionSlugs: string[];
      id: string;
      name: string;
      optionDefinitions?: Array<{
        name: string;
        presentation: "color" | "text";
        values: Array<{ label: string; swatch?: string }>;
      }>;
      seoTitle: string;
      slug: string;
      status: string;
      variants: Array<{ id: string; sku: string } & Record<string, unknown>>;
    } & Record<string, unknown>
  >;
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
        settingId: "featured-collection",
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
                "footer-legal-link": {
                  label: "Footer privacy",
                  target: {
                    kind: "internal",
                    reference: { id: "policy.privacy", kind: "policy" },
                  },
                  targetBehavior: "same-window",
                },
                "footer-social-link": {
                  label: "Demo community",
                  target: { kind: "external", url: "https://example.com" },
                  targetBehavior: "new-window",
                },
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
  const emptyHome = process.argv.includes("--empty-home");
  const emptyProduct = process.argv.includes("--empty-product");
  const unifiedHome = process.argv.includes("--unified-home");
  if ([emptyHome, emptyProduct, unifiedHome].filter(Boolean).length > 1) {
    throw new Error("Choose one Fashion Store live fixture profile.");
  }
  const preparedReleaseFixture = structuredClone(releaseFixture);
  preparedReleaseFixture.releaseId = "fashion-store-live-2026-09-16-v2-shopper-release";
  const reviewedProduct = preparedReleaseFixture.products.find(
    ({ slug }) => slug === "relaxed-corduroy-shirt",
  );
  if (!reviewedProduct) throw new Error("Fashion live preview requires the reviewed Product.");
  if (emptyProduct) {
    const presentation = reviewedProduct.presentation as Record<string, unknown> | undefined;
    if (!presentation) throw new Error("Fashion Product review fixture has no presentation.");
    delete presentation.reviewDisplay;
    preparedReleaseFixture.releaseId = "fashion-store-live-2026-09-16-empty-product";
  }
  reviewedProduct.optionDefinitions = [
    {
      name: "color",
      presentation: "color",
      values: [
        { label: "Gold", swatch: "#d4af37" },
        { label: "Blue", swatch: "#5881bf" },
        { label: "Green", swatch: "#87a968" },
      ],
    },
    {
      name: "size",
      presentation: "text",
      values: ["S", "M", "L", "XL"].map((label) => ({ label })),
    },
  ];
  if (unifiedHome) {
    const homeCollection = preparedReleaseFixture.collections.find(
      ({ status }) => status === "published",
    );
    const seedProduct = preparedReleaseFixture.products.find(
      ({ status, variants }) => status === "published" && variants.length > 0,
    );
    if (!homeCollection || !seedProduct) {
      throw new Error("Fashion unified Home requires a published collection and seed product.");
    }
    const initialProductCount = preparedReleaseFixture.products.length;
    for (let offset = 1; homeCollection.productSlugs.length < 8; offset += 1) {
      const index = initialProductCount + offset;
      const slug = `unified-home-fixture-${index}`;
      const product = structuredClone(seedProduct);
      product.id = `prod_01J000000000000000000000${index}`;
      product.slug = slug;
      product.name = `Unified Home fixture ${index}`;
      product.seoTitle = `${product.name} | Shoppp`;
      product.collectionSlugs = [...new Set([...product.collectionSlugs, homeCollection.slug])];
      product.variants = product.variants.map((variant, variantIndex) => ({
        ...variant,
        id: `var_01J00000000000000000${index}${String(variantIndex).padStart(3, "0")}`,
        sku: `UNIFIED-${index}-${variantIndex + 1}`,
      }));
      preparedReleaseFixture.products.push(product);
      homeCollection.productSlugs.push(slug);
    }
  }
  if (emptyHome) {
    const homeCollection = preparedReleaseFixture.collections.find(
      ({ status }) => status === "published",
    );
    if (!homeCollection) throw new Error("Fashion live preview requires a Home collection.");
    homeCollection.productSlugs = [];
    for (const product of preparedReleaseFixture.products) {
      product.collectionSlugs = product.collectionSlugs.filter(
        (collectionSlug) => collectionSlug !== homeCollection.slug,
      );
    }
  }
  const liveReleaseFixture = {
    ...preparedReleaseFixture,
    policies: [...releaseFixture.policies, selectedReleasePolicyProof],
    site: {
      ...(preparedReleaseFixture.site as Record<string, unknown>),
      name: "Shoppp live preview",
      origin: "https://live-policy.example.test",
    },
  } satisfies FashionStoreReleaseFixture;
  const productFixtureInput = emptyProduct
    ? {
        ...fixtureInput,
        snapshot: {
          ...fixtureInput.snapshot,
          resolvedTemplates: fixtureInput.snapshot.resolvedTemplates.map((template) =>
            template.pageType === "product"
              ? {
                  ...template,
                  sections: template.sections.map((section) => ({
                    ...section,
                    settings: Object.fromEntries(
                      Object.entries(section.settings).filter(
                        ([key]) =>
                          key !== "delivery-summary" &&
                          key !== "shipping-returns-summary" &&
                          !key.startsWith("payment-brand-"),
                      ),
                    ),
                  })),
                }
              : template,
          ),
        },
      }
    : fixtureInput;
  const input = fashionStoreLiveBuildInput(productFixtureInput, liveReleaseFixture);
  if (unifiedHome) {
    const profile = parseFashionStoreHomeDevelopmentProfile(
      process.env.STOREFRONT_FASHION_HOME_PROFILE,
    );
    const home = input.snapshot.resolvedTemplates.find(({ pageType }) => pageType === "home");
    if (!home) throw new Error("Fashion live preview requires a Home template.");
    applyFashionStoreHomeComposition(home, profile.composition);
  }
  await writeFile(
    resolve(
      fixtureRoot,
      unifiedHome
        ? "fashion-store-live-unified-home-e2e-input.json"
        : emptyHome
          ? "fashion-store-live-empty-e2e-input.json"
          : emptyProduct
            ? "fashion-store-live-empty-product-e2e-input.json"
            : "fashion-store-live-e2e-input.json",
    ),
    `${JSON.stringify(input, null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
