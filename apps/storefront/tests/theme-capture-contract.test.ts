import { describe, expect, test } from "bun:test";

import {
  captureGeometryIssues,
  deterministicCaptureCss,
  initialCarouselSelectors,
} from "../e2e/support/theme-capture-contract";

describe("theme capture contract", () => {
  test("freezes the same animation and transient UI surface for source and implementation", () => {
    expect(deterministicCaptureCss).toContain("animation-duration: 0s !important");
    expect(deterministicCaptureCss).toContain("transition: none !important");
    expect(deterministicCaptureCss).toContain("[data-source-reveal]");
    expect(deterministicCaptureCss).toContain(".fashion-skip-link");
    expect(deterministicCaptureCss).toContain(".decor-sticky-actions");
  });

  test("names every autoplay carousel that must return to its initial index", () => {
    expect(initialCarouselSelectors).toEqual({
      decor: [".decor-hero", ".decor-collection"],
      fashion: [".fashion-hero", ".fashion-collection-rail"],
    });
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
