import type { ApiBindings } from "../http/context";

async function deletePrefix(bucket: R2Bucket, prefix: string): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await bucket.list({
      ...(cursor ? { cursor } : {}),
      limit: 500,
      prefix: `${prefix}/`,
    });
    const keys = page.objects.map(({ key }) => key);
    if (keys.length > 0) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

export async function cleanupExpiredStorefrontPreviews(
  environment: Pick<ApiBindings, "DB" | "PREVIEW_ARTIFACTS">,
  now = new Date(),
): Promise<{ artifacts: number; grants: number; objects: number; sessions: number }> {
  const timestamp = now.toISOString();
  const expired = await environment.DB.prepare(
    `SELECT id, artifact_prefix, expires_at
       FROM storefront_preview_builds
      WHERE status = 'deployed' AND cleaned_at IS NULL AND expires_at <= ?
      ORDER BY expires_at, id
      LIMIT 100`,
  )
    .bind(timestamp)
    .all<{ artifact_prefix: string; expires_at: string; id: string }>();
  let artifacts = 0;
  let objects = 0;
  for (const candidate of expired.results) {
    const current = await environment.DB.prepare(
      `SELECT status, artifact_prefix, expires_at, cleaned_at
         FROM storefront_preview_builds
        WHERE id = ?`,
    )
      .bind(candidate.id)
      .first<{
        artifact_prefix: string | null;
        cleaned_at: string | null;
        expires_at: string | null;
        status: string;
      }>();
    if (
      !current ||
      current.status !== "deployed" ||
      current.cleaned_at !== null ||
      current.artifact_prefix !== candidate.artifact_prefix ||
      !current.expires_at ||
      current.expires_at > timestamp
    ) {
      continue;
    }
    const deletedObjects = await deletePrefix(
      environment.PREVIEW_ARTIFACTS,
      candidate.artifact_prefix,
    );
    objects += deletedObjects;
    const changed = await environment.DB.prepare(
      `UPDATE storefront_preview_builds
          SET status = 'expired', cleaned_at = ?, updated_at = ?
        WHERE id = ? AND status = 'deployed' AND cleaned_at IS NULL
          AND artifact_prefix = ? AND expires_at <= ?`,
    )
      .bind(timestamp, timestamp, candidate.id, candidate.artifact_prefix, timestamp)
      .run();
    if (changed.meta.changes !== 1) continue;
    artifacts += 1;
    await environment.DB.prepare(
      `INSERT OR IGNORE INTO audit_events
         (id, actor_type, action, target_type, target_id, result, metadata_json, created_at)
       VALUES (?, 'machine', 'themes.preview.artifact.expire', 'storefront_preview_build',
               ?, 'succeeded', ?, ?)`,
    )
      .bind(
        `audit-preview-cleanup-${candidate.id}`,
        candidate.id,
        JSON.stringify({ artifactPrefix: candidate.artifact_prefix, deletedObjects }),
        timestamp,
      )
      .run();
  }
  const sessions = await environment.DB.prepare(
    `DELETE FROM storefront_preview_sessions
      WHERE expires_at <= ?
         OR build_id IN (SELECT id FROM storefront_preview_builds WHERE status = 'expired')`,
  )
    .bind(timestamp)
    .run();
  const grants = await environment.DB.prepare(
    `DELETE FROM storefront_preview_grants
      WHERE expires_at <= ? OR redeemed_at IS NOT NULL
         OR build_id IN (SELECT id FROM storefront_preview_builds WHERE status = 'expired')`,
  )
    .bind(timestamp)
    .run();
  return {
    artifacts,
    grants: grants.meta.changes,
    objects,
    sessions: sessions.meta.changes,
  };
}
