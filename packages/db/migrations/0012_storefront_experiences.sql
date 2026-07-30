CREATE TABLE storefront_experience_drafts (
  id TEXT PRIMARY KEY,
  experience_id TEXT NOT NULL,
  theme_id TEXT NOT NULL,
  theme_version TEXT NOT NULL,
  configuration_schema_version INTEGER NOT NULL CHECK (configuration_schema_version > 0),
  preset_id TEXT NOT NULL,
  bindings_json TEXT NOT NULL,
  overrides_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  updated_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX storefront_experience_drafts_experience_idx
  ON storefront_experience_drafts(experience_id, updated_at DESC);

CREATE TABLE storefront_experience_validations (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES storefront_experience_drafts(id) ON DELETE RESTRICT,
  draft_version INTEGER NOT NULL CHECK (draft_version > 0),
  status TEXT NOT NULL CHECK (status IN ('valid', 'invalid')),
  issues_json TEXT NOT NULL,
  resolved_templates_json TEXT NOT NULL,
  validated_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE (draft_id, draft_version)
);

CREATE TABLE storefront_experience_migrations (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES storefront_experience_drafts(id) ON DELETE RESTRICT,
  draft_version INTEGER NOT NULL CHECK (draft_version > 0),
  source_theme_version TEXT NOT NULL,
  source_configuration_schema_version INTEGER NOT NULL,
  target_theme_version TEXT NOT NULL,
  target_configuration_schema_version INTEGER NOT NULL,
  migrated_overrides_json TEXT NOT NULL,
  conflicts_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('dry_run', 'approved')),
  created_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  approved_by TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (
    (status = 'dry_run' AND approved_by IS NULL AND approved_at IS NULL)
    OR (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX storefront_experience_migrations_target_unique
  ON storefront_experience_migrations(
    draft_id,
    draft_version,
    target_theme_version,
    target_configuration_schema_version
  );

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
  CHECK (
    (kind = 'preview' AND approved_by IS NULL AND approved_at IS NULL)
    OR (kind = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX storefront_experience_snapshots_experience_idx
  ON storefront_experience_snapshots(experience_id, created_at DESC);

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
  UNIQUE (snapshot_id, attempt),
  CHECK (
    (status = 'deployed' AND artifact_digest IS NOT NULL AND artifact_prefix IS NOT NULL
      AND expires_at IS NOT NULL AND completed_at IS NOT NULL)
    OR status <> 'deployed'
  )
);

CREATE INDEX storefront_preview_builds_cleanup_idx
  ON storefront_preview_builds(status, expires_at);

CREATE TABLE storefront_preview_grants (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES storefront_experience_snapshots(id) ON DELETE RESTRICT,
  build_id TEXT NOT NULL REFERENCES storefront_preview_builds(id) ON DELETE RESTRICT,
  grant_digest TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  created_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE INDEX storefront_preview_grants_expiry_idx
  ON storefront_preview_grants(expires_at, redeemed_at);

CREATE TABLE storefront_preview_sessions (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES storefront_experience_snapshots(id) ON DELETE RESTRICT,
  build_id TEXT NOT NULL REFERENCES storefront_preview_builds(id) ON DELETE RESTRICT,
  session_digest TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX storefront_preview_sessions_expiry_idx
  ON storefront_preview_sessions(expires_at);

CREATE TRIGGER storefront_experience_validations_no_update
BEFORE UPDATE ON storefront_experience_validations
BEGIN
  SELECT RAISE(ABORT, 'immutable_storefront_experience_validation');
END;

CREATE TRIGGER storefront_experience_validations_no_delete
BEFORE DELETE ON storefront_experience_validations
BEGIN
  SELECT RAISE(ABORT, 'append_only_storefront_experience_validation');
END;

CREATE TRIGGER storefront_experience_snapshots_no_update
BEFORE UPDATE ON storefront_experience_snapshots
BEGIN
  SELECT RAISE(ABORT, 'immutable_storefront_experience_snapshot');
END;

CREATE TRIGGER storefront_experience_snapshots_no_delete
BEFORE DELETE ON storefront_experience_snapshots
BEGIN
  SELECT RAISE(ABORT, 'append_only_storefront_experience_snapshot');
END;

CREATE TRIGGER storefront_experience_migrations_approved_immutable
BEFORE UPDATE ON storefront_experience_migrations
WHEN OLD.status = 'approved'
  OR NEW.id <> OLD.id
  OR NEW.draft_id <> OLD.draft_id
  OR NEW.draft_version <> OLD.draft_version
  OR NEW.source_theme_version <> OLD.source_theme_version
  OR NEW.source_configuration_schema_version <> OLD.source_configuration_schema_version
  OR NEW.target_theme_version <> OLD.target_theme_version
  OR NEW.target_configuration_schema_version <> OLD.target_configuration_schema_version
  OR NEW.migrated_overrides_json <> OLD.migrated_overrides_json
  OR NEW.conflicts_json <> OLD.conflicts_json
  OR NEW.created_by <> OLD.created_by
  OR NEW.created_at <> OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'immutable_storefront_experience_migration');
END;

CREATE TRIGGER storefront_experience_migrations_no_delete
BEFORE DELETE ON storefront_experience_migrations
BEGIN
  SELECT RAISE(ABORT, 'append_only_storefront_experience_migration');
END;

CREATE TRIGGER storefront_preview_build_artifact_immutable
BEFORE UPDATE ON storefront_preview_builds
WHEN OLD.artifact_digest IS NOT NULL
  AND (
    NEW.artifact_digest IS NOT OLD.artifact_digest
    OR NEW.artifact_prefix IS NOT OLD.artifact_prefix
    OR NEW.snapshot_id <> OLD.snapshot_id
  )
BEGIN
  SELECT RAISE(ABORT, 'immutable_storefront_preview_artifact');
END;
