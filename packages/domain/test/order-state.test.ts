import { describe, expect, test } from "bun:test";

import {
  transitionFulfillment,
  transitionOrder,
  transitionPayment,
  transitionReservation,
} from "../src/order-state";

describe("independent commerce state dimensions", () => {
  test("allows monotonic payment transitions and idempotent replay", () => {
    expect(transitionPayment("pending", "authorized")).toBe("authorized");
    expect(transitionPayment("authorized", "paid")).toBe("paid");
    expect(transitionPayment("paid", "partially_refunded")).toBe("partially_refunded");
    expect(transitionPayment("paid", "paid")).toBe("paid");
  });

  test("rejects skipped, backward, and conflicting payment transitions", () => {
    expect(() => transitionPayment("pending", "paid")).toThrow("payment transition");
    expect(() => transitionPayment("paid", "authorized")).toThrow("payment transition");
    expect(() => transitionPayment("failed", "paid")).toThrow("payment transition");
  });

  test("keeps order and fulfillment transitions separate", () => {
    expect(transitionOrder("checkout_pending", "confirmed")).toBe("confirmed");
    expect(transitionOrder("confirmed", "processing")).toBe("processing");
    expect(transitionFulfillment("unfulfilled", "picking")).toBe("picking");
    expect(transitionFulfillment("picking", "packed")).toBe("packed");
    expect(() => transitionOrder("confirmed", "completed")).toThrow("order transition");
    expect(() => transitionFulfillment("unfulfilled", "shipped")).toThrow("fulfillment transition");
  });

  test("allows a live reservation to terminate exactly once", () => {
    expect(transitionReservation("active", "confirmed")).toBe("confirmed");
    expect(transitionReservation("active", "expired")).toBe("expired");
    expect(transitionReservation("active", "released")).toBe("released");
    expect(() => transitionReservation("expired", "confirmed")).toThrow("reservation transition");
  });
});
