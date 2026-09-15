CREATE TABLE fashion_staging_catalog_migrations (
  catalog_version TEXT PRIMARY KEY,
  manifest_digest TEXT NOT NULL UNIQUE CHECK (length(manifest_digest) = 64),
  catalog_manifest_json TEXT NOT NULL CHECK (json_valid(catalog_manifest_json)),
  iam_fingerprint_before TEXT NOT NULL CHECK (length(iam_fingerprint_before) = 64),
  iam_fingerprint_after TEXT NOT NULL CHECK (length(iam_fingerprint_after) = 64),
  shopper_release_id TEXT NOT NULL UNIQUE REFERENCES catalog_releases(id) ON DELETE RESTRICT,
  acceptance_release_id TEXT NOT NULL UNIQUE REFERENCES catalog_releases(id) ON DELETE RESTRICT,
  product_count INTEGER NOT NULL CHECK (product_count = 13),
  variant_count INTEGER NOT NULL CHECK (variant_count = 24),
  media_count INTEGER NOT NULL CHECK (media_count = 18),
  actor_id TEXT NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES audit_events(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
