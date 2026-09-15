import { afterEach, describe, expect, test } from "bun:test";

import { useFashionStorePreviewCart } from "../app/themes/fashion-store/composables/useFashionStorePreviewCart";

const originalComputed = globalThis.computed;
const originalUseState = globalThis.useState;

afterEach(() => {
  globalThis.computed = originalComputed;
  globalThis.useState = originalUseState;
});

describe("Fashion Store preview cart", () => {
  function installNuxtStateMocks() {
    const state = new Map<string, { value: unknown }>();
    globalThis.useState = ((key: string, initialize: () => unknown) => {
      if (!state.has(key)) state.set(key, { value: initialize() });
      return state.get(key)!;
    }) as typeof useState;
    globalThis.computed = ((read: () => unknown) => ({
      get value() {
        return read();
      },
    })) as typeof computed;
  }

  test("starts empty until the shopper adds a product", () => {
    installNuxtStateMocks();

    const cart = useFashionStorePreviewCart();

    expect(cart.lines.value).toEqual([]);
    expect(cart.count.value).toBe(0);
    expect(cart.subtotal.value).toBe(0);

    cart.add({
      color: "",
      name: "Shopper choice",
      price: "$18.00",
      quantity: 1,
      sourceImage: "product.jpg",
      total: "$18.00",
      variantId: "shopper-choice",
    });

    expect(cart.lines.value).toEqual([
      expect.objectContaining({ name: "Shopper choice", quantity: 1 }),
    ]);
    expect(cart.count.value).toBe(1);
    expect(cart.subtotal.value).toBe(18);
  });

  test("preserves explicitly supplied cart-page fixture lines", () => {
    installNuxtStateMocks();

    const cart = useFashionStorePreviewCart([
      {
        color: "Black",
        name: "Explicit fixture",
        price: "$12.00",
        quantity: 2,
        sourceImage: "fixture.jpg",
        total: "$24.00",
        variantId: "fixture",
      },
    ]);

    expect(cart.count.value).toBe(2);
    expect(cart.subtotal.value).toBe(24);
  });
});
