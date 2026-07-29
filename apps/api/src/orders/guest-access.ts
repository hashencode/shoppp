import type { GuestOrder, OrderAccess } from "@shoppp/contracts";

import { sha256Hex } from "./tokens";

interface AttemptAccessRow {
  id: string;
  status: "validating" | "payment_pending" | "completed" | "failed" | "expired";
}

interface OrderRow {
  created_at: string;
  currency: string;
  discount_amount: number;
  email: string;
  fulfillment_status: GuestOrder["fulfillmentStatus"];
  grand_total_amount: number;
  id: string;
  order_status: GuestOrder["orderStatus"];
  payment_status: GuestOrder["paymentStatus"];
  public_reference: string;
  shipping_amount: number;
  subtotal_amount: number;
  tax_amount: number;
}

export async function getGuestOrderAccess(
  db: D1Database,
  token: string,
  now = new Date().toISOString(),
): Promise<OrderAccess | null> {
  if (!/^[A-Za-z0-9_-]{40,160}$/.test(token)) return null;
  const attempt = await db
    .prepare(
      `SELECT id, status
         FROM checkout_attempts
        WHERE guest_access_token_hash = ? AND guest_access_expires_at > ?`,
    )
    .bind(await sha256Hex(token), now)
    .first<AttemptAccessRow>();
  if (!attempt) return null;
  const order = await db
    .prepare(
      `SELECT id, public_reference, email, currency, subtotal_amount, discount_amount,
              shipping_amount, tax_amount, grand_total_amount, payment_status,
              order_status, fulfillment_status, created_at
         FROM orders
        WHERE checkout_attempt_id = ? AND guest_access_expires_at > ?`,
    )
    .bind(attempt.id, now)
    .first<OrderRow>();
  if (!order) {
    if (attempt.status === "failed") return { status: "failed" };
    if (attempt.status === "expired") return { status: "expired" };
    return { status: "pending" };
  }
  const address = await db
    .prepare(
      `SELECT name, line1, line2, city, region, postal_code, country_code, phone
         FROM order_addresses WHERE order_id = ? AND kind = 'shipping'`,
    )
    .bind(order.id)
    .first<{
      city: string;
      country_code: string;
      line1: string;
      line2: string | null;
      name: string;
      phone: string | null;
      postal_code: string;
      region: string | null;
    }>();
  if (!address) throw new Error("Paid order shipping snapshot is missing.");
  const lines = await db
    .prepare(
      `SELECT sku, product_name, variant_name, quantity, unit_price_amount,
              discount_amount, tax_amount, line_total_amount, currency
         FROM order_lines WHERE order_id = ? ORDER BY id`,
    )
    .bind(order.id)
    .all<{
      currency: string;
      discount_amount: number;
      line_total_amount: number;
      product_name: string;
      quantity: number;
      sku: string;
      tax_amount: number;
      unit_price_amount: number;
      variant_name: string;
    }>();
  return {
    order: {
      createdAt: order.created_at,
      currency: order.currency,
      email: order.email,
      fulfillmentStatus: order.fulfillment_status,
      lines: lines.results.map((line) => ({
        currency: line.currency,
        discountAmount: line.discount_amount,
        lineTotalAmount: line.line_total_amount,
        productName: line.product_name,
        quantity: line.quantity,
        sku: line.sku,
        taxAmount: line.tax_amount,
        unitPriceAmount: line.unit_price_amount,
        variantName: line.variant_name,
      })),
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      publicReference: order.public_reference,
      shippingAddress: {
        city: address.city,
        countryCode: address.country_code,
        line1: address.line1,
        ...(address.line2 ? { line2: address.line2 } : {}),
        name: address.name,
        ...(address.phone ? { phone: address.phone } : {}),
        postalCode: address.postal_code,
        ...(address.region ? { region: address.region } : {}),
      },
      totals: {
        discountTotal: order.discount_amount,
        grandTotal: order.grand_total_amount,
        shippingTotal: order.shipping_amount,
        subtotal: order.subtotal_amount,
        taxTotal: order.tax_amount,
      },
    },
    status: "paid",
  };
}
