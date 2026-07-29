import { describe, expect, test } from "bun:test";

import { quoteShippingMethods } from "../src/shipping";

describe("shipping quotes", () => {
  test("calculates flat, weight-based, and threshold-free methods in minor units", () => {
    expect(
      quoteShippingMethods({
        currency: "USD",
        methods: [
          {
            calculationType: "flat",
            currency: "USD",
            freeThresholdAmount: null,
            id: "flat",
            maxWeightGrams: null,
            minWeightGrams: null,
            name: "Flat",
            priceAmount: 700,
          },
          {
            calculationType: "weight",
            currency: "USD",
            freeThresholdAmount: null,
            id: "weight",
            maxWeightGrams: 5_000,
            minWeightGrams: 1,
            name: "Weight",
            priceAmount: 450,
          },
          {
            calculationType: "flat",
            currency: "USD",
            freeThresholdAmount: 10_000,
            id: "free",
            maxWeightGrams: null,
            minWeightGrams: null,
            name: "Free over threshold",
            priceAmount: 900,
          },
        ],
        subtotalAmount: 12_900,
        totalWeightGrams: 2_900,
      }),
    ).toEqual([
      { amount: 700, currency: "USD", id: "flat", name: "Flat" },
      { amount: 1_350, currency: "USD", id: "weight", name: "Weight" },
      { amount: 0, currency: "USD", id: "free", name: "Free over threshold" },
    ]);
  });

  test("excludes unavailable weights and rejects cross-currency methods", () => {
    expect(
      quoteShippingMethods({
        currency: "USD",
        methods: [
          {
            calculationType: "flat",
            currency: "EUR",
            freeThresholdAmount: null,
            id: "eur",
            maxWeightGrams: null,
            minWeightGrams: null,
            name: "EUR",
            priceAmount: 500,
          },
          {
            calculationType: "weight",
            currency: "USD",
            freeThresholdAmount: null,
            id: "heavy-only",
            maxWeightGrams: null,
            minWeightGrams: 5_000,
            name: "Heavy",
            priceAmount: 500,
          },
        ],
        subtotalAmount: 1_000,
        totalWeightGrams: 900,
      }),
    ).toEqual([]);
  });
});
