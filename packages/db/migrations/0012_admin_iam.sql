PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE admin_permission_definitions (
  permission_key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (
    category IN ('catalog', 'inventory', 'orders', 'reporting', 'audit', 'settings', 'privacy', 'operations', 'iam')
  ),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order >= 0),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO admin_permission_definitions
  (permission_key, category, label, description, sort_order, created_at)
VALUES
  ('catalog.read', 'catalog', 'View catalog', 'View products and catalog content.', 0, '2026-08-04T00:00:00.000Z'),
  ('catalog.write', 'catalog', 'Edit catalog', 'Create and edit catalog content.', 1, '2026-08-04T00:00:00.000Z'),
  ('catalog.publish', 'catalog', 'Publish catalog', 'Publish catalog content.', 2, '2026-08-04T00:00:00.000Z'),
  ('inventory.read', 'inventory', 'View inventory', 'View inventory levels and history.', 3, '2026-08-04T00:00:00.000Z'),
  ('inventory.adjust', 'inventory', 'Adjust inventory', 'Adjust inventory levels.', 4, '2026-08-04T00:00:00.000Z'),
  ('orders.read', 'orders', 'View orders', 'View orders and their timelines.', 5, '2026-08-04T00:00:00.000Z'),
  ('orders.fulfill', 'orders', 'Fulfill orders', 'Advance order fulfillment.', 6, '2026-08-04T00:00:00.000Z'),
  ('orders.cancel', 'orders', 'Cancel orders', 'Cancel eligible orders.', 7, '2026-08-04T00:00:00.000Z'),
  ('orders.refund', 'orders', 'Refund orders', 'Refund eligible order payments.', 8, '2026-08-04T00:00:00.000Z'),
  ('reporting.read', 'reporting', 'View reports', 'View operational reports.', 9, '2026-08-04T00:00:00.000Z'),
  ('reporting.export', 'reporting', 'Export reports', 'Export operational reports.', 10, '2026-08-04T00:00:00.000Z'),
  ('audit.read', 'audit', 'View audit trail', 'View the application audit trail.', 11, '2026-08-04T00:00:00.000Z'),
  ('settings.read', 'settings', 'View settings', 'View application settings.', 12, '2026-08-04T00:00:00.000Z'),
  ('settings.write', 'settings', 'Edit settings', 'Change application settings.', 13, '2026-08-04T00:00:00.000Z'),
  ('privacy.manage', 'privacy', 'Manage privacy', 'Run privacy-management operations.', 14, '2026-08-04T00:00:00.000Z'),
  ('operations.replay', 'operations', 'Replay jobs', 'Replay failed operational jobs.', 15, '2026-08-04T00:00:00.000Z'),
  ('operations.jobs.read', 'operations', 'View jobs', 'View operational job status.', 16, '2026-08-04T00:00:00.000Z'),
  ('iam.users.read', 'iam', 'View users', 'View human administrator accounts and invitations.', 17, '2026-08-04T00:00:00.000Z'),
  ('iam.users.write', 'iam', 'Manage users', 'Invite, assign, enable, and disable human administrators.', 18, '2026-08-04T00:00:00.000Z'),
  ('iam.roles.read', 'iam', 'View roles', 'View roles and effective permission sets.', 19, '2026-08-04T00:00:00.000Z'),
  ('iam.roles.write', 'iam', 'Manage roles', 'Create, edit, and archive roles.', 20, '2026-08-04T00:00:00.000Z');
--> statement-breakpoint
CREATE TABLE admin_roles (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE CHECK (
    length(key) BETWEEN 1 AND 64
    AND key NOT GLOB '*[^a-z0-9_]*'
    AND substr(key, 1, 1) GLOB '[a-z]'
  ),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR length(trim(description)) <= 500),
  protected INTEGER NOT NULL DEFAULT 0 CHECK (protected IN (0, 1)),
  system INTEGER NOT NULL DEFAULT 0 CHECK (system IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (protected = 0 OR system = 1)
);
--> statement-breakpoint
INSERT INTO admin_roles
  (id, key, name, description, protected, system, enabled, version, created_at, updated_at)
