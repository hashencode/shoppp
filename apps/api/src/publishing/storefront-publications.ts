import type { Context } from "hono";
import {
  canonicalCatalogReleaseSchema,
  canonicalStorefrontJson,
  catalogReleaseV3Schema,
  experienceSnapshotSchema,
  sameStorefrontPublicationIdentity,
  storefrontActivationObservationSchema,
  storefrontPublicationBuildInputSchema,
  storefrontPublicationBuildManifestSchema,
  storefrontPublicationIdentitySchema,
  storefrontPublicationSchema,
  type StorefrontActivePublication,
  type StorefrontPublication,
  type StorefrontPublicationCallback,
  type StorefrontPublicationContext,
  type StorefrontPublicationIdentity,
  type StorefrontPublicationRequest,
  type StorefrontPublicationRollback,
} from "@shoppp/contracts";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareConditionalAuditEvent, recordAuditEvent } from "../iam/audit";
import { sha256Hex } from "../orders/tokens";
import { normalizeAuditReason } from "../security/audit-reason";
import { catalogMediaOrigins } from "../storefront-experience/media-origins";
import { frozenContact } from "../storefront-experience/service";
import { defaultBuildTrigger, type BuildTrigger } from "./releases";

type ApiContext = Context<ApiEnvironment>;
interface PublicationRow {
  id: string;
  environment: StorefrontPublication["environment"];
  identity_json: string;
  operation: StorefrontPublication["operation"];
  status: StorefrontPublication["status"];
  expected_active_publication_id: string | null;
  rollback_of: string | null;
  restore_worker_version_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  reason: string;
  correlation_id: string | null;
  failure_code: string | null;
  run_id: string | null;
  run_attempt: number | null;
  source_commit: string | null;
  receipt_json: string | null;
}
interface ApprovalRow {
  id: string;
  source_draft_id: string;
  source_draft_version: number;
  source_validation_id: string;
  snapshot_json: string;
  content_digest: string | null;
  catalog_release_id: string | null;
}
interface CatalogRow {
  id: string;
  environment: StorefrontPublication["environment"];
  manifest_json: string;
  manifest_digest: string | null;
  source_digest: string | null;
  purpose: "private-preview" | "public";
  candidate_status: string | null;
  candidate_expires_at: string | null;
  status: string;
}
function conflict(code: string, message: string): never {
  throw new ApiError(409, code, message);
}
export function requirePublicationHuman(context: ApiContext): void {
  if (context.get("principal").principalKind !== "human") {
    throw new ApiError(
      403,
      "human_principal_required",
      "A human operator must publish the storefront.",
    );
  }
}
function mapPublication(row: PublicationRow): StorefrontPublication {
  return storefrontPublicationSchema.parse({
    id: row.id,
    environment: row.environment,
    identity: JSON.parse(row.identity_json),
    operation: row.operation,
    status: row.status,
    expectedActivePublicationId: row.expected_active_publication_id,
    rollbackOf: row.rollback_of,
    restoreWorkerVersionId: row.restore_worker_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    reason: row.reason,
    correlationId: row.correlation_id,
    failureCode: row.failure_code,
    runId: row.run_id,
    runAttempt: row.run_attempt,
    sourceCommit: row.source_commit,
    receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null,
  });
}
export async function getStorefrontPublication(
  db: D1Database,
  id: string,
  environment: StorefrontPublication["environment"],
): Promise<StorefrontPublication> {
  const row = await db
    .prepare("SELECT * FROM storefront_publications WHERE id = ? AND environment = ?")
    .bind(id, environment)
    .first<PublicationRow>();
  if (!row)
    throw new ApiError(404, "storefront_publication_not_found", "The publication was not found.");
  return mapPublication(row);
}
async function activePublication(
  db: D1Database,
  environment: StorefrontPublication["environment"],
) {
  const row = await db
    .prepare(
      `SELECT p.* FROM storefront_active_publications active
    JOIN storefront_publications p ON p.id = active.publication_id
    WHERE active.environment = ?`,
    )
    .bind(environment)
    .first<PublicationRow>();
  return row ? mapPublication(row) : null;
}
async function observeStorefront(context: ApiContext) {
  const url = new URL(context.env.STOREFRONT_ORIGIN);
  if (
    url.origin !== context.env.STOREFRONT_ORIGIN ||
    url.protocol !== "https:" ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid configured storefront origin.");
  }
  const response = await fetch(`${url.origin}/.well-known/shoppp-release`, {
    headers: { "Cache-Control": "no-cache" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("The storefront observation is unavailable.");
  return storefrontActivationObservationSchema.parse(await response.json());
}
export async function getActiveStorefrontPublication(
  context: ApiContext,
): Promise<StorefrontActivePublication> {
  const publication = await activePublication(context.env.DB, context.env.ENVIRONMENT);
  const checkedAt = new Date().toISOString();
  if (!publication) return { publication: null, verification: "none", checkedAt };
  try {
    const observed = await observeStorefront(context);
    const verified =
      observed.sourceEnvironment === context.env.ENVIRONMENT &&
      sameStorefrontPublicationIdentity(observed.identity, publication.identity) &&
      observed.workerVersionId === publication.receipt?.workerVersionId;
    return { publication, verification: verified ? "verified" : "mismatch", checkedAt };
  } catch {
    return { publication, verification: "unavailable", checkedAt };
  }
}
async function approval(db: D1Database, id: string): Promise<ApprovalRow> {
  const row = await db
    .prepare(
      `SELECT s.*, v.catalog_release_id
    FROM storefront_experience_snapshots s
    JOIN storefront_experience_validations v ON v.id = s.source_validation_id
    WHERE s.id = ? AND s.kind = 'approved' AND s.approved_by IS NOT NULL
      AND v.status = 'valid' AND v.draft_id = s.source_draft_id
      AND v.draft_version = s.source_draft_version`,
    )
    .bind(id)
    .first<ApprovalRow>();
  if (!row || !row.catalog_release_id) {
    conflict(
      "storefront_publication_approval_invalid",
      "Approve an exact live Catalog Release before publishing.",
    );
  }
  return row;
}
async function catalog(db: D1Database, id: string): Promise<CatalogRow> {
  const row = await db
    .prepare("SELECT * FROM catalog_releases WHERE id = ?")
    .bind(id)
    .first<CatalogRow>();
  if (!row)
    throw new ApiError(404, "catalog_release_not_found", "The Catalog Release was not found.");
  return row;
}
async function approvedInput(context: ApiContext, approved: ApprovalRow) {
  const snapshot = experienceSnapshotSchema.parse(JSON.parse(approved.snapshot_json));
  if (
    snapshot.kind !== "approved" ||
    snapshot.id !== approved.id ||
    snapshot.version !== approved.source_draft_version
  ) {
    conflict(
      "storefront_publication_approval_invalid",
      "The approved Snapshot identity is invalid.",
    );
  }
  const release = await catalog(context.env.DB, approved.catalog_release_id!);
  if (release.environment !== context.env.ENVIRONMENT) {
    conflict(
      "catalog_release_environment_mismatch",
      "The approved Catalog Release belongs to another environment.",
    );
  }
  const catalogRelease = catalogReleaseV3Schema
    .or(canonicalCatalogReleaseSchema)
    .parse(JSON.parse(release.manifest_json));
  const manifestDigest = await sha256Hex(release.manifest_json);
  const snapshotDigest = await sha256Hex(canonicalStorefrontJson(snapshot));
  if (
    (release.manifest_digest && release.manifest_digest !== manifestDigest) ||
    (approved.content_digest && approved.content_digest !== snapshotDigest)
  ) {
    conflict(
      "storefront_publication_digest_mismatch",
      "The approved content no longer matches its immutable digest.",
    );
  }
  const identity = storefrontPublicationIdentitySchema.parse({
    catalogReleaseId: release.id,
    catalogManifestDigest: manifestDigest,
    catalogSourceDigest: release.source_digest,
    experienceSnapshotId: approved.id,
    snapshotDigest,
    contactVersion: snapshot.contact?.version,
    experienceVersion: snapshot.version,
    themeId: snapshot.themeId,
    themeVersion: snapshot.themeVersion,
    platformContractVersion: snapshot.platformContractVersion,
  });
  return { identity, snapshot, release, catalogRelease };
}
export async function getStorefrontPublicationContext(
  context: ApiContext,
  draftId: string,
): Promise<StorefrontPublicationContext> {
  requirePublicationHuman(context);
  const draft = await context.env.DB.prepare(
    "SELECT version FROM storefront_experience_drafts WHERE id = ?",
  )
    .bind(draftId)
    .first<{ version: number }>();
  if (!draft)
    throw new ApiError(404, "storefront_experience_draft_not_found", "The draft was not found.");
  const latest = await context.env.DB.prepare(
    `SELECT s.id FROM storefront_experience_snapshots s
    JOIN storefront_experience_validations v ON v.id = s.source_validation_id
    WHERE s.source_draft_id = ? AND s.source_draft_version = ? AND s.kind = 'approved'
      AND v.status = 'valid' AND v.catalog_release_id IS NOT NULL
    ORDER BY s.approved_at DESC, s.id DESC LIMIT 1`,
  )
    .bind(draftId, draft.version)
    .first<{ id: string }>();
  let currentApproval: StorefrontPublicationContext["approval"] = null;
  if (latest) {
    const row = await approval(context.env.DB, latest.id);
    const input = await approvedInput(context, row);
    const currentContact = await frozenContact(context);
    if (input.identity.contactVersion === currentContact.version) {
      currentApproval = {
        id: row.id,
        sourceDraftId: row.source_draft_id,
        sourceDraftVersion: row.source_draft_version,
        sourceValidationId: row.source_validation_id,
        contentDigest: input.identity.snapshotDigest,
        identity: input.identity,
      };
    }
  }
  const rows = await context.env.DB.prepare(
    `SELECT p.* FROM storefront_publications p
    WHERE p.environment = ?
    ORDER BY p.created_at DESC, p.id DESC LIMIT 50`,
  )
    .bind(context.env.ENVIRONMENT)
    .all<PublicationRow>();
  return {
    environment: context.env.ENVIRONMENT,
    approval: currentApproval,
    active: await getActiveStorefrontPublication(context),
    publications: rows.results.map(mapPublication),
  };
}
async function pendingPublication(context: ApiContext) {
  const row = await context.env.DB.prepare(
    `SELECT * FROM storefront_publications
    WHERE environment = ? AND status IN ('queued', 'building', 'unresolved')`,
  )
    .bind(context.env.ENVIRONMENT)
    .first<PublicationRow>();
  return row ? mapPublication(row) : null;
}
type PublicationIntent = {
  identity: StorefrontPublicationIdentity;
  expectedActivePublicationId: string | null;
  operation: "publish" | "rollback";
  rollbackOf?: string;
  restoreWorkerVersionId?: string;
  reason: string;
  contactSources?: { launch: string | null; profile: string | null };
};

function matchesPendingIntent(pending: StorefrontPublication, input: PublicationIntent): boolean {
  return (
    pending.status !== "unresolved" &&
    pending.operation === input.operation &&
    pending.rollbackOf === (input.rollbackOf ?? null) &&
    pending.expectedActivePublicationId === input.expectedActivePublicationId &&
    sameStorefrontPublicationIdentity(pending.identity, input.identity)
  );
}

async function createIntent(context: ApiContext, input: PublicationIntent, trigger?: BuildTrigger) {
  const pending = await pendingPublication(context);
  if (pending) {
    if (matchesPendingIntent(pending, input)) return pending;
    conflict(
      "storefront_publication_pending",
      "Finish or resolve the current publication before starting another.",
    );
  }
  const current = await activePublication(context.env.DB, context.env.ENVIRONMENT);
  if ((current?.id ?? null) !== input.expectedActivePublicationId) {
    conflict(
      "storefront_publication_active_changed",
      "The active version changed. Refresh before publishing.",
    );
  }
  const id = `publication-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const reason = normalizeAuditReason(input.reason);
  try {
    const changes = await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO storefront_publications
        (id, environment, catalog_release_id, snapshot_id, identity_json, operation, status,
         expected_active_publication_id, rollback_of, restore_worker_version_id,
         created_by, reason, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?
        WHERE COALESCE((SELECT publication_id FROM storefront_active_publications WHERE environment = ?), '') = COALESCE(?, '')
          AND (? = 0 OR ((SELECT value_json FROM settings WHERE key = 'launch_configuration') IS ?
             AND (SELECT value_json FROM settings WHERE key = 'contact_profile') IS ?))`,
      ).bind(
        id,
        context.env.ENVIRONMENT,
        input.identity.catalogReleaseId,
        input.identity.experienceSnapshotId,
        canonicalStorefrontJson(input.identity),
        input.operation,
        input.expectedActivePublicationId,
        input.rollbackOf ?? null,
        input.restoreWorkerVersionId ?? null,
        context.get("principal").id,
        reason,
        now,
        now,
        context.env.ENVIRONMENT,
        input.expectedActivePublicationId,
        input.contactSources ? 1 : 0,
        input.contactSources?.launch ?? null,
        input.contactSources?.profile ?? null,
      ),
      prepareConditionalAuditEvent(
        context.env.DB,
        {
          id: crypto.randomUUID(),
          actorId: context.get("principal").id,
          actorType: "admin",
          action: `storefront.publication.${input.operation}`,
          targetType: "storefront_publication",
          targetId: id,
          result: "allowed",
          reason,
          requestId: context.get("requestId"),
          metadata: { identity: input.identity },
        },
        { sql: "SELECT 1 FROM storefront_publications WHERE id = ?", bindings: [id] },
      ),
    ]);
    if (changes[0]?.meta.changes !== 1)
      conflict(
        "storefront_publication_source_changed",
        "The active version or Contact changed. Refresh and approve the current version.",
      );
  } catch (error) {
    const concurrent = await pendingPublication(context);
    if (concurrent && matchesPendingIntent(concurrent, input)) return concurrent;
    if (concurrent)
      conflict(
        "storefront_publication_pending",
        "Another publication has started. Refresh its status.",
      );
    if (String(error).includes("storefront_publication_approval_stale")) {
      conflict(
        "storefront_publication_approval_stale",
        "The approved draft or candidate changed. Refresh and approve the current version.",
      );
    }
    throw error;
  }
  try {
    const result = await (trigger ?? defaultBuildTrigger(context.env))({
      environment: context.env.ENVIRONMENT,
      sourceEnvironment: context.env.ENVIRONMENT,
      releaseId: input.identity.catalogReleaseId,
      publicationId: id,
      operation: input.operation,
      requestId: context.get("requestId"),
      ...(input.restoreWorkerVersionId
        ? { restoreWorkerVersionId: input.restoreWorkerVersionId }
        : {}),
    });
    await context.env.DB.prepare(
      `UPDATE storefront_publications SET correlation_id = ?, updated_at = ?
      WHERE id = ? AND status IN ('queued', 'building')`,
    )
      .bind(result.correlationId, new Date().toISOString(), id)
      .run();
  } catch (error) {
    await context.env.DB.prepare(
      `UPDATE storefront_publications SET status = 'failed', failure_code = ?, updated_at = ?
      WHERE id = ? AND status = 'queued'`,
    )
      .bind(
        error instanceof ApiError ? error.code : "build_hook_failed",
        new Date().toISOString(),
        id,
      )
      .run();
  }
  return getStorefrontPublication(context.env.DB, id, context.env.ENVIRONMENT);
}
export async function createStorefrontPublication(
  context: ApiContext,
  request: StorefrontPublicationRequest,
  trigger?: BuildTrigger,
) {
  requirePublicationHuman(context);
  const approved = await approval(context.env.DB, request.identity.experienceSnapshotId);
  const draft = await context.env.DB.prepare(
    "SELECT version FROM storefront_experience_drafts WHERE id = ?",
  )
    .bind(request.draftId)
    .first<{ version: number }>();
  if (
    !draft ||
    draft.version !== request.expectedVersion ||
    approved.source_draft_id !== request.draftId ||
    approved.source_draft_version !== request.expectedVersion
  ) {
    conflict(
      "storefront_publication_approval_stale",
      "Save and approve the current draft before publishing.",
    );
  }
  const input = await approvedInput(context, approved);
  if (!sameStorefrontPublicationIdentity(request.identity, input.identity)) {
    conflict(
      "storefront_publication_identity_mismatch",
      "The publication does not match the approved version.",
    );
  }
  const settings = await context.env.DB.prepare(
    "SELECT key, value_json FROM settings WHERE key IN ('launch_configuration', 'contact_profile')",
  ).all<{ key: string; value_json: string }>();
  const byKey = new Map(settings.results.map((row) => [row.key, row.value_json]));
  if (input.identity.contactVersion !== (await frozenContact(context)).version) {
    conflict(
      "storefront_publication_contact_stale",
      "Contact information changed. Preview and approve it again.",
    );
  }
  if (
    input.release.purpose === "private-preview" &&
    (input.release.candidate_status !== "succeeded" ||
      !input.release.candidate_expires_at ||
      input.release.candidate_expires_at <= new Date().toISOString())
  ) {
    conflict(
      "storefront_publication_candidate_unavailable",
      "Create and approve an available private candidate before publishing.",
    );
  }
  if (input.snapshot.bindings.some((binding) => binding.kind === "fixture")) {
    conflict("storefront_publication_live_required", "Publications require live content.");
  }
  return createIntent(
    context,
    {
      ...request,
      operation: "publish",
      contactSources: {
        launch: byKey.get("launch_configuration") ?? null,
        profile: byKey.get("contact_profile") ?? null,
      },
    },
    trigger,
  );
}
export async function rollbackStorefrontPublication(
  context: ApiContext,
  request: StorefrontPublicationRollback,
  trigger?: BuildTrigger,
) {
  requirePublicationHuman(context);
  const target = await getStorefrontPublication(
    context.env.DB,
    request.targetPublicationId,
    context.env.ENVIRONMENT,
  );
  if (
    target.status !== "succeeded" ||
    !target.receipt ||
    target.id === request.expectedActivePublicationId
  ) {
    conflict(
      "storefront_publication_rollback_invalid",
      "Select a previously activated version in this environment.",
    );
  }
  return createIntent(
    context,
    {
      identity: target.identity,
      expectedActivePublicationId: request.expectedActivePublicationId,
      reason: request.reason,
      operation: "rollback",
      rollbackOf: target.id,
      restoreWorkerVersionId: target.receipt.workerVersionId,
    },
    trigger,
  );
}
export async function getStorefrontPublicationBuildManifest(context: ApiContext, id: string) {
  const publication = await getStorefrontPublication(context.env.DB, id, context.env.ENVIRONMENT);
  const approved = await approval(context.env.DB, publication.identity.experienceSnapshotId);
  const input = await approvedInput(context, approved);
  if (!sameStorefrontPublicationIdentity(publication.identity, input.identity)) {
    conflict(
      "storefront_publication_identity_mismatch",
      "The authorized content no longer matches.",
    );
  }
  const baseline = publication.expectedActivePublicationId
    ? await getStorefrontPublication(
        context.env.DB,
        publication.expectedActivePublicationId,
        context.env.ENVIRONMENT,
      )
    : null;
  const rollback = publication.rollbackOf
    ? await getStorefrontPublication(
        context.env.DB,
        publication.rollbackOf,
        context.env.ENVIRONMENT,
      )
    : null;
  return storefrontPublicationBuildManifestSchema.parse({
    input: storefrontPublicationBuildInputSchema.parse({
      environment: "public",
      sourceEnvironment: context.env.ENVIRONMENT,
      expectedOrigin: context.env.STOREFRONT_ORIGIN,
      publicationId: publication.id,
      inputIdentity: publication.identity,
      catalogManifestJson: input.release.manifest_json,
      catalogRelease: input.catalogRelease,
      snapshot: input.snapshot,
      themeId: input.snapshot.themeId,
      presentationMode: "live",
      mediaOrigins: catalogMediaOrigins(input.catalogRelease),
    }),
    publication,
    rollbackReceipt: rollback?.receipt ?? null,
    baselineReceipt: baseline?.receipt ?? null,
  });
}
function sameRun(publication: StorefrontPublication, callback: StorefrontPublicationCallback) {
  return (
    publication.runId === callback.runId &&
    publication.runAttempt === callback.runAttempt &&
    publication.sourceCommit === callback.sourceCommit
  );
}
export async function recordStorefrontPublicationResult(
  context: ApiContext,
  id: string,
  callback: StorefrontPublicationCallback,
) {
  const current = await getStorefrontPublication(context.env.DB, id, context.env.ENVIRONMENT);
  const now = new Date().toISOString();
  if (current.runId && !sameRun(current, callback))
    conflict(
      "storefront_publication_run_mismatch",
      "The delivery callback belongs to another run or attempt.",
    );
  if (current.status === "succeeded") {
    if (
      callback.status === "activated" &&
      canonicalStorefrontJson(current.receipt) === canonicalStorefrontJson(callback.receipt)
    )
      return current;
    conflict("storefront_publication_terminal", "This publication already has a final result.");
  }
  if (
    current.status === "failed" ||
    (current.status === "unresolved" &&
      !(callback.status === "failed" && callback.restorationVerified))
  ) {
    if (
      callback.status === "failed" &&
      current.failureCode === callback.failureCode &&
      (current.status === "failed") === callback.restorationVerified
    )
      return current;
    conflict("storefront_publication_terminal", "Retry using a new publication request.");
  }
  if (callback.status === "building") {
    await context.env.DB.prepare(
      `UPDATE storefront_publications SET status = 'building', run_id = ?, run_attempt = ?,
      source_commit = ?, updated_at = ? WHERE id = ? AND status = 'queued' AND run_id IS NULL`,
    )
      .bind(callback.runId, callback.runAttempt, callback.sourceCommit, now, id)
      .run();
    const result = await getStorefrontPublication(context.env.DB, id, context.env.ENVIRONMENT);
    if (result.status !== "building" || !sameRun(result, callback))
      conflict("storefront_publication_run_mismatch", "The delivery run changed.");
    return result;
  }
  if (callback.status === "failed") {
    let restored = callback.restorationVerified;
    if (restored && current.expectedActivePublicationId) {
      const baseline = await getStorefrontPublication(
        context.env.DB,
        current.expectedActivePublicationId,
        context.env.ENVIRONMENT,
      );
      try {
        const observation = await observeStorefront(context);
        restored =
          observation.sourceEnvironment === context.env.ENVIRONMENT &&
          observation.workerVersionId === baseline.receipt?.workerVersionId &&
          sameStorefrontPublicationIdentity(observation.identity, baseline.identity);
      } catch {
        restored = false;
      }
    }
    if (current.status === "unresolved" && !restored) {
      conflict(
        "storefront_publication_restoration_unverified",
        "Restore and verify the previous storefront version before resolving this publication.",
      );
    }
    await context.env.DB.prepare(
      `UPDATE storefront_publications SET status = ?, failure_code = ?,
      run_id = ?, run_attempt = ?, source_commit = ?, updated_at = ?
      WHERE id = ? AND status IN ('queued', 'building', 'unresolved') AND (run_id IS NULL OR (run_id = ? AND run_attempt = ? AND source_commit = ?))`,
    )
      .bind(
        restored ? "failed" : "unresolved",
        callback.failureCode,
        callback.runId,
        callback.runAttempt,
        callback.sourceCommit,
        now,
        id,
        callback.runId,
        callback.runAttempt,
        callback.sourceCommit,
      )
      .run();
    const result = await getStorefrontPublication(context.env.DB, id, context.env.ENVIRONMENT);
    if (!sameRun(result, callback))
      conflict("storefront_publication_run_mismatch", "The delivery run changed.");
    return result;
  }
  if (current.status !== "building" || !sameRun(current, callback))
    conflict("storefront_publication_run_required", "Start the delivery run before activation.");
  if (
    callback.receipt.environment !== context.env.ENVIRONMENT ||
    !sameStorefrontPublicationIdentity(callback.receipt.identity, current.identity) ||
    (current.operation === "rollback" &&
      callback.receipt.workerVersionId !== current.restoreWorkerVersionId)
  ) {
    conflict(
      "storefront_publication_receipt_mismatch",
      "The activation receipt does not match this authorized version.",
    );
  }
  if (current.rollbackOf) {
    const target = await getStorefrontPublication(
      context.env.DB,
      current.rollbackOf,
      context.env.ENVIRONMENT,
    );
    if (
      callback.receipt.artifactDigest !== target.receipt?.artifactDigest ||
      callback.receipt.reportDigest !== target.receipt?.reportDigest
    ) {
      conflict(
        "storefront_publication_receipt_mismatch",
        "Rollback must retain the original artifact and validation proof.",
      );
    }
  }
  let observation;
  try {
    observation = await observeStorefront(context);
  } catch {
    conflict(
      "storefront_publication_observation_unavailable",
      "The storefront version could not be verified. Restore the previous version before retrying.",
    );
  }
  if (
    observation.sourceEnvironment !== context.env.ENVIRONMENT ||
    observation.workerVersionId !== callback.receipt.workerVersionId ||
    !sameStorefrontPublicationIdentity(observation.identity, current.identity)
  ) {
    conflict(
      "storefront_publication_observation_mismatch",
      "The actual storefront version does not match the activation receipt.",
    );
  }
  const receipt = canonicalStorefrontJson(callback.receipt);
  const changed = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE storefront_publications SET status = 'succeeded', receipt_json = ?, updated_at = ?
      WHERE id = ? AND status = 'building' AND run_id = ? AND run_attempt = ? AND source_commit = ?
        AND COALESCE((SELECT publication_id FROM storefront_active_publications WHERE environment = ?), '') = COALESCE(expected_active_publication_id, '')`,
    ).bind(
      receipt,
      now,
      id,
      callback.runId,
      callback.runAttempt,
      callback.sourceCommit,
      context.env.ENVIRONMENT,
    ),
    context.env.DB.prepare(
      `INSERT INTO storefront_active_publications (environment, publication_id, updated_at)
      SELECT environment, id, ? FROM storefront_publications WHERE id = ? AND status = 'succeeded' AND receipt_json = ?
      ON CONFLICT(environment) DO UPDATE SET publication_id = excluded.publication_id, updated_at = excluded.updated_at
      WHERE storefront_active_publications.publication_id = ?`,
    ).bind(now, id, receipt, current.expectedActivePublicationId),
    context.env.DB.prepare(
      `UPDATE catalog_releases SET status = 'deployed', deployed_at = COALESCE(deployed_at, ?), updated_at = ?
      WHERE id = ? AND EXISTS (SELECT 1 FROM storefront_publications WHERE id = ? AND status = 'succeeded')`,
    ).bind(now, now, current.identity.catalogReleaseId, id),
  ]);
  if (changed[0]?.meta.changes !== 1 || changed[1]?.meta.changes !== 1) {
    const final = await getStorefrontPublication(context.env.DB, id, context.env.ENVIRONMENT);
    if (
      final.status === "succeeded" &&
      sameRun(final, callback) &&
      canonicalStorefrontJson(final.receipt) === receipt
    )
      return final;
    conflict(
      "storefront_publication_active_changed",
      "The active storefront changed during delivery. Restore the previous version and refresh.",
    );
  }
  await recordAuditEvent(context.env.DB, {
    id: crypto.randomUUID(),
    actorType: "machine",
    action: "storefront.publication.activated",
    targetType: "storefront_publication",
    targetId: id,
    result: "succeeded",
    requestId: context.get("requestId"),
    metadata: { receipt: callback.receipt },
  });
  return getStorefrontPublication(context.env.DB, id, context.env.ENVIRONMENT);
}
