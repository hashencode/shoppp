const NOW = "2026-07-30T00:00:00.000Z";

export async function seedLaunchFixture(db: D1Database): Promise<void> {
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO products (id, slug, name, description, status, seo_title, seo_description, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "prd_fixture_0001",
        "fixture-product-0001",
        "Fixture Product 0001",
        "Representative product",
        "published",
        "Fixture Product 0001",
        "Representative product",
        NOW,
        NOW,
        NOW,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO product_variants (id, product_id, sku, title, option_values_json, weight_grams, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "var_fixture_0001",
        "prd_fixture_0001",
        "FIX-0001-1",
        "Default",
        '{"Size":"Default"}',
        125,
        "active",
        NOW,
        NOW,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO price_lists (id, code, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind("price_list_usd", "USD-DEFAULT", "USD", "active", NOW, NOW),
    db
      .prepare(
        "INSERT OR IGNORE INTO prices (id, price_list_id, variant_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind("price_fixture_0001", "price_list_usd", "var_fixture_0001", 2_500, NOW, NOW),
    db
      .prepare("INSERT OR IGNORE INTO warehouses (id, code, name, created_at) VALUES (?, ?, ?, ?)")
      .bind("wh_primary", "PRIMARY", "Primary warehouse", NOW),
    db
      .prepare(
        "INSERT OR IGNORE INTO inventory_items (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, oversell_limit, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind("var_fixture_0001", "wh_primary", 1, 0, 0, 0, NOW),
    db
      .prepare(
        "INSERT OR IGNORE INTO carts (id, public_token_hash, currency, pricing_context_json, promotion_context_json, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "cart_fixture_0001",
        "sha256:cart-fixture",
        "USD",
        "{}",
        "{}",
        "converted",
        "2026-07-31T00:00:00.000Z",
        NOW,
        NOW,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO checkout_attempts (id, cart_id, provider, provider_session_id, idempotency_key, currency, subtotal_amount, discount_amount, shipping_amount, tax_amount, grand_total_amount, shipping_address_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "checkout_fixture_0001",
        "cart_fixture_0001",
        "stripe",
        "cs_test_fixture",
        "checkout-fixture-key",
        "USD",
        2_500,
        0,
        0,
        0,
        2_500,
        '{"name":"Fixture Shopper","line1":"100 Market Street","city":"Portland","postalCode":"97205","countryCode":"US"}',
        "completed",
        NOW,
        NOW,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO orders (id, public_reference, guest_access_token_hash, checkout_attempt_id, email, currency, subtotal_amount, discount_amount, shipping_amount, tax_amount, grand_total_amount, payment_status, order_status, fulfillment_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "ord_fixture_0001",
        "ORD-FIXTURE1",
        "sha256:order-fixture",
        "checkout_fixture_0001",
        "shopper@example.test",
        "USD",
        2_500,
        0,
        0,
        0,
        2_500,
        "paid",
        "confirmed",
        "unfulfilled",
        NOW,
        NOW,
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO order_lines (id, order_id, product_id, variant_id, sku, product_name, variant_name, option_values_json, quantity, unit_price_amount, discount_amount, tax_amount, line_total_amount, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "line_fixture_0001",
        "ord_fixture_0001",
        "prd_fixture_0001",
        "var_fixture_0001",
        "FIX-0001-1",
        "Fixture Product 0001",
        "Default",
        '{"Size":"Default"}',
        1,
        2_500,
        0,
        0,
        2_500,
        "USD",
      ),
  ]);
}
