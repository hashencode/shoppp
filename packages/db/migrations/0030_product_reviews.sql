CREATE TABLE product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 80),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TEXT NOT NULL,
  moderated_at TEXT,
  moderated_by TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  moderation_reason TEXT,
  CHECK (
    (status = 'pending' AND moderated_at IS NULL AND moderated_by IS NULL)
    OR (status IN ('approved', 'rejected') AND moderated_at IS NOT NULL AND moderated_by IS NOT NULL)
  )
);

CREATE INDEX product_reviews_pending_lookup
  ON product_reviews(status, submitted_at, id);

CREATE INDEX product_reviews_approved_product_lookup
  ON product_reviews(product_id, status, submitted_at, id);

UPDATE admin_permission_definitions
   SET sort_order = sort_order + 100
 WHERE sort_order >= 3;

UPDATE admin_permission_definitions
   SET sort_order = sort_order - 99
 WHERE sort_order >= 103;

INSERT INTO admin_permission_definitions
  (permission_key, category, label, description, sort_order, created_at)
VALUES
  ('reviews.moderate', 'catalog', 'Moderate reviews',
   'Read pending customer reviews and approve or reject them.', 3,
   '2026-09-17T00:00:00.000Z');

INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
VALUES ('role_admin', 'reviews.moderate', '2026-09-17T00:00:00.000Z');
