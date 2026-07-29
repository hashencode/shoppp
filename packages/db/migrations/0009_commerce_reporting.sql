ALTER TABLE checkout_attempts ADD COLUMN environment TEXT NOT NULL DEFAULT 'development'
  CHECK (environment IN ('development', 'staging', 'production'));
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD COLUMN test_mode INTEGER NOT NULL DEFAULT 0
  CHECK (test_mode IN (0, 1));
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN environment TEXT NOT NULL DEFAULT 'development'
  CHECK (environment IN ('development', 'staging', 'production'));
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN test_mode INTEGER NOT NULL DEFAULT 0
  CHECK (test_mode IN (0, 1));
--> statement-breakpoint
CREATE INDEX orders_reporting_idx
  ON orders(environment, test_mode, currency, created_at, id);
--> statement-breakpoint
CREATE TRIGGER checkout_attempts_immutable_reporting_context
BEFORE UPDATE OF environment, test_mode ON checkout_attempts
BEGIN
  SELECT RAISE(ABORT, 'immutable_checkout_reporting_context');
END;
--> statement-breakpoint
CREATE TRIGGER orders_immutable_reporting_context
BEFORE UPDATE OF environment, test_mode ON orders
BEGIN
  SELECT RAISE(ABORT, 'immutable_order_reporting_context');
END;
--> statement-breakpoint
CREATE TABLE report_exports (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  currency TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  query_json TEXT NOT NULL CHECK (json_valid(query_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'expired')),
  row_count INTEGER CHECK (row_count IS NULL OR row_count >= 0),
  object_key TEXT UNIQUE,
  error_code TEXT,
  requested_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX report_exports_requester_idx
  ON report_exports(requested_by, created_at DESC, id);
--> statement-breakpoint
CREATE INDEX report_exports_expiry_idx
  ON report_exports(status, expires_at);
