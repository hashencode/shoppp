CREATE TABLE _admin_permission_definitions_with_storefront_control (
  permission_key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (
    category IN (
      'catalog', 'inventory', 'orders', 'reporting', 'audit', 'settings',
      'identity', 'policies', 'content', 'navigation',
      'privacy', 'operations', 'iam', 'themes'
    )
  ),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order >= 0),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO _admin_permission_definitions_with_storefront_control
  (permission_key, category, label, description, sort_order, created_at)
SELECT permission_key, category, label, description,
       CASE WHEN sort_order >= 15 THEN sort_order + 12 ELSE sort_order END,
       created_at
  FROM admin_permission_definitions;
--> statement-breakpoint
INSERT INTO _admin_permission_definitions_with_storefront_control
  (permission_key, category, label, description, sort_order, created_at)
VALUES
  ('identity.read', 'identity', 'View store identity',
   'View the versioned storefront identity and shared brand assets.', 15, '2026-09-23T00:00:00.000Z'),
  ('identity.write', 'identity', 'Edit store identity',
   'Create and edit versioned storefront identity records.', 16, '2026-09-23T00:00:00.000Z'),
  ('policies.read', 'policies', 'View policies',
   'View versioned storefront policies.', 17, '2026-09-23T00:00:00.000Z'),
  ('policies.write', 'policies', 'Edit policies',
   'Create and edit policy drafts.', 18, '2026-09-23T00:00:00.000Z'),
  ('policies.approve', 'policies', 'Approve policies',
   'Approve an exact version of a policy.', 19, '2026-09-23T00:00:00.000Z'),
  ('policies.publish', 'policies', 'Publish policies',
   'Publish, unpublish, and archive approved policies.', 20, '2026-09-23T00:00:00.000Z'),
  ('content.read', 'content', 'View content',
   'View versioned storefront pages and articles.', 21, '2026-09-23T00:00:00.000Z'),
  ('content.write', 'content', 'Edit content',
   'Create and edit storefront pages and articles.', 22, '2026-09-23T00:00:00.000Z'),
  ('content.publish', 'content', 'Publish content',
   'Publish and archive storefront pages and articles.', 23, '2026-09-23T00:00:00.000Z'),
  ('navigation.read', 'navigation', 'View navigation',
   'View reusable storefront navigation menus.', 24, '2026-09-23T00:00:00.000Z'),
  ('navigation.write', 'navigation', 'Edit navigation',
   'Create and edit reusable storefront navigation menus.', 25, '2026-09-23T00:00:00.000Z'),
  ('navigation.publish', 'navigation', 'Publish navigation',
   'Publish and archive reusable storefront navigation menus.', 26, '2026-09-23T00:00:00.000Z');
--> statement-breakpoint
ALTER TABLE admin_permission_definitions RENAME TO _admin_permission_definitions_before_storefront_control;
--> statement-breakpoint
ALTER TABLE _admin_permission_definitions_with_storefront_control RENAME TO admin_permission_definitions;
--> statement-breakpoint
CREATE TABLE _admin_role_permissions_with_storefront_control (
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  permission_key TEXT NOT NULL REFERENCES admin_permission_definitions(permission_key) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);
--> statement-breakpoint
INSERT INTO _admin_role_permissions_with_storefront_control (role_id, permission_key, created_at)
SELECT role_id, permission_key, created_at FROM admin_role_permissions;
--> statement-breakpoint
DROP TABLE admin_role_permissions;
--> statement-breakpoint
ALTER TABLE _admin_role_permissions_with_storefront_control RENAME TO admin_role_permissions;
--> statement-breakpoint
CREATE INDEX admin_role_permissions_permission_idx
  ON admin_role_permissions(permission_key, role_id);
--> statement-breakpoint
INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
SELECT 'role_admin', permission_key, '2026-09-23T00:00:00.000Z'
  FROM admin_permission_definitions
 WHERE category IN ('identity', 'policies', 'content', 'navigation');
--> statement-breakpoint
DROP TABLE _admin_permission_definitions_before_storefront_control;
--> statement-breakpoint

