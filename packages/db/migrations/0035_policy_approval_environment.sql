ALTER TABLE policy_versions ADD COLUMN approval_environment TEXT
  CHECK (approval_environment IS NULL OR approval_environment IN ('development', 'staging', 'production'));

CREATE INDEX policy_versions_kind_status_lookup
  ON policy_versions(kind, status, version DESC);
