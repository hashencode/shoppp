CREATE TABLE admin_password_credentials (
  identity_id TEXT PRIMARY KEY REFERENCES admin_identities(id) ON DELETE RESTRICT,
  password_hash TEXT NOT NULL CHECK (length(password_hash) BETWEEN 32 AND 128),
  password_salt TEXT NOT NULL CHECK (length(password_salt) BETWEEN 16 AND 128),
  password_iterations INTEGER NOT NULL CHECK (password_iterations >= 100000),
  password_version INTEGER NOT NULL DEFAULT 1 CHECK (password_version >= 1),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) BETWEEN 32 AND 128),
  password_version INTEGER NOT NULL CHECK (password_version >= 1),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX admin_sessions_identity_active_idx
  ON admin_sessions(identity_id, revoked_at, expires_at);
--> statement-breakpoint
CREATE INDEX admin_sessions_expiry_idx
  ON admin_sessions(expires_at, revoked_at);
--> statement-breakpoint
CREATE TABLE admin_password_reset_tokens (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) BETWEEN 32 AND 128),
  password_version INTEGER NOT NULL CHECK (password_version >= 1),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX admin_password_reset_identity_idx
  ON admin_password_reset_tokens(identity_id, used_at, expires_at);
--> statement-breakpoint
CREATE TABLE admin_login_throttles (
  key_hash TEXT PRIMARY KEY CHECK (length(key_hash) BETWEEN 32 AND 128),
  failure_count INTEGER NOT NULL CHECK (failure_count >= 0),
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX admin_login_throttles_blocked_idx
  ON admin_login_throttles(blocked_until, updated_at);
--> statement-breakpoint
CREATE TABLE admin_service_credentials (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) BETWEEN 32 AND 128),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  expires_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX admin_service_credentials_identity_idx
  ON admin_service_credentials(identity_id, enabled, expires_at);
--> statement-breakpoint
CREATE INDEX notification_jobs_admin_password_reset_delivery_idx
  ON notification_jobs(type, payload_json, created_at, id)
  WHERE type = 'admin_password_reset';
