ALTER TABLE storefront_preview_builds
  ADD COLUMN catalog_release_id TEXT REFERENCES catalog_releases(id) ON DELETE RESTRICT;

ALTER TABLE storefront_preview_builds
  ADD COLUMN experience_version INTEGER;

ALTER TABLE storefront_preview_builds
  ADD COLUMN theme_id TEXT;

ALTER TABLE storefront_preview_builds
  ADD COLUMN theme_version TEXT;

ALTER TABLE storefront_preview_builds
  ADD COLUMN platform_contract_version TEXT;

CREATE INDEX storefront_preview_builds_input_identity_idx
  ON storefront_preview_builds(
    snapshot_id,
    catalog_release_id,
    experience_version,
    theme_id,
    theme_version,
    platform_contract_version
  );
