ALTER TABLE notification_jobs ADD COLUMN checkout_attempt_id TEXT
  REFERENCES checkout_attempts(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN provider_event_id TEXT
  REFERENCES payment_events(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN kind TEXT NOT NULL DEFAULT 'notification'
  CHECK (kind IN ('notification', 'provider_recovery'));
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3
  CHECK (max_attempts BETWEEN 1 AND 10);
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN attempt_cycle_count INTEGER NOT NULL DEFAULT 0
  CHECK (attempt_cycle_count >= 0);
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN claim_expires_at TEXT;
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN enqueued_at TEXT;
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN sent_at TEXT;
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN provider_message_id TEXT;
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN dead_lettered_at TEXT;
--> statement-breakpoint
ALTER TABLE notification_jobs ADD COLUMN replay_count INTEGER NOT NULL DEFAULT 0
  CHECK (replay_count >= 0);
--> statement-breakpoint
CREATE INDEX notification_jobs_dispatch_idx
  ON notification_jobs(status, next_attempt_at, enqueued_at, created_at);
--> statement-breakpoint
CREATE INDEX notification_jobs_checkout_attempt_idx
  ON notification_jobs(checkout_attempt_id, created_at);
--> statement-breakpoint
CREATE INDEX notification_jobs_provider_event_idx
  ON notification_jobs(provider_event_id, created_at);
--> statement-breakpoint
CREATE TABLE notification_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES notification_jobs(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  result TEXT NOT NULL CHECK (
    result IN ('sent', 'retryable_failure', 'permanent_failure', 'exhausted')
  ),
  error_code TEXT,
  provider_message_id TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  UNIQUE(job_id, attempt_number)
);
--> statement-breakpoint
CREATE INDEX notification_attempts_job_idx
  ON notification_attempts(job_id, attempt_number);
--> statement-breakpoint
CREATE TRIGGER notification_attempts_immutable_update
BEFORE UPDATE ON notification_attempts
BEGIN
  SELECT RAISE(ABORT, 'immutable_notification_attempt');
END;
--> statement-breakpoint
CREATE TRIGGER notification_attempts_immutable_delete
BEFORE DELETE ON notification_attempts
BEGIN
  SELECT RAISE(ABORT, 'immutable_notification_attempt');
END;
