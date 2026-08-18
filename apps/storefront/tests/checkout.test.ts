import { afterEach, describe, expect, test } from "bun:test";
import { orderAccessSchema } from "@shoppp/contracts";

import {
  markPaymentReturnVisit,
  orderAccessMessage,
  readOrderAccess,
  resolvePaymentReturnState,
  storeOrderAccess,
} from "../app/features/checkout/session";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "sessionStorage");
});

describe("secure checkout return state", () => {
  test("stores only an opaque guest token and rejects malformed client state", () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
    const value = {
      attemptId: "chk_01J00000000000000000000000",
      token: "order_access_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    };

    storeOrderAccess(value);
    expect(readOrderAccess()).toEqual(value);

    storage.setItem(
      "shoppp.current-order-access",
      JSON.stringify({ attemptId: value.attemptId, token: "guessable" }),
    );
    expect(readOrderAccess()).toBeNull();
    storage.setItem("shoppp.current-order-access", "{not-json");
    expect(readOrderAccess()).toBeNull();
  });

  test("presents provider-converged states without inferring approval from a redirect", () => {
    expect(orderAccessMessage(orderAccessSchema.parse({ status: "pending" }))).toBe(
      "Payment confirmation is pending",
    );
    expect(orderAccessMessage(orderAccessSchema.parse({ status: "failed" }))).toBe(
      "Payment was not completed",
    );
    expect(orderAccessMessage(orderAccessSchema.parse({ status: "expired" }))).toBe(
      "Payment session expired",
    );
  });

  test("resolves every payment return outcome with authoritative cart behavior", () => {
    expect(resolvePaymentReturnState({})).toMatchObject({
      cartDisposition: "preserve",
      kind: "invalid",
    });
    expect(
      resolvePaymentReturnState({ access: { status: "pending" }, returnIntent: "success" }),
    ).toMatchObject({ cartDisposition: "preserve", kind: "pending" });
    expect(
      resolvePaymentReturnState({ access: { status: "pending" }, returnIntent: "canceled" }),
    ).toMatchObject({ cartDisposition: "preserve", kind: "canceled" });
    expect(resolvePaymentReturnState({ access: { status: "expired" } })).toMatchObject({
      cartDisposition: "preserve",
      kind: "expired",
    });
    expect(resolvePaymentReturnState({ access: { status: "failed" } })).toMatchObject({
      cartDisposition: "preserve",
      kind: "failed",
    });
    expect(resolvePaymentReturnState({ requestFailed: true })).toMatchObject({
      cartDisposition: "preserve",
      kind: "retry",
    });
    expect(
      resolvePaymentReturnState({
        access: orderAccessSchema.parse({
          order: {
            createdAt: "2026-08-14T00:00:00.000Z",
            currency: "USD",
            email: "shopper@example.test",
            fulfillmentStatus: "unfulfilled",
            lines: [
              {
                currency: "USD",
                discountAmount: 0,
                lineTotalAmount: 6500,
                productName: "Relaxed corduroy shirt",
                quantity: 1,
                sku: "SHIRT-XL",
                taxAmount: 0,
                unitPriceAmount: 6500,
                variantName: "Green / XL",
              },
            ],
            orderStatus: "confirmed",
            paymentStatus: "paid",
            publicReference: "SHOPPP-ABC123",
            shippingAddress: {
              city: "Portland",
              countryCode: "US",
              line1: "100 Market Street",
              name: "Example Shopper",
              postalCode: "97205",
              region: "OR",
            },
            totals: {
              discountTotal: 0,
              grandTotal: 6500,
              shippingTotal: 0,
              subtotal: 6500,
              taxTotal: 0,
            },
          },
          status: "paid",
        }),
      }),
    ).toMatchObject({ cartDisposition: "refresh", kind: "confirmed" });
  });

  test("marks a repeated provider return without storing order credentials twice", () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });

    expect(markPaymentReturnVisit("chk_01J00000000000000000000000")).toBe(false);
    expect(markPaymentReturnVisit("chk_01J00000000000000000000000")).toBe(true);
    expect(
      resolvePaymentReturnState({ access: { status: "pending" }, duplicateReturn: true }),
    ).toMatchObject({ cartDisposition: "preserve", kind: "duplicate" });
  });
});
