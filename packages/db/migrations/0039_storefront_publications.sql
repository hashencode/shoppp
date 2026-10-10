INSERT INTO admin_permission_definitions
  (permission_key, category, label, description, sort_order, created_at)
SELECT 'themes.publish', 'themes', 'Publish storefront',
       'Publish approved storefront versions and restore previously activated versions.',
       max(sort_order) + 1, '2026-10-11T00:00:00.000Z'
  FROM admin_permission_definitions;
INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
VALUES ('role_admin', 'themes.publish', '2026-10-11T00:00:00.000Z');

CREATE TABLE storefront_publications (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  catalog_release_id TEXT NOT NULL REFERENCES catalog_releases(id) ON DELETE RESTRICT,
  snapshot_id TEXT NOT NULL REFERENCES storefront_experience_snapshots(id) ON DELETE RESTRICT,
  identity_json TEXT NOT NULL CHECK (json_valid(identity_json)),
  operation TEXT NOT NULL CHECK (operation IN ('publish', 'rollback')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'building', 'succeeded', 'failed', 'unresolved')),
  expected_active_publication_id TEXT REFERENCES storefront_publications(id) ON DELETE RESTRICT,
  rollback_of TEXT REFERENCES storefront_publications(id) ON DELETE RESTRICT,
  restore_worker_version_id TEXT,
  created_by TEXT NOT NULL REFERENCES admin_identities(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  correlation_id TEXT,
  failure_code TEXT,
  run_id TEXT,
  run_attempt INTEGER CHECK (run_attempt IS NULL OR run_attempt > 0),
  source_commit TEXT,
  receipt_json TEXT CHECK (receipt_json IS NULL OR json_valid(receipt_json)),
  CHECK (json_extract(identity_json, '$.catalogReleaseId') = catalog_release_id),
  CHECK (json_extract(identity_json, '$.experienceSnapshotId') = snapshot_id),
  CHECK ((operation = 'publish' AND rollback_of IS NULL AND restore_worker_version_id IS NULL)
      OR (operation = 'rollback' AND rollback_of IS NOT NULL AND restore_worker_version_id IS NOT NULL)),
  CHECK ((status = 'succeeded' AND receipt_json IS NOT NULL) OR (status != 'succeeded' AND receipt_json IS NULL))
);
CREATE UNIQUE INDEX storefront_publications_one_pending_environment
  ON storefront_publications(environment) WHERE status IN ('queued', 'building', 'unresolved');
CREATE INDEX storefront_publications_catalog_activation
  ON storefront_publications(catalog_release_id, environment, status);
CREATE INDEX storefront_publications_snapshot_history
  ON storefront_publications(snapshot_id, created_at DESC);

CREATE TABLE storefront_active_publications (
  environment TEXT PRIMARY KEY CHECK (environment IN ('development', 'staging', 'production')),
  publication_id TEXT NOT NULL REFERENCES storefront_publications(id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL
);
CREATE TRIGGER storefront_publication_identity_immutable
BEFORE UPDATE OF id, environment, catalog_release_id, snapshot_id, identity_json, operation,
                 expected_active_publication_id, rollback_of, restore_worker_version_id,
                 created_by, reason, created_at ON storefront_publications
BEGIN
  SELECT RAISE(ABORT, 'storefront_publication_identity_immutable');
END;
CREATE TRIGGER storefront_publication_terminal_immutable
BEFORE UPDATE ON storefront_publications
WHEN OLD.status IN ('succeeded', 'failed') OR (OLD.status = 'unresolved' AND (
  NEW.status != 'failed' OR NEW.run_id IS NOT OLD.run_id
  OR NEW.run_attempt IS NOT OLD.run_attempt OR NEW.source_commit IS NOT OLD.source_commit
))
BEGIN
  SELECT RAISE(ABORT, 'storefront_publication_terminal_immutable');
END;
CREATE TRIGGER storefront_publication_authorization_guard
BEFORE INSERT ON storefront_publications
WHEN NOT EXISTS (
  SELECT 1 FROM storefront_experience_snapshots s
  JOIN storefront_experience_validations v ON v.id = s.source_validation_id
  JOIN catalog_releases c ON c.id = v.catalog_release_id
  JOIN admin_identities actor ON actor.id = NEW.created_by
  JOIN storefront_experience_drafts d ON d.id = s.source_draft_id
  WHERE s.id = NEW.snapshot_id AND s.kind = 'approved' AND v.status = 'valid'
    AND s.source_draft_version = v.draft_version AND v.draft_id = s.source_draft_id
    AND c.id = NEW.catalog_release_id AND c.environment = NEW.environment
    AND actor.principal_kind = 'human'
    AND (NEW.operation = 'rollback' OR d.version = s.source_draft_version)
    AND (NEW.operation = 'rollback' OR c.purpose = 'public' OR
      (c.candidate_status = 'succeeded' AND c.candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
    AND json_extract(NEW.identity_json, '$.experienceSnapshotId') = s.id
    AND json_extract(NEW.identity_json, '$.experienceVersion') = s.source_draft_version
    AND json_extract(NEW.identity_json, '$.themeId') = s.theme_id
    AND json_extract(NEW.identity_json, '$.themeVersion') = s.theme_version
    AND (c.manifest_digest IS NULL OR json_extract(NEW.identity_json, '$.catalogManifestDigest') = c.manifest_digest)
    AND json_extract(NEW.identity_json, '$.catalogSourceDigest') IS c.source_digest
    AND (s.content_digest IS NULL OR json_extract(NEW.identity_json, '$.snapshotDigest') = s.content_digest)
)
BEGIN
  SELECT RAISE(ABORT, 'storefront_publication_approval_stale');
END;
CREATE TRIGGER storefront_publication_no_delete
BEFORE DELETE ON storefront_publications
BEGIN
  SELECT RAISE(ABORT, 'storefront_publication_retained');
END;
CREATE TRIGGER storefront_active_publication_insert_guard
BEFORE INSERT ON storefront_active_publications
WHEN NOT EXISTS (SELECT 1 FROM storefront_publications
  WHERE id = NEW.publication_id AND environment = NEW.environment AND status = 'succeeded')
BEGIN
  SELECT RAISE(ABORT, 'storefront_activation_receipt_required');
END;
CREATE TRIGGER storefront_active_publication_update_guard
BEFORE UPDATE ON storefront_active_publications
WHEN NOT EXISTS (SELECT 1 FROM storefront_publications
  WHERE id = NEW.publication_id AND environment = NEW.environment AND status = 'succeeded')
BEGIN
  SELECT RAISE(ABORT, 'storefront_activation_receipt_required');
END;
CREATE TRIGGER catalog_publication_abandon_guard
BEFORE UPDATE OF candidate_status ON catalog_releases
WHEN NEW.candidate_status = 'abandoned' AND EXISTS (
  SELECT 1 FROM storefront_publications WHERE catalog_release_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_publication_retained');
END;
CREATE TRIGGER catalog_publication_media_retained
BEFORE DELETE ON catalog_release_media_ledger
WHEN EXISTS (SELECT 1 FROM storefront_publications WHERE catalog_release_id = OLD.release_id)
BEGIN
  SELECT RAISE(ABORT, 'catalog_publication_retained');
END;
CREATE TRIGGER catalog_publication_manifest_retained
BEFORE UPDATE OF manifest_json, manifest_digest, source_digest, purpose, environment ON catalog_releases
WHEN json_extract(OLD.manifest_json, '$.schemaVersion') != 3
  AND EXISTS (SELECT 1 FROM storefront_publications WHERE catalog_release_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'catalog_publication_retained');
END;
