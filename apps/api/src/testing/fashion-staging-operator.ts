import { ApiError } from "../http/errors";
import { sha256Hex } from "../orders/tokens";

export type FashionStagingOperatorRunStatus =
  "approved" | "awaiting_operator" | "canceled" | "consumed" | "expired" | "rejected";

export interface CreateFashionStagingOperatorRunInput {
  candidateSha: string;
  catalogReleaseId: string;
  contractTestDigest: string;
  environment: "fashion-staging";
  expiresAt: string;
  harnessManifestDigest: string;
  harnessSha: string;
  repository: string;
  runId: string;
  runManifestDigest: string;
  sourceDraftId: string;
  u12ReadinessDigest: string;
  u12SnapshotId: string;
  workflowRunAttempt: number;
  workflowRunId: string;
}

export interface ApproveFashionStagingOperatorRunInput {
  approvalAuditId: string;
  operatorIdentityId: string;
  snapshotContentDigest: string;
  snapshotId: string;
  workingDraftId: string;
}

interface FashionStagingOperatorRunRow {
  approval_audit_id: string | null;
  approved_at: string | null;
  candidate_sha: string;
  catalog_release_id: string;
  consumed_at: string | null;
  contract_test_digest: string;
  created_at: string;
  environment: "fashion-staging";
  expires_at: string;
  harness_manifest_digest: string;
  harness_sha: string;
  operator_identity_id: string | null;
  repository: string;
  run_id: string;
  run_manifest_digest: string;
  source_draft_id: string;
  status: FashionStagingOperatorRunStatus;
  successor_content_digest: string | null;
  successor_snapshot_id: string | null;
  u12_readiness_digest: string;
  u12_snapshot_id: string;
  updated_at: string;
  workflow_run_attempt: number;
  workflow_run_id: string;
  working_draft_id: string;
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const digest = /^[a-f0-9]{64}$/;
const sha = /^[a-f0-9]{40}$/;

function assertIdentifier(value: string, label: string): void {
  if (!identifier.test(value)) {
    throw new ApiError(422, "fashion_u8_operator_identity_invalid", `${label} is invalid.`);
  }
}

function mapRun(row: FashionStagingOperatorRunRow) {
  return {
    allowedAction:
      row.status === "awaiting_operator" ? ("complete_run_bound_editor_path" as const) : null,
    approvalAuditId: row.approval_audit_id,
    approvedAt: row.approved_at,
    candidateSha: row.candidate_sha,
    catalogReleaseId: row.catalog_release_id,
    consumedAt: row.consumed_at,
    contractTestDigest: row.contract_test_digest,
    createdAt: row.created_at,
    environment: row.environment,
    expiresAt: row.expires_at,
    harnessManifestDigest: row.harness_manifest_digest,
    harnessSha: row.harness_sha,
    operatorIdentityId: row.operator_identity_id,
    repository: row.repository,
    runId: row.run_id,
    runManifestDigest: row.run_manifest_digest,
    sourceDraftId: row.source_draft_id,
    status: row.status,
    successorContentDigest: row.successor_content_digest,
    successorSnapshotId: row.successor_snapshot_id,
    u12ReadinessDigest: row.u12_readiness_digest,
    u12SnapshotId: row.u12_snapshot_id,
    updatedAt: row.updated_at,
    workflowRunAttempt: row.workflow_run_attempt,
    workflowRunId: row.workflow_run_id,
    workingDraftId: row.working_draft_id,
  };
}

async function expireActiveRuns(db: D1Database, now: Date): Promise<void> {
  const at = now.toISOString();
  await db
    .prepare(
      `UPDATE fashion_staging_operator_runs
          SET status = 'expired', updated_at = ?
        WHERE status IN ('awaiting_operator', 'approved') AND expires_at <= ?`,
    )
    .bind(at, at)
    .run();
}

async function rowByRunId(
  db: D1Database,
  runId: string,
): Promise<FashionStagingOperatorRunRow | null> {
  return db
    .prepare("SELECT * FROM fashion_staging_operator_runs WHERE run_id = ?")
    .bind(runId)
    .first<FashionStagingOperatorRunRow>();
}

function isExactRegistrationReplay(
  row: FashionStagingOperatorRunRow,
  input: CreateFashionStagingOperatorRunInput,
): boolean {
  return (
    row.environment === input.environment &&
    row.repository === input.repository &&
    row.workflow_run_id === input.workflowRunId &&
    row.candidate_sha === input.candidateSha &&
    row.harness_sha === input.harnessSha &&
    row.harness_manifest_digest === input.harnessManifestDigest &&
    row.contract_test_digest === input.contractTestDigest &&
    row.run_manifest_digest === input.runManifestDigest &&
    row.u12_readiness_digest === input.u12ReadinessDigest &&
    row.u12_snapshot_id === input.u12SnapshotId &&
    row.catalog_release_id === input.catalogReleaseId &&
    row.source_draft_id === input.sourceDraftId &&
    row.expires_at === input.expiresAt
  );
}

export async function createFashionStagingOperatorRun(
  db: D1Database,
  input: CreateFashionStagingOperatorRunInput,
  now = new Date(),
) {
  if (input.environment !== "fashion-staging" || input.repository !== "hashencode/shoppp") {
    throw new ApiError(
      422,
      "fashion_u8_operator_environment_invalid",
      "Fashion U8 operator runs require the protected Fashion staging repository.",
    );
  }
  for (const [label, value] of [
    ["runId", input.runId],
    ["workflowRunId", input.workflowRunId],
    ["catalogReleaseId", input.catalogReleaseId],
    ["u12SnapshotId", input.u12SnapshotId],
    ["sourceDraftId", input.sourceDraftId],
  ] as const) {
    assertIdentifier(value, label);
  }
  if (!sha.test(input.candidateSha) || !sha.test(input.harnessSha)) {
    throw new ApiError(422, "fashion_u8_operator_sha_invalid", "Commit identities are invalid.");
  }
  for (const value of [
    input.contractTestDigest,
    input.harnessManifestDigest,
    input.runManifestDigest,
    input.u12ReadinessDigest,
  ]) {
    if (!digest.test(value)) {
      throw new ApiError(422, "fashion_u8_operator_digest_invalid", "Evidence digest is invalid.");
    }
  }
  if (!Number.isInteger(input.workflowRunAttempt)) {
    throw new ApiError(
      422,
      "fashion_u8_operator_provenance_invalid",
      "Workflow provenance is invalid.",
    );
  }
  const expiresAt = Date.parse(input.expiresAt);
  if (
    !Number.isFinite(expiresAt) ||
    new Date(expiresAt).toISOString() !== input.expiresAt ||
    expiresAt <= now.getTime() ||
    expiresAt > now.getTime() + 24 * 60 * 60_000
  ) {
    throw new ApiError(
      422,
      "fashion_u8_operator_expiry_invalid",
      "Fashion U8 operator run expiry must be within 24 hours.",
    );
  }
  const source = await db
    .prepare("SELECT theme_id FROM storefront_experience_drafts WHERE id = ?")
    .bind(input.sourceDraftId)
    .first<{ theme_id: string }>();
  if (source?.theme_id !== "fashion-store") {
    throw new ApiError(
      422,
      "fashion_u8_operator_source_invalid",
      "The run source must be a Fashion Store draft.",
    );
  }
  const u12Snapshot = await db
    .prepare(`SELECT kind, approved_at FROM storefront_experience_snapshots WHERE id = ?`)
    .bind(input.u12SnapshotId)
    .first<{ approved_at: string | null; kind: "approved" | "preview" }>();
  if (u12Snapshot?.kind !== "approved" || !u12Snapshot.approved_at) {
    throw new ApiError(
      422,
      "fashion_u8_operator_u12_snapshot_invalid",
      "The U12 readiness Snapshot must be an existing approved Snapshot.",
    );
  }
  const catalogRelease = await db
    .prepare("SELECT status FROM catalog_releases WHERE id = ?")
    .bind(input.catalogReleaseId)
    .first<{ status: string }>();
  if (catalogRelease?.status !== "deployed") {
    throw new ApiError(
      422,
      "fashion_u8_operator_catalog_release_invalid",
      "The Fashion U8 Catalog Release must already be deployed.",
    );
  }
  await expireActiveRuns(db, now);
  const existing = await rowByRunId(db, input.runId);
  if (existing) {
    if (isExactRegistrationReplay(existing, input)) return mapRun(existing);
    throw new ApiError(
      409,
      "fashion_u8_operator_run_conflict",
      "The Fashion U8 operator run identity already belongs to different evidence.",
    );
  }
  const at = now.toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO fashion_staging_operator_runs
           (run_id, environment, repository, workflow_run_id, workflow_run_attempt, status,
            candidate_sha, harness_sha, harness_manifest_digest, contract_test_digest,
            run_manifest_digest, u12_readiness_digest, u12_snapshot_id, catalog_release_id,
            source_draft_id, working_draft_id, expires_at, created_at, updated_at)
         VALUES (?, 'fashion-staging', ?, ?, ?, 'awaiting_operator', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.runId,
        input.repository,
        input.workflowRunId,
        input.workflowRunAttempt,
        input.candidateSha,
        input.harnessSha,
        input.harnessManifestDigest,
        input.contractTestDigest,
        input.runManifestDigest,
        input.u12ReadinessDigest,
        input.u12SnapshotId,
        input.catalogReleaseId,
        input.sourceDraftId,
        input.sourceDraftId,
        input.expiresAt,
        at,
        at,
      )
      .run();
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("UNIQUE constraint failed")) {
      const concurrent = await rowByRunId(db, input.runId);
      if (concurrent && isExactRegistrationReplay(concurrent, input)) return mapRun(concurrent);
      throw new ApiError(
        409,
        "fashion_u8_operator_run_conflict",
        "Another Fashion U8 operator run is already active.",
      );
    }
    throw cause;
  }
  return mapRun((await rowByRunId(db, input.runId))!);
}

