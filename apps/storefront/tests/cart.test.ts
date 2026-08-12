import { afterEach, describe, expect, test } from "bun:test";
import { cartSchema } from "@shoppp/contracts";

import { acknowledgementKeys, authoritativeTotalLabel } from "../app/features/cart/presentation";
import {
  GuestCartCurrencyMismatchError,
  assertGuestCartCurrency,
  guestCartErrorMessage,
  useGuestCart,
} from "../app/features/cart/use-guest-cart";

const originalUseState = Object.getOwnPropertyDescriptor(globalThis, "useState");
const originalUseCommerceApi = Object.getOwnPropertyDescriptor(globalThis, "useCommerceApi");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function deferred<T>() {
  let reject!: (cause?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

function installCartRuntime(api: object) {
  const state = new Map<string, { value: unknown }>();
  const storage = new Map<string, string>([["shoppp.guest-cart-token", "guest-cart-token"]]);
  Object.defineProperty(globalThis, "useState", {
    configurable: true,
    value: (key: string, initial: () => unknown) => {
      const existing = state.get(key);
      if (existing) return existing;
      const value = { value: initial() };
      state.set(key, value);
      return value;
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  Object.defineProperty(globalThis, "useCommerceApi", {
    configurable: true,
    value: () => api,
  });
  return storage;
}

function restoreGlobal(name: string, descriptor?: PropertyDescriptor): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}

afterEach(() => {
  restoreGlobal("useState", originalUseState);
  restoreGlobal("useCommerceApi", originalUseCommerceApi);
  restoreGlobal("localStorage", originalLocalStorage);
});

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

const shippingInput = {
  shippingAddress: {
    city: "Portland",
    countryCode: "US",
    line1: "100 Market Street",
    name: "Example Shopper",
    postalCode: "97205",
    region: "OR",
  },
};

describe("cart presentation", () => {
  test("displays the server grand total without recomputing commerce truth", () => {
    expect(authoritativeTotalLabel(serverCart)).toBe("$142.50");
  });

  test("acknowledges only adjustments the server marks as reviewable", () => {
    expect(acknowledgementKeys(serverCart)).toEqual([
      "price_changed:var_01J00000000000000000000000",
    ]);
  });

  test("preserves an existing cart when the requested storefront currency changes", () => {
    expect(() => assertGuestCartCurrency(serverCart, "EUR")).toThrow(
      GuestCartCurrencyMismatchError,
    );
    expect(serverCart.currency).toBe("USD");
  });

  test("returns recoverable guidance for checkout validation and runtime timeouts", () => {
    expect(
      guestCartErrorMessage({
        data: { error: { message: "Review cart price changes before checkout." } },
        statusCode: 422,
      }),
    ).toBe("Review cart price changes before checkout.");
    expect(guestCartErrorMessage({ name: "TimeoutError" })).toBe(
      "Commerce is taking too long to respond. Your cart is unchanged; try again.",
    );
  });

  test("shares one cart creation across concurrent mounted cart consumers", async () => {
    const state = new Map<string, { value: unknown }>();
    const storage = new Map<string, string>();
    let createCount = 0;
    let releaseCreate!: () => void;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    Object.defineProperty(globalThis, "useState", {
      configurable: true,
      value: (key: string, initial: () => unknown) => {
        const existing = state.get(key);
        if (existing) return existing;
        const value = { value: initial() };
        state.set(key, value);
        return value;
      },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    Object.defineProperty(globalThis, "useCommerceApi", {
      configurable: true,
      value: () => ({
        async createCart() {
          createCount += 1;
          await createGate;
          return { data: { cart: serverCart, token: "guest-cart-token" } };
        },
      }),
    });

    const guestCart = useGuestCart();
    const first = guestCart.ensure("USD");
    const second = guestCart.ensure("USD");
    expect(second).toBe(first);
    releaseCreate();
    await Promise.all([first, second]);
    expect(createCount).toBe(1);
  });

  test("replaces a release-conflicted preview cart during ensure", async () => {
    const storage = installCartRuntime({
      async createCart() {
        return { data: { cart: serverCart, token: "replacement-cart-token" } };
      },
      async getCart() {
        throw {
          data: {
            error: {
              code: "cart_release_conflict",
              message: "This cart is already bound to another Catalog Release.",
            },
          },
          statusCode: 409,
        };
      },
    });

    const cart = await useGuestCart().ensure("USD");

    expect(cart).toEqual(serverCart);
    expect(storage.get("shoppp.guest-cart-token")).toBe("replacement-cart-token");
  });

  test("does not publish an older shipping quote that resolves last", async () => {
    const firstResponse = deferred<{ data: typeof serverCart }>();
    const secondResponse = deferred<{ data: typeof serverCart }>();
    let requestCount = 0;
    installCartRuntime({
      quoteShipping() {
        requestCount += 1;
        return requestCount === 1 ? firstResponse.promise : secondResponse.promise;
      },
    });
    const olderCart = {
      ...serverCart,
      selectedShippingMethodId: "ship_older",
      totals: { ...serverCart.totals, grandTotal: 13_600, shippingTotal: 700 },
    };
    const newerCart = {
      ...serverCart,
      selectedShippingMethodId: "ship_newer",
      totals: { ...serverCart.totals, grandTotal: 13_350, shippingTotal: 450 },
    };
    const guestCart = useGuestCart();

    const first = guestCart.shipping(shippingInput);
    const second = guestCart.shipping(shippingInput);
    secondResponse.resolve({ data: newerCart });
    await second;
    expect(guestCart.cart.value).toEqual(newerCart);
    expect(guestCart.busy.value).toBe(false);

    firstResponse.resolve({ data: olderCart });
    await first;
    expect(guestCart.cart.value).toEqual(newerCart);
    expect(guestCart.busy.value).toBe(false);
  });

  test("does not publish an older shipping error that rejects last", async () => {
    const firstResponse = deferred<{ data: typeof serverCart }>();
    const secondResponse = deferred<{ data: typeof serverCart }>();
    let requestCount = 0;
    installCartRuntime({
      quoteShipping() {
        requestCount += 1;
        return requestCount === 1 ? firstResponse.promise : secondResponse.promise;
      },
    });
    const guestCart = useGuestCart();

    const first = guestCart.shipping(shippingInput);
    const second = guestCart.shipping(shippingInput);
    secondResponse.resolve({ data: serverCart });
    await second;
    firstResponse.reject(new Error("stale shipping failure"));
    await expect(first).rejects.toThrow("stale shipping failure");

    expect(guestCart.cart.value).toEqual(serverCart);
    expect(guestCart.busy.value).toBe(false);
    expect(guestCart.error.value).toBeNull();
  });
});
