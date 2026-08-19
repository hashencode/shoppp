import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalCatalogReleaseSchema,
  catalogReleaseDigestInput,
  storefrontExperienceDraftInputSchema,
  type CanonicalCatalogRelease,
} from "../packages/contracts/src";

import fashionStoreFixture from "../apps/storefront/fixtures/experience/fashion-store.json";
import releaseFixture from "../apps/storefront/fixtures/release.json";

const CREATED_AT = "2026-08-18T00:00:00.000Z";
const CATALOG_RELEASE_ID = "fashion-staging-u12-release-2026-08-18";
const COLLECTION_ID = "col_01JFASHIONLIVE0000000001";
const WAREHOUSE_ID = "warehouse_fashion_staging";
const PRICE_LIST_ID = "price_list_fashion_staging_usd";

const PRODUCT_IDS = {
  multi: "prod_01JFASHIONLIVE0000000002",
  single: "prod_01JFASHIONLIVE0000000001",
  unavailable: "prod_01JFASHIONLIVE0000000003",
} as const;

const UNAVAILABLE_VARIANT_ID = "var_01JFASHIONUNAVAILABLE00001";

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function catalogRelease(): CanonicalCatalogRelease {
  const baseProducts = releaseFixture.products.map((product, index) => ({
    ...product,
    collectionIds: [COLLECTION_ID],
    id: index === 0 ? PRODUCT_IDS.single : PRODUCT_IDS.multi,
    media: product.media.map((media) => ({ ...media, src: "/media/atlas-carry-on.svg" })),
  }));
  const unavailable = {
    collectionIds: [COLLECTION_ID],
    collectionSlugs: ["travel-essentials"],
    description: "A deliberately unavailable Fashion archetype for sold-out behavior proof.",
    id: PRODUCT_IDS.unavailable,
    media: [
      {
        alt: "Unavailable Fashion staging archetype",
        height: 1200,
        src: "/media/atlas-carry-on.svg",
        width: 1200,
      },
    ],
    name: "Archive weekender",
    seoDescription: "A deliberately unavailable Fashion staging product.",
    seoTitle: "Archive weekender | Shoppp",
    slug: "archive-weekender",
    status: "published" as const,
    variants: [
      {
        id: UNAVAILABLE_VARIANT_ID,
        optionValues: { color: "Archive" },
        prices: [{ amount: 8900, currency: "USD" }],
        sku: "FASHION-U12-UNAVAILABLE",
        status: "active" as const,
        title: "Archive",
        weightGrams: 900,
      },
    ],
  };
  const products = [...baseProducts, unavailable];
  return canonicalCatalogReleaseSchema.parse({
    ...releaseFixture,
    collections: releaseFixture.collections.map((collection) => ({
      ...collection,
      id: COLLECTION_ID,
      productIds: products.map(({ id }) => id),
      productSlugs: products.map(({ slug }) => slug),
    })),
    generatedAt: CREATED_AT,
    products,
    redirects: releaseFixture.redirects.map((redirect) => ({ ...redirect, status: 301 })),
    releaseId: CATALOG_RELEASE_ID,
    routes: [
      "/",
      ...releaseFixture.collections.map(({ slug }) => `/collections/${slug}`),
      ...releaseFixture.policies.map(({ slug }) => `/policies/${slug}`),
      ...products.map(({ slug }) => `/products/${slug}`),
    ],
    schemaVersion: 2,
    site: {
      ...releaseFixture.site,
      origin: "https://shoppp-storefront-fashion-preview.hashencode.workers.dev",
    },
  });
}

