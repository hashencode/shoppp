import { describe, expect, test } from "bun:test";
import { cartSchema } from "@shoppp/contracts";

import { acknowledgementKeys, authoritativeTotalLabel } from "../app/features/cart/presentation";

const serverCart = cartSchema.parse({
  adjustments: [
    {
      code: "price_changed",
      key: "price_changed:var_01J00000000000000000000000",
      message: "Price changed.",
      requiresAcknowledgement: true,
      variantId: "var_01J00000000000000000000000",
    },
  ],
  canCheckout: false,
  currency: "USD",
  expiresAt: "2026-08-06T00:00:00.000Z",
  id: "cart_01J0000000000000000000000",
  lines: [],
  selectedShippingMethodId: null,
  shippingAddress: null,
  shippingMethods: [],
  totals: {
    discountTotal: 0,
    grandTotal: 14_250,
    shippingTotal: 1_350,
    subtotal: 12_900,
    taxTotal: 0,
  },
});

describe("cart presentation", () => {
  test("displays the server grand total without recomputing commerce truth", () => {
    expect(authoritativeTotalLabel(serverCart)).toBe("$142.50");
  });

  test("acknowledges only adjustments the server marks as reviewable", () => {
    expect(acknowledgementKeys(serverCart)).toEqual([
      "price_changed:var_01J00000000000000000000000",
    ]);
  });
});
