import type { CheckoutSnapshot } from "../payments/port";

interface CheckoutAttemptRow {
  currency: string;
  discount_amount: number;
  email: string | null;
  grand_total_amount: number;
  guest_access_expires_at: string | null;
  guest_access_token_hash: string | null;
  id: string;
  reservation_group_id: string | null;
  shipping_address_json: string;
  shipping_amount: number;
  snapshot_json: string | null;
  subtotal_amount: number;
  tax_amount: number;
}

export interface CreatedOrder {
  readonly created: boolean;
  readonly id: string;
  readonly publicReference: string;
}

function attemptSuffix(attemptId: string): string {
  const suffix = attemptId.includes("_") ? attemptId.slice(attemptId.indexOf("_") + 1) : attemptId;
  return suffix.replaceAll(/[^A-Za-z0-9]/g, "").padEnd(12, "0");
}

function parseSnapshot(value: string | null): CheckoutSnapshot {
  if (!value) throw new Error("Checkout snapshot is missing.");
  const snapshot = JSON.parse(value) as CheckoutSnapshot;
  if (!snapshot.lines.length) throw new Error("Checkout snapshot has no lines.");
  return snapshot;
}

export async function createPaidOrderFromAttempt(
  db: D1Database,
  checkoutAttemptId: string,
  createdAt = new Date().toISOString(),
): Promise<CreatedOrder> {
  const existing = await db
    .prepare("SELECT id, public_reference FROM orders WHERE checkout_attempt_id = ?")
    .bind(checkoutAttemptId)
    .first<{ id: string; public_reference: string }>();
  if (existing) {
    return { created: false, id: existing.id, publicReference: existing.public_reference };
  }
  const attempt = await db
    .prepare(
      `SELECT id, reservation_group_id, email, snapshot_json, guest_access_token_hash,
              guest_access_expires_at, currency, subtotal_amount, discount_amount,
              shipping_amount, tax_amount, grand_total_amount, shipping_address_json
         FROM checkout_attempts WHERE id = ?`,
    )
    .bind(checkoutAttemptId)
    .first<CheckoutAttemptRow>();
  if (
    !attempt ||
    !attempt.email ||
    !attempt.reservation_group_id ||
    !attempt.guest_access_token_hash ||
    !attempt.guest_access_expires_at
  ) {
    throw new Error("Checkout attempt is incomplete.");
  }
  const snapshot = parseSnapshot(attempt.snapshot_json);
  const suffix = attemptSuffix(attempt.id);
  const orderId = `ord_${suffix}`;
  const publicReference = `ORD-${suffix.slice(0, 12).toUpperCase()}`;
  const address = snapshot.shippingAddress;
  const results = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO orders
           (id, public_reference, guest_access_token_hash, guest_access_expires_at,
            checkout_attempt_id, email, currency, subtotal_amount, discount_amount,
            shipping_amount, tax_amount, grand_total_amount, payment_status, order_status,
            fulfillment_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'confirmed',
                 'unfulfilled', ?, ?)`,
      )
      .bind(
        orderId,
        publicReference,
        attempt.guest_access_token_hash,
        attempt.guest_access_expires_at,
        attempt.id,
        attempt.email,
        attempt.currency,
        attempt.subtotal_amount,
        attempt.discount_amount,
        attempt.shipping_amount,
        attempt.tax_amount,
        attempt.grand_total_amount,
        createdAt,
        createdAt,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO order_addresses
           (id, order_id, kind, name, line1, line2, city, region, postal_code,
            country_code, phone)
         VALUES (?, ?, 'shipping', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `oa_${suffix}_shipping`,
        orderId,
        address.name,
        address.line1,
        address.line2 ?? null,
        address.city,
        address.region ?? null,
        address.postalCode,
        address.countryCode,
        address.phone ?? null,
      ),
    ...snapshot.lines.map((line, index) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO order_lines
             (id, order_id, product_id, variant_id, sku, product_name, variant_name,
              option_values_json, quantity, unit_price_amount, discount_amount,
              tax_amount, line_total_amount, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `ol_${suffix}_${index}`,
          orderId,
          line.productId,
          line.variantId,
          line.sku,
          line.productName,
          line.variantName,
          JSON.stringify(line.optionValues),
          line.quantity,
          line.unitPriceAmount,
          line.discountAmount,
          line.taxAmount,
          line.lineTotalAmount,
          line.currency,
        ),
    ),
    db
      .prepare(
        `INSERT OR IGNORE INTO notification_jobs
           (id, order_id, type, deduplication_key, payload_json, status,
            attempt_count, next_attempt_at, created_at, updated_at)
         VALUES (?, ?, 'order_receipt', ?, ?, 'pending', 0, ?, ?, ?)`,
      )
      .bind(
        `notify_${suffix}_receipt`,
        orderId,
        `order.receipt:${orderId}`,
        JSON.stringify({ orderId }),
        createdAt,
        createdAt,
        createdAt,
      ),
  ]);
  const stored = await db
    .prepare("SELECT id, public_reference FROM orders WHERE checkout_attempt_id = ?")
    .bind(checkoutAttemptId)
    .first<{ id: string; public_reference: string }>();
  if (!stored) throw new Error("Paid order was not persisted.");
  return {
    created: (results[0]?.meta.changes ?? 0) > 0,
    id: stored.id,
    publicReference: stored.public_reference,
  };
}
