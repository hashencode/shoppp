CREATE TABLE catalog_release_sources (
  release_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (
    source_kind IN ('store-identity', 'policy', 'product', 'collection', 'page', 'article', 'navigation')
  ),
  source_id TEXT NOT NULL,
  source_version INTEGER NOT NULL CHECK (source_version > 0),
  source_digest TEXT NOT NULL CHECK (
    length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'
  ),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (release_id, source_kind, source_id)
);

ALTER TABLE catalog_releases ADD COLUMN candidate_status TEXT
  CHECK (candidate_status IS NULL OR candidate_status IN ('pending', 'succeeded', 'failed', 'abandoned', 'expired'));
ALTER TABLE catalog_releases ADD COLUMN candidate_failure_json TEXT
  CHECK (candidate_failure_json IS NULL OR (json_valid(candidate_failure_json) AND json_type(candidate_failure_json) = 'array'));
ALTER TABLE catalog_releases ADD COLUMN candidate_expires_at TEXT;

CREATE INDEX catalog_release_sources_source_lookup
  ON catalog_release_sources(source_kind, source_id, source_version);

CREATE TABLE catalog_release_media_ledger (
  release_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  frozen_key TEXT NOT NULL,
  digest TEXT NOT NULL CHECK (length(digest) = 64 AND digest NOT GLOB '*[^0-9a-f]*'),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (release_id, source_key)
);

CREATE UNIQUE INDEX catalog_release_private_tuple_unique
  ON catalog_releases(environment, source_digest)
  WHERE purpose = 'private-preview' AND source_digest IS NOT NULL;

