import { describe, expect, test } from "vitest";

import { configuredTaxPort } from "../../src/pricing/tax";

describe("P0 tax port", () => {
  test("returns an explicit zero-tax quote in the configured launch mode", async () => {
    await expect(
      configuredTaxPort("zero").quote({
        currency: "USD",
        destinationCountry: "US",
        taxableAmount: 12_900,
      }),
    ).resolves.toEqual({ amount: 0, currency: "USD" });
  });
});
