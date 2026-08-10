import { describe, expect, test } from "bun:test";

import { semanticReadinessIssues } from "../e2e/support/theme-acceptance-readiness";

const ready = {
  brokenImages: [],
  documentHeight: 1200,
  documentWidth: 1280,
  fontsReady: true,
  imageCount: 4,
  runtimeReady: true,
  stableLayout: true,
};

describe("theme semantic readiness", () => {
  test("accepts stable geometry and a ready runtime", () => {
    expect(
      semanticReadinessIssues(ready, { runtimeStatusSelector: "[data-runtime-status]" }),
    ).toEqual([]);
  });

  test("reports runtime, layout, and strict image failures independently", () => {
    expect(
      semanticReadinessIssues(
        {
          ...ready,
          brokenImages: ["https://source.invalid/product.jpg"],
          runtimeReady: false,
          stableLayout: false,
        },
        { failOnBrokenImages: true, runtimeStatusSelector: "[data-runtime-status]" },
      ),
    ).toEqual([
      "runtime did not become ready at [data-runtime-status]",
      "document geometry did not stabilize",
      "1 image(s) failed to decode: https://source.invalid/product.jpg",
    ]);
  });

  test("allows layout-only source placeholders when strict image checks are disabled", () => {
    expect(
      semanticReadinessIssues({ ...ready, brokenImages: ["https://source.invalid/layout.png"] }),
    ).toEqual([]);
  });

  test("reports a font readiness timeout", () => {
    expect(semanticReadinessIssues({ ...ready, fontsReady: false })).toEqual([
      "document fonts did not become ready",
    ]);
  });
});
