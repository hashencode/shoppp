import { describe, expect, test } from "bun:test";

import { fashionStoreCheckoutSourceContract } from "../app/themes/fashion-store/contracts/pages/checkout";
import {
  fashionStoreCheckoutData,
  fashionStoreCheckoutFixtures,
} from "../app/themes/fashion-store/fixtures/pages/checkout";
import { fashionStorePageContracts } from "../app/themes/fashion-store/page-contracts";

describe("Fashion Store checkout", () => {
  test("pins the checkout source and deterministic populated presentation", () => {
    expect(fashionStoreCheckoutSourceContract.source.sha256).toBe(
      "372be1838b010706fd7f03981f4844bb21b5f1dd0978fa7444f8be8daaf38d0b",
    );
    expect(fashionStoreCheckoutData.lines.map(({ name, quantity, total }) => ({
      name,
      quantity,
      total,
    }))).toEqual([
      { name: "Textured sweater", quantity: 1, total: "$23.00" },
      { name: "Bermuda shorts", quantity: 2, total: "$70.00" },
      { name: "Pocket sweatshirt", quantity: 1, total: "$15.00" },
    ]);
    expect(fashionStoreCheckoutData.payment.map(({ label }) => label)).toEqual([
      "Direct bank transfer",
      "Check payments",
      "Cash on delivery",
      "PayPal",
    ]);
    expect(fashionStoreCheckoutFixtures["fashion-store-checkout"].viewModels.checkout.state).toBe(
      "populated",
    );
  });

  test("enables checkout only with a complete source and host-session contract", () => {
    const contract = fashionStorePageContracts.find(({ id }) => id === "checkout");
    expect(contract?.ready).toBe(true);
    expect(contract?.sourceEntry).toBe("demo-fashion-store-checkout.html");
  });
});
