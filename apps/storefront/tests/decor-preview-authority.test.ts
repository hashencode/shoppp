import { describe, expect, test } from "bun:test";

import { decorBehaviorContract } from "../app/themes/decor/behavior-contract";
import { decorThemeRoutes } from "../app/themes/decor/page-contracts";
import { themeRoutes } from "../app/themes/decor/registry";
import { decorSourceContract } from "../app/themes/decor/source-contract";
import {
  decorComparisonDescriptor,
  initialCarouselSelectors,
  resolveThemeComparison,
} from "../e2e/support/theme-capture-contract";
import { assertThemeBehaviorContractComplete } from "../e2e/support/theme-behavior-contract";
import { decorPreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";

describe("Decor preview authority", () => {
  test("exports the home route through the selected-theme registry", () => {
    expect(themeRoutes).toBe(decorThemeRoutes);
    expect(decorThemeRoutes.map(({ path }) => path)).toEqual(["/"]);
    expect(decorThemeRoutes[0]).toMatchObject({ id: "home", pageType: "home", path: "/" });
  });

  test("prepares an approved Decor-only preview input", async () => {
    const input = await decorPreviewBuildInput("https://preview.example.test");
    expect(input).toMatchObject({ environment: "preview", themeId: "decor" });
    expect(input.snapshot).toMatchObject({ themeId: "decor", themeVersion: "1.0.0" });
    expect(input.snapshot.resolvedTemplates.map(({ pageType }) => pageType)).toEqual(["home"]);
    expect(new Set(input.snapshot.bindings.map(({ fixtureId }) => fixtureId))).toEqual(
      new Set(["decor-home"]),
    );
    expect(input.snapshot.bindings).toHaveLength(10);
  });

  test("registers a Decor comparison and initial carousel", () => {
    expect(resolveThemeComparison("decor", "decor")).toBe(decorComparisonDescriptor);
    expect(initialCarouselSelectors.decor).toEqual([".decor-hero", ".decor-collection"]);
  });

  test("keeps source fade and complete layer timeline distinct", () => {
    expect(decorSourceContract.hero.transition.durationMs).toBe(300);
    expect(decorSourceContract.hero.layerTimeline.durationMs).toBe(2_700);
    expect(decorSourceContract.hero.layerTimeline.layers.map(({ id }) => id)).toEqual([
      "accent",
      "shape",
      "product",
      "heading",
      "price",
      "action",
      "auxiliary-1",
      "auxiliary-2",
      "auxiliary-3",
      "auxiliary-4",
    ]);
    expect(decorSourceContract.hero.interaction).toMatchObject({
      pauseOnFocus: false,
      pauseOnHover: false,
      swipeThresholdPx: 75,
    });
  });

  test("declares the behavior rows needed by the Decor home acceptance seam", () => {
    expect(() =>
      assertThemeBehaviorContractComplete(
        decorBehaviorContract,
        decorSourceContract.sourceRegions.map(({ id }) => id),
      ),
    ).not.toThrow();
    expect(decorBehaviorContract.behaviors.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "hero-carousel",
        "section-reveals",
        "marquee-motion",
        "collection-carousel",
        "client-carousel",
        "scroll-progress",
      ]),
    );
  });
});