CREATE TABLE navigation_policy_references (
  menu_id TEXT NOT NULL,
  menu_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL CHECK (policy_version > 0),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (menu_id, menu_version, item_id),
  FOREIGN KEY (menu_id, menu_version, item_id)
    REFERENCES navigation_items(menu_id, menu_version, item_id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id, policy_version)
    REFERENCES policy_versions(policy_id, version) ON DELETE RESTRICT
);
CREATE INDEX navigation_policy_backlink_lookup
  ON navigation_policy_references(policy_id, policy_version, environment, menu_id, menu_version);

CREATE TABLE navigation_page_references (
  menu_id TEXT NOT NULL,
  menu_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_version INTEGER NOT NULL CHECK (page_version > 0),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (menu_id, menu_version, item_id),
  FOREIGN KEY (menu_id, menu_version, item_id)
    REFERENCES navigation_items(menu_id, menu_version, item_id) ON DELETE CASCADE,
  FOREIGN KEY (page_id, page_version)
    REFERENCES content_page_versions(page_id, version) ON DELETE RESTRICT
);
CREATE INDEX navigation_page_backlink_lookup
  ON navigation_page_references(page_id, page_version, environment, menu_id, menu_version);

CREATE TABLE navigation_article_references (
  menu_id TEXT NOT NULL,
  menu_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  article_version INTEGER NOT NULL CHECK (article_version > 0),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (menu_id, menu_version, item_id),
  FOREIGN KEY (menu_id, menu_version, item_id)
    REFERENCES navigation_items(menu_id, menu_version, item_id) ON DELETE CASCADE,
  FOREIGN KEY (article_id, article_version)
    REFERENCES content_article_versions(article_id, version) ON DELETE RESTRICT
);
CREATE INDEX navigation_article_backlink_lookup
  ON navigation_article_references(article_id, article_version, environment, menu_id, menu_version);

CREATE TABLE navigation_collection_references (
  menu_id TEXT NOT NULL,
  menu_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  collection_version INTEGER NOT NULL CHECK (collection_version > 0),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (menu_id, menu_version, item_id),
  FOREIGN KEY (menu_id, menu_version, item_id)
    REFERENCES navigation_items(menu_id, menu_version, item_id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id, collection_version)
    REFERENCES collection_versions(collection_id, version) ON DELETE RESTRICT
);
CREATE INDEX navigation_collection_backlink_lookup
  ON navigation_collection_references(collection_id, collection_version, environment, menu_id, menu_version);

CREATE TRIGGER navigation_policy_reference_active_guard
BEFORE INSERT ON navigation_policy_references
WHEN EXISTS (
  SELECT 1 FROM policy_versions
   WHERE policy_id = NEW.policy_id AND version = NEW.policy_version AND status = 'archived'
)
BEGIN
  SELECT RAISE(ABORT, 'reference_target_archived');
END;

CREATE TRIGGER navigation_policy_reference_immutable
BEFORE UPDATE ON navigation_policy_references
BEGIN
  SELECT RAISE(ABORT, 'reference_relation_immutable');
END;

CREATE TRIGGER policy_archive_backlink_guard
BEFORE UPDATE OF status ON policy_versions
WHEN NEW.status = 'archived' AND OLD.status != 'archived' AND EXISTS (
  SELECT 1 FROM navigation_policy_references
   WHERE policy_id = OLD.policy_id AND policy_version = OLD.version
)
BEGIN
  SELECT RAISE(ABORT, 'resource_has_backlinks');
END;

CREATE TRIGGER navigation_page_reference_active_guard
BEFORE INSERT ON navigation_page_references
WHEN EXISTS (
  SELECT 1 FROM content_page_versions
   WHERE page_id = NEW.page_id AND version = NEW.page_version AND status = 'archived'
)
BEGIN
  SELECT RAISE(ABORT, 'reference_target_archived');
END;

CREATE TRIGGER navigation_page_reference_immutable
BEFORE UPDATE ON navigation_page_references
BEGIN
  SELECT RAISE(ABORT, 'reference_relation_immutable');
END;

