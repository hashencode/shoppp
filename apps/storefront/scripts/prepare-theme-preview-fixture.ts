import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalCatalogReleaseSchema, fixtureBindingSchema } from "@shoppp/contracts";
import * as z from "zod";

import { fashionStoreManifest } from "../app/themes/fashion-store/successor/manifest";
import { fashionStoreEnabledPageContracts } from "../app/themes/fashion-store/page-contracts";
import { publicPaymentBrands } from "../app/theme-engine/view-models";
import { fashionStorePreset } from "../app/themes/fashion-store/successor/presets/source-parity";
import {
  applyFashionStoreHomeComposition,
  parseFashionStoreHomeDevelopmentProfile,
} from "../app/themes/fashion-store/successor/home-development-profile";
import type { ExperienceBuildInput } from "./prepare-experience";
import { fashionStoreDemoReviewDisplays } from "./fashion-store-demo-reviews";
import {
  createFashionStoreLiveCatalogMigrationPlan,
  loadFashionStoreLiveCatalog,
} from "../../../tools/prepare-fashion-store-live-catalog";

const previewFixtureSchema = z
  .object({
    approvedAt: z.iso.datetime(),
    approvedBy: z.string().trim().min(1).max(120),
    bindings: z.array(fixtureBindingSchema).max(100),
    experienceId: z.string().regex(/^[a-z][a-z0-9-]*$/),
    productPaymentBrands: z
      .array(z.enum(publicPaymentBrands))
      .max(publicPaymentBrands.length)
      .default([]),
    productDeliverySummary: z.string().trim().min(1).max(300).optional(),
    productShippingReturnsSummary: z.string().trim().min(1).max(300).optional(),
    snapshotId: z.string().regex(/^[a-z][a-z0-9-]*$/),
    version: z.int().positive(),
  })
  .strict();

interface PreviewThemeDescriptor {
  fixturePath: string;
  manifest: typeof fashionStoreManifest;
  pageTypes: ReadonlySet<string>;
  templates: typeof fashionStorePreset.templates;
}

const previewThemeDescriptors = {
  "fashion-store": {
    fixturePath: "../fixtures/experience/fashion-store.json",
    manifest: fashionStoreManifest,
    pageTypes: new Set(fashionStoreEnabledPageContracts.map(({ pageType }) => pageType)),
    templates: fashionStorePreset.templates,
  },
} as const satisfies Record<string, PreviewThemeDescriptor>;

type PreviewThemeId = keyof typeof previewThemeDescriptors;

