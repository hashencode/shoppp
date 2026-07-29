import { describe, expect, test } from "bun:test";

import { createRepresentativeCatalogFixture } from "./fixture";

describe("representative catalog fixture", () => {
  test("contains at least 1,000 products and 5,000 variants deterministically", () => {
    const started = performance.now();
    const first = createRepresentativeCatalogFixture();
    const second = createRepresentativeCatalogFixture();

    expect(first.products).toHaveLength(1_000);
    expect(first.variants).toHaveLength(5_000);
    expect(second).toEqual(first);
    expect(new Set(first.variants.map(({ sku }) => sku)).size).toBe(5_000);
    expect(performance.now() - started).toBeLessThan(10 * 60_000);
  });
});
