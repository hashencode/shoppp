import { isFashionStoreViewport } from "./support/fashion-store-project";
import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fashionStoreBehaviorContract } from "../app/themes/fashion-store/behavior-contract";
import { assertThemeBehaviorModeEvidenceRecord } from "./support/theme-behavior-contract";
import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";
import {
  behaviorRow,
  runCollectionBehavior,
  runSearchBehavior,
} from "./support/theme-behavior-runner";
import {
  assertThemeSourceInventoryCovered,
  captureThemeSourceInventory,
} from "./support/theme-source-inventory";
import { assertThemeVisibleCopyEquivalent } from "./support/theme-source-contract";
import { fashionStoreSourceRegions } from "../app/themes/fashion-store/source-contract";
import {
  fashionStoreSourceEntrySha256,
  referenceCaptureConfigs,
  validateIndependentReferenceSource,
} from "../../../tools/capture-storefront-theme-reference";

const sourcePort = Number(process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427);
const sourceUrl = `http://127.0.0.1:${sourcePort}/demo-fashion-store.html`;
const sourceRoot = process.env.STOREFRONT_FASHION_STORE_SOURCE_ROOT
  ? resolve(process.env.STOREFRONT_FASHION_STORE_SOURCE_ROOT)
  : fileURLToPath(
      new URL("../../../templates/Crafto - The Multipurpose HTML5 Template/html/", import.meta.url),
    );
const implementationThemeRoot = fileURLToPath(
  new URL("../app/themes/fashion-store/", import.meta.url),
);

function sourcePageOptions(page: Page, testInfo: Parameters<typeof isFashionStoreViewport>[0]) {
  return {
    ...(isFashionStoreViewport(testInfo, "mobile") ? { hasTouch: true, isMobile: true } : {}),
    viewport: page.viewportSize()!,
  };
}

async function prepareSource(page: Page): Promise<void> {
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".swiper.slider-three-slide").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const carousel = document.querySelector(".swiper.slider-three-slide") as
      (HTMLElement & { swiper?: unknown }) | null;
    return Boolean(carousel?.swiper);
  });
  await page
    .locator("[data-accept-btn]")
    .click({ timeout: 2_000 })
    .catch(() => undefined);
}

async function prepareImplementation(page: Page, allowStatic = false): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction((staticAllowed) => {
    const status = document
      .querySelector("[data-fashion-store-source-parity]")
      ?.getAttribute("data-runtime-status");
    return status === "ready" || (staticAllowed && (status === "loading" || status === "static"));
  }, allowStatic);
  await page
    .getByRole("button", { name: "Allow cookies" })
    .click({ timeout: 2_000 })
    .catch(() => undefined);
}