VALUES
  ('role_admin', 'admin', 'Admin', 'Protected administrator with the complete registered permission catalog.', 1, 1, 1, 1, '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z'),
  ('role_catalog_manager', 'catalog_manager', 'Catalog manager', 'Manages catalog publication and reads inventory.', 0, 1, 1, 1, '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'operations', 'Operations', 'Runs order, inventory, audit, and operational recovery workflows.', 0, 1, 1, 1, '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z'),
  ('role_support', 'support', 'Support', 'Reads catalog, inventory, and orders.', 0, 1, 1, 1, '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z'),
  ('role_analyst', 'analyst', 'Analyst', 'Reads and exports operational reports.', 0, 1, 1, 1, '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z');
--> statement-breakpoint
CREATE TABLE admin_role_permissions (
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  permission_key TEXT NOT NULL REFERENCES admin_permission_definitions(permission_key) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);
--> statement-breakpoint
INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
SELECT 'role_admin', permission_key, '2026-08-04T00:00:00.000Z'
FROM admin_permission_definitions;
--> statement-breakpoint
INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
VALUES
  ('role_catalog_manager', 'catalog.read', '2026-08-04T00:00:00.000Z'),
  ('role_catalog_manager', 'catalog.write', '2026-08-04T00:00:00.000Z'),
  ('role_catalog_manager', 'catalog.publish', '2026-08-04T00:00:00.000Z'),
  ('role_catalog_manager', 'inventory.read', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'catalog.read', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'inventory.read', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'inventory.adjust', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'orders.read', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'orders.fulfill', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'orders.cancel', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'orders.refund', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'audit.read', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'operations.replay', '2026-08-04T00:00:00.000Z'),
  ('role_operations', 'operations.jobs.read', '2026-08-04T00:00:00.000Z'),
  ('role_support', 'catalog.read', '2026-08-04T00:00:00.000Z'),
  ('role_support', 'inventory.read', '2026-08-04T00:00:00.000Z'),
  ('role_support', 'orders.read', '2026-08-04T00:00:00.000Z'),
  ('role_analyst', 'catalog.read', '2026-08-04T00:00:00.000Z'),
  ('role_analyst', 'inventory.read', '2026-08-04T00:00:00.000Z'),
  ('role_analyst', 'orders.read', '2026-08-04T00:00:00.000Z'),
  ('role_analyst', 'reporting.read', '2026-08-04T00:00:00.000Z'),
  ('role_analyst', 'reporting.export', '2026-08-04T00:00:00.000Z');
--> statement-breakpoint
CREATE INDEX admin_role_permissions_permission_idx
  ON admin_role_permissions(permission_key, role_id);
--> statement-breakpoint
CREATE TABLE _admin_identities_new (
  id TEXT PRIMARY KEY,
  principal_kind TEXT NOT NULL CHECK (principal_kind IN ('human', 'service')),
  access_subject TEXT NOT NULL UNIQUE,
  normalized_email TEXT,
  email TEXT NOT NULL DEFAULT 'service-auth@cloudflare-access.invalid',
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 160),
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (principal_kind = 'human' AND normalized_email IS NOT NULL AND length(trim(normalized_email)) BETWEEN 3 AND 254)
    OR (principal_kind = 'service' AND normalized_email IS NULL)
  ),
  CHECK (normalized_email IS NULL OR normalized_email = lower(trim(normalized_email)))
);
--> statement-breakpoint
INSERT INTO _admin_identities_new
  (id, principal_kind, access_subject, normalized_email, email, display_name, role_id, role,
   enabled, version, last_seen_at, created_at, updated_at)
SELECT legacy.id,
       CASE WHEN legacy.email = 'service-auth@cloudflare-access.invalid' THEN 'service' ELSE 'human' END,
       legacy.access_subject,
       CASE WHEN legacy.email = 'service-auth@cloudflare-access.invalid' THEN NULL ELSE lower(trim(legacy.email)) END,
       legacy.email,
       legacy.display_name,
       role.id,
       legacy.role,
       legacy.enabled,
       1,
       NULL,
       legacy.created_at,
       legacy.updated_at
  FROM admin_identities legacy
  JOIN admin_roles role ON role.key = legacy.role;
