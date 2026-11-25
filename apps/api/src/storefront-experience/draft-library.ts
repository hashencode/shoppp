import type { Context } from "hono";
import type { StorefrontDraftLibraryAction } from "@shoppp/contracts";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareConditionalAuditEvent } from "../iam/audit";
import { assertStorefrontThemeLifecycleWritable } from "./retirement-policy";
import { assertStorefrontThemePackageActivatable, getStorefrontExperienceDraft } from "./service";

export async function applyDraftLibraryAction(
  context: Context<ApiEnvironment>,
  id: string,
  input: StorefrontDraftLibraryAction,
) {
  const source = await getStorefrontExperienceDraft(context.env.DB, id);
  assertStorefrontThemeLifecycleWritable(source.themeId);
  if (source.version !== input.expectedVersion)
    throw new ApiError(
      409,
      "storefront_experience_draft_conflict",
      "The saved draft changed. Reload before continuing.",
    );
  const now = new Date().toISOString(),
    actor = context.get("principal").id;
  let targetId = id;
  let operation: D1PreparedStatement;
  if (input.kind === "copy") {
    assertStorefrontThemePackageActivatable(
      source.themeId,
      source.themeVersion,
      source.configurationSchemaVersion,
    );
    targetId = `draft-${crypto.randomUUID()}`;
    operation = context.env.DB.prepare(
      `INSERT INTO storefront_experience_drafts
      (id, name, experience_id, theme_id, theme_version, configuration_schema_version, preset_id,
       bindings_json, overrides_json, version, created_by, updated_by, created_at, updated_at)
      SELECT ?, ?, ?, theme_id, theme_version, configuration_schema_version, preset_id,
        bindings_json, overrides_json, 1, ?, ?, ?, ? FROM storefront_experience_drafts
      WHERE id = ? AND version = ? AND removed_at IS NULL`,
    ).bind(
      targetId,
      input.name,
      `storefront-copy-${crypto.randomUUID()}`,
      actor,
      actor,
      now,
      now,
      id,
      input.expectedVersion,
    );
  } else if (input.kind === "rename") {
    operation = context.env.DB.prepare(
      `UPDATE storefront_experience_drafts SET name = ?, version = version + 1,
      updated_by = ?, updated_at = ? WHERE id = ? AND version = ? AND removed_at IS NULL`,
    ).bind(input.name, actor, now, id, input.expectedVersion);
  } else {
    operation = context.env.DB.prepare(
      `UPDATE storefront_experience_drafts SET removed_at = ?, removed_by = ?,
      updated_at = ?, updated_by = ?, version = version + 1
      WHERE id = ? AND version = ? AND removed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM fashion_staging_operator_runs run
          WHERE (run.source_draft_id = storefront_experience_drafts.id OR run.working_draft_id = storefront_experience_drafts.id)
          AND run.status IN ('awaiting_operator', 'approved') AND run.expires_at > ?)
        AND NOT EXISTS (SELECT 1 FROM storefront_preview_builds build
          JOIN storefront_experience_snapshots snapshot ON snapshot.id = build.snapshot_id
          WHERE snapshot.source_draft_id = storefront_experience_drafts.id AND build.status IN ('pending', 'building'))`,
    ).bind(now, actor, now, actor, id, input.expectedVersion, now);
  }
  const results = await context.env.DB.batch([
    operation,
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: `themes.draft.${input.kind}`,
        actorId: actor,
        actorType: "admin",
        id: crypto.randomUUID(),
        targetId,
        targetType: "storefront_experience_draft",
        requestId: context.get("requestId"),
        result: "succeeded",
        ...(input.reason ? { reason: input.reason } : {}),
        metadata: { sourceDraftId: id, sourceVersion: input.expectedVersion },
      },
      { sql: "SELECT 1 WHERE changes() = 1", bindings: [] },
    ),
  ]);
  if (results[0]!.meta.changes !== 1) {
    const latest = await getStorefrontExperienceDraft(context.env.DB, id);
    if (latest.version !== input.expectedVersion)
      throw new ApiError(
        409,
        "storefront_experience_draft_conflict",
        "The saved draft changed. Reload before continuing.",
      );
    throw new ApiError(
      409,
      "storefront_experience_draft_busy",
      "This draft has an active operator run or preview build. Complete that operation before removing it.",
    );
  }
  return input.kind === "remove"
    ? { id, removedAt: now }
    : getStorefrontExperienceDraft(context.env.DB, targetId);
}
