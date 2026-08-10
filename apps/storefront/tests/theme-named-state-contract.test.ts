import { describe, expect, test } from "bun:test";
import {
  fashionStoreNamedStates,
  namedStatePixelThreshold,
  namedStateViewportIds,
} from "../e2e/support/theme-named-state-contract";

describe("theme named-state contract", () => {
  test("covers the retained Fashion Store source-equivalent states", () => {
    expect(fashionStoreNamedStates.map(({ id }) => id)).toEqual([
      "navigation-open",
      "search-open",
      "cart-open",
      "hero-slide-1",
      "hero-slide-2",
      "hero-slide-3",
      "product-default",
      "product-hover",
      "product-focus",
      "collection-slide-1",
      "collection-slide-2",
      "collection-slide-3",
      "collection-slide-4",
      "marquee-paused",
      "footer-sticky",
    ]);
    expect(namedStateViewportIds).toEqual(["desktop", "laptop", "tablet", "mobile"]);
    expect(new Set(fashionStoreNamedStates.map(({ id }) => id)).size).toBe(
      fashionStoreNamedStates.length,
    );
  });

  test("uses stricter gates for transient controls", () => {
    const state = (id: string) => fashionStoreNamedStates.find((candidate) => candidate.id === id)!;
    expect(namedStatePixelThreshold(state("search-open"))).toBe(0.001);
    expect(namedStatePixelThreshold(state("cart-open"))).toBe(0.001);
    expect(namedStatePixelThreshold(state("hero-slide-1"))).toBe(0.005);
    expect(state("marquee-paused").action).toEqual({ kind: "pause" });
  });
});
