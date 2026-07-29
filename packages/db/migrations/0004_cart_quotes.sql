ALTER TABLE carts ADD COLUMN shipping_address_json TEXT
  CHECK (shipping_address_json IS NULL OR json_valid(shipping_address_json));
--> statement-breakpoint
ALTER TABLE carts ADD COLUMN shipping_method_id TEXT;
--> statement-breakpoint
CREATE INDEX carts_status_expiry_idx ON carts(status, expires_at);
--> statement-breakpoint
CREATE INDEX cart_lines_cart_idx ON cart_lines(cart_id, created_at);
--> statement-breakpoint
CREATE INDEX shipping_methods_zone_idx ON shipping_methods(zone_id, status);
