ALTER TABLE collection_versions ADD COLUMN redirect_from_slug TEXT;

UPDATE collection_versions
   SET seo_json = json_object('title', name, 'description', description)
 WHERE json_type(seo_json, '$.title') != 'text'
    OR trim(COALESCE(json_extract(seo_json, '$.title'), '')) = ''
    OR json_type(seo_json, '$.description') != 'text';

CREATE TABLE collection_route_redirects (
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  collection_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (environment, from_path),
  FOREIGN KEY (collection_id, collection_version)
    REFERENCES collection_versions(collection_id, version) ON DELETE RESTRICT,
  CHECK (from_path LIKE '/collections/%' AND to_path LIKE '/collections/%' AND from_path != to_path)
);

CREATE INDEX collection_route_redirects_target_lookup
  ON collection_route_redirects(collection_id, collection_version, environment);
