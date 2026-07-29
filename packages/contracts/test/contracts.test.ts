import { describe, expect, test } from "bun:test";

import { adminOrderSchema } from "../src/admin";
import { cartSchema } from "../src/cart";
import { productSchema } from "../src/catalog";
import { checkoutRequestSchema } from "../src/checkout";
import { inventoryAdjustmentRequestSchema, inventoryReservationSchema } from "../src/inventory";

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
});
