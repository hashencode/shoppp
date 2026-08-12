import type { StorefrontExperienceBuildResult } from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { sha256Hex } from "../orders/tokens";
import { toPreviewInputIdentity, type PreviewInputIdentityRow } from "./input-identity";
import { getStorefrontExperienceSnapshot } from "./service";
import { getCanonicalDeployedCatalogRelease } from "./catalog-resources";

export interface ExperienceBuildTriggerResult {
  readonly correlationId: string;
}

export type ExperienceBuildTrigger = (input: {
  readonly buildId: string;
  readonly catalogReleaseId?: string;
  readonly environment: string;
  readonly manifestUrl: string;
  readonly requestId: string;
  readonly snapshotId: string;
}) => Promise<ExperienceBuildTriggerResult>;

interface BuildRow extends PreviewInputIdentityRow {
  artifact_digest: string | null;
  artifact_prefix: string | null;
  attempt: number;
  cleaned_at: string | null;
  completed_at: string | null;
  correlation_id: string | null;
  catalog_release_id: string | null;
  created_at: string;
  expires_at: string | null;
  failure_code: string | null;
  id: string;
  experience_version: number | null;
  platform_contract_version: string | null;
  snapshot_id: string;
  status: "building" | "deployed" | "expired" | "failed" | "pending";
  theme_id: string | null;
  theme_version: string | null;
  updated_at: string;
}

const BUILD_HOOK_TIMEOUT_MS = 15_000;

function mapBuild(row: BuildRow) {
  return {
    artifactDigest: row.artifact_digest,
    artifactPrefix: row.artifact_prefix,
    attempt: row.attempt,
    cleanedAt: row.cleaned_at,
    completedAt: row.completed_at,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    failureCode: row.failure_code,
    id: row.id,
    inputIdentity: toPreviewInputIdentity(row),
    snapshotId: row.snapshot_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

async function buildRow(db: D1Database, id: string): Promise<BuildRow> {
  const row = await db
    .prepare("SELECT * FROM storefront_preview_builds WHERE id = ?")
    .bind(id)
    .first<BuildRow>();
  if (!row) {
    throw new ApiError(
      404,
      "storefront_preview_build_not_found",
      "The storefront preview build was not found.",
    );
  }
  return row;
}

function buildResultMatches(row: BuildRow, result: StorefrontExperienceBuildResult): boolean {
  if (row.status !== result.status) return false;
  return result.status === "deployed"
    ? row.artifact_digest === result.artifactDigest &&
        row.artifact_prefix === result.artifactPrefix &&
        row.expires_at === result.expiresAt
    : row.failure_code === result.failureCode;
}

function assertMatchingBuildResult(row: BuildRow, result: StorefrontExperienceBuildResult): void {
  if (buildResultMatches(row, result)) return;
  throw new ApiError(
    409,
    "storefront_preview_build_result_conflict",
    "The preview build already recorded a different terminal result.",
  );
}

async function auditBuildStart(
  context: Context<ApiEnvironment>,
  buildId: string,
  result: "failed" | "succeeded",
  metadata: Record<string, unknown>,
): Promise<void> {
  const principal = context.get("principal");
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events
       (id, actor_type, actor_id, action, target_type, target_id, result,
        request_id, metadata_json, created_at)
     VALUES (?, 'admin', ?, 'themes.preview.build.start', 'storefront_preview_build',
             ?, ?, ?, ?, ?)`,
  )
    .bind(
      `audit-${buildId}-start`,
      principal.id,
      buildId,
      result,
      context.get("requestId"),
      JSON.stringify(metadata),
      new Date().toISOString(),
    )
    .run();
}

export async function getStorefrontExperienceBuild(db: D1Database, id: string) {
  return mapBuild(await buildRow(db, id));
}

export function defaultExperienceBuildTrigger(
  environment: ApiEnvironment["Bindings"],
): ExperienceBuildTrigger {
  return async (input) => {
    if (!environment.PREVIEW_BUILD_HOOK || !environment.PREVIEW_BUILD_HOOK_TOKEN) {
      throw new ApiError(
        500,
        "storefront_preview_build_hook_not_configured",
        "The storefront preview build hook is not configured.",
      );
    }
    const response = await fetch(environment.PREVIEW_BUILD_HOOK, {
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${environment.PREVIEW_BUILD_HOOK_TOKEN}`,
        "Content-Type": "application/json",
        "X-Request-Id": input.requestId,
      },
      method: "POST",
      signal: AbortSignal.timeout(BUILD_HOOK_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new ApiError(
        500,
        "storefront_preview_build_hook_failed",
        "The storefront preview build could not be started.",
      );
    }
    const body: { correlationId?: string } = await response
      .json<{ correlationId?: string }>()
      .catch(() => ({}));
    return {
      correlationId:
        body.correlationId ?? response.headers.get("x-build-correlation-id") ?? crypto.randomUUID(),
    };
  };
}

