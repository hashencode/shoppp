import {
  productOptionDefinitionsSchema,
  productPresentationSchema,
  type Product,
} from "@shoppp/contracts";

import { ApiError } from "../http/errors";
import { publishedProductRevisionContentSchema } from "./schemas";

interface PublicProductRow {
  description: string;
  id: string;
  name: string;
  option_definitions_json: string;
  presentation_json: string | null;
  seo_description: string;
  seo_title: string;
  slug: string;
  status: "published";
}

interface PublicVariantRow {
  available_quantity: number;
  compare_at_amount: number | null;
  id: string;
  option_values_json: string;
  price_amount: number;
  sku: string;
  title: string;
}

interface PublicMediaRow {
  alt_text: string;
  height: number;
  id: string;
  position: number;
  r2_key: string;
  width: number;
}

// Shared SQL uses the same variant alias as the public product query below.
const availableQuantitySql = `COALESCE((SELECT SUM(i.on_hand_quantity + i.oversell_limit -
  i.reserved_quantity - i.backordered_quantity) FROM inventory_items i WHERE i.variant_id = v.id), 0)`;
const eligiblePriceSql = `SELECT eligible_price.id FROM prices eligible_price
  JOIN price_lists pl ON pl.id = eligible_price.price_list_id
  WHERE eligible_price.variant_id = v.id AND pl.currency = ? AND pl.status = 'active'
    AND (pl.starts_at IS NULL OR pl.starts_at <= ?)
    AND (pl.ends_at IS NULL OR pl.ends_at > ?)
  ORDER BY pl.code LIMIT 1`;

export async function hasSellableSku(
  db: D1Database,
  currency: string,
  checkedAt: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS found FROM product_variants v
    JOIN products p ON p.id = v.product_id
    JOIN prices pr ON pr.id = (${eligiblePriceSql})
    WHERE p.status = 'published' AND v.status = 'active' AND ${availableQuantitySql} > 0
    LIMIT 1`,
    )
    .bind(currency, checkedAt, checkedAt)
    .first<{ found: number }>();
  return row !== null;
}

async function getLiveProductBy(
  db: D1Database,
  lookup: { id: string } | { slug: string },
  currency: string,
  mediaOrigin: string,
): Promise<Product> {
  const now = new Date().toISOString();
  const column = "id" in lookup ? "id" : "slug";
  const value = "id" in lookup ? lookup.id : lookup.slug;
  const [productResult, variantsResult, mediaResult] = await db.batch([
    db
      .prepare(
        `SELECT id, slug, name, description, option_definitions_json, presentation_json, status, seo_title, seo_description
         FROM products WHERE ${column} = ? AND status = 'published'`,
      )
      .bind(value),
    db
      .prepare(
        `SELECT v.id, v.sku, v.title, v.option_values_json, pr.amount AS price_amount,
                pr.compare_at_amount,
                ${availableQuantitySql}
                  AS available_quantity
           FROM product_variants v
           JOIN products p ON p.id = v.product_id
           JOIN prices pr ON pr.id = (${eligiblePriceSql})
          WHERE p.${column} = ? AND p.status = 'published' AND v.status = 'active'
          ORDER BY v.created_at, v.id`,
      )
      .bind(currency, now, now, value),
    db
      .prepare(
        `SELECT pm.id, pm.r2_key, pm.alt_text, pm.width, pm.height, pm.position
           FROM product_media pm
           JOIN products p ON p.id = pm.product_id
          WHERE p.${column} = ? AND p.status = 'published'
          ORDER BY pm.position, pm.id`,
      )
      .bind(value),
  ]);
  const product = productResult?.results[0] as PublicProductRow | undefined;
  if (!product) throw new ApiError(404, "product_not_found", "The product was not found.");
  const publishedRevision = await db
    .prepare(
      `SELECT content_json FROM product_revisions
        WHERE product_id = ? AND status = 'published'
        ORDER BY published_at DESC, id DESC LIMIT 1`,
    )
    .bind(product.id)
    .first<{ content_json: string }>();
  const revision = publishedRevision
    ? publishedProductRevisionContentSchema.parse(JSON.parse(publishedRevision.content_json))
    : null;
  if (revision?.presentation?.purchaseStatus === "unverified") {
    throw new ApiError(
      409,
      "product_assortment_unverified",
      "This Product's sellable options are being verified.",
    );
  }
  const variants = (variantsResult?.results ?? []) as unknown as PublicVariantRow[];
  const media = (mediaResult?.results ?? []) as unknown as PublicMediaRow[];
  if (variants.length === 0) {
    throw new ApiError(
      422,
      "currency_unavailable",
      "This product is not sellable in the requested currency.",
      [{ path: ["currency"] }],
    );
  }
  const options = new Map<string, Set<string>>();
  const publicVariants = variants.map((variant) => {
    const values =
      revision?.variantOptions?.find(({ id }) => id === variant.id)?.optionValues ??
      (JSON.parse(variant.option_values_json) as Record<string, string>);
    for (const [name, value] of Object.entries(values)) {
      const choices = options.get(name) ?? new Set<string>();
      choices.add(value);
      options.set(name, choices);
    }
    return {
      available: variant.available_quantity > 0,
      id: variant.id,
      options: values,
      price: {
        amount: variant.price_amount,
        ...(variant.compare_at_amount === null
          ? {}
          : { compareAtAmount: variant.compare_at_amount }),
        currency,
      },
      sku: variant.sku,
    };
  });
  const storedOptionDefinitions = productOptionDefinitionsSchema.parse(
    JSON.parse(product.option_definitions_json),
  );
  const optionDefinitions =
    revision?.optionDefinitions ??
    (storedOptionDefinitions.length > 0
      ? storedOptionDefinitions
      : [...options].map(([name, values]) => ({
          name,
          presentation: "text" as const,
          values: [...values].map((label) => ({ label })),
        })));
  return {
    description: revision?.description ?? product.description,
    id: product.id,
    media: revision
      ? revision.media.map((item, position) => ({
          alt: item.altText,
          height: item.height,
          id: item.id,
          position,
          src: `${mediaOrigin.replace(/\/+$/, "")}/${item.r2Key}`,
          width: item.width,
        }))
      : media.map((item) => ({
          alt: item.alt_text,
          height: item.height,
          id: item.id,
          position: item.position,
          src: `${mediaOrigin.replace(/\/+$/, "")}/${item.r2_key}`,
          width: item.width,
        })),
    name: revision?.name ?? product.name,
    optionDefinitions,
    options: [...options].map(([name, values]) => ({ name, values: [...values] })),
    ...(revision
      ? revision.presentation
        ? { presentation: revision.presentation }
        : {}
      : product.presentation_json
        ? { presentation: productPresentationSchema.parse(JSON.parse(product.presentation_json)) }
        : {}),
    seo: {
      description: revision?.seoDescription ?? product.seo_description,
      title: revision?.seoTitle ?? product.seo_title,
    },
    slug: product.slug,
    status: product.status,
    variants: publicVariants,
  };
}

export function getLiveProduct(
  db: D1Database,
  slug: string,
  currency: string,
  mediaOrigin: string,
): Promise<Product> {
  return getLiveProductBy(db, { slug }, currency, mediaOrigin);
}

export function getLiveProductById(
  db: D1Database,
  id: string,
  currency: string,
  mediaOrigin: string,
): Promise<Product> {
  return getLiveProductBy(db, { id }, currency, mediaOrigin);
}
