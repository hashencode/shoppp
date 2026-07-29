PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE admin_identities (
  id TEXT PRIMARY KEY,
  access_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'catalog_manager', 'operations', 'support', 'analyst')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  option_values_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(option_values_json)),
  weight_grams INTEGER NOT NULL CHECK (weight_grams >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX product_variants_product_idx ON product_variants(product_id, status);
--> statement-breakpoint
CREATE TABLE product_media (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  r2_key TEXT NOT NULL UNIQUE,
  alt_text TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE product_categories (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);
--> statement-breakpoint
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE collection_products (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (collection_id, product_id)
);
--> statement-breakpoint
CREATE TABLE price_lists (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE prices (
  id TEXT PRIMARY KEY,
  price_list_id TEXT NOT NULL REFERENCES price_lists(id) ON DELETE RESTRICT,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (price_list_id, variant_id)
);
--> statement-breakpoint
CREATE TABLE warehouses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE inventory_items (
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  on_hand_quantity INTEGER NOT NULL DEFAULT 0 CHECK (on_hand_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  oversell_limit INTEGER NOT NULL DEFAULT 0 CHECK (oversell_limit >= 0),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (variant_id, warehouse_id),
  CHECK (reserved_quantity <= on_hand_quantity + oversell_limit)
);
--> statement-breakpoint
CREATE TABLE stock_ledger_entries (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta != 0),
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  actor_id TEXT REFERENCES admin_identities(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (variant_id, warehouse_id) REFERENCES inventory_items(variant_id, warehouse_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX stock_ledger_item_idx ON stock_ledger_entries(variant_id, warehouse_id, created_at);
--> statement-breakpoint
CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  public_token_hash TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  pricing_context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(pricing_context_json)),
  promotion_context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(promotion_context_json)),
  shipping_country TEXT CHECK (shipping_country IS NULL OR length(shipping_country) = 2),
  status TEXT NOT NULL CHECK (status IN ('active', 'converted', 'expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE cart_lines (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (cart_id, variant_id)
);
--> statement-breakpoint
CREATE TABLE shipping_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE shipping_zone_countries (
  zone_id TEXT NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  PRIMARY KEY (zone_id, country_code)
);
--> statement-breakpoint
CREATE TABLE shipping_methods (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES shipping_zones(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('flat', 'weight')),
  price_amount INTEGER NOT NULL CHECK (price_amount >= 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  free_threshold_amount INTEGER CHECK (free_threshold_amount IS NULL OR free_threshold_amount >= 0),
  min_weight_grams INTEGER CHECK (min_weight_grams IS NULL OR min_weight_grams >= 0),
  max_weight_grams INTEGER CHECK (max_weight_grams IS NULL OR max_weight_grams >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE inventory_reservations (
  id TEXT PRIMARY KEY,
  cart_id TEXT REFERENCES carts(id) ON DELETE SET NULL,
  checkout_attempt_id TEXT,
  variant_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'confirmed', 'expired', 'released')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (variant_id, warehouse_id) REFERENCES inventory_items(variant_id, warehouse_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX inventory_reservations_expiry_idx ON inventory_reservations(status, expires_at);
--> statement-breakpoint
CREATE TABLE checkout_attempts (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE RESTRICT,
  reservation_id TEXT REFERENCES inventory_reservations(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_session_id TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  subtotal_amount INTEGER NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount INTEGER NOT NULL CHECK (discount_amount >= 0),
  shipping_amount INTEGER NOT NULL CHECK (shipping_amount >= 0),
  tax_amount INTEGER NOT NULL CHECK (tax_amount >= 0),
  grand_total_amount INTEGER NOT NULL CHECK (grand_total_amount >= 0),
  shipping_address_json TEXT NOT NULL CHECK (json_valid(shipping_address_json)),
  status TEXT NOT NULL CHECK (status IN ('validating', 'payment_pending', 'completed', 'failed', 'expired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE catalog_releases (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('approved', 'building', 'deployed', 'failed')),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  approved_by TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  approved_at TEXT NOT NULL,
  deployed_at TEXT,
  failure_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  guest_access_token_hash TEXT NOT NULL UNIQUE,
  checkout_attempt_id TEXT NOT NULL UNIQUE REFERENCES checkout_attempts(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  subtotal_amount INTEGER NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount INTEGER NOT NULL CHECK (discount_amount >= 0),
  shipping_amount INTEGER NOT NULL CHECK (shipping_amount >= 0),
  tax_amount INTEGER NOT NULL CHECK (tax_amount >= 0),
  grand_total_amount INTEGER NOT NULL CHECK (grand_total_amount >= 0),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'authorized', 'paid', 'failed', 'canceled', 'partially_refunded', 'refunded')),
  order_status TEXT NOT NULL CHECK (order_status IN ('checkout_pending', 'confirmed', 'processing', 'completed', 'canceled')),
  fulfillment_status TEXT NOT NULL CHECK (fulfillment_status IN ('unfulfilled', 'picking', 'packed', 'shipped', 'delivered', 'canceled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE order_addresses (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('shipping', 'billing')),
  name TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  region TEXT,
  postal_code TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (length(country_code) = 2),
  phone TEXT,
  UNIQUE (order_id, kind)
);
--> statement-breakpoint
CREATE TABLE order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  option_values_json TEXT NOT NULL CHECK (json_valid(option_values_json)),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_amount INTEGER NOT NULL CHECK (unit_price_amount >= 0),
  discount_amount INTEGER NOT NULL CHECK (discount_amount >= 0),
  tax_amount INTEGER NOT NULL CHECK (tax_amount >= 0),
  line_total_amount INTEGER NOT NULL CHECK (line_total_amount >= 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3)
);
--> statement-breakpoint
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  checkout_attempt_id TEXT REFERENCES checkout_attempts(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  provider_created_at TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  result TEXT CHECK (result IS NULL OR result IN ('applied', 'ignored', 'failed')),
  UNIQUE (provider, provider_event_id)
);
--> statement-breakpoint
CREATE INDEX payment_events_order_idx ON payment_events(order_id, received_at);
--> statement-breakpoint
CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider_refund_id TEXT UNIQUE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
  requested_by TEXT REFERENCES admin_identities(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE fulfillment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  tracking_number TEXT,
  carrier TEXT,
  actor_id TEXT REFERENCES admin_identities(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX fulfillment_events_order_idx ON fulfillment_events(order_id, created_at);
--> statement-breakpoint
CREATE TABLE notification_jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  deduplication_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE idempotency_claims (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body_json TEXT CHECK (response_body_json IS NULL OR json_valid(response_body_json)),
  state TEXT NOT NULL CHECK (state IN ('processing', 'completed', 'failed')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (scope, key)
);
--> statement-breakpoint
CREATE INDEX idempotency_expiry_idx ON idempotency_claims(state, expires_at);
--> statement-breakpoint
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('shopper', 'admin', 'machine', 'provider')),
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  result TEXT NOT NULL CHECK (result IN ('allowed', 'denied', 'succeeded', 'failed')),
  reason TEXT,
  request_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX audit_target_idx ON audit_events(target_type, target_id, created_at);
--> statement-breakpoint
CREATE TRIGGER order_lines_immutable_update
BEFORE UPDATE ON order_lines
BEGIN
  SELECT RAISE(ABORT, 'order line snapshots are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER order_lines_immutable_delete
BEFORE DELETE ON order_lines
BEGIN
  SELECT RAISE(ABORT, 'order line snapshots are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER order_addresses_immutable_update
BEFORE UPDATE ON order_addresses
BEGIN
  SELECT RAISE(ABORT, 'order address snapshots are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_immutable_update
BEFORE UPDATE ON stock_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'stock ledger entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER stock_ledger_immutable_delete
BEFORE DELETE ON stock_ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'stock ledger entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER payment_events_immutable_delete
BEFORE DELETE ON payment_events
BEGIN
  SELECT RAISE(ABORT, 'payment events are immutable');
END;
