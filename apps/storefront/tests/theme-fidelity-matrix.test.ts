import { describe, expect, test } from "bun:test";

import {
  assertFidelityMatrixComplete,
  themeFidelityMatrix,
} from "../e2e/support/theme-fidelity-matrix";

describe("theme fidelity matrix", () => {
  test("covers the retained Fashion Store home at desktop/mobile and DPR 1/2", () => {
    expect(() => assertFidelityMatrixComplete()).not.toThrow();
    expect(themeFidelityMatrix).toHaveLength(1);
  });

  test("maps the Crafto Fashion source home to Fashion Store", () => {
    const route = themeFidelityMatrix[0]!;
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
    missing[0]!.regions.find(({ id }) => id === "collection")!.states = ["initial"];
    expect(() => assertFidelityMatrixComplete(missing)).toThrow(/missing behavior state/);

    const orphaned = structuredClone(themeFidelityMatrix);
    orphaned[0]!.regions.find(({ id }) => id === "header")!.states.push("ghost-open");
    expect(() => assertFidelityMatrixComplete(orphaned)).toThrow(/unknown behavior state ghost-open/);
  });
});