export async function getFashionStagingOperatorRun(
  db: D1Database,
  runId: string,
  now = new Date(),
) {
  assertIdentifier(runId, "runId");
  await expireActiveRuns(db, now);
  const row = await rowByRunId(db, runId);
  if (!row) {
    throw new ApiError(404, "fashion_u8_operator_run_not_found", "Operator run not found.");
  }
  return mapRun(row);
}

export async function rejectFashionStagingOperatorRun(
  db: D1Database,
  runId: string,
  reason: string,
  now = new Date(),
) {
  assertIdentifier(runId, "runId");
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3 || normalizedReason.length > 500) {
    throw new ApiError(
      422,
      "fashion_u8_operator_rejection_invalid",
      "Rejection reason is invalid.",
    );
  }
  await expireActiveRuns(db, now);
  const at = now.toISOString();
  const result = await db
    .prepare(
      `UPDATE fashion_staging_operator_runs
          SET status = 'rejected', updated_at = ?
        WHERE run_id = ? AND status = 'awaiting_operator'
          AND successor_snapshot_id IS NULL AND approval_audit_id IS NULL`,
    )
    .bind(at, runId)
    .run();
  const row = await rowByRunId(db, runId);
  if (result.meta.changes !== 1 && row?.status !== "rejected") {
    throw new ApiError(
      409,
      "fashion_u8_operator_run_not_rejectable",
      "Operator run is missing, immutable, or already terminal.",
    );
  }
  await db
    .prepare(
      `INSERT OR IGNORE INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result,
          reason, request_id, metadata_json, created_at)
       VALUES (?, 'system', NULL, 'themes.fashion-staging.operator.reject',
               'fashion_staging_operator_run', ?, 'succeeded', ?, NULL, '{}', ?)`,
    )
    .bind(`audit-fashion-u8-reject-${runId}`, runId, normalizedReason, at)
    .run();
  return mapRun((await rowByRunId(db, runId))!);
}

