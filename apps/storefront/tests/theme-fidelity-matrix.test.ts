import { describe, expect, test } from "bun:test";

import {
  assertFidelityMatrixComplete,
  themeFidelityMatrix,
} from "../e2e/support/theme-fidelity-matrix";
import { fashionSourceContract } from "../app/themes/fashion/source-contract";

describe("theme fidelity matrix", () => {
  test("covers home, collection, and product routes at desktop/mobile and DPR 1/2", () => {
    expect(() => assertFidelityMatrixComplete()).not.toThrow();
  });

  test("covers every Fashion reference page instead of treating route presence as fidelity", () => {
    const expectedSourcePaths = fashionSourceContract.referencePages
      .map(([sourcePath]) => `/${sourcePath}`)
      .sort();
    const actualSourcePaths = themeFidelityMatrix
      .filter(({ id }) => id.startsWith("fashion-") && id !== "fashion-2-home")
      .map(({ sourcePath }) => sourcePath)
      .sort();

    expect(actualSourcePaths).toEqual(expectedSourcePaths);
    for (const route of themeFidelityMatrix.filter(
      ({ id }) => id.startsWith("fashion-") && id !== "fashion-2-home",
    )) {
      expect(route.viewports).toEqual(["desktop", "laptop", "tablet", "mobile"]);
      expect(route.viewports).not.toContain("laptop-922");
    }
  });

  test("maps the Fashion source home to the isolated Fashion 2 implementation", () => {
    const route = themeFidelityMatrix.find(({ id }) => id === "fashion-2-home")!;
    expect(route).toMatchObject({
      densities: [1, 2],
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
      "full-page",
    ]);
  });

  test("includes the Fashion controls that aggregate full-page diffs previously missed", () => {
    const home = themeFidelityMatrix.find(({ id }) => id === "fashion-home")!;
    const product = themeFidelityMatrix.find(({ id }) => id === "fashion-product")!;

    expect(home.viewports).toContain("laptop");
    expect(home.regions.find(({ id }) => id === "hero")).toMatchObject({
      implementationProbeSelector: '.fashion-hero-slide[data-current="true"] h1',
      kind: "component",
      maxChangedPixelRatio: 0.009,
      pixelBudgetReason: "source-font-antialiasing",
      sourceProbeSelector: ".swiper.full-screen .swiper-slide-active .alt-font.fs-120",
    });
    expect(home.regions.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["category-control", "product-badge", "new-arrival-collection"]),
    );
    expect(home.regions.find(({ id }) => id === "promo-band")).toMatchObject({
      geometryTolerancePx: 2,
      implementationProbeSelector: ".fashion-promo-band > span",
      kind: "component",
      maxChangedPixelRatio: 0.03,
      pixelBudgetReason: "source-font-antialiasing",
      sourceProbeSelector: "section:nth-of-type(5) span.fs-15",
    });
    expect(product.regions.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "gallery-thumbnails",
        "color-control",
        "size-control",
        "quantity-control",
        "tabs",
        "related-products",
      ]),
    );
    expect(
      themeFidelityMatrix
        .find(({ id }) => id === "fashion-collection")!
        .regions.map(({ id }) => id),
    ).toContain("pagination-control");
    expect(product.regions.find(({ id }) => id === "gallery")).toMatchObject({
      imageAssetPolicy: "source-match",
      neutralizeImagePixels: true,
    });
    expect(product.regions.find(({ id }) => id === "gallery-thumbnails")).toMatchObject({
      imageAssetPolicy: "source-match",
      neutralizeImagePixels: true,
    });
    expect(product.regions.find(({ id }) => id === "product-info")).toMatchObject({
      implementationProbeSelector: ".fashion-product-price > span",
      maxChangedPixelRatio: 0.026,
      pixelBudgetReason: "source-font-antialiasing",
      sourceProbeSelector: ".product-info .product-price span",
    });
    expect(product.regions.find(({ id }) => id === "breadcrumb")).toMatchObject({
      implementationProbeSelector: ".fashion-product-breadcrumb li:first-child a",
      maxChangedPixelRatio: 0.034,
      pixelBudgetReason: "dense-source-font-antialiasing",
      sourceProbeSelector: "section:nth-of-type(1) li:first-child a",
    });
    expect(product.regions.find(({ id }) => id === "tabs")).toMatchObject({
      implementationProbeSelector: ".fashion-product-description-panel h2",
      maxChangedPixelRatio: 0.014,
      pixelBudgetReason: "source-font-antialiasing",
      sourceProbeSelector: "#tab_five1 h4",
    });
    expect(
      themeFidelityMatrix
        .find(({ id }) => id === "fashion-collection")!
        .regions.find(({ id }) => id === "product-grid"),
    ).toMatchObject({
      imageAssetPolicy: "source-match",
      neutralizeImagePixels: true,
    });
  });

  test("keeps every source-visible Decor home section independently measurable", () => {
    const home = themeFidelityMatrix.find(({ id }) => id === "decor-home")!;

    expect(home.regions.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "header",
        "hero",
        "categories",
        "product-tabs",
        "marquee",
        "collection",
        "clients",
        "journal",
        "services",
        "footer",
        "full-page",
      ]),
    );
    expect(home.regions).not.toContainEqual(expect.objectContaining({ id: "body-sections" }));
    for (const id of ["categories", "product-tabs", "collection", "journal", "services"]) {
      const contractRegion = home.regions.find((candidate) => candidate.id === id)!;
      expect(typeof contractRegion.implementationProbeSelector).toBe("string");
      expect(typeof contractRegion.sourceProbeSelector).toBe("string");
    }
    expect(home.regions.find(({ id }) => id === "hero")).toMatchObject({
      allowExpectedTopOcclusion: true,
      imageAssetPolicy: "implementation-original",
      maxChangedPixelRatio: 0.01,
      neutralizeImagePixels: true,
      pixelBudgetReason: "source-font-antialiasing",
    });
    expect(home.regions.find(({ id }) => id === "marquee")).toMatchObject({
      maxChangedPixelRatio: 0.014,
      pixelBudgetReason: "source-font-antialiasing",
    });
    expect(home.regions.find(({ id }) => id === "services")).toMatchObject({
      implementationProbeSelector: ".decor-service-detail",
      maxChangedPixelRatio: 0.041,
      pixelBudgetReason: "source-accessibility-contrast-correction",
      styleEquivalences: {
        color: [
          {
            implementation: "rgb(113, 117, 128)",
            reason: "source-accessibility-contrast-correction",
            reference: "rgb(136, 142, 149)",
          },
        ],
      },
    });
    expect(home.regions.find(({ id }) => id === "journal")).toMatchObject({
      maxChangedPixelRatio: 0.01,
      pixelBudgetReason: "source-accessibility-contrast-correction",
      styleEquivalences: {
        color: [
          {
            implementation: "rgb(105, 115, 123)",
            reason: "source-accessibility-contrast-correction",
            reference: "rgb(136, 142, 149)",
          },
        ],
      },
    });
    expect(home.regions.find(({ id }) => id === "clients")).toMatchObject({
      imageAssetPolicy: "source-match",
      maxChangedPixelRatio: 0.015,
      pixelBudgetReason: "source-image-subpixel-rasterization",
    });
    expect(home.regions.find(({ id }) => id === "footer")).toMatchObject({
      maxChangedPixelRatio: 0.03,
      pixelBudgetReason: "source-font-antialiasing",
      probeRootStyles: true,
    });
  });

  test("rejects missing DPR coverage and permissive regional thresholds", () => {
    const broken = structuredClone(themeFidelityMatrix);
    broken[0]!.densities = [1];
    broken[0]!.regions[0]!.maxChangedPixelRatio = 0.006;

    expect(() => assertFidelityMatrixComplete(broken)).toThrow(
      /both DPR 1 and DPR 2 are required[\s\S]*regional pixel gate exceeds 0.5%/,
    );
  });

  test("pairs a text-raster budget for tiny controls with exact computed-style gates", () => {
    const home = themeFidelityMatrix.find(({ id }) => id === "fashion-home")!;
    expect(home.regions.find(({ id }) => id === "category-control")).toMatchObject({
      geometryTolerancePx: 1,
      kind: "control",
      maxChangedPixelRatio: 0.06,
    });
  });

  test("allows a measured font-antialiasing budget only with exact nested style probes", () => {
    const home = themeFidelityMatrix.find(({ id }) => id === "fashion-home")!;
    expect(home.regions.find(({ id }) => id === "promise-strip")).toMatchObject({
      implementationProbeSelector: ".fashion-promises-cycle:first-child p:nth-child(2)",
      kind: "component",
      maxChangedPixelRatio: 0.03,
      pixelBudgetReason: "source-font-antialiasing",
      sourceProbeSelector: "section:nth-of-type(9) .swiper-slide:nth-child(2) > div",
    });
    expect(home.regions.find(({ id }) => id === "footer")).toMatchObject({
      implementationProbeSelector: ".fashion-footer-top nav a:first-child",
      kind: "component",
      maxChangedPixelRatio: 0.028,
      pixelBudgetReason: "source-font-antialiasing",
      sourceProbeSelector: "footer .footer-navbar li:first-child a",
    });
  });
});