export async function themePreviewBuildInput(
  themeId: PreviewThemeId,
  expectedOrigin: string,
): Promise<Extract<ExperienceBuildInput, { environment: "preview" }>> {
  const descriptor = previewThemeDescriptors[themeId];
  const fixture = previewFixtureSchema.parse(
    JSON.parse(await readFile(resolve(import.meta.dir, descriptor.fixturePath), "utf8")),
  );
  let catalogRelease = canonicalCatalogReleaseSchema.parse(
    JSON.parse(await readFile(resolve(import.meta.dir, "../fixtures/release.json"), "utf8")),
  );
  if (
    themeId === "fashion-store" &&
    process.env.STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG === "1"
  ) {
    const catalog = await loadFashionStoreLiveCatalog({
      manifestPath: "tools/fashion-store-product-content-catalog.json",
      repositoryRoot: resolve(import.meta.dir, "../../.."),
    });
    const release = createFashionStoreLiveCatalogMigrationPlan(catalog, {
      expectedIamFingerprint: "0".repeat(64),
      mediaPublicOrigin: "https://pub-4e1c398c57fa4b9f9781bc1abcb507a5.r2.dev",
      storefrontOrigin: expectedOrigin,
    }).shopperRelease;
    catalogRelease = canonicalCatalogReleaseSchema.parse({
      ...release,
      products: release.products.map((product) => {
        const manifestProduct = catalog.products.find(({ id }) => id === product.id);
        if (!manifestProduct) throw new Error(`Missing preview Product ${product.id}`);
        return {
          ...product,
          media: product.media.map((item, index) => {
            const sourcePath = manifestProduct.media[index]?.sourcePath;
            return sourcePath?.startsWith("apps/storefront/public/")
              ? { ...item, src: `/${sourcePath.slice("apps/storefront/public/".length)}` }
              : item;
          }),
        };
      }),
    });
  }
  if (themeId === "fashion-store" && process.env.STOREFRONT_FASHION_DEMO_REVIEWS === "1") {
    const displays = await fashionStoreDemoReviewDisplays();
    catalogRelease = canonicalCatalogReleaseSchema.parse({
      ...catalogRelease,
      products: catalogRelease.products.map((product) => {
        const reviewDisplay = displays.get(product.slug);
        return reviewDisplay && product.presentation
          ? { ...product, presentation: { ...product.presentation, reviewDisplay } }
          : product;
      }),
    });
  }
  const fixtureInput = {
    catalogRelease,
    environment: "preview" as const,
    expectedOrigin,
    snapshot: {
      approvedAt: fixture.approvedAt,
      approvedBy: fixture.approvedBy,
      bindings: fixture.bindings,
      configurationSchemaVersion: descriptor.manifest.configurationSchemaVersion,
      experienceId: fixture.experienceId,
      id: fixture.snapshotId,
      kind: "approved",
      overrides: [],
      platformContractVersion: descriptor.manifest.platformContractVersion,
      provenance: descriptor.manifest.provenance,
      resolvedTemplates: descriptor.templates
        .filter(({ pageType }) => descriptor.pageTypes.has(pageType))
        .map((template) =>
          template.pageType === "product"
            ? {
                ...template,
                sections: template.sections.map((section) => ({
                  ...section,
                  settings: {
                    ...section.settings,
                    ...(fixture.productDeliverySummary
                      ? { "delivery-summary": fixture.productDeliverySummary }
                      : {}),
                    ...(fixture.productShippingReturnsSummary
                      ? { "shipping-returns-summary": fixture.productShippingReturnsSummary }
                      : {}),
                    ...Object.fromEntries(
                      fixture.productPaymentBrands.map((brand) => [`payment-brand-${brand}`, true]),
                    ),
                  },
                })),
              }
            : template,
        ),
      themeId: descriptor.manifest.id,
      themeVersion: descriptor.manifest.themeVersion,
      version: fixture.version,
    },
    themeId: descriptor.manifest.id,
  };
  if (
    themeId === "fashion-store" &&
    process.env.STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG === "1"
  ) {
    const collection = catalogRelease.collections.find(({ status }) => status === "published");
    const product = catalogRelease.products.find(({ slug }) => slug === "relaxed-corduroy-shirt");
    if (!collection || !product)
      throw new Error(
        "Product content preview requires its published collection and lead Product.",
      );
    const liveSnapshot = {
      ...fixtureInput.snapshot,
      bindings: [
        {
          id: "fashion-store-product-content-home-binding",
          instanceId: "fashion-store-home",
          kind: "catalog" as const,
          reference: { id: collection.id, kind: "collection" as const },
          settingId: "featured-collection",
        },
        {
          id: "fashion-store-product-content-collection-binding",
          instanceId: "fashion-store-collection",
          kind: "catalog" as const,
          reference: { id: collection.id, kind: "collection" as const },
          settingId: "fashion-store-live-collection-resource",
        },
        {
          id: "fashion-store-product-content-product-binding",
          instanceId: "fashion-store-product",
          kind: "catalog" as const,
          reference: { id: product.id, kind: "product" as const },
          settingId: "fashion-store-live-product-resource",
        },
      ],
    };
    return {
      ...fixtureInput,
      inputIdentity: {
        catalogReleaseId: catalogRelease.releaseId,
        experienceSnapshotId: liveSnapshot.id,
        experienceVersion: liveSnapshot.version,
        platformContractVersion: liveSnapshot.platformContractVersion,
        themeId: liveSnapshot.themeId,
        themeVersion: liveSnapshot.themeVersion,
      },
      mediaOrigins: ["https://pub-4e1c398c57fa4b9f9781bc1abcb507a5.r2.dev"],
      presentationMode: "live",
      snapshot: liveSnapshot,
    };
  }
  return fixtureInput;
}

export const fashionStorePreviewBuildInput = (expectedOrigin: string) =>
  themePreviewBuildInput("fashion-store", expectedOrigin);

async function main(): Promise<void> {
  const themeId = process.argv[2];
  if (!themeId || !(themeId in previewThemeDescriptors)) {
    throw new Error(`Unknown fixture theme ${themeId ?? "(missing)"}.`);
  }
  const outputPath = resolve(
    import.meta.dir,
    `../fixtures/experience/.generated/${themeId}-preview-input.json`,
  );
  const input = await themePreviewBuildInput(
    themeId as PreviewThemeId,
    "https://preview.example.test",
  );
  if (themeId === "fashion-store") {
    const profile = parseFashionStoreHomeDevelopmentProfile(
      process.env.STOREFRONT_FASHION_HOME_PROFILE,
    );
    const home = input.snapshot.resolvedTemplates.find(({ pageType }) => pageType === "home");
    if (!home) throw new Error("Fashion preview requires a Home template.");
    applyFashionStoreHomeComposition(home, profile.composition);
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`);
  console.log(`Prepared ${themeId} preview fixture at ${outputPath}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
