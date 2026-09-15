CREATE TABLE fashion_staging_catalog_reset_locks (
  id TEXT PRIMARY KEY CHECK (id = 'fashion-staging-catalog-reset'),
  owner_request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER fashion_catalog_reset_blocks_acceptance_insert
BEFORE INSERT ON fashion_staging_acceptance_runs
WHEN NEW.status IN ('acquired', 'running', 'cleanup_pending')
  AND EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks)
BEGIN
  SELECT RAISE(ABORT, 'fashion_catalog_reset_in_progress');
END;
--> statement-breakpoint
CREATE TRIGGER fashion_catalog_reset_blocks_acceptance_update
BEFORE UPDATE OF status ON fashion_staging_acceptance_runs
WHEN NEW.status IN ('acquired', 'running', 'cleanup_pending')
  AND EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks)
BEGIN
  SELECT RAISE(ABORT, 'fashion_catalog_reset_in_progress');
END;
--> statement-breakpoint
CREATE TRIGGER fashion_catalog_reset_blocks_operator_insert
BEFORE INSERT ON fashion_staging_operator_runs
WHEN NEW.status IN ('awaiting_operator', 'approved')
  AND EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks)
BEGIN
  SELECT RAISE(ABORT, 'fashion_catalog_reset_in_progress');
END;
--> statement-breakpoint
CREATE TRIGGER fashion_catalog_reset_blocks_operator_update
BEFORE UPDATE OF status ON fashion_staging_operator_runs
WHEN NEW.status IN ('awaiting_operator', 'approved')
  AND EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks)
BEGIN
  SELECT RAISE(ABORT, 'fashion_catalog_reset_in_progress');
END;
--> statement-breakpoint
CREATE TRIGGER fashion_catalog_reset_blocks_release_insert
BEFORE INSERT ON catalog_releases
WHEN NEW.status = 'building'
  AND EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks)
BEGIN
  SELECT RAISE(ABORT, 'fashion_catalog_reset_in_progress');
END;
--> statement-breakpoint
CREATE TRIGGER fashion_catalog_reset_blocks_release_update
BEFORE UPDATE OF status ON catalog_releases
WHEN NEW.status = 'building'
  AND EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks)
BEGIN
  SELECT RAISE(ABORT, 'fashion_catalog_reset_in_progress');
END;
--> statement-breakpoint
CREATE TRIGGER fashion_catalog_reset_blocks_preview_build_insert
BEFORE INSERT ON storefront_preview_builds
WHEN NEW.status IN ('pending', 'building')
  AND EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks)
BEGIN
  SELECT RAISE(ABORT, 'fashion_catalog_reset_in_progress');
END;
--> statement-breakpoint
CREATE TRIGGER fashion_catalog_reset_blocks_preview_build_update
BEFORE UPDATE OF status ON storefront_preview_builds
WHEN NEW.status IN ('pending', 'building')
  AND EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks)
BEGIN
  SELECT RAISE(ABORT, 'fashion_catalog_reset_in_progress');
END;
