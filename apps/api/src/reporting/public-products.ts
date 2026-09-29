import {
  analyticsProductPathSchema,
  analyticsStorefrontOriginSchema,
  canonicalCatalogReleaseSchema,
  catalogReleaseV3Schema,
  type CanonicalCatalogRelease,
  type CatalogReleaseV3,
} from "@shoppp/contracts";

import type { ApiBindings } from "../http/context";

export type PublicRelease = CanonicalCatalogRelease | CatalogReleaseV3;

/** Select the current release before looking for a product: older routes are not live links. */
export async function getPublicRelease(
  env: ApiBindings,
  releaseId?: string,
): Promise<PublicRelease | null> {
  const row = await env.DB.prepare(
    `SELECT id, manifest_json FROM catalog_releases
      WHERE status = 'deployed' AND purpose = 'public' AND environment = ?
        AND deployed_at IS NOT NULL ${releaseId === undefined ? "" : "AND id = ?"}
      ORDER BY deployed_at DESC, id DESC LIMIT 1`,
  )
    .bind(...(releaseId === undefined ? [env.ENVIRONMENT] : [env.ENVIRONMENT, releaseId]))
    .first<{ id: string; manifest_json: string }>();
  if (!row) return null;
  let value: unknown;
  try {
    value = JSON.parse(row.manifest_json);
  } catch {
    return null;
  }
  const parsed = catalogReleaseV3Schema.or(canonicalCatalogReleaseSchema).safeParse(value);
  if (!parsed.success || parsed.data.releaseId !== row.id) return null;
  const release = parsed.data;
  if (
    release.schemaVersion === 3 &&
    (release.environment !== env.ENVIRONMENT || release.purpose !== "public")
  )
    return null;
  return release;
}

export function publicStorefrontOrigin(env: ApiBindings): string | null {
  const parsed = analyticsStorefrontOriginSchema.safeParse(env.STOREFRONT_ORIGIN);
  return parsed.success ? parsed.data : null;
}

export function publicProductPath(release: PublicRelease | null, productId: string): string | null {
  const product = release?.products.find((item) => item.id === productId);
  if (!product || product.status !== "published") return null;
  const parsed = analyticsProductPathSchema.safeParse(`/products/${product.slug}`);
  return parsed.success && release!.routes.includes(parsed.data) ? parsed.data : null;
}

export function publicProductName(release: PublicRelease | null, productId: string): string | null {
  return release?.products.find((item) => item.id === productId)?.name ?? null;
}
