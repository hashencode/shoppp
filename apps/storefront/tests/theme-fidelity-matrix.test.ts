import { describe, expect, test } from "bun:test";

import {
  assertFidelityMatrixComplete,
  themeFidelityMatrix,
} from "../e2e/support/theme-fidelity-matrix";

describe("theme fidelity matrix", () => {
  test("covers the enabled source-equivalent pages at desktop/mobile and DPR 1/2", () => {
    expect(() => assertFidelityMatrixComplete()).not.toThrow();
    expect(themeFidelityMatrix.map(({ id }) => id)).toEqual([
      "decor-home",
      "fashion-store-home",
      "fashion-store-shop-left",
      "fashion-store-shop-none",
      "fashion-store-shop-right",
      "fashion-store-collection",
      "fashion-store-product",
      "fashion-store-cart",
      "fashion-store-checkout",
      "fashion-store-wishlist",
      "fashion-store-account",
      "fashion-store-magazine",
      "fashion-store-article",
      "fashion-store-about",
      "fashion-store-faq",
      "fashion-store-contact",
    ]);
  });

  test("maps the Crafto Fashion source home to Fashion Store", () => {
    const route = themeFidelityMatrix.find(({ id }) => id === "fashion-store-home")!;
    expect(route).toMatchObject({
      densities: [1, 2],
      id: "fashion-store-home",
      implementationPath: "/",
      sourcePath: "/demo-fashion-store.html",
      viewports: ["desktop", "laptop", "tablet", "mobile"],
    });
    expect(route.regions.map(({ id }) => id)).toEqual([
      "header",
      "hero",
      "categories",
      "best-sellers",
      "collection",
      "marquee",
      "footer",
      "sticky",
      "scroll-progress",
      "full-page",
    ]);
  });

  test("rejects fidelity states that drift away from the behavior contract", () => {
    const missing = structuredClone(themeFidelityMatrix);
    const fashionHome = missing.find(({ id }) => id === "fashion-store-home")!;
    fashionHome.regions.find(({ id }) => id === "collection")!.states = ["initial"];
    expect(() => assertFidelityMatrixComplete(missing)).toThrow(/missing behavior state/);

    const orphaned = structuredClone(themeFidelityMatrix);
    const orphanedFashionHome = orphaned.find(({ id }) => id === "fashion-store-home")!;
    orphanedFashionHome.regions.find(({ id }) => id === "header")!.states.push("ghost-open");
    expect(() => assertFidelityMatrixComplete(orphaned)).toThrow(
      /unknown behavior state ghost-open/,
    );

    const missingRegion = structuredClone(themeFidelityMatrix);
    const missingRegionFashionHome = missingRegion.find(({ id }) => id === "fashion-store-home")!;
    missingRegionFashionHome.regions = missingRegionFashionHome.regions.filter(
      ({ id }) => id !== "collection",
    );
    expect(() => assertFidelityMatrixComplete(missingRegion)).toThrow(
      /fashion-store-home\/collection: behavior region is absent from the fidelity matrix/,
    );
  });
});
