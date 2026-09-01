CREATE TABLE fashion_u8_acceptance_runs (
  run_id TEXT PRIMARY KEY,
  manifest_digest TEXT NOT NULL UNIQUE CHECK (length(manifest_digest) = 64),
  repository TEXT NOT NULL,
  workflow_run_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment = 'fashion-staging'),
  candidate_sha TEXT NOT NULL CHECK (length(candidate_sha) = 40),
  harness_sha TEXT NOT NULL CHECK (length(harness_sha) = 40),
  catalog_release_id TEXT NOT NULL,
  u12_snapshot_id TEXT NOT NULL,
  source_draft_id TEXT NOT NULL,
  successor_draft_id TEXT,
  successor_snapshot_id TEXT,
  approval_audit_id TEXT,
  operator_id TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('awaiting_operator', 'active', 'consumed', 'rejected', 'canceled', 'expired')
  ),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX fashion_u8_acceptance_status_expiry_idx
  ON fashion_u8_acceptance_runs(status, expires_at, run_id);
