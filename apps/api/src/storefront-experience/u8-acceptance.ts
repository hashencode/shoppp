import type {
  FashionU8AcceptanceContext,
  PrepareFashionU8AcceptanceRunRequest,
} from "@shoppp/contracts";

import { ApiError } from "../http/errors";
import type { Principal } from "../iam/permissions";

export interface FashionU8AcceptanceRun {
  approvalAuditId: string | null;
  candidateSha: string;
  catalogReleaseId: string;
  consumedAt: string | null;
  createdAt: string;
  environment: "fashion-staging";
  expiresAt: string;
  harnessSha: string;
  manifestDigest: string;
  operatorId: string | null;
  repository: string;
  runId: string;
  sourceDraftId: string;
  status: "active" | "awaiting_operator" | "canceled" | "consumed" | "expired" | "rejected";
  successorDraftId: string | null;
  successorSnapshotId: string | null;
  u12SnapshotId: string;
  updatedAt: string;
  workflowRunId: string;
}

interface FashionU8AcceptanceRunRow {
  approval_audit_id: string | null;
  candidate_sha: string;
  catalog_release_id: string;
  consumed_at: string | null;
  created_at: string;
  environment: "fashion-staging";
  expires_at: string;
  harness_sha: string;
  manifest_digest: string;
  operator_id: string | null;
  repository: string;
  run_id: string;
  source_draft_id: string;
  status: FashionU8AcceptanceRun["status"];
  successor_draft_id: string | null;
  successor_snapshot_id: string | null;
  u12_snapshot_id: string;
  updated_at: string;
  workflow_run_id: string;
}

const selectRun = `SELECT run_id, manifest_digest, repository, workflow_run_id, environment,
  candidate_sha, harness_sha, catalog_release_id, u12_snapshot_id, source_draft_id,
  successor_draft_id, successor_snapshot_id, approval_audit_id, operator_id, status,
  created_at, expires_at, consumed_at, updated_at
  FROM fashion_u8_acceptance_runs WHERE run_id = ? AND manifest_digest = ?`;

function mapRun(row: FashionU8AcceptanceRunRow): FashionU8AcceptanceRun {
  return {
    approvalAuditId: row.approval_audit_id,
    candidateSha: row.candidate_sha,
    catalogReleaseId: row.catalog_release_id,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
    environment: row.environment,
    expiresAt: row.expires_at,
    harnessSha: row.harness_sha,
    manifestDigest: row.manifest_digest,
    operatorId: row.operator_id,
    repository: row.repository,
    runId: row.run_id,
    sourceDraftId: row.source_draft_id,
    status: row.status,
    successorDraftId: row.successor_draft_id,
    successorSnapshotId: row.successor_snapshot_id,
    u12SnapshotId: row.u12_snapshot_id,
    updatedAt: row.updated_at,
    workflowRunId: row.workflow_run_id,
  };
}

async function runRow(
  db: D1Database,
  context: FashionU8AcceptanceContext,
): Promise<FashionU8AcceptanceRunRow | null> {
  return db.prepare(selectRun).bind(context.runId, context.manifestDigest).first();
}

function acceptanceError(code: string, message: string, status: 403 | 409 | 410 = 409): ApiError {
  return new ApiError(status, code, message);
}

export async function prepareFashionU8AcceptanceRun(
  db: D1Database,
  input: PrepareFashionU8AcceptanceRunRequest,
  now = new Date(),
): Promise<FashionU8AcceptanceRun> {
  const source = await db
    .prepare("SELECT theme_id FROM storefront_experience_drafts WHERE id = ?")
    .bind(input.sourceDraftId)
    .first<{ theme_id: string }>();
  const baseline = await db
    .prepare(
      `SELECT snapshots.kind, snapshots.theme_id, validations.catalog_release_id
       FROM storefront_experience_snapshots snapshots
       JOIN storefront_experience_validations validations
         ON validations.id = snapshots.source_validation_id
       WHERE snapshots.id = ?`,
    )
    .bind(input.u12SnapshotId)
    .first<{ catalog_release_id: string | null; kind: string; theme_id: string }>();
  if (
    !source ||
    source.theme_id !== "fashion-store" ||
    !baseline ||
    baseline.kind !== "approved" ||
    baseline.theme_id !== "fashion-store" ||
    baseline.catalog_release_id !== input.catalogReleaseId
  ) {
    throw acceptanceError(
      "fashion_u8_acceptance_identity_invalid",
      "The Fashion U8 source draft or approved U12 baseline is invalid.",
    );
  }
  const context = { manifestDigest: input.manifestDigest, runId: input.runId };
  const existing = await runRow(db, context);
  if (existing) {
    const same =
      existing.status === "awaiting_operator" &&
      existing.candidate_sha === input.candidateSha &&
      existing.harness_sha === input.harnessSha &&
      existing.catalog_release_id === input.catalogReleaseId &&
      existing.u12_snapshot_id === input.u12SnapshotId &&
      existing.source_draft_id === input.sourceDraftId &&
      existing.repository === input.repository &&
      existing.workflow_run_id === input.workflowRunId;
    if (!same) {
      throw acceptanceError(
        "fashion_u8_acceptance_run_conflict",
        "The Fashion U8 run identity is already used or no longer awaiting an operator.",
      );
    }
    return mapRun(existing);
  }
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60_000).toISOString();
  await db
    .prepare(
      `INSERT INTO fashion_u8_acceptance_runs
       (run_id, manifest_digest, repository, workflow_run_id, environment, candidate_sha,
        harness_sha, catalog_release_id, u12_snapshot_id, source_draft_id, status,
        created_at, expires_at, updated_at)
       VALUES (?, ?, ?, ?, 'fashion-staging', ?, ?, ?, ?, ?, 'awaiting_operator', ?, ?, ?)`,
    )
    .bind(
      input.runId,
      input.manifestDigest,
      input.repository,
      input.workflowRunId,
      input.candidateSha,
      input.harnessSha,
      input.catalogReleaseId,
      input.u12SnapshotId,
      input.sourceDraftId,
      createdAt,
      expiresAt,
      createdAt,
    )
    .run();
  return getFashionU8AcceptanceRun(db, context, now);
}

