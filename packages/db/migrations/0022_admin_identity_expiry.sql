ALTER TABLE admin_identities ADD COLUMN expires_at TEXT;
--> statement-breakpoint
CREATE INDEX admin_identities_expiry_idx ON admin_identities(expires_at, enabled);
