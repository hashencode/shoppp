import { describe, expect, test } from "bun:test";

import {
  captureGeometryIssues,
  captureCssForMode,
  captureModePreservesTarget,
  deterministicCaptureCss,
  fashionStoreComparisonDescriptor,
  initialCarouselSelectors,
  resolveThemeComparison,
} from "../e2e/support/theme-capture-contract";

describe("theme capture contract", () => {
  test("freezes the same animation and transient UI surface for source and implementation", () => {
    expect(deterministicCaptureCss).toContain("animation-duration: 0s !important");
    expect(deterministicCaptureCss).toContain("transition: none !important");
    expect(deterministicCaptureCss).toContain("[data-source-reveal]");
    expect(deterministicCaptureCss).toContain(".fashion-skip-link");
    expect(deterministicCaptureCss).toContain(".decor-sticky-actions");
  });

  test("preserves the capability under acceptance in temporal and scroll/fixed modes", () => {
    expect(captureCssForMode("temporal")).not.toContain("animation-duration: 0s !important");
    expect(captureCssForMode("scroll-fixed")).not.toContain(
      ".scroll-progress, .sticky-wrap, .decor-scroll-progress { display: none !important; }",
    );
    expect(captureCssForMode("static")).toContain("animation-duration: 0s !important");
    expect(captureModePreservesTarget("static", ".scroll-progress")).toBe(false);
    expect(captureModePreservesTarget("scroll-fixed", ".scroll-progress")).toBe(true);
  });

  test("names every autoplay carousel that must return to its initial index", () => {
    expect(initialCarouselSelectors).toEqual({
      "fashion-store": [".swiper.full-screen"],
    });
  });

  test("describes Fashion source and Fashion Store implementation as distinct evidence roots", () => {
    expect(resolveThemeComparison("fashion", "fashion-store")).toBe(fashionStoreComparisonDescriptor);
    expect(fashionStoreComparisonDescriptor).toMatchObject({
      artifactRoots: {
        implementation: "implementation/fashion-store",
        reference: "reference/fashion",
      },
      densities: [1, 2],
      implementationThemeId: "fashion-store",
      referenceEntry: "demo-fashion-store.html",
      referenceThemeId: "fashion",
    });
    expect(() => resolveThemeComparison("fashion-store", "fashion-store")).toThrow("implementation-only");
  });

  test("checks every bounding-box edge in the correct coordinate space", () => {
    const reference = { height: 100, pageX: 40, pageY: 240, width: 200, x: 10, y: 20 };
    const documentShift = { ...reference, pageX: 43 };
    const viewportShift = { ...reference, x: 13 };

    expect(captureGeometryIssues("section", reference, documentShift, "document")).toEqual([
      "section left: expected 40px, received 43px",
      "section right: expected 240px, received 243px",
    ]);
    expect(captureGeometryIssues("fixed", reference, viewportShift, "viewport")).toEqual([
      "fixed left: expected 10px, received 13px",
      "fixed right: expected 210px, received 213px",
    ]);
    expect(
      captureGeometryIssues(
        "within-tolerance",
        reference,
        { ...reference, width: 202 },
        "document",
      ),
    ).toEqual([]);
    expect(
      captureGeometryIssues(
        "over-threshold",
        reference,
        { ...reference, width: 202.01 },
        "document",
      ),
    ).toEqual([
      "over-threshold right: expected 240px, received 242.01px",
      "over-threshold width: expected 200px, received 202.01px",
    ]);
  });
});