async function revealInventorySurface(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      [data-anime], [data-anime] > *, .grid-loading, .grid-loading > * {
        opacity: 1 !important;
        transform: none !important;
        visibility: visible !important;
      }
    `,
  });
  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * 0.75) {
      scrollTo(0, top);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 40));
    }
    scrollTo(0, 0);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  });
}

async function resetInventoryHero(page: Page, side: "implementation" | "source"): Promise<void> {
  if (side === "source") {
    await page.locator(".swiper.full-screen").evaluate((element) => {
      const swiper = (
        element as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop?(index: number, speed: number): void;
          };
        }
      ).swiper;
      swiper?.autoplay?.stop();
      swiper?.slideToLoop?.(0, 0);
    });
    return;
  }
  await page.locator(".swiper.full-screen").waitFor({ state: "visible" });
  await expect(page.locator(".swiper.full-screen")).toHaveAttribute(
    "data-motion-active-index",
    "0",
  );
  await expect(page.locator(".swiper.full-screen")).toHaveAttribute("data-motion-phase", "idle");
}

async function exerciseKeyboardSearch(page: Page): Promise<void> {
  const trigger = page.locator(".header-search-form").first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".search-form-wrapper")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".search-form-wrapper")).toBeHidden();
}

async function swipeCollectionWithTouch(page: Page): Promise<void> {
  const carousel = page.locator(".swiper.slider-three-slide").first();
  const box = await carousel.boundingBox();
  if (!box) throw new Error("Collection carousel is unavailable for touch input.");
  const session = await page.context().newCDPSession(page);
  const y = Math.round(box.y + box.height / 2);
  const startX = Math.round(box.x + box.width * 0.75);
  const endX = Math.round(box.x + box.width * 0.25);
  const state = () =>
    carousel.evaluate((element) => {
      const root = element as HTMLElement & {
        swiper?: { activeIndex?: number; realIndex?: number };
      };
      return String(
        root.dataset.collectionIndex ??
          root.swiper?.realIndex ??
          root.swiper?.activeIndex ??
          "missing",
      );
    });
  const before = await state();
  try {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x: startX, y }],
      type: "touchStart",
    });
    for (let step = 1; step <= 8; step += 1) {
      const x = Math.round(startX + ((endX - startX) * step) / 8);
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{ x, y }],
        type: "touchMove",
      });
      await page.waitForTimeout(25);
    }
    await session.send("Input.dispatchTouchEvent", { touchPoints: [], type: "touchEnd" });
    await expect.poll(state, { timeout: 2_500 }).not.toBe(before);
  } finally {
    await session.detach();
  }
}

async function assertSourceCollectionTouchEnabled(page: Page): Promise<void> {
  expect(
    await page
      .locator(".swiper.slider-three-slide")
      .first()
      .evaluate((element) => {
        const swiper = (
          element as HTMLElement & {
            swiper?: {
              allowTouchMove?: boolean;
              enabled?: boolean;
              params?: { allowTouchMove?: boolean };
            };
          }
        ).swiper;
        return Boolean(
          swiper &&
          swiper.enabled !== false &&
          swiper.allowTouchMove !== false &&
          swiper.params?.allowTouchMove !== false,
        );
      }),
  ).toBe(true);
}

test.beforeAll(async () => {
  await validateIndependentReferenceSource({
    config: referenceCaptureConfigs["fashion-store-source"],
    expectedEntrySha256: fashionStoreSourceEntrySha256,
    implementationThemeRoot,
    sourceRoot,
  });
});

test.beforeEach(({ browser: _browser }, testInfo) => {
  test.skip(
    !isFashionStoreViewport(testInfo, "desktop", "mobile"),
    "The acceptance slice intentionally gates desktop and mobile only.",
  );
});

test("source-inventory static: independent candidates and visible copy match", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Inventory runs once at desktop.");
  const source = await browser.newPage(sourcePageOptions(page, testInfo));
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await Promise.all([prepareSource(source), prepareImplementation(page, true)]);
    await Promise.all([revealInventorySurface(source), revealInventorySurface(page)]);
    await Promise.all([
      resetInventoryHero(source, "source"),
      resetInventoryHero(page, "implementation"),
    ]);
    const regions = fashionStoreSourceRegions.map((region) => ({
      id: region.key,
      selector: "inventorySelector" in region ? region.inventorySelector : region.selector,
    }));
    const [sourceInventory, implementationInventory] = await Promise.all([
      captureThemeSourceInventory({
        contract: fashionStoreBehaviorContract,
        page: source,
        regions,
        side: "source",
      }),
      captureThemeSourceInventory({
        contract: fashionStoreBehaviorContract,
        page,
        regions,
        side: "implementation",
      }),
    ]);
    assertThemeSourceInventoryCovered(sourceInventory, fashionStoreBehaviorContract);
    assertThemeVisibleCopyEquivalent(
      sourceInventory.visibleCopy,
      implementationInventory.visibleCopy,
    );
  } finally {
    await source.close();
  }
});

test("search-open interaction: contract-driven search opens and dismisses on source and implementation", async ({
  browser,
  page,
}, testInfo) => {
  const source = await browser.newPage(sourcePageOptions(page, testInfo));
  try {
    await Promise.all([prepareSource(source), prepareImplementation(page, true)]);
    const behavior = behaviorRow(fashionStoreBehaviorContract, "header-search-overlay");
    const [sourceResult, implementationResult] = await Promise.all([
      runSearchBehavior({
        behavior,
        expectedFocusWhileOpen: "trigger",
        inputSelector: ".search-form-wrapper input[type=text]",
        page: source,
        panelSelector: ".search-form-wrapper",
        side: "source",
      }),
      runSearchBehavior({
        behavior,
        expectedFocusWhileOpen: "input",
        inputSelector: ".search-form-wrapper input[type=text]",
        page,
        panelSelector: ".search-form-wrapper",
        side: "implementation",
      }),
    ]);
    expect(sourceResult).toMatchObject({ dismissed: true, opened: true, urlChanged: false });
    expect(implementationResult).toMatchObject({
      dismissed: true,
      focusAfterDismissal: "trigger",
      focusWhileOpen: "input",
      opened: true,
      urlChanged: false,
    });
    await Promise.all([exerciseKeyboardSearch(source), exerciseKeyboardSearch(page)]);
    const evidence = {
      actionOutcome: sourceResult.opened && implementationResult.opened,
      behaviorId: behavior.id,
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" as const },
        { id: "keyboard", outcome: true, viewportId: "desktop" as const },
      ],
      mode: "interaction" as const,
    };
    assertThemeBehaviorModeEvidenceRecord(fashionStoreBehaviorContract, evidence);
    recordThemeBehaviorEvidence(testInfo, evidence);
  } finally {
    await source.close();
  }
});

test("collection-slide-1 temporal: contract-driven collection exposes cards and moves after elapsed time", async ({
  browser,
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const source = await browser.newPage({
    reducedMotion: "no-preference",
    ...sourcePageOptions(page, testInfo),
  });
  try {
    await Promise.all([prepareSource(source), prepareImplementation(page)]);
    const behavior = behaviorRow(fashionStoreBehaviorContract, "new-arrival-collection-carousel");
    const desktop = isFashionStoreViewport(testInfo, "desktop");
    const minimumVisibleCards = desktop ? 3 : 1;
    const maximumCardWidthRatio = desktop ? 0.45 : 1.05;
    const [sourceResult, implementationResult] = await Promise.all([
      runCollectionBehavior({
        behavior,
        maximumCardWidthRatio,
        minimumVisibleCards,
        mode: "temporal",
        page: source,
        side: "source",
      }),
      runCollectionBehavior({
        behavior,
        maximumCardWidthRatio,
        minimumVisibleCards,
        mode: "temporal",
        page,
        side: "implementation",
      }),
    ]);
    expect(sourceResult.moved).toBe(true);
    expect(implementationResult.moved).toBe(true);
    expect(
      Math.abs(sourceResult.visibleCardCount - implementationResult.visibleCardCount),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(sourceResult.cardWidthRatio - implementationResult.cardWidthRatio),
    ).toBeLessThan(0.1);
    const evidence = {
      behaviorId: behavior.id,
      mode: "temporal" as const,
      temporalSamples: {
        after: implementationResult.movementDisplacement,
        before: 0,
        elapsedMs: implementationResult.elapsedMs,
      },
    };
    assertThemeBehaviorModeEvidenceRecord(fashionStoreBehaviorContract, evidence);
    recordThemeBehaviorEvidence(testInfo, evidence);
  } finally {
    await source.close();
  }
});

test("collection-slide-1 interaction: declared controls advance both carousels", async ({
  browser,
  page,
}, testInfo) => {
  const source = await browser.newPage(sourcePageOptions(page, testInfo));
  try {
    await Promise.all([prepareSource(source), prepareImplementation(page, true)]);
    const behavior = behaviorRow(fashionStoreBehaviorContract, "new-arrival-collection-carousel");
    const desktop = isFashionStoreViewport(testInfo, "desktop");
    const options = {
      behavior,
      maximumCardWidthRatio: desktop ? 0.45 : 1.05,
      minimumVisibleCards: desktop ? 3 : 1,
      mode: "interaction" as const,
    };
    const [sourceResult, implementationResult] = await Promise.all([
      runCollectionBehavior({ ...options, page: source, side: "source" }),
      runCollectionBehavior({ ...options, page, side: "implementation" }),
    ]);
    expect(sourceResult.moved).toBe(true);
    expect(implementationResult.moved).toBe(true);
    if (!desktop) {
      await assertSourceCollectionTouchEnabled(source);
      await swipeCollectionWithTouch(page);
    }
    const evidence = {
      actionOutcome: true,
      behaviorId: behavior.id,
      branches: [
        {
          id: desktop ? "desktop" : "mobile",
          outcome: true,
          viewportId: desktop ? ("desktop" as const) : ("mobile" as const),
        },
      ],
      mode: "interaction" as const,
    };
    assertThemeBehaviorModeEvidenceRecord(fashionStoreBehaviorContract, evidence);
    recordThemeBehaviorEvidence(testInfo, evidence);
  } finally {
    await source.close();
  }
});
