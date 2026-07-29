ALTER TABLE products ADD COLUMN scheduled_at TEXT;
--> statement-breakpoint
ALTER TABLE product_variants ADD COLUMN length_mm INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE product_variants ADD COLUMN width_mm INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE product_variants ADD COLUMN height_mm INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE catalog_releases ADD COLUMN product_id TEXT REFERENCES products(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX catalog_releases_product_idx ON catalog_releases(product_id, created_at);
