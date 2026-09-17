import type { Context } from "hono";
import { validateProductOptionDefinitions } from "@shoppp/contracts";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { buildCatalogReleaseManifest } from "../publishing/build-manifest";
import {
  publishedProductRevisionContentSchema,
  type PublishedProductRevisionInput,
} from "./schemas";

type CatalogContext = Context<ApiEnvironment>;

interface RevisionRow {
  base_product_version: number;
  base_published_revision_id: string | null;
  content_json: string;
  id: string;
  product_id: string;
  status: "draft" | "building" | "published" | "failed";
  version: number;
}

async function latestPublished(db: D1Database, productId: string): Promise<RevisionRow | null> {
  return db
    .prepare(
      `SELECT * FROM product_revisions
        WHERE product_id = ? AND status = 'published'
        ORDER BY published_at DESC, id DESC LIMIT 1`,
    )
    .bind(productId)
    .first<RevisionRow>();
}

async function openRevision(db: D1Database, productId: string): Promise<RevisionRow | null> {
  return db
    .prepare(
      `SELECT * FROM product_revisions
        WHERE product_id = ? AND status IN ('draft', 'building')
        ORDER BY created_at DESC, id DESC LIMIT 1`,
    )
    .bind(productId)
    .first<RevisionRow>();
}

function revisionView(row: RevisionRow | null) {
  return row
    ? {
        baseProductVersion: row.base_product_version,
        basePublishedRevisionId: row.base_published_revision_id,
        content: publishedProductRevisionContentSchema.parse(JSON.parse(row.content_json)),
        id: row.id,
        status: row.status,
        version: row.version,
      }
    : null;
}

export async function getPublishedProductRevisions(db: D1Database, productId: string) {
  const product = await db
    .prepare("SELECT id, status, version FROM products WHERE id = ?")
    .bind(productId)
    .first<{ id: string; status: string; version: number }>();
  if (!product) throw new ApiError(404, "product_not_found", "The Product was not found.");
  if (product.status !== "published") {
    throw new ApiError(
      409,
      "published_revision_requires_published_product",
      "The Product is not published.",
    );
  }
  const [published, draft] = await Promise.all([
    latestPublished(db, productId),
    openRevision(db, productId),
  ]);
  return {
    draft: revisionView(draft),
    productVersion: product.version,
    published: revisionView(published),
  };
}