export async function getFashionU8AcceptanceRun(
  db: D1Database,
  context: FashionU8AcceptanceContext,
  now = new Date(),
): Promise<FashionU8AcceptanceRun> {
  let row = await runRow(db, context);
  if (!row) {
    throw new ApiError(404, "fashion_u8_acceptance_not_found", "The Fashion U8 run was not found.");
  }
  if (
    (row.status === "awaiting_operator" || row.status === "active") &&
    Date.parse(row.expires_at) <= now.getTime()
  ) {
    await db
      .prepare(
        `UPDATE fashion_u8_acceptance_runs SET status = 'expired', updated_at = ?
         WHERE run_id = ? AND manifest_digest = ? AND status IN ('awaiting_operator', 'active')`,
      )
      .bind(now.toISOString(), context.runId, context.manifestDigest)
      .run();
    row = (await runRow(db, context))!;
  }
  return mapRun(row);
}

export async function authorizeFashionU8OperatorMutation(
  db: D1Database,
  principal: Principal,
  draftId: string,
  reason: string,
  context?: FashionU8AcceptanceContext,
  now = new Date(),
): Promise<FashionU8AcceptanceRun | null> {
  if (!context) return null;
  if (principal.principalKind !== "human") {
    throw acceptanceError(
      "fashion_u8_operator_identity_required",
      "A named human operator is required for this Fashion U8 run.",
      403,
    );
  }
  const run = await getFashionU8AcceptanceRun(db, context, now);
  const expectedReason = `Fashion U8 ${run.runId} ${run.manifestDigest}`;
  const expectedDraftId = run.successorDraftId ?? run.sourceDraftId;
  if (
    (run.status !== "awaiting_operator" && run.status !== "active") ||
    run.expiresAt <= now.toISOString() ||
    reason !== expectedReason ||
    draftId !== expectedDraftId ||
    (run.operatorId && run.operatorId !== principal.id)
  ) {
    throw acceptanceError(
      "fashion_u8_acceptance_invalid",
      "The Fashion U8 run is expired, consumed, mismatched, or owned by another operator.",
      run.status === "expired" ? 410 : 409,
    );
  }
  await db
    .prepare(
      `UPDATE fashion_u8_acceptance_runs
       SET status = 'active', operator_id = COALESCE(operator_id, ?), updated_at = ?
       WHERE run_id = ? AND manifest_digest = ? AND status IN ('awaiting_operator', 'active')
         AND expires_at > ? AND (operator_id IS NULL OR operator_id = ?)`,
    )
    .bind(
      principal.id,
      now.toISOString(),
      run.runId,
      run.manifestDigest,
      now.toISOString(),
      principal.id,
    )
    .run();
  return getFashionU8AcceptanceRun(db, context, now);
}

export async function bindFashionU8Successor(
  db: D1Database,
  run: FashionU8AcceptanceRun,
  sourceDraftId: string,
  successorDraftId: string,
  now = new Date(),
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE fashion_u8_acceptance_runs SET successor_draft_id = ?, updated_at = ?
       WHERE run_id = ? AND manifest_digest = ? AND source_draft_id = ? AND status = 'active'
         AND expires_at > ? AND (successor_draft_id IS NULL OR successor_draft_id = ?)`,
    )
    .bind(
      successorDraftId,
      now.toISOString(),
      run.runId,
      run.manifestDigest,
      sourceDraftId,
      now.toISOString(),
      successorDraftId,
    )
    .run();
  if (result.meta.changes !== 1) {
    throw acceptanceError(
      "fashion_u8_successor_conflict",
      "The Fashion U8 successor is already bound or the run is no longer active.",
    );
  }
}

export async function consumeFashionU8AcceptanceRun(
  db: D1Database,
  run: FashionU8AcceptanceRun,
  operatorId: string,
  draftId: string,
  snapshotId: string,
  now = new Date(),
): Promise<void> {
  const consumedAt = now.toISOString();
  const result = await db
    .prepare(
      `UPDATE fashion_u8_acceptance_runs
       SET status = 'consumed', successor_snapshot_id = ?, approval_audit_id = ?,
           consumed_at = ?, updated_at = ?
       WHERE run_id = ? AND manifest_digest = ? AND status = 'active' AND expires_at > ?
         AND operator_id = ? AND successor_draft_id = ? AND successor_snapshot_id IS NULL`,
    )
    .bind(
      snapshotId,
      `audit-${snapshotId}`,
      consumedAt,
      consumedAt,
      run.runId,
      run.manifestDigest,
      consumedAt,
      operatorId,
      draftId,
    )
    .run();
  if (result.meta.changes !== 1) {
    throw acceptanceError(
      "fashion_u8_acceptance_consumption_conflict",
      "The Fashion U8 run could not be consumed exactly once.",
    );
  }
}
