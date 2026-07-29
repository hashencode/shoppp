import { describe, expect, test } from "bun:test";

import { createMoney } from "../src/money";
import { calculatePricing } from "../src/pricing";

describe("pricing", () => {
  test("produces integer authoritative totals", () => {
    expect(
      calculatePricing({
        currency: "USD",
        discount: createMoney(500, "USD"),
        lines: [
          { quantity: 2, unitPrice: createMoney(1_250, "USD") },
          { quantity: 1, unitPrice: createMoney(500, "USD") },
        ],
        shipping: createMoney(700, "USD"),
        tax: createMoney(200, "USD"),
      }),
    ).toEqual({
      currency: "USD",
      discountTotal: 500,
      grandTotal: 3_400,
      shippingTotal: 700,
      subtotal: 3_000,
      taxTotal: 200,
    });
  });

  test("rejects negative totals and mixed currency inputs", () => {
    expect(() =>
      calculatePricing({
        currency: "USD",
        discount: createMoney(200, "USD"),
        lines: [{ quantity: 1, unitPrice: createMoney(100, "USD") }],
        shipping: createMoney(0, "USD"),
        tax: createMoney(0, "USD"),
      }),
    ).toThrow("negative");
    expect(() =>
      calculatePricing({
        currency: "USD",
        discount: createMoney(0, "USD"),
        lines: [{ quantity: 1, unitPrice: createMoney(100, "EUR") }],
        shipping: createMoney(0, "USD"),
        tax: createMoney(0, "USD"),
      }),
    ).toThrow("currency mismatch");
  });
});
