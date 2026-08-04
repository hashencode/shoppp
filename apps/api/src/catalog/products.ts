import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import type { ProductDraftInput } from "./schemas";

type CatalogContext = Context<ApiEnvironment>;

interface ProductRow {
  created_at: string;
  description: string;
  id: string;
  name: string;
  published_at: string | null;
  seo_description: string;
  seo_title: string;
  slug: string;
  status: string;
  updated_at: string;
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
    `SELECT p.id, p.slug, p.name, p.status, p.scheduled_at, p.updated_at,
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
      "SELECT c.id, c.name, c.slug FROM collections c JOIN collection_products cp ON cp.collection_id = c.id WHERE cp.product_id = ? ORDER BY cp.position",
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

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

async function appendTaxonomyStatements(
  db: D1Database,
  statements: D1PreparedStatement[],
  productId: string,
  input: ProductDraftInput,
  now: string,
) {
  for (const category of input.categories) {
    const existing = await db
      .prepare("SELECT id FROM categories WHERE slug = ?")
      .bind(category.slug)
      .first<{ id: string }>();
    const categoryId = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      statements.push(
        db
          .prepare(
            "INSERT INTO categories (id, parent_id, slug, name, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?)",
          )
          .bind(categoryId, category.slug, category.name, now, now),
      );
    }
    statements.push(
      db
        .prepare("INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)")
        .bind(productId, categoryId),
    );
  }
  for (const [position, collection] of input.collections.entries()) {
    const existing = await db
      .prepare("SELECT id FROM collections WHERE slug = ?")
      .bind(collection.slug)
      .first<{ id: string }>();
    const collectionId = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      statements.push(
        db
          .prepare(
            "INSERT INTO collections (id, slug, name, description, status, created_at, updated_at) VALUES (?, ?, ?, '', 'draft', ?, ?)",
          )
          .bind(collectionId, collection.slug, collection.name, now, now),
      );
    }
    statements.push(
      db
        .prepare(
          "INSERT INTO collection_products (collection_id, product_id, position) VALUES (?, ?, ?)",
        )
        .bind(collectionId, productId, position),
    );
  }
}

export async function createProduct(context: CatalogContext, input: ProductDraftInput) {
  await assertMediaExists(context.env.MEDIA, input);
  const now = new Date().toISOString();
  const productId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `INSERT INTO products
        (id, slug, name, description, status, scheduled_at, seo_title, seo_description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      productId,
      input.slug,
      input.name,
      input.description,
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
            (id, price_list_id, variant_id, amount, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), listId, variantId, price.amount, now, now),
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
  const existing = await context.env.DB.prepare("SELECT status FROM products WHERE id = ?")
    .bind(productId)
    .first<{ status: string }>();
  if (!existing) {
    throw new ApiError(404, "product_not_found", "The product was not found.");
  }
  if (!["draft", "scheduled"].includes(existing.status)) {
    throw new ApiError(
      409,
      "published_product_immutable",
      "Published catalog snapshots are immutable.",
    );
  }
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare("DELETE FROM product_media WHERE product_id = ?").bind(productId),
    context.env.DB.prepare("DELETE FROM collection_products WHERE product_id = ?").bind(productId),
    context.env.DB.prepare("DELETE FROM product_categories WHERE product_id = ?").bind(productId),
    context.env.DB.prepare(
      "DELETE FROM prices WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)",
    ).bind(productId),
    context.env.DB.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(productId),
    context.env.DB.prepare(
      `UPDATE products
          SET slug = ?, name = ?, description = ?, status = ?, scheduled_at = ?, seo_title = ?, seo_description = ?, updated_at = ?
        WHERE id = ?`,
    ).bind(
      input.slug,
      input.name,
      input.description,
      input.publicationStatus,
      input.scheduledAt,
      input.seoTitle,
      input.seoDescription,
      now,
      productId,
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
             VALUES (?, ?, ?, 'active', ?, ?)`,
          ).bind(priceListId, price.priceListCode, price.currency, now, now),
        );
      }
      priceLists.set(price.priceListCode, { currency: price.currency, id: priceListId });
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO prices
            (id, price_list_id, variant_id, amount, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), priceListId, variantId, price.amount, now, now),
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
    action: "catalog.update",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: productId,
    targetType: "product",
  });
  return { id: productId, status: input.publicationStatus };
}