--> statement-breakpoint
CREATE TABLE _admin_iam_migration_check (
  invalid_count INTEGER NOT NULL CHECK (invalid_count = 0)
);
--> statement-breakpoint
INSERT INTO _admin_iam_migration_check (invalid_count)
SELECT abs(
  (SELECT COUNT(*) FROM admin_identities) -
  (SELECT COUNT(*) FROM _admin_identities_new)
);
--> statement-breakpoint
DROP TABLE _admin_iam_migration_check;
--> statement-breakpoint
CREATE TABLE _admin_actor_reference_backup (
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  PRIMARY KEY (table_name, row_id)
);
--> statement-breakpoint
INSERT INTO _admin_actor_reference_backup (table_name, row_id, actor_id)
SELECT 'stock_ledger_entries', id, actor_id FROM stock_ledger_entries WHERE actor_id IS NOT NULL
UNION ALL
SELECT 'catalog_releases', id, approved_by FROM catalog_releases WHERE approved_by IS NOT NULL
UNION ALL
SELECT 'refunds', id, requested_by FROM refunds WHERE requested_by IS NOT NULL
UNION ALL
SELECT 'fulfillment_events', id, actor_id FROM fulfillment_events WHERE actor_id IS NOT NULL
UNION ALL
SELECT 'order_events', id, actor_id FROM order_events WHERE actor_id IS NOT NULL;
--> statement-breakpoint
DROP TRIGGER stock_ledger_immutable_update;
--> statement-breakpoint
DROP TRIGGER stock_ledger_entries_no_update;
--> statement-breakpoint
DROP TRIGGER fulfillment_events_append_only_update;
--> statement-breakpoint
DROP TRIGGER order_events_append_only_update;
--> statement-breakpoint
UPDATE stock_ledger_entries SET actor_id = NULL WHERE actor_id IS NOT NULL;
--> statement-breakpoint
UPDATE catalog_releases SET approved_by = NULL WHERE approved_by IS NOT NULL;
--> statement-breakpoint
UPDATE refunds SET requested_by = NULL WHERE requested_by IS NOT NULL;
--> statement-breakpoint
UPDATE fulfillment_events SET actor_id = NULL WHERE actor_id IS NOT NULL;
--> statement-breakpoint
UPDATE order_events SET actor_id = NULL WHERE actor_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE _admin_report_exports_backup AS SELECT * FROM report_exports;
--> statement-breakpoint
DELETE FROM report_exports;
--> statement-breakpoint
CREATE TABLE _admin_privacy_request_events_backup AS SELECT * FROM privacy_request_events;
--> statement-breakpoint
DROP TRIGGER privacy_request_events_immutable_delete;
--> statement-breakpoint
DELETE FROM privacy_request_events;
--> statement-breakpoint
CREATE TABLE _admin_privacy_requests_backup AS SELECT * FROM privacy_requests;
--> statement-breakpoint
DELETE FROM privacy_requests;
--> statement-breakpoint
DROP TABLE admin_identities;
--> statement-breakpoint
ALTER TABLE _admin_identities_new RENAME TO admin_identities;
--> statement-breakpoint
CREATE TRIGGER admin_identities_legacy_columns_after_insert
AFTER INSERT ON admin_identities
BEGIN
  UPDATE admin_identities
     SET email = CASE
           WHEN NEW.principal_kind = 'human' THEN NEW.normalized_email
           ELSE 'service-auth@cloudflare-access.invalid'
         END,
         role = (SELECT key FROM admin_roles WHERE id = NEW.role_id)
   WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER admin_identities_legacy_columns_after_update
AFTER UPDATE OF principal_kind, normalized_email, role_id ON admin_identities
BEGIN
  UPDATE admin_identities
     SET email = CASE
           WHEN NEW.principal_kind = 'human' THEN NEW.normalized_email
           ELSE 'service-auth@cloudflare-access.invalid'
         END,
         role = (SELECT key FROM admin_roles WHERE id = NEW.role_id)
   WHERE id = NEW.id;
END;
--> statement-breakpoint
UPDATE stock_ledger_entries
   SET actor_id = (
     SELECT backup.actor_id
       FROM _admin_actor_reference_backup backup
      WHERE backup.table_name = 'stock_ledger_entries'
        AND backup.row_id = stock_ledger_entries.id
   )
 WHERE id IN (
   SELECT row_id FROM _admin_actor_reference_backup WHERE table_name = 'stock_ledger_entries'
 );
--> statement-breakpoint
UPDATE catalog_releases
   SET approved_by = (
     SELECT backup.actor_id
       FROM _admin_actor_reference_backup backup
      WHERE backup.table_name = 'catalog_releases'
        AND backup.row_id = catalog_releases.id
   )
 WHERE id IN (
   SELECT row_id FROM _admin_actor_reference_backup WHERE table_name = 'catalog_releases'
 );
--> statement-breakpoint
UPDATE refunds
   SET requested_by = (
     SELECT backup.actor_id
       FROM _admin_actor_reference_backup backup
      WHERE backup.table_name = 'refunds'
        AND backup.row_id = refunds.id
   )
 WHERE id IN (
   SELECT row_id FROM _admin_actor_reference_backup WHERE table_name = 'refunds'
 );
--> statement-breakpoint
UPDATE fulfillment_events
   SET actor_id = (
     SELECT backup.actor_id
       FROM _admin_actor_reference_backup backup
      WHERE backup.table_name = 'fulfillment_events'
        AND backup.row_id = fulfillment_events.id
   )
 WHERE id IN (
   SELECT row_id FROM _admin_actor_reference_backup WHERE table_name = 'fulfillment_events'
 );
