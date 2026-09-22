import {
  publishedProductRevisionContentSchema,
  type PublishedProductRevisionContent,
} from "../apps/api/src/catalog/schemas";
import {
  validateFashionStoreLiveCatalog,
  type FashionStoreLiveCatalog,
  type FashionStoreLiveCatalogMedia,
  type FashionStoreLiveCatalogVariant,
} from "./prepare-fashion-store-live-catalog";

interface AddedVariant {
  readonly productId: string;
  readonly referenceVariantId: string;
  readonly variant: FashionStoreLiveCatalogVariant;
}

interface AddedMedia {
  readonly media: FashionStoreLiveCatalogMedia;
  readonly productId: string;
}

export interface FashionStoreProductContentMigrationPlan {
  readonly addedMedia: readonly AddedMedia[];
  readonly addedVariants: readonly AddedVariant[];
  readonly expected: {
    readonly mediaCount: number;
    readonly productCount: number;
    readonly variantCount: number;
  };
  readonly predecessorCatalogVersion: string;
  readonly currency: string;
  readonly preservedProducts: readonly { id: string; slug: string; status: "published" }[];
  readonly preservedVariants: readonly {
    id: string;
    productId: string;
    sku: string;
    status: "active";
  }[];
  readonly removedMediaIds: readonly string[];
  readonly revisions: readonly {
    readonly content: PublishedProductRevisionContent;
    readonly productId: string;
  }[];
  readonly successorCatalogVersion: string;
  readonly warehouseId: string;
}

