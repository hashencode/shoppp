ALTER TABLE catalog_releases ADD COLUMN build_correlation_id TEXT;
--> statement-breakpoint
CREATE INDEX catalog_releases_build_correlation_idx
  ON catalog_releases(build_correlation_id);
