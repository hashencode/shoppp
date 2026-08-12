import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { opaqueAccessToken, sha256Hex } from "../orders/tokens";
import { getCanonicalDeployedCatalogRelease } from "./catalog-resources";
import { toPreviewInputIdentity, type PreviewInputIdentityRow } from "./input-identity";
import { getStorefrontExperienceSnapshot } from "./service";

interface GrantRow {
  build_id: string;
  created_by: string;
  expires_at: string;
  id: string;
  origin: string;
  redeemed_at: string | null;
  snapshot_id: string;
}

interface SessionRow extends PreviewInputIdentityRow {
  artifact_prefix: string;
  build_expires_at: string;
  catalog_release_id: string | null;
  experience_version: number | null;
  expires_at: string;
  origin: string;
  platform_contract_version: string | null;
  snapshot_id: string;
  theme_id: string | null;
  theme_version: string | null;
}

const GRANT_TTL_MS = 10 * 60 * 1_000;
const SESSION_TTL_MS = 30 * 60 * 1_000;

function requireConfiguredPreviewOrigin(
  environment: ApiEnvironment["Bindings"],
  origin: string,
): void {
  let configured: URL;
  try {
    configured = new URL(environment.PREVIEW_ORIGIN);
  } catch {
    throw new ApiError(
      500,
      "storefront_preview_origin_not_configured",
      "The private preview origin is not configured.",
    );
  }
  if (
    configured.protocol !== "https:" ||
    configured.origin !== environment.PREVIEW_ORIGIN ||
    origin !== environment.PREVIEW_ORIGIN
  ) {
    throw new ApiError(
      403,
      "storefront_preview_origin_invalid",
      "The request does not match the private preview origin.",
    );
  }
}

export function requirePreviewServiceCredential(
  context: Context<ApiEnvironment>,
  configuredToken: string | undefined,
): void {
  if (!configuredToken || configuredToken.length < 32) {
    throw new ApiError(
      500,
      "storefront_preview_service_not_configured",
      "The private preview authorization service is not configured.",
    );
  }
  if (context.req.header("authorization") !== `Bearer ${configuredToken}`) {
    throw new ApiError(
      401,
      "storefront_preview_service_unauthorized",
      "Private preview service authentication is required.",
    );
  }
}

