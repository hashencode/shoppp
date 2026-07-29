import { describe, expect, test } from "bun:test";

import { availableQuantity, assertReservable } from "../src/inventory";

describe("inventory policy", () => {
  test("derives sellable quantity from on-hand, active reservations, and oversell policy", () => {
    expect(availableQuantity({ onHand: 10, oversellLimit: 2, reserved: 4 })).toBe(8);
  });

  test("rejects a reservation beyond the sellable quantity", () => {
    expect(() => assertReservable(2, { onHand: 1, oversellLimit: 0, reserved: 0 })).toThrow(
      "available",
    );
  });

  test.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid stock quantities: %s",
    (quantity) => {
      expect(() => availableQuantity({ onHand: quantity, oversellLimit: 0, reserved: 0 })).toThrow(
        "safe non-negative integer",
      );
    },
  );
});
