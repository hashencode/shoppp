ALTER TABLE storefront_experience_drafts ADD COLUMN name TEXT;
ALTER TABLE storefront_experience_drafts ADD COLUMN removed_at TEXT;
ALTER TABLE storefront_experience_drafts ADD COLUMN removed_by TEXT;

CREATE TABLE storefront_editor_sessions (
  id TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  draft_id TEXT NOT NULL REFERENCES storefront_experience_drafts(id),
  actor_id TEXT NOT NULL,
  catalog_release_id TEXT NOT NULL REFERENCES catalog_releases(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX storefront_editor_sessions_draft ON storefront_editor_sessions(draft_id, expires_at);
CREATE INDEX storefront_editor_sessions_expiry ON storefront_editor_sessions(expires_at);

CREATE TRIGGER storefront_validation_active_draft
BEFORE INSERT ON storefront_experience_validations
WHEN EXISTS (SELECT 1 FROM storefront_experience_drafts WHERE id = NEW.draft_id AND removed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'storefront_draft_removed'); END;

CREATE TRIGGER storefront_snapshot_active_draft
BEFORE INSERT ON storefront_experience_snapshots
WHEN EXISTS (SELECT 1 FROM storefront_experience_drafts WHERE id = NEW.source_draft_id AND removed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'storefront_draft_removed'); END;

CREATE TRIGGER storefront_build_active_draft
BEFORE INSERT ON storefront_preview_builds
WHEN EXISTS (SELECT 1 FROM storefront_experience_snapshots snapshot
  JOIN storefront_experience_drafts draft ON draft.id = snapshot.source_draft_id
  WHERE snapshot.id = NEW.snapshot_id AND draft.removed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'storefront_draft_removed'); END;

CREATE TRIGGER storefront_operator_active_draft
BEFORE INSERT ON fashion_staging_operator_runs
WHEN EXISTS (SELECT 1 FROM storefront_experience_drafts
  WHERE id IN (NEW.source_draft_id, NEW.working_draft_id) AND removed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'storefront_draft_removed'); END;

CREATE TRIGGER storefront_operator_update_active_draft
BEFORE UPDATE OF working_draft_id ON fashion_staging_operator_runs
WHEN EXISTS (SELECT 1 FROM storefront_experience_drafts WHERE id = NEW.working_draft_id AND removed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'storefront_draft_removed'); END;
