import { describe, expect, test } from "bun:test";

import { fashionStoreCartSourceContract } from "../app/themes/fashion-store/contracts/pages/cart";
import {
  fashionStoreCartData,
  fashionStoreCartFixtures,
} from "../app/themes/fashion-store/fixtures/pages/cart";
import { fashionStorePageContracts } from "../app/themes/fashion-store/page-contracts";

describe("Fashion Store cart", () => {
  test("pins the cart source and deterministic populated presentation", () => {
    expect(fashionStoreCartSourceContract.source.sha256).toBe(
      "fe60f6a7e897350e927a7b222eb8ea6c21c1598712a6784380eeeb487d8eca51",
    );
    expect(fashionStoreCartData.lines.map(({ name, price, quantity, total }) => ({
      name,
      price,
      quantity,
      total,
    }))).toEqual([
      { name: "Textured sweater", price: "$23.00", quantity: 1, total: "$23.00" },
      { name: "Bermuda shorts", price: "$35.00", quantity: 1, total: "$70.00" },
      { name: "Pocket sweatshirt", price: "$15.00", quantity: 1, total: "$15.00" },
    ]);
    expect(fashionStoreCartData.totals).toEqual({
      subtotal: "$405.00",
      tax: "(Includes $19.29 tax)",
      total: "$405.00",
    });
    expect(fashionStoreCartData.shipping.map(({ label }) => label)).toEqual([
      "Free shipping",
      "Flat: $12.00",
      "Local pickup",
    ]);
    expect(fashionStoreCartFixtures["fashion-store-cart"].viewModels.cart.state).toBe("populated");
  });

  test("enables the cart route only with a complete page contract", () => {
    const contract = fashionStorePageContracts.find(({ id }) => id === "cart");
    expect(contract?.ready).toBe(true);
    expect(contract?.sourceEntry).toBe("demo-fashion-store-cart.html");
  });
});
