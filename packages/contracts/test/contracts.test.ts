import { describe, expect, test } from "bun:test";

import {
  cancelOrderRequestSchema,
  fulfillmentTransitionRequestSchema,
  notificationJobSchema,
  replayNotificationJobRequestSchema,
  refundRequestSchema,
  adminOrderSchema,
} from "../src/admin";
import { cartSchema } from "../src/cart";
import { productSchema } from "../src/catalog";
import { checkoutRequestSchema } from "../src/checkout";
import { inventoryAdjustmentRequestSchema, inventoryReservationSchema } from "../src/inventory";
import { publicRuntimeConfigurationSchema } from "../src/platform";

const product = {
  description: "A durable travel bottle.",
  id: "prd_01J00000000000000000000000",
  media: [],
  name: "Travel Bottle",
  options: [{ name: "Size", values: ["500ml"] }],
  seo: {
    description: "A durable travel bottle.",
    title: "Travel Bottle",
  },
  slug: "travel-bottle",
  status: "published",
  variants: [
    {
      available: true,
      id: "var_01J00000000000000000000000",
      options: { Size: "500ml" },
      price: { amount: 2_500, currency: "USD" },
      sku: "BOTTLE-500",
    },
  ],
};

describe("public contracts", () => {
  test("requires fail-closed public security configuration", () => {
    expect(
      publicRuntimeConfigurationSchema.parse({
        turnstile: { required: true, siteKey: "environment-site-key" },
      }),
    ).toEqual({
      turnstile: { required: true, siteKey: "environment-site-key" },
    });
    expect(() =>
      publicRuntimeConfigurationSchema.parse({
        turnstile: { required: true, siteKey: null },
      }),
    ).toThrow();
  });

  test("accepts catalog, cart, checkout, and admin order DTOs without persistence fields", () => {
    expect(productSchema.parse(product).slug).toBe("travel-bottle");
    expect(
      cartSchema.parse({
        adjustments: [],
        canCheckout: false,
        currency: "USD",
        expiresAt: "2026-07-31T00:00:00.000Z",
        id: "cart_01J00000000000000000000000",
        lines: [],
        selectedShippingMethodId: null,
        shippingAddress: null,
        shippingMethods: [],
        totals: {
          discountTotal: 0,
          grandTotal: 0,
          shippingTotal: 0,
          subtotal: 0,
          taxTotal: 0,
        },
      }).currency,
    ).toBe("USD");
    expect(
      checkoutRequestSchema.parse({
        acceptTerms: true,
        cartId: "cart_01J00000000000000000000000",
        countryCode: "US",
        currency: "USD",
        email: "shopper@example.test",
        idempotencyKey: "checkout-attempt-0001",
        shippingAddress: {
          city: "Portland",
          countryCode: "US",
          line1: "100 Market Street",
          name: "Example Shopper",
          postalCode: "97205",
          region: "OR",
        },
        shippingMethodId: "ship_01J00000000000000000000000",
      }).countryCode,
    ).toBe("US");
    expect(
      adminOrderSchema.parse({
        createdAt: "2026-07-30T00:00:00.000Z",
        currency: "USD",
        fulfillmentStatus: "unfulfilled",
        grandTotal: 2_500,
        orderStatus: "confirmed",
        paymentStatus: "paid",
        publicReference: "ORD-7JY2Q9",
      }).paymentStatus,
    ).toBe("paid");
  });

  test("rejects unsafe money, unknown database fields, and malformed country codes", () => {
    expect(() =>
      productSchema.parse({
        ...product,
        created_at: "database-field",
      }),
    ).toThrow();
    expect(() =>
      productSchema.parse({
        ...product,
        variants: [
          {
            ...product.variants[0],
            price: { amount: 10.5, currency: "USD" },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      checkoutRequestSchema.parse({
        acceptTerms: true,
        cartId: "cart_01J00000000000000000000000",
        countryCode: "USA",
        currency: "USD",
        email: "shopper@example.test",
        idempotencyKey: "checkout-attempt-0001",
        shippingAddress: {
          city: "Portland",
          countryCode: "USA",
          line1: "100 Market Street",
          name: "Example Shopper",
          postalCode: "97205",
        },
        shippingMethodId: "ship_01J00000000000000000000000",
      }),
    ).toThrow();
  });

  test("validates reservation lifecycle responses and reasoned inventory adjustments", () => {
    expect(
      inventoryReservationSchema.parse({
        expiresAt: "2026-07-30T00:30:00.000Z",
        id: "irg_01J00000000000000000000000",
        lines: [
          {
            id: "ir_01J00000000000000000000000",
            quantity: 1,
            variantId: "var_01J00000000000000000000000",
            warehouseId: "wh_01J00000000000000000000000",
          },
        ],
        status: "active",
      }).status,
    ).toBe("active");
    expect(
      inventoryAdjustmentRequestSchema.parse({
        quantityDelta: -1,
        reason: "Damaged stock removal",
      }).quantityDelta,
    ).toBe(-1);
    expect(() =>
      inventoryAdjustmentRequestSchema.parse({ quantityDelta: 0, reason: "No change" }),
    ).toThrow();
    expect(() =>
      inventoryAdjustmentRequestSchema.parse({ quantityDelta: 1, reason: "" }),
    ).toThrow();
  });

  test("requires explicit confirmation and shipment facts for sensitive order operations", () => {
    expect(
      refundRequestSchema.parse({
        amount: 500,
        confirm: true,
        reason: "Customer service adjustment",
      }).amount,
    ).toBe(500);
    expect(() =>
      refundRequestSchema.parse({
        amount: 500,
        reason: "Customer service adjustment",
      }),
    ).toThrow();
    expect(
      cancelOrderRequestSchema.parse({
        confirm: true,
        reason: "Customer canceled before fulfillment",
      }).confirm,
    ).toBe(true);
    expect(() =>
      fulfillmentTransitionRequestSchema.parse({
        confirm: true,
        reason: "Handed to carrier",
        toStatus: "shipped",
      }),
    ).toThrow();
    expect(
      fulfillmentTransitionRequestSchema.parse({
        carrier: "DHL",
        confirm: true,
        reason: "Handed to carrier",
        toStatus: "shipped",
        trackingNumber: "DHL-TRACK-001",
      }).trackingNumber,
    ).toBe("DHL-TRACK-001");
    expect(
      replayNotificationJobRequestSchema.parse({
        confirm: true,
        reason: "Provider configuration corrected",
      }).confirm,
    ).toBe(true);
    expect(() =>
      replayNotificationJobRequestSchema.parse({
        confirm: false,
        reason: "Provider configuration corrected",
      }),
    ).toThrow();
  });

  test("validates operator-visible notification and provider recovery jobs", () => {
    expect(
      notificationJobSchema.parse({
        attemptCount: 3,
        attempts: [],
        createdAt: "2026-07-30T00:00:00.000Z",
        deadLetteredAt: "2026-07-30T00:03:00.000Z",
        id: "recover-payment-event-001",
        kind: "provider_recovery",
        lastErrorCode: "stripe_unreachable",
        maxAttempts: 3,
        orderReference: null,
        recipient: "Provider · stripe",
        replayCount: 0,
        status: "dead_letter",
        type: "payment_reconciliation",
        updatedAt: "2026-07-30T00:03:00.000Z",
      }).kind,
    ).toBe("provider_recovery");
  });
});
