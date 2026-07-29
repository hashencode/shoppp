import { describe, expect, test } from "bun:test";

import {
  assertInventoryAdjustment,
  availableQuantity,
  assertReservable,
  canTransitionReservation,
  isReservationExpired,
} from "../src/inventory";

describe("inventory policy", () => {
  test("derives sellable quantity from on-hand, active reservations, and oversell policy", () => {
    expect(availableQuantity({ onHand: 10, oversellLimit: 2, reserved: 4 })).toBe(8);
    expect(availableQuantity({ backordered: 1, onHand: 0, oversellLimit: 2, reserved: 0 })).toBe(1);
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

  test("allows oversell within policy but rejects adjustments below conserved reservations", () => {
    expect(assertInventoryAdjustment(-1, { onHand: 1, oversellLimit: 1, reserved: 1 })).toEqual({
      onHand: 0,
      oversellLimit: 1,
      reserved: 1,
    });
    expect(() =>
      assertInventoryAdjustment(-2, { onHand: 1, oversellLimit: 0, reserved: 1 }),
    ).toThrow("negative");
  });

  test("treats the exact expiry timestamp as expired", () => {
    expect(isReservationExpired("2026-07-30T00:30:00.000Z", "2026-07-30T00:30:00.000Z")).toBe(true);
    expect(isReservationExpired("2026-07-30T00:30:00.001Z", "2026-07-30T00:30:00.000Z")).toBe(
      false,
    );
  });

  test("only active reservations can enter a terminal lifecycle state", () => {
    expect(canTransitionReservation("active", "confirmed")).toBe(true);
    expect(canTransitionReservation("active", "released")).toBe(true);
    expect(canTransitionReservation("confirmed", "released")).toBe(false);
    expect(canTransitionReservation("expired", "expired")).toBe(true);
  });
});
