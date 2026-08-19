import { describe, expect, test } from "bun:test";

import {
  decorStoreAccountData,
  decorStoreCartData,
  decorStoreCheckoutData,
} from "../app/themes/decor-store/fixtures/pages/commerce";
import { resolveDecorStorePage } from "../app/themes/decor-store/page-contracts";

describe("Decor Store Cart, Checkout, and Account", () => {
  test("enables the three source-backed presentation routes", () => {
    expect(resolveDecorStorePage("/cart")?.id).toBe("cart");
    expect(resolveDecorStorePage("/checkout")?.id).toBe("checkout");
    expect(resolveDecorStorePage("/account")?.id).toBe("account");
  });

  test("freezes deterministic cart rows and truthful totals", () => {
    expect(decorStoreCartData.lines.map(({ name, quantity }) => [name, quantity])).toEqual([
      ["Table clock", 1],
      ["Designer pot", 2],
      ["Ceramic mug", 1],
    ]);
    expect(
      decorStoreCartData.lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    ).toBe(108);
  });

  test("keeps Checkout and Account free of business integration data", () => {
    expect(decorStoreCheckoutData.paymentMethods).toHaveLength(3);
    expect(decorStoreCheckoutData).not.toHaveProperty("paymentProvider");
    expect(decorStoreCheckoutData).not.toHaveProperty("endpoint");
    expect(decorStoreAccountData).not.toHaveProperty("authAdapter");
  });
});
