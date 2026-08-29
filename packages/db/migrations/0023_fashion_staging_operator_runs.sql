CREATE TABLE fashion_staging_operator_runs (
  run_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'fashion-staging'),
  repository TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  workflow_run_attempt INTEGER NOT NULL CHECK (workflow_run_attempt > 0),
  status TEXT NOT NULL CHECK (
    status IN ('awaiting_operator', 'approved', 'rejected', 'canceled', 'expired', 'consumed')
  ),
  candidate_sha TEXT NOT NULL CHECK (length(candidate_sha) = 40),
  harness_sha TEXT NOT NULL CHECK (length(harness_sha) = 40),
  harness_manifest_digest TEXT NOT NULL CHECK (length(harness_manifest_digest) = 64),
  contract_test_digest TEXT NOT NULL CHECK (length(contract_test_digest) = 64),
  run_manifest_digest TEXT NOT NULL UNIQUE CHECK (length(run_manifest_digest) = 64),
  u12_readiness_digest TEXT NOT NULL CHECK (length(u12_readiness_digest) = 64),
  u12_snapshot_id TEXT NOT NULL REFERENCES storefront_experience_snapshots(id) ON DELETE RESTRICT,
  catalog_release_id TEXT NOT NULL REFERENCES catalog_releases(id) ON DELETE RESTRICT,
  source_draft_id TEXT NOT NULL REFERENCES storefront_experience_drafts(id) ON DELETE RESTRICT,
  working_draft_id TEXT NOT NULL REFERENCES storefront_experience_drafts(id) ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  successor_snapshot_id TEXT REFERENCES storefront_experience_snapshots(id) ON DELETE RESTRICT,
  successor_content_digest TEXT CHECK (
    successor_content_digest IS NULL OR length(successor_content_digest) = 64
  ),
  approval_audit_id TEXT REFERENCES audit_events(id) ON DELETE RESTRICT,
  operator_identity_id TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  approved_at TEXT,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'awaiting_operator' AND successor_snapshot_id IS NULL
      AND successor_content_digest IS NULL AND approval_audit_id IS NULL
      AND operator_identity_id IS NULL AND approved_at IS NULL AND consumed_at IS NULL)
    OR (status IN ('approved', 'consumed') AND successor_snapshot_id IS NOT NULL
      AND successor_content_digest IS NOT NULL AND approval_audit_id IS NOT NULL
      AND operator_identity_id IS NOT NULL AND approved_at IS NOT NULL
      AND ((status = 'approved' AND consumed_at IS NULL)
        OR (status = 'consumed' AND consumed_at IS NOT NULL)))
    OR status IN ('rejected', 'canceled', 'expired')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX fashion_staging_operator_active_environment
  ON fashion_staging_operator_runs(environment)
  WHERE status IN ('awaiting_operator', 'approved');
--> statement-breakpoint
CREATE INDEX fashion_staging_operator_working_draft_idx
  ON fashion_staging_operator_runs(working_draft_id, status, expires_at);
--> statement-breakpoint
CREATE TRIGGER fashion_staging_operator_approval_immutable
BEFORE UPDATE ON fashion_staging_operator_runs
WHEN OLD.approved_at IS NOT NULL AND (
  (OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'consumed', 'expired'))
  OR (OLD.status = 'consumed' AND NEW.status <> 'consumed')
  OR (OLD.status = 'expired' AND NEW.status <> 'expired')
  OR NEW.run_id <> OLD.run_id
  OR NEW.repository <> OLD.repository
  OR NEW.workflow_run_id <> OLD.workflow_run_id
  OR NEW.workflow_run_attempt <> OLD.workflow_run_attempt
  OR NEW.candidate_sha <> OLD.candidate_sha
  OR NEW.harness_sha <> OLD.harness_sha
  OR NEW.harness_manifest_digest <> OLD.harness_manifest_digest
  OR NEW.contract_test_digest <> OLD.contract_test_digest
  OR NEW.run_manifest_digest <> OLD.run_manifest_digest
  OR NEW.u12_readiness_digest <> OLD.u12_readiness_digest
  OR NEW.u12_snapshot_id <> OLD.u12_snapshot_id
  OR NEW.catalog_release_id <> OLD.catalog_release_id
  OR NEW.source_draft_id <> OLD.source_draft_id
  OR NEW.working_draft_id <> OLD.working_draft_id
  OR NEW.expires_at <> OLD.expires_at
  OR NEW.successor_snapshot_id IS NOT OLD.successor_snapshot_id
  OR NEW.successor_content_digest IS NOT OLD.successor_content_digest
  OR NEW.approval_audit_id IS NOT OLD.approval_audit_id
  OR NEW.operator_identity_id IS NOT OLD.operator_identity_id
  OR NEW.approved_at IS NOT OLD.approved_at
  OR (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS NOT OLD.consumed_at)
  OR (OLD.status = 'approved' AND NEW.status <> 'consumed' AND NEW.consumed_at IS NOT OLD.consumed_at)
  OR NEW.created_at <> OLD.created_at
)
BEGIN
  SELECT RAISE(ABORT, 'immutable_fashion_staging_operator_approval');
END;
