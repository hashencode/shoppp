ALTER TABLE storefront_experience_migrations
  ADD COLUMN catalog_release_id TEXT REFERENCES catalog_releases(id) ON DELETE RESTRICT;

DROP INDEX storefront_experience_migrations_target_unique;

CREATE UNIQUE INDEX storefront_experience_migrations_target_unique
  ON storefront_experience_migrations(
    draft_id,
    draft_version,
    target_theme_version,
    target_configuration_schema_version
  ) WHERE catalog_release_id IS NULL;

CREATE UNIQUE INDEX storefront_experience_migrations_target_catalog_unique
  ON storefront_experience_migrations(
    draft_id,
    draft_version,
    target_theme_version,
    target_configuration_schema_version,
    catalog_release_id
  ) WHERE catalog_release_id IS NOT NULL;

DROP TRIGGER storefront_experience_migrations_approved_immutable;

CREATE TRIGGER storefront_experience_migrations_approved_immutable
BEFORE UPDATE ON storefront_experience_migrations
WHEN OLD.status = 'approved'
  OR NEW.id <> OLD.id
  OR NEW.draft_id <> OLD.draft_id
  OR NEW.draft_version <> OLD.draft_version
  OR NEW.catalog_release_id IS NOT OLD.catalog_release_id
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