export async function supersedeFashionStagingOperatorRun(
  db: D1Database,
  runId: string,
  replacementHarnessSha: string,
  reason: string,
  now = new Date(),
) {
  assertIdentifier(runId, "runId");
  if (!sha.test(replacementHarnessSha)) {
    throw new ApiError(
      422,
      "fashion_u8_operator_sha_invalid",
      "The replacement harness commit is invalid.",
    );
  }
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3 || normalizedReason.length > 500) {
    throw new ApiError(
      422,
      "fashion_u8_operator_supersession_invalid",
      "Supersession reason is invalid.",
    );
  }
  await expireActiveRuns(db, now);
  const before = await rowByRunId(db, runId);
  if (!before) {
    throw new ApiError(404, "fashion_u8_operator_run_not_found", "Operator run not found.");
  }
  if (before.harness_sha === replacementHarnessSha) {
    throw new ApiError(
      409,
      "fashion_u8_operator_harness_not_superseded",
      "The replacement harness must differ from the retained run.",
    );
  }
  const auditId = `audit-fashion-u8-supersede-${(
    await sha256Hex(`${runId}:${replacementHarnessSha}`)
  ).slice(0, 32)}`;
  if (before.status === "expired" || before.status === "rejected") {
    const audit = await db
      .prepare(
        `SELECT action, metadata_json FROM audit_events
          WHERE id = ? AND target_id = ? AND target_type = 'fashion_staging_operator_run'`,
      )
      .bind(auditId, runId)
      .first<{ action: string; metadata_json: string }>();
    const metadata = audit ? (JSON.parse(audit.metadata_json) as Record<string, unknown>) : null;
    if (
      audit?.action === "themes.fashion-staging.operator.supersede" &&
      metadata?.replacementHarnessSha === replacementHarnessSha
    ) {
      return mapRun(before);
    }
    throw new ApiError(
      409,
      "fashion_u8_operator_run_not_supersedable",
      "Operator run is terminal under a different boundary.",
    );
  }
  if (before.status !== "awaiting_operator" && before.status !== "approved") {
    throw new ApiError(
      409,
      "fashion_u8_operator_run_not_supersedable",
      "Operator run is missing, immutable, or already terminal.",
    );
  }
  const at = now.toISOString();
  const nextStatus = before.status === "approved" ? "expired" : "rejected";
  const [updated] = await db.batch([
    db
      .prepare(
        `UPDATE fashion_staging_operator_runs
            SET status = ?, updated_at = ?
          WHERE run_id = ? AND harness_sha <> ? AND status = ?
            AND ((? = 'awaiting_operator' AND successor_snapshot_id IS NULL
                  AND successor_content_digest IS NULL AND approval_audit_id IS NULL
                  AND operator_identity_id IS NULL AND approved_at IS NULL)
              OR (? = 'approved' AND successor_snapshot_id IS NOT NULL
                  AND successor_content_digest IS NOT NULL AND approval_audit_id IS NOT NULL
                  AND operator_identity_id IS NOT NULL AND approved_at IS NOT NULL))`,
      )
      .bind(
        nextStatus,
        at,
        runId,
        replacementHarnessSha,
        before.status,
        before.status,
        before.status,
      ),
    db
      .prepare(
        `INSERT INTO audit_events
           (id, actor_type, actor_id, action, target_type, target_id, result,
            reason, request_id, metadata_json, created_at)
         VALUES (?, 'system', NULL, 'themes.fashion-staging.operator.supersede',
                 'fashion_staging_operator_run', ?, 'succeeded', ?, NULL, ?, ?)`,
      )
      .bind(
        auditId,
        runId,
        normalizedReason,
        JSON.stringify({ previousStatus: before.status, replacementHarnessSha }),
        at,
      ),
  ]);
  if (updated?.meta.changes !== 1) {
    throw new ApiError(
      409,
      "fashion_u8_operator_run_supersession_conflict",
      "Operator run changed before its supersession evidence could be committed.",
    );
  }
  return mapRun((await rowByRunId(db, runId))!);
}