function productStatements(release: CanonicalCatalogRelease): string[] {
  return release.products.flatMap((product) => {
    const productInsert = `INSERT OR IGNORE INTO products (id, slug, name, description, status, seo_title, seo_description, published_at, created_at, updated_at) VALUES (${[
      product.id,
      product.slug,
      product.name,
      product.description,
      product.status,
      product.seoTitle,
      product.seoDescription,
      CREATED_AT,
      CREATED_AT,
      CREATED_AT,
    ]
      .map(sql)
      .join(", ")});`;
    const variants = product.variants.flatMap((variant) => {
      const amount = variant.prices.find(({ currency }) => currency === "USD")?.amount;
      if (amount === undefined) throw new Error(`${variant.id} has no USD price`);
      const onHand =
        product.id === PRODUCT_IDS.unavailable ? 0 : product.id === PRODUCT_IDS.single ? 100 : 20;
      return [
        `INSERT OR IGNORE INTO product_variants (id, product_id, sku, title, option_values_json, weight_grams, status, created_at, updated_at) VALUES (${[
          variant.id,
          product.id,
          variant.sku,
          variant.title,
          JSON.stringify(variant.optionValues),
          String(variant.weightGrams),
          variant.status,
          CREATED_AT,
          CREATED_AT,
        ]
          .map(sql)
          .join(", ")});`,
        `INSERT OR IGNORE INTO prices (id, price_list_id, variant_id, amount, created_at, updated_at) VALUES (${[
          `price_${variant.id}`,
          PRICE_LIST_ID,
          variant.id,
          String(amount),
          CREATED_AT,
          CREATED_AT,
        ]
          .map(sql)
          .join(", ")});`,
        `INSERT OR IGNORE INTO inventory_items (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, oversell_limit, version, updated_at) VALUES (${[
          variant.id,
          WAREHOUSE_ID,
          String(onHand),
          "0",
          "0",
          "0",
          CREATED_AT,
        ]
          .map(sql)
          .join(", ")});`,
      ];
    });
    return [productInsert, ...variants];
  });
}

function seedSql(release: CanonicalCatalogRelease): string {
  return [
    "PRAGMA foreign_keys = ON;",
    `INSERT OR IGNORE INTO price_lists (id, code, currency, status, created_at, updated_at) VALUES (${[
      PRICE_LIST_ID,
      "FASHION-STAGING-USD",
      "USD",
      "active",
      CREATED_AT,
      CREATED_AT,
    ]
      .map(sql)
      .join(", ")});`,
    `INSERT OR IGNORE INTO warehouses (id, code, name, created_at) VALUES (${[
      WAREHOUSE_ID,
      "FASHION-STAGING",
      "Fashion staging acceptance warehouse",
      CREATED_AT,
    ]
      .map(sql)
      .join(", ")});`,
    ...productStatements(release),
    `INSERT INTO catalog_releases (id, status, manifest_json, approved_at, deployed_at, created_at, updated_at) VALUES (${[
      release.releaseId,
      "deployed",
      JSON.stringify(release),
      CREATED_AT,
      CREATED_AT,
      CREATED_AT,
      CREATED_AT,
    ]
      .map(sql)
      .join(", ")});`,
    "",
  ].join("\n");
}

function preflightSql(release: CanonicalCatalogRelease): string {
  const productIds = release.products.map(({ id }) => sql(id)).join(", ");
  const variants = release.products.flatMap((product) =>
    product.variants.map((variant) => ({ product, variant })),
  );
  const variantIds = variants.map(({ variant }) => sql(variant.id)).join(", ");
  const productIdentity = release.products
    .map(
      (product) =>
        `(id = ${sql(product.id)} AND slug = ${sql(product.slug)} AND name = ${sql(product.name)} AND status = ${sql(product.status)})`,
    )
    .join("\n      OR ");
  const variantIdentity = variants
    .map(
      ({ product, variant }) =>
        `(id = ${sql(variant.id)} AND product_id = ${sql(product.id)} AND sku = ${sql(variant.sku)} AND title = ${sql(variant.title)} AND option_values_json = ${sql(JSON.stringify(variant.optionValues))} AND status = ${sql(variant.status)})`,
    )
    .join("\n      OR ");
  const priceIdentity = variants
    .map(({ variant }) => {
      const amount = variant.prices.find(({ currency }) => currency === "USD")?.amount;
      if (amount === undefined) throw new Error(`${variant.id} has no USD price`);
      return `(id = ${sql(`price_${variant.id}`)} AND price_list_id = ${sql(PRICE_LIST_ID)} AND variant_id = ${sql(variant.id)} AND amount = ${amount})`;
    })
    .join("\n      OR ");
  const inventoryIdentity = variants
    .map(({ product, variant }) => {
      const onHand =
        product.id === PRODUCT_IDS.unavailable ? 0 : product.id === PRODUCT_IDS.single ? 100 : 20;
      return `(variant_id = ${sql(variant.id)} AND warehouse_id = ${sql(WAREHOUSE_ID)} AND on_hand_quantity = ${onHand} AND reserved_quantity = 0 AND backordered_quantity = 0 AND oversell_limit = 0)`;
    })
    .join("\n      OR ");
  return `SELECT
  (SELECT COUNT(*) FROM catalog_releases WHERE id = ${sql(release.releaseId)})
  + (SELECT COUNT(*) FROM products WHERE id IN (${productIds}) AND NOT (
      ${productIdentity}
    ))
  + (SELECT COUNT(*) FROM product_variants WHERE id IN (${variantIds}) AND NOT (
      ${variantIdentity}
    ))
  + (SELECT COUNT(*) FROM prices WHERE id IN (${variants.map(({ variant }) => sql(`price_${variant.id}`)).join(", ")}) AND NOT (
      ${priceIdentity}
    ))
  + (SELECT COUNT(*) FROM inventory_items WHERE variant_id IN (${variantIds}) AND NOT (
      ${inventoryIdentity}
    ))
  + (SELECT COUNT(*) FROM warehouses WHERE id = ${sql(WAREHOUSE_ID)} AND code <> 'FASHION-STAGING')
  + (SELECT COUNT(*) FROM price_lists WHERE id = ${sql(PRICE_LIST_ID)} AND (currency <> 'USD' OR status <> 'active'))
  AS conflict_count;
`;
}