export async function getStorefrontExperienceBuildManifest(
  context: Context<ApiEnvironment>,
  snapshotId: string,
) {
  const snapshot = await getStorefrontExperienceSnapshot(context.env.DB, snapshotId);
  return {
    environment: "preview" as const,
    expectedOrigin: context.env.PREVIEW_ORIGIN,
    snapshot: snapshot.snapshot,
    themeId: snapshot.themeId,
  };
}

export async function getStorefrontExperienceBuildManifestByBuild(
  context: Context<ApiEnvironment>,
  buildId: string,
) {
  const build = await buildRow(context.env.DB, buildId);
  if (!build.catalog_release_id) {
    return getStorefrontExperienceBuildManifest(context, build.snapshot_id);
  }
  const [snapshot, catalogRelease] = await Promise.all([
    getStorefrontExperienceSnapshot(context.env.DB, build.snapshot_id),
    getCanonicalDeployedCatalogRelease(context.env.DB, build.catalog_release_id),
  ]);
  return {
    catalogRelease,
    environment: "preview" as const,
    expectedOrigin: context.env.PREVIEW_ORIGIN,
    inputIdentity: mapBuild(build).inputIdentity,
    presentationMode: "live" as const,
    snapshot: snapshot.snapshot,
    themeId: snapshot.themeId,
  };
}

export async function triggerStorefrontExperienceBuild(
  context: Context<ApiEnvironment>,
  snapshotId: string,
  trigger: ExperienceBuildTrigger,
  catalogReleaseId?: string,
) {
  const snapshot = await getStorefrontExperienceSnapshot(context.env.DB, snapshotId);
  if (catalogReleaseId) {
    await getCanonicalDeployedCatalogRelease(context.env.DB, catalogReleaseId);
  }
  const existing = await context.env.DB.prepare(
    `SELECT *
       FROM storefront_preview_builds
      WHERE snapshot_id = ? AND catalog_release_id IS ?
        AND status IN ('deployed', 'building', 'pending')
      ORDER BY attempt DESC
      LIMIT 1`,
  )
    .bind(snapshotId, catalogReleaseId ?? null)
    .first<BuildRow>();
  if (existing) return mapBuild(existing);

  const latest = await context.env.DB.prepare(
    `SELECT COALESCE(MAX(attempt), 0) AS attempt
       FROM storefront_preview_builds
      WHERE snapshot_id = ?`,
  )
    .bind(snapshotId)
    .first<{ attempt: number }>();
  const attempt = (latest?.attempt ?? 0) + 1;
  const inputToken = catalogReleaseId
    ? (await sha256Hex(catalogReleaseId)).slice(0, 16)
    : "fixture";
  const buildId = `preview-build-${snapshotId.slice(-24)}-${inputToken}-${attempt}`;
  const now = new Date().toISOString();
  const inserted = await context.env.DB.prepare(
    `INSERT OR IGNORE INTO storefront_preview_builds
       (id, snapshot_id, catalog_release_id, experience_version, theme_id, theme_version,
        platform_contract_version, attempt, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      buildId,
      snapshotId,
      catalogReleaseId ?? null,
      catalogReleaseId ? snapshot.snapshot.version : null,
      catalogReleaseId ? snapshot.snapshot.themeId : null,
      catalogReleaseId ? snapshot.snapshot.themeVersion : null,
      catalogReleaseId ? snapshot.snapshot.platformContractVersion : null,
      attempt,
      now,
      now,
    )
    .run();
  if (inserted.meta.changes === 0) {
    return mapBuild(await buildRow(context.env.DB, buildId));
  }

  let result: ExperienceBuildTriggerResult;
  try {
    result = await trigger({
      buildId,
      ...(catalogReleaseId ? { catalogReleaseId } : {}),
      environment: context.env.ENVIRONMENT,
      manifestUrl: catalogReleaseId
        ? `${context.env.PUBLIC_ORIGIN.replace(/\/$/, "")}/build/storefront-experiences/builds/${buildId}`
        : `${context.env.PUBLIC_ORIGIN.replace(/\/$/, "")}/build/storefront-experiences/snapshots/${snapshotId}`,
      requestId: context.get("requestId"),
      snapshotId,
    });
  } catch (error) {
    const failureCode =
      error instanceof ApiError ? error.code : "storefront_preview_build_hook_failed";
    await context.env.DB.prepare(
      `UPDATE storefront_preview_builds
          SET status = 'failed', failure_code = ?, completed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'`,
    )
      .bind(failureCode, new Date().toISOString(), new Date().toISOString(), buildId)
      .run();
    await auditBuildStart(context, buildId, "failed", { failureCode, snapshotId });
    throw error;
  }

  await context.env.DB.prepare(
    `UPDATE storefront_preview_builds
        SET status = 'building', correlation_id = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`,
  )
    .bind(result.correlationId, new Date().toISOString(), buildId)
    .run();
  await auditBuildStart(context, buildId, "succeeded", {
    correlationId: result.correlationId,
    snapshotId,
  });
  return mapBuild(await buildRow(context.env.DB, buildId));
}

