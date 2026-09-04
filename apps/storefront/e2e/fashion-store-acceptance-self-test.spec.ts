import { isFashionStoreViewport } from "./support/fashion-store-project";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  assertVisibleCopyAbsent,
  probeCollectionCarouselOutcome,
  probeContinuousMovement,
  probeNativeCursorVisibility,
  probePreviewCardOutcome,
  probeRequiredVisibleElement,
  probeScrollProgressAndReturn,
  probeSearchOverlayOutcome,
} from "./support/theme-behavior-probes";
import {
  assertThemeSourceInventoryCovered,
  captureThemeSourceInventory,
} from "./support/theme-source-inventory";
import type { ThemeBehaviorContract } from "./support/theme-behavior-contract";

const fixture = readFileSync(
  new URL("./fixtures/source-equivalence-defects/fashion-store/index.html", import.meta.url),
  "utf8",
);

async function loadFixture(page: Page, defect = "none"): Promise<void> {
  page.setDefaultTimeout(750);
  await page.setContent(fixture.replace("__DEFECT__", defect), { waitUntil: "load" });
}

test.beforeEach(({ browser: _browser }, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Harness self-tests run once.");
});

test("historical defect fixtures fail the intended Fashion Store probes", async ({ page }) => {
  await loadFixture(page, "cursor-hidden");
  await expect(probeNativeCursorVisibility(page, ".hero")).rejects.toThrow(/cursor is hidden/);

  await loadFixture(page, "collection-full-width");
  await expect(
    probeCollectionCarouselOutcome({
      carouselSelector: ".collection",
      maximumCardWidthRatio: 0.4,
      minimumVisibleCards: 3,
      page,
      timeoutMs: 500,
    }),
  ).rejects.toThrow(/visible card|width ratio/);

  await loadFixture(page, "static-collection");
  await expect(
    probeCollectionCarouselOutcome({
      carouselSelector: ".collection",
      maximumCardWidthRatio: 0.4,
      minimumVisibleCards: 3,
      page,
      timeoutMs: 400,
    }),
  ).rejects.toThrow(/Timeout|did not move/);

  await loadFixture(page, "autoplay-only-collection");
  await expect(
    probeCollectionCarouselOutcome({
      advanceKey: "ArrowRight",
      carouselSelector: ".collection",
      maximumCardWidthRatio: 0.4,
      minimumVisibleCards: 3,
      page,
      timeoutMs: 500,
    }),
  ).rejects.toThrow(/Timeout|did not move/);

  await loadFixture(page, "static-marquee");
  await expect(
    probeContinuousMovement({ page, sampleIntervalMs: 400, trackSelector: ".marquee-track" }),
  ).rejects.toThrow(/Timeout|displacement/);

  await loadFixture(page, "inert-search");
  await expect(
    probeSearchOverlayOutcome({
      expectedFocusWhileOpen: "input",
      inputSelector: ".search-input",
      page,
      panelSelector: ".search-panel",
      triggerSelector: ".search-trigger",
    }),
  ).rejects.toThrow(/Timeout/);

  await loadFixture(page, "inert-cart");
  await expect(
    probePreviewCardOutcome({
      contentPattern: /Ribbed tank.*Pleated dress/,
      page,
      panelSelector: ".cart-panel",
      triggerSelector: ".cart",
    }),
  ).rejects.toThrow(/Timeout/);

  await loadFixture(page, "hidden-social");
  await expect(probeRequiredVisibleElement(page, ".social")).rejects.toThrow(/not visible/);

  await loadFixture(page, "inert-progress");
  await expect(
    probeScrollProgressAndReturn({
      backToTopSelector: ".scroll-top",
      controlSelector: ".scroll-progress",
      page,
      progressSelector: ".scroll-point",
      scrollSamples: [500, 1_500],
    }),
  ).rejects.toThrow(/did not increase/);

  await loadFixture(page, "extra-copy");
  await expect(assertVisibleCopyAbsent(page, "Product added to the preview cart.")).rejects.toThrow(
    /Implementation-only visible copy/,
  );
});

test("the repaired fixture passes every shared behavior probe", async ({ page }) => {
  await loadFixture(page);
  await expect(probeNativeCursorVisibility(page, ".hero")).resolves.toMatchObject({
    visible: true,
  });
  await expect(
    probeCollectionCarouselOutcome({
      advanceKey: "ArrowRight",
      carouselSelector: ".collection",
      maximumCardWidthRatio: 0.4,
      minimumVisibleCards: 3,
      page,
      timeoutMs: 500,
    }),
  ).resolves.toMatchObject({ moved: true, visibleCardCount: 3 });
  await expect(
    probeContinuousMovement({ page, sampleIntervalMs: 600, trackSelector: ".marquee-track" }),
  ).resolves.toMatchObject({ displacement: expect.any(Number) });
  await expect(
    probeSearchOverlayOutcome({
      expectedFocusWhileOpen: "input",
      inputSelector: ".search-input",
      page,
      panelSelector: ".search-panel",
      triggerSelector: ".search-trigger",
    }),
  ).resolves.toMatchObject({ dismissed: true, opened: true });
  await expect(
    probePreviewCardOutcome({
      contentPattern: /Ribbed tank.*Pleated dress/,
      page,
      panelSelector: ".cart-panel",
      triggerSelector: ".cart",
    }),
  ).resolves.toMatchObject({ hiddenAfterExit: true, visibleAfterTrigger: true });
  await expect(page.locator(".social")).toBeVisible();
  await expect(probeRequiredVisibleElement(page, ".social")).resolves.toBeUndefined();
  await expect(
    assertVisibleCopyAbsent(page, "Product added to the preview cart."),
  ).resolves.toBeUndefined();
});

test("independent candidate discovery rejects an undeclared ordinary button", async ({ page }) => {
  await loadFixture(page);
  const emptyContract = {
    behaviors: [],
    customAdapters: [],
    routeId: "fixture-home",
    suppressions: [],
    themeId: "fixture",
  } as const satisfies ThemeBehaviorContract;
  const inventory = await captureThemeSourceInventory({
    contract: emptyContract,
    page,
    regions: [{ id: "document", selector: "body" }],
    side: "source",
  });
  expect(inventory.candidates.some(({ selector }) => selector.includes("button"))).toBe(true);
  expect(() => assertThemeSourceInventoryCovered(inventory, emptyContract)).toThrow(
    /unresolved candidate/,
  );
});
