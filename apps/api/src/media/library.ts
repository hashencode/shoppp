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
  product_name: string;
  r2_key: string;
  width: number;
}

export async function listCatalogMedia(env: ApiBindings, input: CatalogMediaListInput) {
  const query = input.query.trim().slice(0, 100);
  const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const bindings = [query, pattern, pattern] as const;
  const where = `p.status IN ('published', 'archived')
    AND (? = '' OR pm.alt_text LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')`;
  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS total
       FROM product_media pm
       JOIN products p ON p.id = pm.product_id
      WHERE ${where}`,
  )
    .bind(...bindings)
    .first<{ total: number }>();
  const rows = await env.DB.prepare(
    `SELECT pm.r2_key, pm.alt_text, pm.width, pm.height, p.name AS product_name
       FROM product_media pm
       JOIN products p ON p.id = pm.product_id
      WHERE ${where}
      ORDER BY pm.created_at DESC, pm.position, pm.r2_key
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
