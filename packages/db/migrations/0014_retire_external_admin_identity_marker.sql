UPDATE admin_identities
   SET email = 'service-auth@shoppp.invalid'
 WHERE principal_kind = 'service'
   AND email = 'service-auth@cloudflare-access.invalid';
--> statement-breakpoint
DROP TRIGGER admin_identities_legacy_columns_after_insert;
--> statement-breakpoint
CREATE TRIGGER admin_identities_legacy_columns_after_insert
AFTER INSERT ON admin_identities
BEGIN
  UPDATE admin_identities
     SET email = CASE
           WHEN NEW.principal_kind = 'human' THEN NEW.normalized_email
           ELSE 'service-auth@shoppp.invalid'
         END,
         role = (SELECT key FROM admin_roles WHERE id = NEW.role_id)
   WHERE id = NEW.id;
END;
--> statement-breakpoint
DROP TRIGGER admin_identities_legacy_columns_after_update;
--> statement-breakpoint
CREATE TRIGGER admin_identities_legacy_columns_after_update
AFTER UPDATE OF principal_kind, normalized_email, role_id ON admin_identities
BEGIN
  UPDATE admin_identities
     SET email = CASE
           WHEN NEW.principal_kind = 'human' THEN NEW.normalized_email
           ELSE 'service-auth@shoppp.invalid'
         END,
         role = (SELECT key FROM admin_roles WHERE id = NEW.role_id)
   WHERE id = NEW.id;
END;