export async function recordStorefrontExperienceBuildResult(
  context: Context<ApiEnvironment>,
  buildId: string,
  result: StorefrontExperienceBuildResult,
) {
  const current = await buildRow(context.env.DB, buildId);
  if (current.status === result.status) {
    assertMatchingBuildResult(current, result);
    return mapBuild(current);
  }
  if (current.status !== "building") {
    throw new ApiError(
      409,
      "storefront_preview_build_transition_invalid",
      `A preview build in ${current.status} cannot transition to ${result.status}.`,
    );
  }
  if (result.status === "deployed") {
    const expectedPrefix = current.catalog_release_id
      ? `snapshots/${current.snapshot_id}/${current.catalog_release_id}/${result.artifactDigest}`
      : `snapshots/${current.snapshot_id}/${result.artifactDigest}`;
    if (result.artifactPrefix !== expectedPrefix || Date.parse(result.expiresAt) <= Date.now()) {
      throw new ApiError(
        422,
        "storefront_preview_artifact_invalid",
        "The preview artifact identity or retention deadline is invalid.",
      );
    }
  }
  const now = new Date().toISOString();
  const changed = await context.env.DB.prepare(
    `UPDATE storefront_preview_builds
        SET status = ?, artifact_digest = ?, artifact_prefix = ?, failure_code = ?,
            expires_at = ?, completed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'building'`,
  )
    .bind(
      result.status,
      result.status === "deployed" ? result.artifactDigest : null,
      result.status === "deployed" ? result.artifactPrefix : null,
      result.status === "failed" ? result.failureCode : null,
      result.status === "deployed" ? result.expiresAt : null,
      now,
      now,
      buildId,
    )
    .run();
  if (changed.meta.changes !== 1) {
    const reconciled = await buildRow(context.env.DB, buildId);
    if (reconciled.status === result.status) {
      assertMatchingBuildResult(reconciled, result);
      return mapBuild(reconciled);
    }
    throw new ApiError(
      409,
      "storefront_preview_build_transition_conflict",
      "The preview build changed while its result was recorded.",
    );
  }
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events
       (id, actor_type, action, target_type, target_id, result, reason, request_id,
        metadata_json, created_at)
     VALUES (?, 'machine', 'themes.preview.build.result', 'storefront_preview_build', ?,
             ?, ?, ?, ?, ?)`,
  )
    .bind(
      `audit-${buildId}-${result.status}`,
      buildId,
      result.status === "deployed" ? "succeeded" : "failed",
      result.status === "failed" ? result.failureCode : null,
      context.get("requestId"),
      JSON.stringify({
        artifactDigest: result.status === "deployed" ? result.artifactDigest : undefined,
        status: result.status,
      }),
      now,
    )
    .run();
  return mapBuild(await buildRow(context.env.DB, buildId));
}