function verificationSql(release: CanonicalCatalogRelease): string {
  return `SELECT
  (SELECT COUNT(*) FROM products WHERE id IN (${release.products.map(({ id }) => sql(id)).join(", ")})) AS product_count,
  (SELECT COUNT(*) FROM product_variants WHERE product_id = ${sql(PRODUCT_IDS.single)}) AS single_variant_count,
  (SELECT COUNT(*) FROM inventory_items i JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ${sql(PRODUCT_IDS.single)} AND i.on_hand_quantity + i.oversell_limit - i.reserved_quantity - i.backordered_quantity > 0) AS single_available_count,
  (SELECT COUNT(*) FROM product_variants WHERE product_id = ${sql(PRODUCT_IDS.multi)}) AS multi_variant_count,
  (SELECT COUNT(*) FROM inventory_items i JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ${sql(PRODUCT_IDS.multi)} AND i.on_hand_quantity + i.oversell_limit - i.reserved_quantity - i.backordered_quantity > 0) AS multi_available_count,
  (SELECT COUNT(*) FROM inventory_items i JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ${sql(PRODUCT_IDS.unavailable)} AND i.on_hand_quantity + i.oversell_limit - i.reserved_quantity - i.backordered_quantity > 0) AS unavailable_sellable_count,
  (SELECT COUNT(*) FROM catalog_releases WHERE id = ${sql(release.releaseId)} AND status = 'deployed' AND manifest_json = ${sql(JSON.stringify(release))}) AS immutable_catalog_count,
  (SELECT COUNT(*) FROM storefront_experience_snapshots WHERE kind = 'approved' AND source_validation_id IN (SELECT id FROM storefront_experience_validations WHERE catalog_release_id = ${sql(release.releaseId)} AND status = 'valid')) AS approved_snapshot_count,
  (SELECT COUNT(*) FROM storefront_preview_builds WHERE catalog_release_id = ${sql(release.releaseId)} AND status = 'building') AS building_build_count;
`;
}

export interface FashionStagingU12SeedPlan {
  catalogRelease: CanonicalCatalogRelease;
  canonicalCatalogDigest: string;
  experience: {
    approvePathTemplate: string;
    buildPathTemplate: string;
    createBody: unknown;
    createPath: string;
    validatePathTemplate: string;
  };
  expectedVariables: Record<string, string>;
  preflightSql: string;
  seedManifestDigest: string;
  seedSql: string;
  verifySql: string;
}

