CREATE TABLE fashion_staging_acceptance_runs (
  run_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'fashion-staging'),
  owner TEXT NOT NULL,
  namespace TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN ('acquired', 'running', 'cleanup_pending', 'completed', 'failed')
  ),
  catalog_release_id TEXT NOT NULL,
  experience_snapshot_id TEXT NOT NULL,
  artifact_digest TEXT NOT NULL CHECK (length(artifact_digest) = 64),
  commit_sha TEXT NOT NULL CHECK (length(commit_sha) = 40),
  seed_manifest_digest TEXT NOT NULL CHECK (length(seed_manifest_digest) = 64),
  variant_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  baseline_on_hand_quantity INTEGER NOT NULL CHECK (baseline_on_hand_quantity >= 0),
  baseline_reserved_quantity INTEGER NOT NULL CHECK (baseline_reserved_quantity >= 0),
  baseline_backordered_quantity INTEGER NOT NULL CHECK (baseline_backordered_quantity >= 0),
  baseline_oversell_limit INTEGER NOT NULL CHECK (baseline_oversell_limit >= 0),
  lease_expires_at TEXT NOT NULL,
  journey_failure TEXT,
  cleanup_failure TEXT,
  before_inventory_json TEXT NOT NULL CHECK (json_valid(before_inventory_json)),
  after_inventory_json TEXT CHECK (after_inventory_json IS NULL OR json_valid(after_inventory_json)),
  retained_order_references_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(retained_order_references_json)),
  cleanup_started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (variant_id, warehouse_id)
    REFERENCES inventory_items(variant_id, warehouse_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX fashion_staging_acceptance_active_lock
  ON fashion_staging_acceptance_runs(environment)
  WHERE status IN ('acquired', 'running', 'cleanup_pending');
--> statement-breakpoint
CREATE INDEX fashion_staging_acceptance_status_lease_idx
  ON fashion_staging_acceptance_runs(status, lease_expires_at, run_id);
--> statement-breakpoint
CREATE TABLE fashion_staging_acceptance_resources (
  run_id TEXT NOT NULL REFERENCES fashion_staging_acceptance_runs(run_id) ON DELETE RESTRICT,
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('cart', 'checkout_attempt', 'reservation_group', 'reservation', 'order')
  ),
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, resource_type, resource_id)
);
--> statement-breakpoint
CREATE INDEX fashion_staging_acceptance_resource_lookup_idx
  ON fashion_staging_acceptance_resources(resource_type, resource_id, run_id);
--> statement-breakpoint
CREATE TRIGGER fashion_staging_acceptance_resources_no_delete
BEFORE DELETE ON fashion_staging_acceptance_resources
BEGIN
  SELECT RAISE(ABORT, 'append_only_acceptance_resources');
END;
