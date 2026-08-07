import { describe, expect, test } from "bun:test";

import {
  captureThemeRouteRegion,
  equivalentRoundedSectionTarget,
} from "./capture-theme-route-region";

describe("full-page section origin normalization", () => {
  test("normalizes only already-equivalent section origins", () => {
    expect(
      equivalentRoundedSectionTarget({ left: 0.04, top: 100.04 }, { left: 0.08, top: 100.08 }),
    ).toEqual({ left: 0, top: 100 });
    expect(
      equivalentRoundedSectionTarget({ left: 0, top: 100 }, { left: 0, top: 100.11 }),
    ).toBeNull();
  });
});

describe("capture acceptance modes", () => {
  test("rejects static capture when its stylesheet hides the target control", async () => {
    await expect(
      captureThemeRouteRegion({
        captureMode: "static",
        commit: "abcdef1",
        density: 1,
        implementationOrigin: "http://127.0.0.1:1",
        outputRoot: "/tmp/unused-capture-output",
        regionId: "scroll-progress",
        routeId: "fashion-store-home",
        sourceOrigin: "http://127.0.0.1:2",
        viewportId: "desktop",
      }),
    ).rejects.toThrow(/static capture CSS hides the target control/);
  });
});
