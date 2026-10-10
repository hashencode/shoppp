import { catalogAssetKeySchema } from "@shoppp/contracts";

import type { ApiBindings } from "../http/context";

export interface CatalogMediaListInput {
  page: number;
  pageSize: number;
  query: string;
}

interface CatalogMediaRow {
  alt_text: string;
  height: number;
  id: string;
  product_name: string;
  r2_key: string;
  width: number;
}

export async function listCatalogMedia(env: ApiBindings, input: CatalogMediaListInput) {
  const query = input.query.trim().slice(0, 100);
  const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const bindings = [query, pattern, pattern] as const;
  const mediaSources = `WITH published_revisions AS (
      SELECT r.product_id, r.content_json
        FROM product_revisions r
       WHERE r.status = 'published' AND r.id = (
         SELECT current.id FROM product_revisions current
          WHERE current.product_id = r.product_id AND current.status = 'published'
          ORDER BY current.published_at DESC, current.id DESC LIMIT 1
       )
    ), revision_media AS (
      SELECT a.id, a.r2_key,
             json_extract(media.value, '$.altText') AS alt_text,
             json_extract(media.value, '$.width') AS width,
             json_extract(media.value, '$.height') AS height,
             json_extract(r.content_json, '$.name') AS product_name,
             a.created_at, CAST(media.key AS INTEGER) AS position
        FROM published_revisions r
        JOIN products p ON p.id = r.product_id AND p.status = 'published'
        JOIN json_each(r.content_json, '$.media') media
        JOIN product_media_assets a
          ON a.id = json_extract(media.value, '$.id')
         AND a.product_id = r.product_id
         AND a.r2_key = json_extract(media.value, '$.r2Key')
    ), catalog_media AS (
      SELECT pm.id, pm.r2_key, pm.alt_text, pm.width, pm.height,
             COALESCE(json_extract(r.content_json, '$.name'), p.name) AS product_name,
             pm.created_at, pm.position
        FROM product_media pm
        JOIN products p ON p.id = pm.product_id AND p.status = 'published'
        LEFT JOIN published_revisions r ON r.product_id = p.id
       WHERE NOT EXISTS (SELECT 1 FROM revision_media revised WHERE revised.id = pm.id)
      UNION ALL
      SELECT id, r2_key, alt_text, width, height, product_name, created_at, position
        FROM revision_media
    )`;
  const where = `(? = '' OR alt_text LIKE ? ESCAPE '\\' OR product_name LIKE ? ESCAPE '\\')`;
  const count = await env.DB.prepare(
    `${mediaSources}
     SELECT COUNT(*) AS total FROM catalog_media
      WHERE ${where}`,
  )
    .bind(...bindings)
    .first<{ total: number }>();
  const rows = await env.DB.prepare(
    `${mediaSources}
     SELECT id, r2_key, alt_text, width, height, product_name FROM catalog_media
      WHERE ${where}
      ORDER BY created_at DESC, position, r2_key
      LIMIT ? OFFSET ?`,
  )
    .bind(...bindings, input.pageSize, (input.page - 1) * input.pageSize)
    .all<CatalogMediaRow>();
  const origin = env.MEDIA_PUBLIC_ORIGIN.replace(/\/+$/, "");
  return {
    data: rows.results
      .filter(({ r2_key }) => catalogAssetKeySchema.safeParse(r2_key).success)
      .map((row) => ({
        alt: row.alt_text,
        height: row.height,
        id: row.id,
        key: row.r2_key,
        kind: "catalog" as const,
        productName: row.product_name,
        src: `${origin}/${row.r2_key}`,
        width: row.width,
      })),
    page: input.page,
    pageSize: input.pageSize,
    total: count?.total ?? 0,
  };
}
