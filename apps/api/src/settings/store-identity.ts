import {
  storeIdentitySchema,
  type StoreIdentity,
  type UpdateStoreIdentityRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";

interface IdentityRow {
  created_at: string;
  favicon_asset_id: string | null;
  identity_id: string;
  published_at: string | null;
  seo_json: string;
  social_share_asset_id: string | null;
  status: "draft" | "published" | "archived";
  storefront_name: string;
  tagline: string;
  updated_at: string;
  version: number;
}

async function identityRow(db: D1Database): Promise<IdentityRow | null> {
  return db
    .prepare(
      `SELECT identity_id, version, status, storefront_name, tagline, favicon_asset_id,
              social_share_asset_id, seo_json, published_at, created_at, updated_at
         FROM store_identity_versions
        WHERE identity_id = 'identity.primary'
        ORDER BY version DESC LIMIT 1`,
    )
    .first<IdentityRow>();
}

async function mapIdentity(db: D1Database, row: IdentityRow): Promise<StoreIdentity> {
  const logos = await db
    .prepare(
      `SELECT asset_id AS assetId, variant FROM store_identity_logo_assets
        WHERE identity_id = ? AND identity_version = ? ORDER BY variant`,
    )
    .bind(row.identity_id, row.version)
    .all<{ assetId: string; variant: "primary" | "light" | "dark" | "compact" }>();
  return storeIdentitySchema.parse({
    createdAt: row.created_at,
    ...(row.favicon_asset_id ? { faviconAssetId: row.favicon_asset_id } : {}),
    id: row.identity_id,
    logoAssets: logos.results,
    seo: JSON.parse(row.seo_json),
    ...(row.social_share_asset_id ? { socialShareAssetId: row.social_share_asset_id } : {}),
    status: row.status,
    storefrontName: row.storefront_name,
    tagline: row.tagline,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

export async function getStoreIdentity(db: D1Database): Promise<StoreIdentity | null> {
  const row = await identityRow(db);
  if (!row) return null;
  const identity = await mapIdentity(db, row);
  const inclusion = await db
    .prepare(
      `SELECT
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = 'store-identity' AND source.source_id = ?
            AND source.source_version = ? AND release.purpose = 'private-preview'
            AND release.candidate_status = 'succeeded') AS candidate,
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = 'store-identity' AND source.source_id = ?
            AND source.source_version = ? AND release.status = 'deployed') AS live`,
    )
    .bind(identity.id, identity.version, identity.id, identity.version)
    .first<{ candidate: number; live: number }>();
  return Object.assign(identity, {
    inclusion: { candidate: inclusion?.candidate === 1, live: inclusion?.live === 1 },
  });
}

async function assertAssetsExist(db: D1Database, assetIds: readonly string[]): Promise<void> {
  if (assetIds.length === 0) return;
  const placeholders = assetIds.map(() => "?").join(", ");
  const result = await db
    .prepare(`SELECT id FROM product_media_assets WHERE id IN (${placeholders})`)
    .bind(...assetIds)
    .all<{ id: string }>();
  const found = new Set(result.results.map(({ id }) => id));
  const missing = assetIds.filter((id) => !found.has(id));
  if (missing.length) {
    throw new ApiError(422, "store_identity_asset_invalid", "Select approved media assets.", {
      assetIds: missing,
    });
  }
}

async function logoBacklinks(db: D1Database, removed: readonly string[]) {
  if (!removed.length) return [];
  const rows = await db
    .prepare(
      `SELECT id FROM storefront_experience_drafts
        WHERE ${removed.map(() => "instr(bindings_json, json_quote(?)) > 0 OR instr(overrides_json, json_quote(?)) > 0").join(" OR ")}
        ORDER BY id`,
    )
    .bind(...removed.flatMap((id) => [id, id]))
    .all<{ id: string }>();
  return rows.results.map(({ id }) => ({
    href: `/storefront/themes/${encodeURIComponent(id)}`,
    id,
    type: "storefront-experience-draft" as const,
  }));
}

export async function updateStoreIdentity(
  context: Context<ApiEnvironment>,
  input: UpdateStoreIdentityRequest,
): Promise<StoreIdentity> {
  const current = await identityRow(context.env.DB);
  const currentVersion = current?.version ?? null;
  if (input.expectedVersion !== currentVersion) {
    throw new ApiError(
      409,
      "store_identity_conflict",
      "Store Identity changed. Reload before saving.",
    );
  }
  const currentLogos = current
    ? await context.env.DB.prepare(
        "SELECT asset_id FROM store_identity_logo_assets WHERE identity_id = 'identity.primary' AND identity_version = ?",
      )
        .bind(current.version)
        .all<{ asset_id: string }>()
    : { results: [] as { asset_id: string }[] };
  const nextIds = new Set(input.logoAssets.map(({ assetId }) => assetId));
  const removed = currentLogos.results
    .map(({ asset_id }) => asset_id)
    .filter((assetId) => !nextIds.has(assetId));
  const backlinks = await logoBacklinks(context.env.DB, removed);
  if (backlinks.length) {
    const visibleBacklinks = context.get("principal").permissions.includes("themes.read")
      ? backlinks
      : [];
    throw new ApiError(
      409,
      "store_identity_logo_in_use",
      "A mutable Theme draft still uses a Logo asset being removed.",
      { backlinks: visibleBacklinks },
    );
  }
  await assertAssetsExist(context.env.DB, [
    ...input.logoAssets.map(({ assetId }) => assetId),
    ...(input.faviconAssetId ? [input.faviconAssetId] : []),
    ...(input.socialShareAssetId ? [input.socialShareAssetId] : []),
  ]);

  const now = new Date().toISOString();
  const nextVersion = (currentVersion ?? 0) + 1;
  const principal = context.get("principal");
  const guardKey = `store_identity_write_guard:${context.get("requestId")}`;
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, CASE WHEN (SELECT MAX(version) FROM store_identity_versions
                           WHERE identity_id = 'identity.primary') IS ?
                       THEN '{}' ELSE 'invalid' END, ?)`,
    ).bind(guardKey, currentVersion, now),
    context.env.DB.prepare(
      "UPDATE store_identity_versions SET status = 'archived', updated_at = ? WHERE identity_id = 'identity.primary' AND status = 'published'",
    ).bind(now),
    context.env.DB.prepare(
      `INSERT INTO store_identity_versions
        (identity_id, version, status, storefront_name, tagline, favicon_asset_id,
         social_share_asset_id, seo_json, published_at, created_at, updated_at)
       VALUES ('identity.primary', ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      nextVersion,
      input.storefrontName,
      input.tagline,
      input.faviconAssetId,
      input.socialShareAssetId,
      JSON.stringify(input.seo),
      now,
      now,
      now,
    ),
    ...input.logoAssets.map(({ assetId, variant }) =>
      context.env.DB.prepare(
        `INSERT INTO store_identity_logo_assets
          (identity_id, identity_version, asset_id, variant)
         VALUES ('identity.primary', ?, ?, ?)`,
      ).bind(nextVersion, assetId, variant),
    ),
    prepareAuditEvent(context.env.DB, {
      action: "identity.update",
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { fromVersion: currentVersion, toVersion: nextVersion },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: "identity.primary",
      targetType: "store_identity",
    }),
    context.env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(guardKey),
  ];
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    if ((await identityRow(context.env.DB))?.version !== currentVersion) {
      throw new ApiError(
        409,
        "store_identity_conflict",
        "Store Identity changed. Reload before saving.",
      );
    }
    throw error;
  }
  return (await getStoreIdentity(context.env.DB))!;
}
