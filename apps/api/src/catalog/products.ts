import type { Context } from "hono";
import {
  deriveTextProductOptionDefinitions,
  productOptionDefinitionsSchema,
  productPresentationSchema,
  validateProductOptionDefinitions,
} from "@shoppp/contracts";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareConditionalAuditEvent, recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import type { ProductDraftInput } from "./schemas";
import type { ProductOptionDefinitionsInput } from "./schemas";
import type { ProductPresentationInput } from "./schemas";

type CatalogContext = Context<ApiEnvironment>;

interface ProductRow {
  created_at: string;
  description: string;
  id: string;
  name: string;
  option_definitions_json: string;
  presentation_json: string | null;
  published_at: string | null;
  seo_description: string;
  seo_title: string;
  slug: string;
  status: string;
  updated_at: string;
  version: number;
}

export async function listProducts(context: CatalogContext) {
  const query = context.req.query("query")?.trim() ?? "";
  const status = context.req.query("status")?.trim() ?? "";
  const page = Math.max(Number.parseInt(context.req.query("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number.parseInt(context.req.query("pageSize") ?? "20", 10) || 20, 1),
    100,
  );
  const where: string[] = [];
  const bindings: unknown[] = [];
  if (query) {
    where.push("(name LIKE ? OR slug LIKE ?)");
    bindings.push(`%${query}%`, `%${query}%`);
  }
  if (status) {
    where.push("status = ?");
    bindings.push(status);
  }
  const predicate = where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "";
  const count = await context.env.DB.prepare(`SELECT COUNT(*) AS total FROM products${predicate}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const rows = await context.env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.status, p.scheduled_at, p.updated_at, p.version,
            (SELECT cr.status FROM catalog_releases cr WHERE cr.product_id = p.id ORDER BY cr.created_at DESC LIMIT 1) AS build_status,
            (SELECT cr.build_correlation_id FROM catalog_releases cr WHERE cr.product_id = p.id ORDER BY cr.created_at DESC LIMIT 1) AS build_correlation_id
       FROM products p${predicate
         .replaceAll("name", "p.name")
         .replaceAll("slug", "p.slug")
         .replaceAll("status", "p.status")}
      ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?`,
  )
    .bind(...bindings, pageSize, (page - 1) * pageSize)
    .all();
  return {
    data: rows.results,
    meta: {
      page,
      pageSize,
      requestId: context.get("requestId"),
      total: count?.total ?? 0,
    },
  };
}

export async function getProduct(db: D1Database, productId: string) {
  const product = await db
    .prepare("SELECT * FROM products WHERE id = ?")
    .bind(productId)
    .first<ProductRow>();
  if (!product) {
    throw new ApiError(404, "product_not_found", "The product was not found.");
  }
  const variants = await db
    .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at, id")
    .bind(productId)
    .all<Record<string, unknown>>();
  const variantIds = variants.results.map((variant) => String(variant.id));
  const prices =
    variantIds.length === 0
      ? []
      : (
          await db
            .prepare(
              `SELECT p.*, pl.code AS price_list_code, pl.currency
                 FROM prices p JOIN price_lists pl ON pl.id = p.price_list_id
                WHERE p.variant_id IN (${variantIds.map(() => "?").join(",")})
                ORDER BY pl.code`,
            )
            .bind(...variantIds)
            .all<Record<string, unknown>>()
        ).results;
  const media = await db
    .prepare("SELECT * FROM product_media WHERE product_id = ? ORDER BY position, id")
    .bind(productId)
    .all<Record<string, unknown>>();
  const categories = await db
    .prepare(
      "SELECT c.id, c.name, c.slug FROM categories c JOIN product_categories pc ON pc.category_id = c.id WHERE pc.product_id = ? ORDER BY c.name",
    )
    .bind(productId)
    .all<Record<string, unknown>>();
  const collections = await db
    .prepare(
      `SELECT cv.collection_id AS id, cv.name, cv.slug
         FROM collection_memberships cm
         JOIN collection_versions cv
           ON cv.collection_id = cm.collection_id AND cv.version = cm.collection_version
        WHERE cm.product_id = ?
          AND cm.collection_version = (
            SELECT MAX(current.version) FROM collection_versions current
             WHERE current.collection_id = cm.collection_id
          )
        ORDER BY cm.position`,
    )
    .bind(productId)
    .all<Record<string, unknown>>();
  return {
    categories: categories.results,
    collections: collections.results,
    media: media.results,
    prices,
    product,
    variants: variants.results,
  };
}

async function assertMediaExists(mediaBucket: R2Bucket, input: ProductDraftInput): Promise<void> {
  for (const media of input.media) {
    if (!(await mediaBucket.head(media.r2Key))) {
      throw new ApiError(
        422,
        "media_not_uploaded",
        `Catalog media must be uploaded before use: ${media.r2Key}`,
      );
    }
  }
}

function assertOptionDefinitions(
  definitions: ProductOptionDefinitionsInput["optionDefinitions"],
  variants: readonly { optionValues: Readonly<Record<string, string>> }[],
): void {
  const issues = validateProductOptionDefinitions(definitions, variants);
  if (issues.length) {
    throw new ApiError(
      422,
      "option_definitions_invalid",
      "Option definitions must exactly cover the product variant options.",
      issues,
    );
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

async function appendTaxonomyStatements(
  db: D1Database,
  statements: D1PreparedStatement[],
  productId: string,
  input: ProductDraftInput,
  now: string,
  expectedVersion?: number,
) {
  for (const category of input.categories) {
    const existing = await db
      .prepare("SELECT id FROM categories WHERE slug = ?")
      .bind(category.slug)
      .first<{ id: string }>();
    const categoryId = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      statements.push(
        expectedVersion === undefined
          ? db
              .prepare(
                "INSERT INTO categories (id, parent_id, slug, name, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?)",
              )
              .bind(categoryId, category.slug, category.name, now, now)
          : db
              .prepare(
                `INSERT INTO categories (id, parent_id, slug, name, created_at, updated_at)
                 SELECT ?, NULL, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ?)`,
              )
              .bind(categoryId, category.slug, category.name, now, now, productId, expectedVersion),
      );
    }
    statements.push(
      expectedVersion === undefined
        ? db
            .prepare("INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)")
            .bind(productId, categoryId)
        : db
            .prepare(
              `INSERT INTO product_categories (product_id, category_id)
               SELECT ?, ? WHERE EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ?)`,
            )
            .bind(productId, categoryId, productId, expectedVersion),
    );
  }
}

export async function createProduct(context: CatalogContext, input: ProductDraftInput) {
  if (input.collections.length) {
    throw new ApiError(
      409,
      "collection_membership_maintenance_required",
      "Collection membership is maintained in Collection management. Create the Product first, then add it to a Collection.",
    );
  }
  await assertMediaExists(context.env.MEDIA, input);
  const optionDefinitions =
    input.optionDefinitions ?? deriveTextProductOptionDefinitions(input.variants);
  assertOptionDefinitions(optionDefinitions, input.variants);
  const now = new Date().toISOString();
  const productId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `INSERT INTO products
        (id, slug, name, description, option_definitions_json, status, scheduled_at, seo_title, seo_description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      productId,
      input.slug,
      input.name,
      input.description,
      JSON.stringify(optionDefinitions),
      input.publicationStatus,
      input.scheduledAt,
      input.seoTitle,
      input.seoDescription,
      now,
      now,
    ),
  ];
  const priceLists = new Map<string, { currency: string; id: string }>();
  for (const variant of input.variants) {
    const variantId = crypto.randomUUID();
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO product_variants
          (id, product_id, sku, title, option_values_json, weight_grams, length_mm, width_mm, height_mm, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      ).bind(
        variantId,
        productId,
        variant.sku,
        variant.title,
        JSON.stringify(variant.optionValues),
        variant.weightGrams,
        variant.dimensionsMm.length,
        variant.dimensionsMm.width,
        variant.dimensionsMm.height,
        now,
        now,
      ),
    );
    for (const price of variant.prices) {
      const existingList =
        priceLists.get(price.priceListCode) ??
        (await context.env.DB.prepare("SELECT id, currency FROM price_lists WHERE code = ?")
          .bind(price.priceListCode)
          .first<{ currency: string; id: string }>());
      if (existingList && existingList.currency !== price.currency) {
        throw new ApiError(
          422,
          "price_list_currency_mismatch",
          "A price list cannot change currency.",
        );
      }
      const listId = existingList?.id ?? crypto.randomUUID();
      if (!existingList) {
        statements.push(
          context.env.DB.prepare(
            `INSERT INTO price_lists
              (id, code, currency, status, created_at, updated_at)
             VALUES (?, ?, ?, 'active', ?, ?)`,
          ).bind(listId, price.priceListCode, price.currency, now, now),
        );
      }
      priceLists.set(price.priceListCode, { currency: price.currency, id: listId });
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO prices
            (id, price_list_id, variant_id, amount, compare_at_amount, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          listId,
          variantId,
          price.amount,
          price.compareAtAmount ?? null,
          now,
          now,
        ),
      );
    }
  }
  input.media.forEach((media, position) => {
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO product_media
          (id, product_id, variant_id, r2_key, alt_text, width, height, position, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        productId,
        media.r2Key,
        media.altText,
        media.width,
        media.height,
        position,
        now,
      ),
    );
  });
  await appendTaxonomyStatements(context.env.DB, statements, productId, input, now);

  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new ApiError(409, "catalog_conflict", "A slug, SKU, or media key already exists.");
    }
    throw error;
  }
  const principal = context.get("principal");
  await recordAuditEvent(context.env.DB, {
    action: "catalog.create",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: productId,
    targetType: "product",
  });
  return { id: productId, status: "draft" };
}

export async function updateProduct(
  context: CatalogContext,
  productId: string,
  input: ProductDraftInput,
) {
  await assertMediaExists(context.env.MEDIA, input);
  const existing = await context.env.DB.prepare(
    "SELECT status, version, option_definitions_json, presentation_json FROM products WHERE id = ?",
  )
    .bind(productId)
    .first<{
      option_definitions_json: string;
      presentation_json: string | null;
      status: string;
      version: number;
    }>();
  if (!existing) {
    throw new ApiError(404, "product_not_found", "The product was not found.");
  }
  const currentCollections = await context.env.DB.prepare(
    `SELECT cv.slug
       FROM collection_memberships cm
       JOIN collection_versions cv
         ON cv.collection_id = cm.collection_id AND cv.version = cm.collection_version
      WHERE cm.product_id = ?
        AND cm.collection_version = (
          SELECT MAX(current.version) FROM collection_versions current
           WHERE current.collection_id = cm.collection_id
        )
      ORDER BY cv.slug`,
  )
    .bind(productId)
    .all<{ slug: string }>();
  const currentCollectionSlugs = currentCollections.results.map(({ slug }) => slug);
  const requestedCollectionSlugs = input.collections.map(({ slug }) => slug).sort();
  if (
    currentCollectionSlugs.length !== requestedCollectionSlugs.length ||
    currentCollectionSlugs.some((slug, index) => slug !== requestedCollectionSlugs[index])
  ) {
    throw new ApiError(
      409,
      "collection_membership_maintenance_required",
      "Collection membership is maintained in Collection management. Save the Product without changing membership.",
    );
  }
  if (!["draft", "scheduled"].includes(existing.status)) {
    throw new ApiError(
      409,
      "published_product_immutable",
      "Published catalog snapshots are immutable.",
    );
  }
  const expectedVersion = input.expectedVersion ?? existing.version;
  if (expectedVersion !== existing.version) {
    throw new ApiError(409, "stale_product_version", "The Product changed before it was saved.");
  }
  const optionDefinitions = input.optionDefinitions
    ? input.optionDefinitions
    : productOptionDefinitionsSchema.parse(JSON.parse(existing.option_definitions_json));
  assertOptionDefinitions(optionDefinitions, input.variants);
  const [existingVariants, existingMedia] = await Promise.all([
    context.env.DB.prepare("SELECT id, sku FROM product_variants WHERE product_id = ?")
      .bind(productId)
      .all<{ id: string; sku: string }>(),
    context.env.DB.prepare("SELECT id, r2_key FROM product_media WHERE product_id = ?")
      .bind(productId)
      .all<{ id: string; r2_key: string }>(),
  ]);
  const variantIdsBySku = new Map(existingVariants.results.map(({ id, sku }) => [sku, id]));
  const mediaIdsByKey = new Map(existingMedia.results.map(({ id, r2_key }) => [r2_key, id]));
  const retainedVariantIds = new Set(
    input.variants.flatMap(({ sku }) => {
      const id = variantIdsBySku.get(sku);
      return id ? [id] : [];
    }),
  );
  const retainedMediaIds = new Set(
    input.media.flatMap(({ r2Key }) => {
      const id = mediaIdsByKey.get(r2Key);
      return id ? [id] : [];
    }),
  );
  if (existing.presentation_json) {
    const presentation = productPresentationSchema.parse(JSON.parse(existing.presentation_json));
    const issues: Array<{ message: string; path: Array<number | string> }> = [];
    if (presentation.defaultVariantId && !retainedVariantIds.has(presentation.defaultVariantId)) {
      issues.push({
        message: "The edited Variant set would remove the presentation default Variant.",
        path: ["presentation", "defaultVariantId"],
      });
    }
    if (presentation.detailMediaId && !retainedMediaIds.has(presentation.detailMediaId)) {
      issues.push({
        message: "The edited media set would remove the presentation detail media.",
        path: ["presentation", "detailMediaId"],
      });
    }
    if (issues.length) {
      throw new ApiError(
        422,
        "product_presentation_reference_removed",
        "Update Product presentation before removing one of its selected references.",
        issues,
      );
    }
  }
  const now = new Date().toISOString();
  const staleGuard = "EXISTS (SELECT 1 FROM products WHERE id = ? AND version = ?)";
  const removedVariantIds = existingVariants.results
    .filter(({ id }) => !retainedVariantIds.has(id))
    .map(({ id }) => id);
  const removedMediaIds = existingMedia.results
    .filter(({ id }) => !retainedMediaIds.has(id))
    .map(({ id }) => id);
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `DELETE FROM product_categories WHERE product_id = ? AND ${staleGuard}`,
    ).bind(productId, productId, expectedVersion),
    context.env.DB.prepare(
      `DELETE FROM prices
        WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)
          AND ${staleGuard}`,
    ).bind(productId, productId, expectedVersion),
  ];
  for (const mediaId of removedMediaIds) {
    statements.push(
      context.env.DB.prepare(
        `DELETE FROM product_media WHERE id = ? AND product_id = ? AND ${staleGuard}`,
      ).bind(mediaId, productId, productId, expectedVersion),
    );
  }
  const priceLists = new Map<string, { currency: string; id: string }>();
  for (const variant of input.variants) {
    const retainedVariantId = variantIdsBySku.get(variant.sku);
    const variantId = retainedVariantId ?? crypto.randomUUID();
    statements.push(
      retainedVariantId
        ? context.env.DB.prepare(
            `UPDATE product_variants
                  SET title = ?, option_values_json = ?, weight_grams = ?, length_mm = ?, width_mm = ?, height_mm = ?, status = 'active', updated_at = ?
                WHERE id = ? AND product_id = ? AND ${staleGuard}`,
          ).bind(
            variant.title,
            JSON.stringify(variant.optionValues),
            variant.weightGrams,
            variant.dimensionsMm.length,
            variant.dimensionsMm.width,
            variant.dimensionsMm.height,
            now,
            variantId,
            productId,
            productId,
            expectedVersion,
          )
        : context.env.DB.prepare(
            `INSERT INTO product_variants
                (id, product_id, sku, title, option_values_json, weight_grams, length_mm, width_mm, height_mm, status, created_at, updated_at)
               SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ? WHERE ${staleGuard}`,
          ).bind(
            variantId,
            productId,
            variant.sku,
            variant.title,
            JSON.stringify(variant.optionValues),
            variant.weightGrams,
            variant.dimensionsMm.length,
            variant.dimensionsMm.width,
            variant.dimensionsMm.height,
            now,
            now,
            productId,
            expectedVersion,
          ),
    );
    for (const price of variant.prices) {
      const priceList =
        priceLists.get(price.priceListCode) ??
        (await context.env.DB.prepare("SELECT id, currency FROM price_lists WHERE code = ?")
          .bind(price.priceListCode)
          .first<{ currency: string; id: string }>());
      if (priceList && priceList.currency !== price.currency) {
        throw new ApiError(
          422,
          "price_list_currency_mismatch",
          "A price list cannot change currency.",
        );
      }
      const priceListId = priceList?.id ?? crypto.randomUUID();
      if (!priceList) {
        statements.push(
          context.env.DB.prepare(
            `INSERT INTO price_lists
              (id, code, currency, status, created_at, updated_at)
             SELECT ?, ?, ?, 'active', ?, ? WHERE ${staleGuard}`,
          ).bind(
            priceListId,
            price.priceListCode,
            price.currency,
            now,
            now,
            productId,
            expectedVersion,
          ),
        );
      }
      priceLists.set(price.priceListCode, { currency: price.currency, id: priceListId });
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO prices
            (id, price_list_id, variant_id, amount, compare_at_amount, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${staleGuard}`,
        ).bind(
          crypto.randomUUID(),
          priceListId,
          variantId,
          price.amount,
          price.compareAtAmount ?? null,
          now,
          now,
          productId,
          expectedVersion,
        ),
      );
    }
  }
  for (const variantId of removedVariantIds) {
    statements.push(
      context.env.DB.prepare(
        `DELETE FROM product_variants WHERE id = ? AND product_id = ? AND ${staleGuard}`,
      ).bind(variantId, productId, productId, expectedVersion),
    );
  }
  input.media.forEach((media, position) => {
    const retainedMediaId = mediaIdsByKey.get(media.r2Key);
    const mediaId = retainedMediaId ?? crypto.randomUUID();
    statements.push(
      retainedMediaId
        ? context.env.DB.prepare(
            `UPDATE product_media SET alt_text = ?, width = ?, height = ?, position = ?
                WHERE id = ? AND product_id = ? AND ${staleGuard}`,
          ).bind(
            media.altText,
            media.width,
            media.height,
            position,
            mediaId,
            productId,
            productId,
            expectedVersion,
          )
        : context.env.DB.prepare(
            `INSERT INTO product_media
                (id, product_id, variant_id, r2_key, alt_text, width, height, position, created_at)
               SELECT ?, ?, NULL, ?, ?, ?, ?, ?, ? WHERE ${staleGuard}`,
          ).bind(
            mediaId,
            productId,
            media.r2Key,
            media.altText,
            media.width,
            media.height,
            position,
            now,
            productId,
            expectedVersion,
          ),
    );
  });
  await appendTaxonomyStatements(
    context.env.DB,
    statements,
    productId,
    input,
    now,
    expectedVersion,
  );
  const productUpdateIndex = statements.length;
  statements.push(
    context.env.DB.prepare(
      `UPDATE products
          SET slug = ?, name = ?, description = ?, option_definitions_json = ?, status = ?, scheduled_at = ?, seo_title = ?, seo_description = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND status IN ('draft', 'scheduled')`,
    ).bind(
      input.slug,
      input.name,
      input.description,
      JSON.stringify(optionDefinitions),
      input.publicationStatus,
      input.scheduledAt,
      input.seoTitle,
      input.seoDescription,
      now,
      productId,
      expectedVersion,
    ),
  );
  const principal = context.get("principal");
  statements.push(
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: "catalog.update",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: productId,
        targetType: "product",
      },
      {
        bindings: [productId, expectedVersion + 1, now],
        sql: "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?",
      },
    ),
  );
  try {
    const results = await context.env.DB.batch(statements);
    if (results[productUpdateIndex]?.meta.changes !== 1) {
      throw new ApiError(409, "stale_product_version", "The Product changed before it was saved.");
    }
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new ApiError(409, "catalog_conflict", "A slug, SKU, or media key already exists.");
    }
    throw error;
  }
  return { id: productId, status: input.publicationStatus };
}