--> statement-breakpoint
UPDATE order_events
   SET actor_id = (
     SELECT backup.actor_id
       FROM _admin_actor_reference_backup backup
      WHERE backup.table_name = 'order_events'
        AND backup.row_id = order_events.id
   )
 WHERE id IN (
   SELECT row_id FROM _admin_actor_reference_backup WHERE table_name = 'order_events'
 );
--> statement-breakpoint
INSERT INTO report_exports
  (id, environment, currency, time_zone, start_date, end_date, query_json, status,
   row_count, object_key, error_code, requested_by, expires_at, created_at, updated_at)
SELECT id, environment, currency, time_zone, start_date, end_date, query_json, status,
       row_count, object_key, error_code, requested_by, expires_at, created_at, updated_at
  FROM _admin_report_exports_backup;
--> statement-breakpoint
INSERT INTO privacy_requests
  (id, subject_hash, type, status, decision, object_key, requested_by, expires_at,
   completed_at, created_at)
SELECT id, subject_hash, type, status, decision, object_key, requested_by, expires_at,
       completed_at, created_at
  FROM _admin_privacy_requests_backup;
--> statement-breakpoint
INSERT INTO privacy_request_events
  (id, privacy_request_id, event_type, metadata_json, created_at)
SELECT id, privacy_request_id, event_type, metadata_json, created_at
  FROM _admin_privacy_request_events_backup;
--> statement-breakpoint
DROP TABLE _admin_actor_reference_backup;
--> statement-breakpoint
DROP TABLE _admin_report_exports_backup;
--> statement-breakpoint
DROP TABLE _admin_privacy_request_events_backup;
--> statement-breakpoint
DROP TABLE _admin_privacy_requests_backup;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_immutable_update
BEFORE UPDATE ON stock_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'stock ledger entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_entries_no_update
BEFORE UPDATE ON stock_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'append_only_stock_ledger');
END;
--> statement-breakpoint
CREATE TRIGGER fulfillment_events_append_only_update
BEFORE UPDATE ON fulfillment_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_fulfillment_events');
END;
--> statement-breakpoint
CREATE TRIGGER order_events_append_only_update
BEFORE UPDATE ON order_events
BEGIN
  SELECT RAISE(ABORT, 'append_only_order_events');
END;
--> statement-breakpoint
CREATE TRIGGER privacy_request_events_immutable_delete
BEFORE DELETE ON privacy_request_events
BEGIN
  SELECT RAISE(ABORT, 'immutable_privacy_request_event');
END;
--> statement-breakpoint
CREATE UNIQUE INDEX admin_identities_human_email_unique
  ON admin_identities(normalized_email)
  WHERE principal_kind = 'human';
--> statement-breakpoint
CREATE INDEX admin_identities_role_enabled_idx
  ON admin_identities(role_id, enabled, principal_kind);
--> statement-breakpoint
CREATE TABLE admin_invitations (
  id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL CHECK (
    normalized_email = lower(trim(normalized_email))
    AND length(normalized_email) BETWEEN 3 AND 254
  ),
  display_name TEXT CHECK (display_name IS NULL OR length(trim(display_name)) BETWEEN 1 AND 160),
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 128),
  invited_by_id TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  accepted_identity_id TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'pending' AND accepted_identity_id IS NULL AND accepted_at IS NULL AND revoked_at IS NULL)
    OR (status = 'accepted' AND accepted_identity_id IS NOT NULL AND accepted_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND accepted_identity_id IS NULL AND accepted_at IS NULL AND revoked_at IS NOT NULL)
    OR (status = 'expired' AND accepted_identity_id IS NULL AND accepted_at IS NULL AND revoked_at IS NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX admin_invitations_active_email_unique
  ON admin_invitations(normalized_email)
  WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX admin_invitations_role_status_idx
  ON admin_invitations(role_id, status, expires_at);
--> statement-breakpoint
CREATE INDEX admin_invitations_inviter_idx
  ON admin_invitations(invited_by_id, created_at);
--> statement-breakpoint
CREATE INDEX notification_jobs_admin_invitation_delivery_idx
  ON notification_jobs(type, payload_json, created_at, id)
  WHERE type = 'admin_invitation';
--> statement-breakpoint
CREATE TABLE _admin_iam_integrity_check (
  invalid_count INTEGER NOT NULL CHECK (invalid_count = 0)
);
--> statement-breakpoint
INSERT INTO _admin_iam_integrity_check (invalid_count)
SELECT COUNT(*) FROM pragma_foreign_key_check;
--> statement-breakpoint
DROP TABLE _admin_iam_integrity_check;
