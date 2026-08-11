import { canonicalCatalogReleaseSchema } from "@shoppp/contracts";

import type { ApiBindings } from "../http/context";

interface ReleaseRow {
  approved_at: string;
  deployed_at: string | null;
  id: string;
  manifest_json: string;
  status: "deployed";
}

export async function listStorefrontCatalogReleases(env: ApiBindings) {
  const rows = await env.DB.prepare(
    `SELECT id, status, manifest_json, approved_at, deployed_at
       FROM catalog_releases
      WHERE status = 'deployed'
      ORDER BY deployed_at DESC, id DESC
      LIMIT 50`,
  ).all<ReleaseRow>();

  return rows.results.flatMap((row) => {
    let manifest: unknown;
    try {
      manifest = JSON.parse(row.manifest_json);
    } catch {
      return [];
    }
    const parsed = canonicalCatalogReleaseSchema.safeParse(manifest);
    if (!parsed.success || parsed.data.releaseId !== row.id) return [];
    return [
      {
        approvedAt: row.approved_at,
        collections: parsed.data.collections.map(({ id, name, slug }) => ({
          id,
          kind: "collection" as const,
          name,
          slug,
        })),
        deployedAt: row.deployed_at,
        environment: env.ENVIRONMENT,
        id: row.id,
        products: parsed.data.products.map(({ id, name, slug }) => ({
          id,
          kind: "product" as const,
          name,
          slug,
        })),
        status: row.status,
      },
    ];
  });
}

export async function listStorefrontCatalogMedia(env: ApiBindings, query: string) {
  const normalizedQuery = query.trim().slice(0, 100);
  const pattern = `%${normalizedQuery.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const rows = await env.DB.prepare(
    `SELECT pm.r2_key, pm.alt_text, pm.width, pm.height, p.name AS product_name
       FROM product_media pm
       JOIN products p ON p.id = pm.product_id
      WHERE p.status IN ('published', 'archived')
        AND (? = '' OR pm.alt_text LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')
      ORDER BY pm.created_at DESC, pm.r2_key
      LIMIT 100`,
  )
    .bind(normalizedQuery, pattern, pattern)
    .all<{
      alt_text: string;
      height: number;
      product_name: string;
      r2_key: string;
      width: number;
    }>();
  const origin = env.MEDIA_PUBLIC_ORIGIN.replace(/\/+$/, "");
  return rows.results
    .filter(
      ({ r2_key }) =>
        /^catalog\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(r2_key) &&
        !r2_key.includes("..") &&
        !r2_key.includes("//"),
    )
    .map((row) => ({
      alt: row.alt_text,
      height: row.height,
      key: row.r2_key,
      kind: "catalog" as const,
      productName: row.product_name,
      src: `${origin}/${row.r2_key}`,
      width: row.width,
    }));
}