export interface FashionStoreProductContentMigrationSqlOptions {
  readonly actorId: string;
  readonly createdAt: string;
  readonly requestId: string;
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid Fashion Store Product content migration: ${message}`);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sql(value: string | number): string {
  return typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
}

function sqlList(values: readonly string[]): string {
  return values.map(sql).join(", ");
}

export function buildFashionStoreProductContentMigrationPlan(
  rawPredecessor: unknown,
  rawSuccessor: unknown,
): FashionStoreProductContentMigrationPlan {
  const predecessor = validateFashionStoreLiveCatalog(rawPredecessor as FashionStoreLiveCatalog);
  const successor = validateFashionStoreLiveCatalog(rawSuccessor as FashionStoreLiveCatalog);
  invariant(
    predecessor.catalogVersion !== successor.catalogVersion,
    "successor must use a new catalog version",
  );
  invariant(
    successor.currency === predecessor.currency &&
      successor.warehouse.id === predecessor.warehouse.id,
    "successor must preserve Commerce currency and warehouse authority",
  );

  const predecessorProducts = new Map(predecessor.products.map((product) => [product.id, product]));
  const successorProducts = new Map(successor.products.map((product) => [product.id, product]));
  invariant(
    predecessorProducts.size === successorProducts.size &&
      [...predecessorProducts.keys()].every((id) => successorProducts.has(id)),
    "successor must preserve the exact Product IDs",
  );
  for (const product of predecessor.products) {
    invariant(
      successorProducts.get(product.id)?.slug === product.slug,
      `successor must preserve Product slug ${product.slug}`,
    );
  }

  const predecessorVariants = new Map(
    predecessor.products.flatMap((product) =>
      product.variants.map((variant) => [variant.id, { productId: product.id, variant }] as const),
    ),
  );
  const successorVariants = new Map(
    successor.products.flatMap((product) =>
      product.variants.map((variant) => [variant.id, { productId: product.id, variant }] as const),
    ),
  );
  for (const [id, previous] of predecessorVariants) {
    const next = successorVariants.get(id);
    invariant(next, `successor removed historical Variant ${id}`);
    invariant(
      next.productId === previous.productId &&
        next.variant.sku === previous.variant.sku &&
        sameJson(next.variant.price, previous.variant.price) &&
        sameJson(next.variant.inventory, previous.variant.inventory) &&
        next.variant.weightGrams === previous.variant.weightGrams,
      `successor rewrote historical Variant ${id}`,
    );
  }

  const addedVariants = [...successorVariants]
    .filter(([id]) => !predecessorVariants.has(id))
    .map(([, entry]) => {
      const referenceVariantId = predecessor.products.find(({ id }) => id === entry.productId)
        ?.variants[0]?.id;
      invariant(
        referenceVariantId,
        `new Variant for ${entry.productId} has no historical reference`,
      );
      return { ...entry, referenceVariantId };
    });

  const predecessorMedia = new Map(
    predecessor.products.flatMap((product) =>
      product.media.map((media) => [media.id, { media, productId: product.id }] as const),
    ),
  );
  const successorMedia = new Map(
    successor.products.flatMap((product) =>
      product.media.map((media) => [media.id, { media, productId: product.id }] as const),
    ),
  );
  for (const [id, previous] of predecessorMedia) {
    const next = successorMedia.get(id);
    if (!next) continue;
    invariant(
      next.productId === previous.productId &&
        next.media.r2Key === previous.media.r2Key &&
        next.media.sha256 === previous.media.sha256 &&
        next.media.width === previous.media.width &&
        next.media.height === previous.media.height,
      `successor rewrote historical media ${id}`,
    );
  }
  const addedMedia = [...successorMedia]
    .filter(([id]) => !predecessorMedia.has(id))
    .map(([, entry]) => {
      invariant(
        entry.media.r2Key.startsWith(`catalog/products/${entry.productId}/`),
        `new media ${entry.media.id} must use its Product-owned R2 prefix`,
      );
      return entry;
    });

  const revisions = successor.products.map((product) => ({
    content: publishedProductRevisionContentSchema.parse({
      description: product.description,
      media: product.media.map((media) => ({
        altText: media.alt,
        height: media.height,
        id: media.id,
        r2Key: media.r2Key,
        width: media.width,
      })),
      name: product.name,
      optionDefinitions: product.optionDefinitions,
      presentation: product.presentation ?? null,
      seoDescription: product.description.slice(0, 320),
      seoTitle: `${product.name} | Shoppp`.slice(0, 70),
      variantOptions: product.variants.map((variant) => ({
        id: variant.id,
        optionValues: variant.optionValues,
        title: variant.title,
      })),
    }),
    productId: product.id,
  }));

  return {
    addedMedia,
    addedVariants,
    expected: {
      mediaCount: successorMedia.size,
      productCount: successorProducts.size,
      variantCount: successorVariants.size,
    },
    currency: predecessor.currency,
    predecessorCatalogVersion: predecessor.catalogVersion,
    preservedProducts: predecessor.products.map(({ id, slug, status }) => ({ id, slug, status })),
    preservedVariants: predecessor.products.flatMap((product) =>
      product.variants.map(({ id, sku, status }) => ({
        id,
        productId: product.id,
        sku,
        status,
      })),
    ),
    removedMediaIds: [...predecessorMedia.keys()].filter((id) => !successorMedia.has(id)),
    revisions,
    successorCatalogVersion: successor.catalogVersion,
    warehouseId: predecessor.warehouse.id,
  };
}

export interface FashionStoreProductContentD1Batch<TStatement> {
  batch(statements: TStatement[]): Promise<unknown>;
  prepare(query: string): TStatement;
}

function exactProductPredicate(plan: FashionStoreProductContentMigrationPlan): string {
  return plan.preservedProducts
    .map(
      (product) =>
        `(id = ${sql(product.id)} AND slug = ${sql(product.slug)} AND status = ${sql(product.status)})`,
    )
    .join(" OR ");
}

function exactVariantPredicate(plan: FashionStoreProductContentMigrationPlan): string {
  return plan.preservedVariants
    .map(
      (variant) =>
        `(id = ${sql(variant.id)} AND product_id = ${sql(variant.productId)} AND sku = ${sql(variant.sku)} AND status = ${sql(variant.status)})`,
    )
    .join(" OR ");
}

export function buildFashionStoreProductContentMigrationStatements(
  plan: FashionStoreProductContentMigrationPlan,
  options: FashionStoreProductContentMigrationSqlOptions,
): string[] {
  invariant(plan.addedVariants.length > 0, "migration requires at least one additive Variant");
  invariant(options.actorId.trim(), "actor ID is required");
  invariant(options.requestId.trim(), "request ID is required");
  const productIds = plan.preservedProducts.map(({ id }) => id);
  const variantIds = plan.preservedVariants.map(({ id }) => id);
  const addedVariantIds = plan.addedVariants.map(({ variant }) => variant.id);
  const guard = `_fashion_product_content_guard_${options.requestId.replaceAll(
    /[^A-Za-z0-9]/g,
    "_",
  )}`;
  const lines = [
    "PRAGMA foreign_keys = ON",
    `CREATE TEMP TABLE ${guard} (invalid_count INTEGER NOT NULL CHECK (invalid_count = 0))`,
    `INSERT INTO ${guard} SELECT ABS(COUNT(*) - ${plan.expected.productCount}) FROM products WHERE ${exactProductPredicate(plan)}`,
    `INSERT INTO ${guard} SELECT ABS(COUNT(*) - ${variantIds.length}) FROM product_variants WHERE ${exactVariantPredicate(plan)}`,
    `INSERT INTO ${guard} SELECT COUNT(*) FROM product_variants WHERE product_id IN (${sqlList(productIds)}) AND id NOT IN (${sqlList(variantIds)})`,
  ];

  for (const { referenceVariantId, variant } of plan.addedVariants) {
    lines.push(
      `INSERT INTO ${guard} SELECT ABS(COUNT(*) - 1) FROM prices p JOIN price_lists pl ON pl.id = p.price_list_id WHERE p.variant_id = ${sql(referenceVariantId)} AND p.amount = ${variant.price.amount} AND p.compare_at_amount = ${variant.price.compareAtAmount} AND pl.currency = ${sql(plan.currency)} AND pl.status = 'active' AND (pl.starts_at IS NULL OR pl.starts_at <= ${sql(options.createdAt)}) AND (pl.ends_at IS NULL OR pl.ends_at > ${sql(options.createdAt)})`,
      `INSERT INTO ${guard} SELECT ABS(COUNT(*) - 1) FROM inventory_items WHERE variant_id = ${sql(referenceVariantId)} AND warehouse_id = ${sql(plan.warehouseId)}`,
    );
  }

  for (const { productId, variant } of plan.addedVariants) {
    lines.push(
      `INSERT INTO ${guard} SELECT COUNT(*) FROM product_variants WHERE id = ${sql(variant.id)} OR sku = ${sql(variant.sku)}`,
      `INSERT INTO product_variants (id, product_id, sku, title, option_values_json, weight_grams, length_mm, width_mm, height_mm, status, created_at, updated_at) VALUES (${[
        variant.id,
        productId,
        variant.sku,
        variant.title,
        JSON.stringify(variant.optionValues),
        variant.weightGrams ?? 0,
        0,
        0,
        0,
        variant.status,
        options.createdAt,
        options.createdAt,
      ]
        .map(sql)
        .join(", ")})`,
    );
  }
  for (const { referenceVariantId, variant } of plan.addedVariants) {
    lines.push(
      `INSERT INTO prices (id, price_list_id, variant_id, amount, compare_at_amount, created_at, updated_at) SELECT ${sql(`price_${variant.id}`)}, p.price_list_id, ${sql(variant.id)}, ${variant.price.amount}, ${variant.price.compareAtAmount}, ${sql(options.createdAt)}, ${sql(options.createdAt)} FROM prices p JOIN price_lists pl ON pl.id = p.price_list_id WHERE p.variant_id = ${sql(referenceVariantId)} AND p.amount = ${variant.price.amount} AND p.compare_at_amount = ${variant.price.compareAtAmount} AND pl.currency = ${sql(plan.currency)} AND pl.status = 'active' AND (pl.starts_at IS NULL OR pl.starts_at <= ${sql(options.createdAt)}) AND (pl.ends_at IS NULL OR pl.ends_at > ${sql(options.createdAt)}) ORDER BY pl.code LIMIT 1`,
      `INSERT INTO inventory_items (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, backordered_quantity, oversell_limit, version, updated_at) SELECT ${sql(variant.id)}, warehouse_id, ${variant.inventory.onHand}, 0, 0, ${variant.inventory.oversellLimit}, 0, ${sql(options.createdAt)} FROM inventory_items WHERE variant_id = ${sql(referenceVariantId)} AND warehouse_id = ${sql(plan.warehouseId)}`,
    );
  }

  lines.push(
    `INSERT INTO ${guard} SELECT ABS(COUNT(*) - ${plan.expected.variantCount}) FROM product_variants WHERE product_id IN (${sqlList(productIds)}) AND status = 'active'`,
    `INSERT INTO ${guard} SELECT ABS(COUNT(*) - ${addedVariantIds.length}) FROM prices p JOIN price_lists pl ON pl.id = p.price_list_id WHERE p.variant_id IN (${sqlList(addedVariantIds)}) AND pl.currency = ${sql(plan.currency)} AND pl.status = 'active'`,
    `INSERT INTO ${guard} SELECT ABS(COUNT(*) - ${addedVariantIds.length}) FROM inventory_items WHERE variant_id IN (${sqlList(addedVariantIds)}) AND warehouse_id = ${sql(plan.warehouseId)}`,
    `INSERT INTO audit_events (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at) VALUES (${[
      `audit_${options.requestId}`,
      "machine",
      options.actorId,
      "catalog.product-content.migrate",
      "catalog_version",
      plan.successorCatalogVersion,
      "succeeded",
      "Prepare additive Fashion Store Product content migration",
      options.requestId,
      JSON.stringify({
        addedMediaCount: plan.addedMedia.length,
        addedVariantCount: plan.addedVariants.length,
        predecessorCatalogVersion: plan.predecessorCatalogVersion,
        successorCatalogVersion: plan.successorCatalogVersion,
      }),
      options.createdAt,
    ]
      .map(sql)
      .join(", ")})`,
    `DROP TABLE ${guard}`,
  );
  return lines;
}

export function buildFashionStoreProductContentMigrationSql(
  plan: FashionStoreProductContentMigrationPlan,
  options: FashionStoreProductContentMigrationSqlOptions,
): string {
  return `${buildFashionStoreProductContentMigrationStatements(plan, options).join(";\n")};\n`;
}

export async function applyFashionStoreProductContentMigration<TStatement>(
  database: FashionStoreProductContentD1Batch<TStatement>,
  plan: FashionStoreProductContentMigrationPlan,
  options: FashionStoreProductContentMigrationSqlOptions,
): Promise<void> {
  const statements = buildFashionStoreProductContentMigrationStatements(plan, options).map(
    (statement) => database.prepare(statement),
  );
  await database.batch(statements);
}
