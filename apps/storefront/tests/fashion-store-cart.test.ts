import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import {
  fashionStoreCartSourceContract,
  fashionStoreCartSourceRegions,
} from "../app/themes/fashion-store/contracts/pages/cart";
import {
  fashionStoreCartData,
  fashionStoreCartFixtures,
} from "../app/themes/fashion-store/fixtures/pages/cart";
import { fashionStorePageContracts } from "../app/themes/fashion-store/page-contracts";
import { themeFidelityMatrix } from "../e2e/support/theme-fidelity-matrix";

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

  test("captures the complete cart action row at source button geometry", () => {
    const selector = "section:nth-of-type(2) .row.mt-20px";
    expect(fashionStoreCartSourceRegions.find(({ key }) => key === "cart-controls")?.selector).toBe(
      selector,
    );

    const matrixRegion = themeFidelityMatrix
      .find(({ id }) => id === "fashion-store-cart")
      ?.regions.find(({ id }) => id === "cart-controls");
    expect(matrixRegion?.sourceSelector).toBe(selector);
    expect(matrixRegion?.implementationSelector).toBe(selector);

    const integrationCss = readFileSync(
      new URL("../app/themes/fashion-store/integration.css", import.meta.url),
      "utf8",
    );
    expect(integrationCss).toContain(`[data-fashion-store-cart] .fashion-cart-body .row.mt-20px button.btn-small {
  appearance: none;
  font-family: "Outfit", sans-serif;
  font-weight: 600;
  line-height: 24px;
}`);
    expect(integrationCss).toContain(`[data-fashion-store-cart] .fashion-cart-body .row.mt-20px button.me-15px {
  margin-right: 19.203125px !important;
}`);
    expect(integrationCss).toContain(`@media (max-width: 1199px) {
  [data-fashion-store-cart] .fashion-cart-body .row.mt-20px button.me-15px {
    margin-right: 9.203125px !important;
  }
}`);
  });
});
