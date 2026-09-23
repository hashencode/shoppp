CREATE TABLE content_route_redirects (
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  content_kind TEXT NOT NULL CHECK (content_kind IN ('page', 'article')),
  content_id TEXT NOT NULL,
  content_version INTEGER NOT NULL CHECK (content_version > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (environment, from_path),
  CHECK (from_path != to_path),
  CHECK (substr(from_path, 1, 1) = '/' AND substr(to_path, 1, 1) = '/')
);

CREATE INDEX content_route_redirect_target_lookup
  ON content_route_redirects(content_kind, content_id, content_version, environment);
