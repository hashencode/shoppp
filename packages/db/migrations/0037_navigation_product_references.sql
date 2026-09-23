CREATE TABLE navigation_product_references (
  menu_id TEXT NOT NULL,
  menu_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_version INTEGER NOT NULL CHECK (product_version > 0),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (menu_id, menu_version, item_id),
  FOREIGN KEY (menu_id, menu_version, item_id)
    REFERENCES navigation_items(menu_id, menu_version, item_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX navigation_product_backlink_lookup
  ON navigation_product_references(product_id, product_version, environment, menu_id, menu_version);

CREATE TRIGGER navigation_product_reference_active_guard
BEFORE INSERT ON navigation_product_references
WHEN EXISTS (
  SELECT 1 FROM products
   WHERE id = NEW.product_id AND version = NEW.product_version AND status = 'archived'
)
BEGIN
  SELECT RAISE(ABORT, 'reference_target_archived');
END;

CREATE TRIGGER navigation_product_reference_immutable
BEFORE UPDATE ON navigation_product_references
BEGIN
  SELECT RAISE(ABORT, 'reference_relation_immutable');
END;

CREATE TRIGGER product_archive_navigation_backlink_guard
BEFORE UPDATE OF status ON products
WHEN NEW.status = 'archived' AND OLD.status != 'archived' AND EXISTS (
  SELECT 1 FROM navigation_product_references
   WHERE product_id = OLD.id AND product_version = OLD.version
)
BEGIN
  SELECT RAISE(ABORT, 'resource_has_backlinks');
END;