export async function updateProductOptionDefinitions(
  context: CatalogContext,
  productId: string,
  input: ProductOptionDefinitionsInput,
) {
  const product = await context.env.DB.prepare("SELECT status, version FROM products WHERE id = ?")
    .bind(productId)
    .first<{ status: string; version: number }>();
  if (!product) throw new ApiError(404, "product_not_found", "The product was not found.");
  if (!["draft", "scheduled"].includes(product.status)) {
    throw new ApiError(
      409,
      "published_product_immutable",
      "Published and archived products are immutable.",
    );
  }
  const rows = await context.env.DB.prepare(
    "SELECT option_values_json FROM product_variants WHERE product_id = ? ORDER BY created_at, id",
  )
    .bind(productId)
    .all<{ option_values_json: string }>();
  const variants = rows.results.map(({ option_values_json }) => ({
    optionValues: JSON.parse(option_values_json) as Record<string, string>,
  }));
  assertOptionDefinitions(input.optionDefinitions, variants);
  const now = new Date().toISOString();
  const principal = context.get("principal");
  const nextVersion = input.expectedVersion + 1;
  const [result] = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE products
            SET option_definitions_json = ?, version = version + 1, updated_at = ?
          WHERE id = ? AND status IN ('draft', 'scheduled') AND version = ?`,
    ).bind(JSON.stringify(input.optionDefinitions), now, productId, input.expectedVersion),
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: "catalog.option-presentation.update",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: productId,
        targetType: "product",
      },
      {
        bindings: [productId, nextVersion, now],
        sql: "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?",
      },
    ),
  ]);
  if (result?.meta.changes !== 1) {
    throw new ApiError(
      409,
      "stale_product_version",
      "The product changed while option presentation was being saved.",
    );
  }
  return {
    id: productId,
    optionDefinitions: input.optionDefinitions,
    status: product.status,
    version: product.version + 1,
  };
}

export async function updateProductPresentation(
  context: CatalogContext,
  productId: string,
  input: ProductPresentationInput,
) {
  const product = await context.env.DB.prepare("SELECT status, version FROM products WHERE id = ?")
    .bind(productId)
    .first<{ status: string; version: number }>();
  if (!product) throw new ApiError(404, "product_not_found", "The product was not found.");
  if (!["draft", "scheduled"].includes(product.status)) {
    throw new ApiError(
      409,
      "published_product_immutable",
      "Published catalog snapshots are immutable.",
    );
  }

  const [media, variants] = await Promise.all([
    context.env.DB.prepare("SELECT id FROM product_media WHERE product_id = ?")
      .bind(productId)
      .all<{ id: string }>(),
    context.env.DB.prepare("SELECT id FROM product_variants WHERE product_id = ?")
      .bind(productId)
      .all<{ id: string }>(),
  ]);
  const issues: Array<{ message: string; path: Array<number | string> }> = [];
  if (
    input.presentation.detailMediaId &&
    !media.results.some(({ id }) => id === input.presentation.detailMediaId)
  ) {
    issues.push({
      message: "Detail media must belong to the current Product.",
      path: ["presentation", "detailMediaId"],
    });
  }
  if (
    input.presentation.defaultVariantId &&
    !variants.results.some(({ id }) => id === input.presentation.defaultVariantId)
  ) {
    issues.push({
      message: "Default Variant must belong to the current Product.",
      path: ["presentation", "defaultVariantId"],
    });
  }
  if (issues.length) {
    throw new ApiError(
      422,
      "product_presentation_invalid",
      "Product presentation references must belong to the current Product.",
      issues,
    );
  }

  const now = new Date().toISOString();
  const principal = context.get("principal");
  const nextVersion = input.expectedVersion + 1;
  const [result] = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE products
            SET presentation_json = ?, version = version + 1, updated_at = ?
          WHERE id = ? AND status IN ('draft', 'scheduled') AND version = ?`,
    ).bind(JSON.stringify(input.presentation), now, productId, input.expectedVersion),
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: "catalog.presentation.update",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: productId,
        targetType: "product",
      },
      {
        bindings: [productId, nextVersion, now],
        sql: "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?",
      },
    ),
  ]);
  if (result?.meta.changes !== 1) {
    throw new ApiError(
      409,
      "stale_product_version",
      "The Product changed before presentation metadata could be saved.",
    );
  }

  return { presentation: input.presentation, version: product.version + 1 };
}
