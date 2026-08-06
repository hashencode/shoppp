import { describe, expect, test } from "bun:test";
import {
  decorNamedStates,
  fashion2NamedStates,
  fashionNamedStates,
  namedStatePixelThreshold,
  namedStateViewportIds,
} from "../e2e/support/theme-named-state-contract";

describe("theme named-state contract", () => {
  test("covers the source-visible Fashion interaction surface", () => {
    expect(fashionNamedStates.map(({ id }) => id)).toEqual([
      "cookie-overlay",
      "navigation-open",
      "collection-menu-open",
      "pages-menu-open",
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
      "collection-hover",
      "marquee-paused",
      "footer",
    ]);
    expect(namedStateViewportIds).toEqual(["desktop", "laptop", "tablet", "mobile"]);
    expect(new Set(fashionNamedStates.map(({ id }) => id)).size).toBe(fashionNamedStates.length);
  });

  test("uses stricter regional gates for small transient controls", () => {
    const state = (id: string) => fashionNamedStates.find((candidate) => candidate.id === id)!;
    expect(namedStatePixelThreshold(state("search-open"))).toBe(0.001);
    expect(namedStatePixelThreshold(state("collection-menu-open"))).toBe(0.005);
    expect(namedStatePixelThreshold(state("hero-slide-1"))).toBe(0.005);
    expect(state("marquee-paused").action).toEqual({ kind: "pause" });
  });

  test("covers Fashion 2 source-equivalent temporal states without changing source identity", () => {
    expect(fashion2NamedStates.map(({ id }) => id)).toEqual([
      "navigation-open",
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
  });

  test("covers the source-visible Decor interaction surface", () => {
    expect(decorNamedStates.map(({ id }) => id)).toEqual([
      "cookie-overlay",
      "language-open",
      "navigation-open",
      "hero-slide-1",
      "hero-slide-2",
      "hero-slide-3",
      "category-default",
      "category-hover",
      "product-default",
      "product-hover",
      "product-focus",
      "new-arrivals-tab",
      "collection-slide-1",
      "collection-slide-2",
      "collection-slide-3",
      "promotional-marquee-paused",
      "client-strip-paused",
      "footer",
    ]);
    expect(new Set(decorNamedStates.map(({ id }) => id)).size).toBe(decorNamedStates.length);
  });
});