CREATE TRIGGER content_page_archive_backlink_guard
BEFORE UPDATE OF status ON content_page_versions
WHEN NEW.status = 'archived' AND OLD.status != 'archived' AND EXISTS (
  SELECT 1 FROM navigation_page_references
   WHERE page_id = OLD.page_id AND page_version = OLD.version
)
BEGIN
  SELECT RAISE(ABORT, 'resource_has_backlinks');
END;

CREATE TRIGGER navigation_article_reference_active_guard
BEFORE INSERT ON navigation_article_references
WHEN EXISTS (
  SELECT 1 FROM content_article_versions
   WHERE article_id = NEW.article_id AND version = NEW.article_version AND status = 'archived'
)
BEGIN
  SELECT RAISE(ABORT, 'reference_target_archived');
END;

CREATE TRIGGER navigation_article_reference_immutable
BEFORE UPDATE ON navigation_article_references
BEGIN
  SELECT RAISE(ABORT, 'reference_relation_immutable');
END;

CREATE TRIGGER content_article_archive_backlink_guard
BEFORE UPDATE OF status ON content_article_versions
WHEN NEW.status = 'archived' AND OLD.status != 'archived' AND EXISTS (
  SELECT 1 FROM navigation_article_references
   WHERE article_id = OLD.article_id AND article_version = OLD.version
)
BEGIN
  SELECT RAISE(ABORT, 'resource_has_backlinks');
END;

CREATE TRIGGER navigation_collection_reference_active_guard
BEFORE INSERT ON navigation_collection_references
WHEN EXISTS (
  SELECT 1 FROM collection_versions
   WHERE collection_id = NEW.collection_id AND version = NEW.collection_version AND status = 'archived'
)
BEGIN
  SELECT RAISE(ABORT, 'reference_target_archived');
END;

CREATE TRIGGER navigation_collection_reference_immutable
BEFORE UPDATE ON navigation_collection_references
BEGIN
  SELECT RAISE(ABORT, 'reference_relation_immutable');
END;

CREATE TRIGGER collection_archive_backlink_guard
BEFORE UPDATE OF status ON collection_versions
WHEN NEW.status = 'archived' AND OLD.status != 'archived' AND EXISTS (
  SELECT 1 FROM navigation_collection_references
   WHERE collection_id = OLD.collection_id AND collection_version = OLD.version
)
BEGIN
  SELECT RAISE(ABORT, 'resource_has_backlinks');
END;

ALTER TABLE catalog_releases ADD COLUMN purpose TEXT NOT NULL DEFAULT 'public'
  CHECK (purpose IN ('private-preview', 'public'));
ALTER TABLE catalog_releases ADD COLUMN environment TEXT NOT NULL DEFAULT 'development'
  CHECK (environment IN ('development', 'staging', 'production'));
ALTER TABLE catalog_releases ADD COLUMN manifest_digest TEXT
  CHECK (manifest_digest IS NULL OR (length(manifest_digest) = 64 AND manifest_digest NOT GLOB '*[^0-9a-f]*'));
ALTER TABLE catalog_releases ADD COLUMN source_digest TEXT
  CHECK (source_digest IS NULL OR (length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'));
ALTER TABLE catalog_releases ADD COLUMN attestation_json TEXT
  CHECK (attestation_json IS NULL OR (json_valid(attestation_json) AND json_type(attestation_json) = 'object'));
ALTER TABLE catalog_releases ADD COLUMN attested_at TEXT;

CREATE TRIGGER catalog_release_attestation_insert_guard
BEFORE INSERT ON catalog_releases
WHEN (NEW.attestation_json IS NULL) != (NEW.attested_at IS NULL)
  OR (NEW.purpose = 'private-preview' AND NEW.attestation_json IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'catalog_release_attestation_invalid');
END;

CREATE TRIGGER catalog_release_attestation_update_guard
BEFORE UPDATE OF purpose, attestation_json, attested_at ON catalog_releases
WHEN (NEW.attestation_json IS NULL) != (NEW.attested_at IS NULL)
  OR (NEW.purpose = 'private-preview' AND NEW.attestation_json IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'catalog_release_attestation_invalid');
END;