export async function createStorefrontPreviewGrant(
  context: Context<ApiEnvironment>,
  snapshotId: string,
  origin: string,
  reason: string,
  catalogReleaseId?: string,
) {
  requireConfiguredPreviewOrigin(context.env, origin);
  await getStorefrontExperienceSnapshot(context.env.DB, snapshotId);
  if (catalogReleaseId) {
    await getCanonicalDeployedCatalogRelease(context.env.DB, catalogReleaseId);
  }
  const build = await context.env.DB.prepare(
    `SELECT id, snapshot_id, artifact_digest, artifact_prefix, expires_at,
            catalog_release_id, experience_version, theme_id, theme_version,
            platform_contract_version
       FROM storefront_preview_builds
      WHERE snapshot_id = ? AND catalog_release_id IS ?
        AND status = 'deployed' AND expires_at > ?
      ORDER BY attempt DESC
      LIMIT 1`,
  )
    .bind(snapshotId, catalogReleaseId ?? null, new Date().toISOString())
    .first<{
      artifact_digest: string;
      artifact_prefix: string;
      catalog_release_id: string | null;
      experience_version: number | null;
      expires_at: string;
      id: string;
      platform_contract_version: string | null;
      snapshot_id: string;
      theme_id: string | null;
      theme_version: string | null;
    }>();
  if (!build) {
    throw new ApiError(
      409,
      "storefront_preview_artifact_unavailable",
      "A current immutable preview artifact is required before issuing access.",
    );
  }
  const grant = opaqueAccessToken();
  const grantDigest = await sha256Hex(grant);
  const id = `preview-grant-${crypto.randomUUID()}`;
  const principal = context.get("principal");
  const now = new Date();
  const expiresAt = new Date(
    Math.min(now.getTime() + GRANT_TTL_MS, Date.parse(build.expires_at)),
  ).toISOString();
  await context.env.DB.prepare(
    `INSERT INTO storefront_preview_grants
       (id, snapshot_id, build_id, grant_digest, origin, expires_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, snapshotId, build.id, grantDigest, origin, expiresAt, principal.id, now.toISOString())
    .run();
  await recordAuditEvent(context.env.DB, {
    action: "themes.preview.grant.create",
    actorId: principal.id,
    actorType: "admin",
    id: crypto.randomUUID(),
    metadata: {
      artifactDigest: build.artifact_digest,
      ...(catalogReleaseId ? { catalogReleaseId } : {}),
      expiresAt,
      snapshotId,
    },
    reason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "storefront_preview_grant",
  });
  return {
    expiresAt,
    grant,
    inputIdentity: toPreviewInputIdentity(build),
    redeemUrl: `${origin}/__preview/session`,
    snapshotId,
  };
}

export async function redeemStorefrontPreviewGrant(
  context: Context<ApiEnvironment>,
  grant: string,
  origin: string,
) {
  requireConfiguredPreviewOrigin(context.env, origin);
  const digest = await sha256Hex(grant);
  const now = new Date();
  const row = await context.env.DB.prepare(
    `SELECT id, snapshot_id, build_id, origin, expires_at, redeemed_at, created_by
       FROM storefront_preview_grants
      WHERE grant_digest = ?`,
  )
    .bind(digest)
    .first<GrantRow>();
  if (
    !row ||
    row.origin !== origin ||
    row.redeemed_at !== null ||
    Date.parse(row.expires_at) <= now.getTime()
  ) {
    throw new ApiError(
      403,
      "storefront_preview_grant_invalid",
      "The private preview grant is invalid, expired, or already used.",
    );
  }
  const redeemed = await context.env.DB.prepare(
    `UPDATE storefront_preview_grants
        SET redeemed_at = ?
      WHERE id = ? AND redeemed_at IS NULL AND expires_at > ? AND origin = ?`,
  )
    .bind(now.toISOString(), row.id, now.toISOString(), origin)
    .run();
  if (redeemed.meta.changes !== 1) {
    throw new ApiError(
      403,
      "storefront_preview_grant_invalid",
      "The private preview grant is invalid, expired, or already used.",
    );
  }
  const session = opaqueAccessToken();
  const sessionDigest = await sha256Hex(session);
  const build = await context.env.DB.prepare(
    `SELECT snapshot_id, expires_at, catalog_release_id, experience_version,
            theme_id, theme_version, platform_contract_version
       FROM storefront_preview_builds
      WHERE id = ? AND snapshot_id = ? AND status = 'deployed' AND expires_at > ?`,
  )
    .bind(row.build_id, row.snapshot_id, now.toISOString())
    .first<PreviewInputIdentityRow & { expires_at: string }>();
  if (!build) {
    throw new ApiError(
      403,
      "storefront_preview_artifact_expired",
      "The private preview artifact is no longer available.",
    );
  }
  const expiresAt = new Date(
    Math.min(now.getTime() + SESSION_TTL_MS, Date.parse(build.expires_at)),
  ).toISOString();
  await context.env.DB.prepare(
    `INSERT INTO storefront_preview_sessions
       (id, snapshot_id, build_id, session_digest, origin, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      `preview-session-${crypto.randomUUID()}`,
      row.snapshot_id,
      row.build_id,
      sessionDigest,
      origin,
      expiresAt,
      now.toISOString(),
    )
    .run();
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events
       (id, actor_type, actor_id, action, target_type, target_id, result,
        request_id, metadata_json, created_at)
     VALUES (?, 'machine', ?, 'themes.preview.grant.redeem', 'storefront_preview_grant',
             ?, 'succeeded', ?, ?, ?)`,
  )
    .bind(
      `audit-preview-grant-redeem-${row.id}`,
      row.created_by,
      row.id,
      context.get("requestId"),
      JSON.stringify({ expiresAt, snapshotId: row.snapshot_id }),
      now.toISOString(),
    )
    .run();
  return { expiresAt, inputIdentity: toPreviewInputIdentity(build), session };
}

export async function authorizeStorefrontPreviewSession(
  context: Context<ApiEnvironment>,
  session: string,
  origin: string,
) {
  requireConfiguredPreviewOrigin(context.env, origin);
  const digest = await sha256Hex(session);
  const row = await context.env.DB.prepare(
    `SELECT s.snapshot_id, s.origin, s.expires_at,
            b.artifact_prefix, b.expires_at AS build_expires_at,
            b.catalog_release_id, b.experience_version, b.theme_id, b.theme_version,
            b.platform_contract_version
       FROM storefront_preview_sessions s
       JOIN storefront_preview_builds b ON b.id = s.build_id
      WHERE s.session_digest = ? AND b.status = 'deployed'`,
  )
    .bind(digest)
    .first<SessionRow>();
  const now = Date.now();
  if (
    !row ||
    row.origin !== origin ||
    Date.parse(row.expires_at) <= now ||
    Date.parse(row.build_expires_at) <= now
  ) {
    throw new ApiError(
      403,
      "storefront_preview_session_invalid",
      "The private preview session is invalid or expired.",
    );
  }
  return {
    artifactPrefix: row.artifact_prefix,
    authorized: true as const,
    expiresAt:
      Date.parse(row.expires_at) < Date.parse(row.build_expires_at)
        ? row.expires_at
        : row.build_expires_at,
    inputIdentity: toPreviewInputIdentity(row),
    origin: row.origin,
    snapshotId: row.snapshot_id,
  };
}