export async function stagePublishedProductRevision(
  context: CatalogContext,
  productId: string,
  input: PublishedProductRevisionInput,
) {
  const db = context.env.DB;
  const state = await getPublishedProductRevisions(db, productId);
  if (state.productVersion !== input.expectedProductVersion) {
    throw new ApiError(
      409,
      "stale_product_version",
      "The Product changed before revision staging.",
    );
  }
  if ((state.published?.id ?? null) !== input.expectedPublishedRevisionId) {
    throw new ApiError(409, "stale_product_revision", "A newer Product revision was published.");
  }
  if ((state.draft?.version ?? null) !== input.expectedDraftVersion) {
    throw new ApiError(409, "stale_product_revision", "The Product draft changed before saving.");
  }
  if (state.draft?.status === "building") {
    throw new ApiError(409, "product_revision_building", "A Product revision is building.");
  }

  const mediaIds = input.content.media.map((item) => item.id);
  const mediaKeys = input.content.media.map((item) => item.r2Key);
  if (new Set(mediaIds).size !== mediaIds.length || new Set(mediaKeys).size !== mediaKeys.length) {
    throw new ApiError(422, "duplicate_product_revision_media", "Revision media must be unique.");
  }
  const variantIds = new Set(
    (
      await db
        .prepare("SELECT id FROM product_variants WHERE product_id = ?")
        .bind(productId)
        .all<{ id: string }>()
    ).results.map(({ id }) => id),
  );
  if (input.content.variantOptions && input.content.optionDefinitions) {
    const revised = input.content.variantOptions;
    const revisedIds = revised.map(({ id }) => id);
    if (
      revisedIds.length !== variantIds.size ||
      new Set(revisedIds).size !== revisedIds.length ||
      revisedIds.some((id) => !variantIds.has(id)) ||
      validateProductOptionDefinitions(input.content.optionDefinitions, revised).length > 0
    ) {
      throw new ApiError(
        422,
        "product_revision_options_invalid",
        "Revision options must cover this Product's exact Variant IDs and values.",
      );
    }
  }
  const presentation = input.content.presentation;
  if (
    (presentation?.defaultVariantId && !variantIds.has(presentation.defaultVariantId)) ||
    (presentation?.detailMediaId && !mediaIds.includes(presentation.detailMediaId)) ||
    (presentation?.colorMediaIds &&
      Object.values(presentation.colorMediaIds).some((ids) =>
        ids.some((id) => !mediaIds.includes(id)),
      ))
  ) {
    throw new ApiError(
      422,
      "product_revision_reference_invalid",
      "Presentation media and Variant references must belong to this Product revision.",
    );
  }

  const newAssets: typeof input.content.media = [];
  for (const media of input.content.media) {
    const owner = await db
      .prepare("SELECT id, product_id, r2_key FROM product_media_assets WHERE id = ? OR r2_key = ?")
      .bind(media.id, media.r2Key)
      .all<{ id: string; product_id: string; r2_key: string }>();
    if (owner.results.some((row) => row.product_id !== productId)) {
      throw new ApiError(422, "cross_product_media", "Revision media belongs to another Product.");
    }
    if (owner.results.length > 0) {
      if (
        owner.results.length !== 1 ||
        owner.results[0]?.id !== media.id ||
        owner.results[0]?.r2_key !== media.r2Key
      ) {
        throw new ApiError(
          422,
          "product_media_identity_mismatch",
          "Media ID and key do not match.",
        );
      }
    } else {
      if (!media.r2Key.startsWith(`catalog/products/${productId}/`)) {
        throw new ApiError(
          422,
          "product_media_key_invalid",
          "New media must use the Product-owned R2 prefix.",
        );
      }
      newAssets.push(media);
    }
    if (!(await context.env.MEDIA.head(media.r2Key))) {
      throw new ApiError(422, "media_not_uploaded", `Catalog media is missing: ${media.r2Key}`);
    }
  }

  const now = new Date().toISOString();
  const revisionId = state.draft?.id ?? crypto.randomUUID();
  const contentJson = JSON.stringify(input.content);
  const activeGuard = `COALESCE((SELECT id FROM product_revisions
    WHERE product_id = ? AND status = 'published'
    ORDER BY published_at DESC, id DESC LIMIT 1), '') = COALESCE(?, '')`;
  const revisionStatement = state.draft
    ? db
        .prepare(
          `UPDATE product_revisions SET content_json = ?, version = version + 1, updated_at = ?
              WHERE id = ? AND product_id = ? AND status = 'draft' AND version = ?
                AND base_product_version = ? AND base_published_revision_id IS ?
                AND EXISTS (SELECT 1 FROM products WHERE id = ? AND status = 'published' AND version = ?)
                AND ${activeGuard}`,
        )
        .bind(
          contentJson,
          now,
          revisionId,
          productId,
          input.expectedDraftVersion,
          input.expectedProductVersion,
          input.expectedPublishedRevisionId,
          productId,
          input.expectedProductVersion,
          productId,
          input.expectedPublishedRevisionId,
        )
    : db
        .prepare(
          `INSERT INTO product_revisions
              (id, product_id, base_product_version, base_published_revision_id,
               version, status, content_json, created_by, created_at, updated_at)
             SELECT ?, ?, ?, ?, 1, 'draft', ?, ?, ?, ?
             WHERE EXISTS (SELECT 1 FROM products WHERE id = ? AND status = 'published' AND version = ?)
               AND ${activeGuard}`,
        )
        .bind(
          revisionId,
          productId,
          input.expectedProductVersion,
          input.expectedPublishedRevisionId,
          contentJson,
          context.get("principal").id,
          now,
          now,
          productId,
          input.expectedProductVersion,
          productId,
          input.expectedPublishedRevisionId,
        );
  const statements = [
    revisionStatement,
    ...newAssets.map((asset) =>
      db
        .prepare(
          `INSERT INTO product_media_assets (id, product_id, r2_key, created_at)
           SELECT ?, ?, ?, ? WHERE EXISTS (
             SELECT 1 FROM product_revisions
              WHERE id = ? AND product_id = ? AND status = 'draft'
                AND version = ? AND content_json = ? AND updated_at = ?
           )`,
        )
        .bind(
          asset.id,
          productId,
          asset.r2Key,
          now,
          revisionId,
          productId,
          (input.expectedDraftVersion ?? 0) + 1,
          contentJson,
          now,
        ),
    ),
  ];
  let results: D1Result[];
  try {
    results = await db.batch(statements);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      throw new ApiError(409, "stale_product_revision", "The Product revision changed.");
    }
    throw error;
  }
  if (results[0]?.meta.changes !== 1) {
    throw new ApiError(409, "stale_product_revision", "The Product revision changed.");
  }
  return {
    baseProductVersion: input.expectedProductVersion,
    basePublishedRevisionId: input.expectedPublishedRevisionId,
    content: input.content,
    id: revisionId,
    status: "draft" as const,
    version: (input.expectedDraftVersion ?? 0) + 1,
  };
}

export async function previewPublishedProductRevision(
  context: CatalogContext,
  productId: string,
  revisionId: string,
) {
  const state = await getPublishedProductRevisions(context.env.DB, productId);
  if (state.draft?.id !== revisionId) {
    throw new ApiError(404, "product_revision_not_found", "The staged revision was not found.");
  }
  const manifest = await buildCatalogReleaseManifest(context.env.DB, {
    candidateProductId: productId,
    candidateRevisionId: revisionId,
    mediaOrigin: context.env.MEDIA_PUBLIC_ORIGIN,
    releaseId: `revision-preview-${revisionId}`,
    storefrontOrigin: context.env.STOREFRONT_ORIGIN,
  });
  const product = manifest.products.find(({ id }) => id === productId);
  if (!product) throw new ApiError(404, "product_not_found", "The Product was not found.");
  return { product, revisionId, sourceProductVersion: state.productVersion };
}