export function createFashionStagingU12SeedPlan(): FashionStagingU12SeedPlan {
  const release = catalogRelease();
  const draft = storefrontExperienceDraftInputSchema.parse({
    bindings: [
      ...fashionStoreFixture.bindings,
      {
        id: "catalog-fashion-store-home-featured-collection",
        instanceId: "fashion-store-home",
        kind: "catalog",
        reference: { id: COLLECTION_ID, kind: "collection" },
        settingId: "featured-collection",
      },
      {
        id: "catalog-fashion-store-collection-default-collection",
        instanceId: "fashion-store-collection",
        kind: "catalog",
        reference: { id: COLLECTION_ID, kind: "collection" },
        settingId: "default-collection",
      },
    ],
    experienceId: "experience-fashion-staging-u12",
    overrides: [],
    presetId: "source-parity",
    themeId: "fashion-store",
    themeVersion: "1.0.0",
  });
  const seedIdentity = JSON.stringify({
    catalogReleaseId: release.releaseId,
    products: release.products.map((product) => ({
      id: product.id,
      variants: product.variants.map(({ id }) => id),
    })),
    warehouseId: WAREHOUSE_ID,
  });
  return {
    canonicalCatalogDigest: sha256(catalogReleaseDigestInput(release)),
    catalogRelease: release,
    experience: {
      approvePathTemplate: "/admin/storefront-experiences/drafts/{draftId}/approve",
      buildPathTemplate: "/admin/storefront-experiences/snapshots/{snapshotId}/build",
      createBody: { draft, reason: "Create the immutable Fashion staging U12 experience input" },
      createPath: "/admin/storefront-experiences/drafts",
      validatePathTemplate: "/admin/storefront-experiences/drafts/{draftId}/validate",
    },
    expectedVariables: {
      FASHION_U12_MULTI_VARIANT_PRODUCT_ID: PRODUCT_IDS.multi,
      FASHION_U12_OPTION_VALUES: JSON.stringify(["Gold", "S"]),
      FASHION_U12_PRODUCT_NAME: "Atlas Carry-on",
      FASHION_U12_PRODUCT_SLUG: "atlas-carry-on",
      FASHION_U12_SINGLE_VARIANT_PRODUCT_ID: PRODUCT_IDS.single,
      FASHION_U12_UNAVAILABLE_PRODUCT_ID: PRODUCT_IDS.unavailable,
      FASHION_U12_WAREHOUSE_ID: WAREHOUSE_ID,
      FASHION_U13_PRODUCT_ID: PRODUCT_IDS.single,
      FASHION_U13_VARIANT_ID: release.products[0]!.variants[0]!.id,
    },
    preflightSql: preflightSql(release),
    seedManifestDigest: sha256(seedIdentity),
    seedSql: seedSql(release),
    verifySql: verificationSql(release),
  };
}

if (import.meta.main) {
  const outputArgument = process.argv.slice(2).find((value) => value.startsWith("--output-dir="));
  if (!outputArgument) throw new Error("Use --output-dir=<local-path>");
  const outputDirectory = resolve(outputArgument.slice("--output-dir=".length));
  const plan = createFashionStagingU12SeedPlan();
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(outputDirectory, "catalog-release.json"),
      `${JSON.stringify(plan.catalogRelease, null, 2)}\n`,
    ),
    writeFile(
      resolve(outputDirectory, "experience-plan.json"),
      `${JSON.stringify(plan.experience, null, 2)}\n`,
    ),
    writeFile(
      resolve(outputDirectory, "expected-variables.json"),
      `${JSON.stringify(plan.expectedVariables, null, 2)}\n`,
    ),
    writeFile(resolve(outputDirectory, "preflight.sql"), plan.preflightSql),
    writeFile(resolve(outputDirectory, "seed.sql"), plan.seedSql),
    writeFile(resolve(outputDirectory, "verify.sql"), plan.verifySql),
    writeFile(
      resolve(outputDirectory, "seed-receipt.json"),
      `${JSON.stringify(
        {
          canonicalCatalogDigest: plan.canonicalCatalogDigest,
          catalogReleaseId: plan.catalogRelease.releaseId,
          seedManifestDigest: plan.seedManifestDigest,
        },
        null,
        2,
      )}\n`,
    ),
  ]);
  console.log(JSON.stringify({ outputDirectory, seedManifestDigest: plan.seedManifestDigest }));
}