CREATE TRIGGER catalog_release_v3_manifest_guard
BEFORE INSERT ON catalog_releases
WHEN json_extract(NEW.manifest_json, '$.schemaVersion') = 3 AND (
  NEW.manifest_digest IS NULL
  OR NEW.source_digest IS NULL
  OR json_extract(NEW.manifest_json, '$.purpose') IS NOT NEW.purpose
  OR json_extract(NEW.manifest_json, '$.environment') IS NOT NEW.environment
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_release_v3_identity_invalid');
END;

CREATE TRIGGER catalog_release_v3_update_manifest_guard
BEFORE UPDATE OF manifest_json, manifest_digest, source_digest, purpose, environment ON catalog_releases
WHEN json_extract(NEW.manifest_json, '$.schemaVersion') = 3 AND (
  NEW.manifest_digest IS NULL
  OR NEW.source_digest IS NULL
  OR json_extract(NEW.manifest_json, '$.purpose') IS NOT NEW.purpose
  OR json_extract(NEW.manifest_json, '$.environment') IS NOT NEW.environment
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_release_v3_identity_invalid');
END;

CREATE TRIGGER catalog_release_v3_immutable
BEFORE UPDATE OF manifest_json, manifest_digest, source_digest, purpose, environment ON catalog_releases
WHEN json_extract(OLD.manifest_json, '$.schemaVersion') = 3
BEGIN
  SELECT RAISE(ABORT, 'catalog_release_v3_immutable');
END;

DROP INDEX catalog_release_private_tuple_unique;
CREATE UNIQUE INDEX catalog_release_private_tuple_unique
  ON catalog_releases(environment, source_digest)
  WHERE purpose = 'private-preview'
    AND source_digest IS NOT NULL
    AND candidate_status IN ('pending', 'succeeded', 'failed');

-- A pending candidate is a short-lived, database-enforced read freeze. The builder
-- re-reads and compares the complete canonical payload immediately after acquiring
-- this freeze, so the stored source digests remain exact until terminal CAS.
CREATE TRIGGER catalog_candidate_freeze_settings_insert
BEFORE INSERT ON settings
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_settings_update
BEFORE UPDATE ON settings
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_settings_delete
BEFORE DELETE ON settings
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_products_insert
BEFORE INSERT ON products
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_products_update
BEFORE UPDATE ON products
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_products_delete
BEFORE DELETE ON products
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_revisions_insert
BEFORE INSERT ON product_revisions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_revisions_update
BEFORE UPDATE ON product_revisions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_revisions_delete
BEFORE DELETE ON product_revisions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_reviews_insert
BEFORE INSERT ON product_reviews
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_reviews_update
BEFORE UPDATE ON product_reviews
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_reviews_delete
BEFORE DELETE ON product_reviews
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_variants_insert
BEFORE INSERT ON product_variants
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_variants_update
BEFORE UPDATE ON product_variants
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_variants_delete
BEFORE DELETE ON product_variants
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_prices_insert
BEFORE INSERT ON prices
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_prices_update
BEFORE UPDATE ON prices
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_prices_delete
BEFORE DELETE ON prices
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_price_lists_insert
BEFORE INSERT ON price_lists
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_price_lists_update
BEFORE UPDATE ON price_lists
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_price_lists_delete
BEFORE DELETE ON price_lists
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_media_insert
BEFORE INSERT ON product_media
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_media_update
BEFORE UPDATE ON product_media
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_product_media_delete
BEFORE DELETE ON product_media
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collections_insert
BEFORE INSERT ON collections
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collections_update
BEFORE UPDATE ON collections
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collections_delete
BEFORE DELETE ON collections
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collection_versions_insert
BEFORE INSERT ON collection_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collection_versions_update
BEFORE UPDATE ON collection_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collection_versions_delete
BEFORE DELETE ON collection_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collection_memberships_insert
BEFORE INSERT ON collection_memberships
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collection_memberships_update
BEFORE UPDATE ON collection_memberships
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_collection_memberships_delete
BEFORE DELETE ON collection_memberships
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_store_identity_versions_insert
BEFORE INSERT ON store_identity_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_store_identity_versions_update
BEFORE UPDATE ON store_identity_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_store_identity_versions_delete
BEFORE DELETE ON store_identity_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_store_identity_logo_assets_insert
BEFORE INSERT ON store_identity_logo_assets
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_store_identity_logo_assets_update
BEFORE UPDATE ON store_identity_logo_assets
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_store_identity_logo_assets_delete
BEFORE DELETE ON store_identity_logo_assets
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_policy_versions_insert
BEFORE INSERT ON policy_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_policy_versions_update
BEFORE UPDATE ON policy_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_policy_versions_delete
BEFORE DELETE ON policy_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_content_page_versions_insert
BEFORE INSERT ON content_page_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_content_page_versions_update
BEFORE UPDATE ON content_page_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_content_page_versions_delete
BEFORE DELETE ON content_page_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_content_article_versions_insert
BEFORE INSERT ON content_article_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_content_article_versions_update
BEFORE UPDATE ON content_article_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_content_article_versions_delete
BEFORE DELETE ON content_article_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_menu_versions_insert
BEFORE INSERT ON navigation_menu_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_menu_versions_update
BEFORE UPDATE ON navigation_menu_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_menu_versions_delete
BEFORE DELETE ON navigation_menu_versions
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_items_insert
BEFORE INSERT ON navigation_items
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_items_update
BEFORE UPDATE ON navigation_items
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_items_delete
BEFORE DELETE ON navigation_items
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_policy_references_insert
BEFORE INSERT ON navigation_policy_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_policy_references_update
BEFORE UPDATE ON navigation_policy_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_policy_references_delete
BEFORE DELETE ON navigation_policy_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_page_references_insert
BEFORE INSERT ON navigation_page_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_page_references_update
BEFORE UPDATE ON navigation_page_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_page_references_delete
BEFORE DELETE ON navigation_page_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_article_references_insert
BEFORE INSERT ON navigation_article_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_article_references_update
BEFORE UPDATE ON navigation_article_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_article_references_delete
BEFORE DELETE ON navigation_article_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_collection_references_insert
BEFORE INSERT ON navigation_collection_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_collection_references_update
BEFORE UPDATE ON navigation_collection_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;

CREATE TRIGGER catalog_candidate_freeze_navigation_collection_references_delete
BEFORE DELETE ON navigation_collection_references
WHEN EXISTS (
  SELECT 1 FROM catalog_releases
   WHERE purpose = 'private-preview'
     AND candidate_status = 'pending'
     AND candidate_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
)
BEGIN
  SELECT RAISE(ABORT, 'catalog_candidate_sources_locked');
END;
