PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE _storefront_experience_validations_0019_backup AS
SELECT * FROM storefront_experience_validations;
--> statement-breakpoint
CREATE TABLE _storefront_experience_snapshots_0019_backup AS
SELECT * FROM storefront_experience_snapshots;
--> statement-breakpoint
CREATE TABLE _storefront_preview_builds_0019_backup AS
SELECT * FROM storefront_preview_builds;
--> statement-breakpoint
CREATE TABLE _storefront_preview_grants_0019_backup AS
SELECT * FROM storefront_preview_grants;
--> statement-breakpoint
CREATE TABLE _storefront_preview_sessions_0019_backup AS
SELECT * FROM storefront_preview_sessions;
--> statement-breakpoint
DROP TRIGGER storefront_experience_validations_no_update;
--> statement-breakpoint
DROP TRIGGER storefront_experience_validations_no_delete;
--> statement-breakpoint
DROP TRIGGER storefront_experience_snapshots_no_update;
--> statement-breakpoint
DROP TRIGGER storefront_experience_snapshots_no_delete;
--> statement-breakpoint
DROP TRIGGER storefront_preview_build_artifact_immutable;
--> statement-breakpoint
DROP TABLE storefront_preview_grants;
--> statement-breakpoint
DROP TABLE storefront_preview_sessions;
--> statement-breakpoint
DROP TABLE storefront_preview_builds;
--> statement-breakpoint
DROP TABLE storefront_experience_snapshots;
--> statement-breakpoint
DROP TABLE storefront_experience_validations;
--> statement-breakpoint
CREATE TABLE storefront_experience_validations (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES storefront_experience_drafts(id) ON DELETE RESTRICT,
  draft_version INTEGER NOT NULL CHECK (draft_version > 0),
  catalog_release_id TEXT REFERENCES catalog_releases(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('valid', 'invalid')),
  issues_json TEXT NOT NULL,
  resolved_templates_json TEXT NOT NULL,
  validated_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO storefront_experience_validations
  (id, draft_id, draft_version, catalog_release_id, status, issues_json,
   resolved_templates_json, validated_by, created_at)
SELECT id, draft_id, draft_version, NULL, status, issues_json,
       resolved_templates_json, validated_by, created_at
  FROM _storefront_experience_validations_0019_backup;
--> statement-breakpoint
CREATE UNIQUE INDEX storefront_experience_validations_draft_version_unique
  ON storefront_experience_validations(draft_id, draft_version)
  WHERE catalog_release_id IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX storefront_experience_validations_draft_version_catalog_unique
  ON storefront_experience_validations(draft_id, draft_version, catalog_release_id)
  WHERE catalog_release_id IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER storefront_experience_validations_no_update
BEFORE UPDATE ON storefront_experience_validations
BEGIN
  SELECT RAISE(ABORT, 'immutable_storefront_experience_validation');
END;
--> statement-breakpoint
CREATE TRIGGER storefront_experience_validations_no_delete
BEFORE DELETE ON storefront_experience_validations
BEGIN
  SELECT RAISE(ABORT, 'append_only_storefront_experience_validation');
END;
--> statement-breakpoint
CREATE TABLE storefront_experience_snapshots (
  id TEXT PRIMARY KEY,
  deduplication_key TEXT NOT NULL UNIQUE,
  experience_id TEXT NOT NULL,
  source_draft_id TEXT NOT NULL REFERENCES storefront_experience_drafts(id) ON DELETE RESTRICT,
  source_draft_version INTEGER NOT NULL CHECK (source_draft_version > 0),
  source_validation_id TEXT NOT NULL REFERENCES storefront_experience_validations(id) ON DELETE RESTRICT,
  migration_id TEXT REFERENCES storefront_experience_migrations(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('preview', 'approved')),
  theme_id TEXT NOT NULL,
  theme_version TEXT NOT NULL,
  configuration_schema_version INTEGER NOT NULL CHECK (configuration_schema_version > 0),
  snapshot_json TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  approved_by TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  content_digest TEXT,
  CHECK (
    (kind = 'preview' AND approved_by IS NULL AND approved_at IS NULL)
    OR (kind = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);
--> statement-breakpoint
INSERT INTO storefront_experience_snapshots
  (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
   source_validation_id, migration_id, kind, theme_id, theme_version,
   configuration_schema_version, snapshot_json, created_by, approved_by, approved_at,
   created_at, content_digest)
SELECT id, deduplication_key, experience_id, source_draft_id, source_draft_version,
       source_validation_id, migration_id, kind, theme_id, theme_version,
       configuration_schema_version, snapshot_json, created_by, approved_by, approved_at,
       created_at, content_digest
  FROM _storefront_experience_snapshots_0019_backup;
--> statement-breakpoint
CREATE INDEX storefront_experience_snapshots_experience_idx
  ON storefront_experience_snapshots(experience_id, created_at DESC);
--> statement-breakpoint
CREATE TRIGGER storefront_experience_snapshots_no_update
BEFORE UPDATE ON storefront_experience_snapshots
BEGIN
  SELECT RAISE(ABORT, 'immutable_storefront_experience_snapshot');
END;
--> statement-breakpoint
CREATE TRIGGER storefront_experience_snapshots_no_delete
BEFORE DELETE ON storefront_experience_snapshots
BEGIN
  SELECT RAISE(ABORT, 'append_only_storefront_experience_snapshot');
END;
--> statement-breakpoint
CREATE TABLE storefront_preview_builds (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES storefront_experience_snapshots(id) ON DELETE RESTRICT,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'building', 'deployed', 'failed', 'expired')),
  correlation_id TEXT,
  artifact_digest TEXT,
  artifact_prefix TEXT,
  failure_code TEXT,
  expires_at TEXT,
  completed_at TEXT,
  cleaned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  catalog_release_id TEXT REFERENCES catalog_releases(id) ON DELETE RESTRICT,
  experience_version INTEGER,
  theme_id TEXT,
  theme_version TEXT,
  platform_contract_version TEXT,
  media_origins_json TEXT,
  UNIQUE (snapshot_id, attempt),
  CHECK (
    (status = 'deployed' AND artifact_digest IS NOT NULL AND artifact_prefix IS NOT NULL
      AND expires_at IS NOT NULL AND completed_at IS NOT NULL)
    OR status <> 'deployed'
  )
);
--> statement-breakpoint
INSERT INTO storefront_preview_builds
  (id, snapshot_id, attempt, status, correlation_id, artifact_digest, artifact_prefix,
   failure_code, expires_at, completed_at, cleaned_at, created_at, updated_at,
   catalog_release_id, experience_version, theme_id, theme_version,
   platform_contract_version)
SELECT id, snapshot_id, attempt, status, correlation_id, artifact_digest, artifact_prefix,
       failure_code, expires_at, completed_at, cleaned_at, created_at, updated_at,
       catalog_release_id, experience_version, theme_id, theme_version,
       platform_contract_version
  FROM _storefront_preview_builds_0019_backup;
--> statement-breakpoint
CREATE INDEX storefront_preview_builds_cleanup_idx
  ON storefront_preview_builds(status, expires_at);
--> statement-breakpoint
CREATE INDEX storefront_preview_builds_input_identity_idx
  ON storefront_preview_builds(
    snapshot_id,
    catalog_release_id,
    experience_version,
    theme_id,
    theme_version,
    platform_contract_version
  );
--> statement-breakpoint
CREATE TRIGGER storefront_preview_build_artifact_immutable
BEFORE UPDATE ON storefront_preview_builds
WHEN (
  OLD.artifact_digest IS NOT NULL
  AND (
      NEW.artifact_digest IS NOT OLD.artifact_digest
      OR NEW.artifact_prefix IS NOT OLD.artifact_prefix
      OR NEW.snapshot_id <> OLD.snapshot_id
    )
  )
  OR NEW.media_origins_json IS NOT OLD.media_origins_json
BEGIN
  SELECT RAISE(ABORT, 'immutable_storefront_preview_artifact');
END;
--> statement-breakpoint
CREATE TABLE storefront_preview_grants (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES storefront_experience_snapshots(id) ON DELETE RESTRICT,
  build_id TEXT NOT NULL REFERENCES storefront_preview_builds(id) ON DELETE RESTRICT,
  grant_digest TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  created_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
--> statement-breakpoint
INSERT INTO storefront_preview_grants
  (id, snapshot_id, build_id, grant_digest, origin, expires_at, redeemed_at,
   created_by, created_at, revoked_at)
SELECT id, snapshot_id, build_id, grant_digest, origin, expires_at, redeemed_at,
       created_by, created_at, revoked_at
  FROM _storefront_preview_grants_0019_backup;
--> statement-breakpoint
CREATE INDEX storefront_preview_grants_expiry_idx
  ON storefront_preview_grants(expires_at, redeemed_at);
--> statement-breakpoint
CREATE INDEX storefront_preview_grants_snapshot_revocation_idx
  ON storefront_preview_grants(snapshot_id, revoked_at);
--> statement-breakpoint
CREATE TABLE storefront_preview_sessions (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES storefront_experience_snapshots(id) ON DELETE RESTRICT,
  build_id TEXT NOT NULL REFERENCES storefront_preview_builds(id) ON DELETE RESTRICT,
  session_digest TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
--> statement-breakpoint
INSERT INTO storefront_preview_sessions
  (id, snapshot_id, build_id, session_digest, origin, expires_at, created_at, revoked_at)
SELECT id, snapshot_id, build_id, session_digest, origin, expires_at, created_at, revoked_at
  FROM _storefront_preview_sessions_0019_backup;
--> statement-breakpoint
CREATE INDEX storefront_preview_sessions_expiry_idx
  ON storefront_preview_sessions(expires_at);
--> statement-breakpoint
CREATE INDEX storefront_preview_sessions_snapshot_revocation_idx
  ON storefront_preview_sessions(snapshot_id, revoked_at);
--> statement-breakpoint
DROP TABLE _storefront_preview_sessions_0019_backup;
--> statement-breakpoint
DROP TABLE _storefront_preview_grants_0019_backup;
--> statement-breakpoint
DROP TABLE _storefront_preview_builds_0019_backup;
--> statement-breakpoint
DROP TABLE _storefront_experience_snapshots_0019_backup;
--> statement-breakpoint
DROP TABLE _storefront_experience_validations_0019_backup;
--> statement-breakpoint
CREATE TABLE _storefront_validation_catalog_integrity_check (
  invalid_count INTEGER NOT NULL CHECK (invalid_count = 0)
);
--> statement-breakpoint
INSERT INTO _storefront_validation_catalog_integrity_check (invalid_count)
SELECT COUNT(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
DROP TABLE _storefront_validation_catalog_integrity_check;
