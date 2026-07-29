import { describe, expect, test } from "bun:test";

import { addMoney, createMoney, multiplyMoney } from "../src/money";

describe("money", () => {
  test("adds integer minor units in the same currency", () => {
    expect(addMoney(createMoney(1_250, "USD"), createMoney(750, "USD"))).toEqual({
      amount: 2_000,
      currency: "USD",
    });
  });

  test.each([10.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe or fractional minor units: %s",
    (amount) => {
      expect(() => createMoney(amount, "USD")).toThrow("safe integer");
    },
  );

  test("rejects floating-point API input instead of rounding it", () => {
    expect(() => multiplyMoney(createMoney(199, "USD"), 1.1)).toThrow("integer");
  });

  test("rejects currency mismatch", () => {
    expect(() => addMoney(createMoney(100, "USD"), createMoney(100, "EUR"))).toThrow(
      "currency mismatch",
    );
  });

  test("rejects arithmetic overflow", () => {
    expect(() =>
      addMoney(createMoney(Number.MAX_SAFE_INTEGER, "USD"), createMoney(1, "USD")),
    ).toThrow("safe integer");
  });
});
