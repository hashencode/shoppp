CREATE TABLE product_media_assets (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

INSERT INTO product_media_assets (id, product_id, r2_key, created_at)
SELECT id, product_id, r2_key, created_at FROM product_media;

CREATE TRIGGER product_media_asset_claim_after_insert
AFTER INSERT ON product_media
BEGIN
  SELECT RAISE(ABORT, 'product media asset identity conflict')
  WHERE EXISTS (
    SELECT 1 FROM product_media_assets
    WHERE (id = NEW.id OR r2_key = NEW.r2_key)
      AND NOT (id = NEW.id AND product_id = NEW.product_id AND r2_key = NEW.r2_key)
  );
  INSERT OR IGNORE INTO product_media_assets (id, product_id, r2_key, created_at)
  VALUES (NEW.id, NEW.product_id, NEW.r2_key, NEW.created_at);
END;

CREATE INDEX product_media_assets_product_lookup
  ON product_media_assets(product_id, id);

CREATE TABLE product_revisions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  base_product_version INTEGER NOT NULL CHECK (base_product_version > 0),
  base_published_revision_id TEXT REFERENCES product_revisions(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'building', 'published', 'failed')),
  content_json TEXT NOT NULL CHECK (json_valid(content_json) AND json_type(content_json) = 'object'),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE UNIQUE INDEX product_revisions_one_open_per_product
  ON product_revisions(product_id)
  WHERE status IN ('draft', 'building');

CREATE INDEX product_revisions_published_lookup
  ON product_revisions(product_id, published_at, id)
  WHERE status = 'published';

ALTER TABLE catalog_releases
ADD COLUMN product_revision_id TEXT REFERENCES product_revisions(id) ON DELETE RESTRICT;
