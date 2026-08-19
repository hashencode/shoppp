ALTER TABLE storefront_experience_snapshots ADD COLUMN content_digest TEXT;

ALTER TABLE storefront_preview_grants ADD COLUMN revoked_at TEXT;

ALTER TABLE storefront_preview_sessions ADD COLUMN revoked_at TEXT;

CREATE INDEX storefront_preview_grants_snapshot_revocation_idx
  ON storefront_preview_grants(snapshot_id, revoked_at);

CREATE INDEX storefront_preview_sessions_snapshot_revocation_idx
  ON storefront_preview_sessions(snapshot_id, revoked_at);
