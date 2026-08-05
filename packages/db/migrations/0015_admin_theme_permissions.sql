CREATE TABLE _admin_permission_definitions_with_themes (
  permission_key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (
    category IN (
      'catalog', 'inventory', 'orders', 'reporting', 'audit', 'settings',
      'privacy', 'operations', 'iam', 'themes'
    )
  ),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order >= 0),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO _admin_permission_definitions_with_themes
  (permission_key, category, label, description, sort_order, created_at)
SELECT permission_key, category, label, description, sort_order, created_at
  FROM admin_permission_definitions;
--> statement-breakpoint
INSERT INTO _admin_permission_definitions_with_themes
  (permission_key, category, label, description, sort_order, created_at)
VALUES
  ('themes.read', 'themes', 'View themes', 'View storefront themes and experience drafts.', 21, '2026-08-05T00:00:00.000Z'),
  ('themes.write', 'themes', 'Edit themes', 'Create and edit storefront experience drafts.', 22, '2026-08-05T00:00:00.000Z'),
  ('themes.approve', 'themes', 'Approve themes', 'Approve storefront experience snapshots and migrations.', 23, '2026-08-05T00:00:00.000Z'),
  ('themes.preview', 'themes', 'Preview themes', 'Create and access private storefront previews.', 24, '2026-08-05T00:00:00.000Z');
--> statement-breakpoint
ALTER TABLE admin_permission_definitions RENAME TO _admin_permission_definitions_without_themes;
--> statement-breakpoint
ALTER TABLE _admin_permission_definitions_with_themes RENAME TO admin_permission_definitions;
--> statement-breakpoint
CREATE TABLE _admin_role_permissions_with_themes (
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  permission_key TEXT NOT NULL REFERENCES admin_permission_definitions(permission_key) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);
--> statement-breakpoint
INSERT INTO _admin_role_permissions_with_themes (role_id, permission_key, created_at)
SELECT role_id, permission_key, created_at FROM admin_role_permissions;
--> statement-breakpoint
DROP TABLE admin_role_permissions;
--> statement-breakpoint
ALTER TABLE _admin_role_permissions_with_themes RENAME TO admin_role_permissions;
--> statement-breakpoint
CREATE INDEX admin_role_permissions_permission_idx
  ON admin_role_permissions(permission_key, role_id);
--> statement-breakpoint
INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
SELECT 'role_admin', permission_key, '2026-08-05T00:00:00.000Z'
  FROM admin_permission_definitions
 WHERE category = 'themes';
--> statement-breakpoint
DROP TABLE _admin_permission_definitions_without_themes;
--> statement-breakpoint
CREATE TABLE _admin_theme_permission_integrity_check (
  invalid_count INTEGER NOT NULL CHECK (invalid_count = 0)
);
--> statement-breakpoint
INSERT INTO _admin_theme_permission_integrity_check (invalid_count)
SELECT COUNT(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
DROP TABLE _admin_theme_permission_integrity_check;
