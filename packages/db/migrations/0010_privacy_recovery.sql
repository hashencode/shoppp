CREATE TABLE privacy_requests (
  id TEXT PRIMARY KEY,
  subject_hash TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('access', 'correction', 'deletion')),
  status TEXT NOT NULL CHECK (status IN ('completed')),
  decision TEXT NOT NULL CHECK (
    decision IN ('export_created', 'retained_immutable_financial_records', 'no_matching_records')
  ),
  object_key TEXT UNIQUE,
  requested_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  expires_at TEXT,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX privacy_requests_subject_idx
  ON privacy_requests(subject_hash, created_at DESC, id);
--> statement-breakpoint
CREATE TABLE privacy_request_events (
  id TEXT PRIMARY KEY,
  privacy_request_id TEXT NOT NULL REFERENCES privacy_requests(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('verified', 'exported', 'retention_decision_recorded', 'completed')
  ),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER privacy_request_events_immutable_update
BEFORE UPDATE ON privacy_request_events
BEGIN
  SELECT RAISE(ABORT, 'immutable_privacy_request_event');
END;
--> statement-breakpoint
CREATE TRIGGER privacy_request_events_immutable_delete
BEFORE DELETE ON privacy_request_events
BEGIN
  SELECT RAISE(ABORT, 'immutable_privacy_request_event');
END;
--> statement-breakpoint
CREATE TABLE d1_backup_runs (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  database_id TEXT NOT NULL,
  object_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('started', 'ready', 'failed', 'verified')),
  error_code TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
--> statement-breakpoint
CREATE INDEX d1_backup_runs_status_idx
  ON d1_backup_runs(environment, status, started_at DESC);
