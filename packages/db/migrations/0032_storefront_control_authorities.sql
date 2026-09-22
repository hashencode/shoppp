CREATE TABLE store_identity_versions (
  identity_id TEXT NOT NULL CHECK (identity_id = 'identity.primary'),
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  storefront_name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  favicon_asset_id TEXT,
  social_share_asset_id TEXT,
  seo_json TEXT NOT NULL CHECK (json_valid(seo_json) AND json_type(seo_json) = 'object'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  PRIMARY KEY (identity_id, version)
);

CREATE UNIQUE INDEX store_identity_one_current_published
  ON store_identity_versions(identity_id)
  WHERE status = 'published';

CREATE TABLE store_identity_logo_assets (
  identity_id TEXT NOT NULL,
  identity_version INTEGER NOT NULL,
  asset_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('primary', 'light', 'dark', 'compact')),
  PRIMARY KEY (identity_id, identity_version, asset_id),
  UNIQUE (identity_id, identity_version, variant),
  FOREIGN KEY (identity_id, identity_version)
    REFERENCES store_identity_versions(identity_id, version) ON DELETE RESTRICT
);

CREATE TABLE policy_versions (
  policy_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  kind TEXT NOT NULL CHECK (kind IN ('privacy', 'returns', 'shipping', 'terms')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  sections_json TEXT NOT NULL CHECK (json_valid(sections_json) AND json_type(sections_json) = 'array'),
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'published', 'archived')),
  approval_digest TEXT,
  approved_by TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  approved_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (policy_id, version),
  CHECK (
    status = 'draft'
    OR status = 'archived'
    OR (approval_digest IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CHECK (status != 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX policy_versions_published_slug_unique
  ON policy_versions(slug)
  WHERE status = 'published';

CREATE TABLE content_page_versions (
  page_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  sections_json TEXT NOT NULL CHECK (json_valid(sections_json) AND json_type(sections_json) = 'array'),
  seo_json TEXT NOT NULL CHECK (json_valid(seo_json) AND json_type(seo_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (page_id, version),
  CHECK (status != 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX content_page_versions_published_slug_unique
  ON content_page_versions(slug)
  WHERE status = 'published';

CREATE TABLE content_article_versions (
  article_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  cover_asset_id TEXT,
  sections_json TEXT NOT NULL CHECK (json_valid(sections_json) AND json_type(sections_json) = 'array'),
  seo_json TEXT NOT NULL CHECK (json_valid(seo_json) AND json_type(seo_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (article_id, version),
  CHECK (status != 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX content_article_versions_published_slug_unique
  ON content_article_versions(slug)
  WHERE status = 'published';

CREATE TABLE navigation_menu_versions (
  menu_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  placement TEXT NOT NULL CHECK (placement IN ('header', 'footer')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  PRIMARY KEY (menu_id, version),
  CHECK (status != 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX navigation_one_published_placement
  ON navigation_menu_versions(placement)
  WHERE status = 'published';

CREATE TABLE navigation_items (
  menu_id TEXT NOT NULL,
  menu_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  parent_item_id TEXT,
  position INTEGER NOT NULL CHECK (position >= 0),
  label TEXT NOT NULL,
  target_json TEXT NOT NULL CHECK (json_valid(target_json) AND json_type(target_json) = 'object'),
  PRIMARY KEY (menu_id, menu_version, item_id),
  FOREIGN KEY (menu_id, menu_version)
    REFERENCES navigation_menu_versions(menu_id, version) ON DELETE RESTRICT,
  FOREIGN KEY (menu_id, menu_version, parent_item_id)
    REFERENCES navigation_items(menu_id, menu_version, item_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX navigation_items_sibling_position_unique
  ON navigation_items(menu_id, menu_version, ifnull(parent_item_id, ''), position);

CREATE TABLE collection_versions (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_asset_id TEXT,
  seo_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(seo_json) AND json_type(seo_json) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  PRIMARY KEY (collection_id, version),
  CHECK (status != 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX collection_versions_published_slug_unique
  ON collection_versions(slug)
  WHERE status = 'published';

CREATE TABLE collection_memberships (
  collection_id TEXT NOT NULL,
  collection_version INTEGER NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (collection_id, collection_version, product_id),
  UNIQUE (collection_id, collection_version, position),
  FOREIGN KEY (collection_id, collection_version)
    REFERENCES collection_versions(collection_id, version) ON DELETE RESTRICT
);

CREATE INDEX collection_memberships_product_lookup
  ON collection_memberships(product_id, collection_id, collection_version, position);

INSERT INTO collection_versions
  (collection_id, version, slug, name, description, status, created_at, updated_at, published_at)
SELECT id, 1, slug, name, description, status, created_at, updated_at,
       CASE WHEN status = 'published' THEN updated_at ELSE NULL END
  FROM collections;

INSERT INTO collection_memberships
  (collection_id, collection_version, product_id, position)
SELECT collection_id, 1, product_id, position
  FROM collection_products;

CREATE TRIGGER collection_products_insert_authority_moved
BEFORE INSERT ON collection_products
BEGIN
  SELECT RAISE(ABORT, 'collection_membership_authority_moved_maintenance');
END;

CREATE TRIGGER collection_products_update_authority_moved
BEFORE UPDATE ON collection_products
BEGIN
  SELECT RAISE(ABORT, 'collection_membership_authority_moved_maintenance');
END;

CREATE TRIGGER collection_products_delete_authority_moved
BEFORE DELETE ON collection_products
BEGIN
  SELECT RAISE(ABORT, 'collection_membership_authority_moved_maintenance');
END;
