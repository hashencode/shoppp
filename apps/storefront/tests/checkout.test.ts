import { afterEach, describe, expect, test } from "bun:test";
import { orderAccessSchema } from "@shoppp/contracts";

import {
  orderAccessMessage,
  readOrderAccess,
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
});