export async function getFashionStagingOperatorRunForDraft(
  db: D1Database,
  draftId: string,
  now = new Date(),
) {
  assertIdentifier(draftId, "draftId");
  await expireActiveRuns(db, now);
  const row = await db
    .prepare(
      `SELECT * FROM fashion_staging_operator_runs
        WHERE working_draft_id = ?
        ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(draftId)
    .first<FashionStagingOperatorRunRow>();
  return row ? mapRun(row) : null;
}

export async function moveFashionStagingOperatorRunToSuccessor(
  db: D1Database,
  sourceDraftId: string,
  successorDraftId: string,
  now = new Date(),
): Promise<void> {
  await expireActiveRuns(db, now);
  const result = await db
    .prepare(
      `UPDATE fashion_staging_operator_runs
          SET working_draft_id = ?, updated_at = ?
        WHERE working_draft_id = ? AND status = 'awaiting_operator' AND expires_at > ?`,
    )
    .bind(successorDraftId, now.toISOString(), sourceDraftId, now.toISOString())
    .run();
  if (result.meta.changes > 1) {
    throw new ApiError(409, "fashion_u8_operator_run_conflict", "Operator run is ambiguous.");
  }
}

export async function assertFashionStagingOperatorRunApprovable(
  db: D1Database,
  workingDraftId: string,
  now = new Date(),
): Promise<ReturnType<typeof mapRun> | null> {
  await expireActiveRuns(db, now);
  const row = await db
    .prepare(
      `SELECT * FROM fashion_staging_operator_runs
        WHERE working_draft_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(workingDraftId)
    .first<FashionStagingOperatorRunRow>();
  if (row && row.status !== "awaiting_operator" && row.status !== "approved") {
    throw new ApiError(
      409,
      `fashion_u8_operator_run_${row.status}`,
      `The Fashion U8 operator run is ${row.status}.`,
    );
  }
  return row ? mapRun(row) : null;
}

export async function approveFashionStagingOperatorRun(
  db: D1Database,
  input: ApproveFashionStagingOperatorRunInput,
  now = new Date(),
): Promise<void> {
  await expireActiveRuns(db, now);
  const active = await db
    .prepare(
      `SELECT status FROM fashion_staging_operator_runs
        WHERE working_draft_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(input.workingDraftId)
    .first<{ status: FashionStagingOperatorRunStatus }>();
  if (!active) return;
  if (active.status !== "awaiting_operator") {
    throw new ApiError(
      409,
      `fashion_u8_operator_run_${active.status}`,
      `The Fashion U8 operator run is ${active.status}.`,
    );
  }
  if (!digest.test(input.snapshotContentDigest)) {
    throw new ApiError(422, "fashion_u8_operator_digest_invalid", "Snapshot digest is invalid.");
  }
  const result = await db
    .prepare(
      `UPDATE fashion_staging_operator_runs
          SET status = 'approved', successor_snapshot_id = ?, successor_content_digest = ?,
              approval_audit_id = ?, operator_identity_id = ?, approved_at = ?, updated_at = ?
        WHERE working_draft_id = ? AND status = 'awaiting_operator' AND expires_at > ?`,
    )
    .bind(
      input.snapshotId,
      input.snapshotContentDigest,
      input.approvalAuditId,
      input.operatorIdentityId,
      now.toISOString(),
      now.toISOString(),
      input.workingDraftId,
      now.toISOString(),
    )
    .run();
  if (result.meta.changes !== 1) {
    throw new ApiError(
      409,
      "fashion_u8_operator_run_conflict",
      "Operator run changed before approval was recorded.",
    );
  }
}

export async function consumeFashionStagingOperatorRun(
  db: D1Database,
  runId: string,
  snapshotId: string,
  approvalAuditId: string,
  now = new Date(),
) {
  await expireActiveRuns(db, now);
  const result = await db
    .prepare(
      `UPDATE fashion_staging_operator_runs
          SET status = 'consumed', consumed_at = ?, updated_at = ?
        WHERE run_id = ? AND status = 'approved'
          AND successor_snapshot_id = ? AND approval_audit_id = ?`,
    )
    .bind(now.toISOString(), now.toISOString(), runId, snapshotId, approvalAuditId)
    .run();
  if (result.meta.changes !== 1) {
    const existing = await rowByRunId(db, runId);
    if (
      existing?.status === "consumed" &&
      existing.successor_snapshot_id === snapshotId &&
      existing.approval_audit_id === approvalAuditId
    ) {
      return mapRun(existing);
    }
    throw new ApiError(
      409,
      "fashion_u8_operator_run_not_consumable",
      "Operator evidence is missing, mismatched, or already consumed.",
    );
  }
  return getFashionStagingOperatorRun(db, runId, now);
}
