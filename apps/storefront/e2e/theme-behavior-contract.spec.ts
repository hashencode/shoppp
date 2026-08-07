import { expect, test, type Page } from "@playwright/test";
import { fashionStoreBehaviorContract } from "../app/themes/fashion-store/behavior-contract";
import { assertThemeBehaviorModeEvidenceRecord } from "./support/theme-behavior-contract";
import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";
import {
  behaviorRow,
  runContinuousMovementBehavior,
  runPreviewBehavior,
  runScrollBehavior,
} from "./support/theme-behavior-runner";

const sourceUrl = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}/demo-fashion-store.html`;

async function prepare(page: Page, side: "implementation" | "source"): Promise<void> {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(side === "source" ? sourceUrl : "/", { waitUntil: "domcontentloaded" });
  if (side === "source") {
    await page.waitForFunction(() =>
      Boolean(
        (document.querySelector(".swiper.full-screen") as HTMLElement & { swiper?: unknown })
          ?.swiper,
      ),
    );
    await page
      .locator("[data-accept-btn]")
      .click({ timeout: 2_000 })
      .catch(() => undefined);
  } else {
    await page
      .locator('[data-fashion-store-source-parity][data-runtime-status="ready"]')
      .waitFor({ state: "attached" });
    await page
      .getByRole("button", { name: "Allow cookies" })
      .click({ timeout: 2_000 })
      .catch(() => undefined);
  }
}

test.beforeEach(({ browser: _browser }, testInfo) => {
  test.skip(
    testInfo.project.name !== "fashion-store-desktop",
    "Preview, marquee, and fixed scroll controls are gated at the desktop source breakpoint.",
  );
});

test("cart-open interaction: behavior runner verifies preview cart outcome on both sides", async ({
  browser,
  page,
}, testInfo) => {
  const source = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await Promise.all([prepare(source, "source"), prepare(page, "implementation")]);
    const behavior = behaviorRow(fashionStoreBehaviorContract, "header-cart-preview");
    const [sourceResult, implementationResult] = await Promise.all([
      runPreviewBehavior({
        behavior,
        contentPattern: /Ribbed tank.*Pleated dress/,
        page: source,
        panelSelector: ".header-cart .cart-item-list",
        side: "source",
      }),
      runPreviewBehavior({
        behavior,
        contentPattern: /Ribbed tank.*Pleated dress/,
        page,
        panelSelector: ".header-cart .cart-item-list",
        side: "implementation",
      }),
    ]);
    expect(sourceResult.hiddenAfterExit).toBe(true);
    expect(implementationResult.hiddenAfterExit).toBe(true);
    const evidence = {
      actionOutcome: sourceResult.visibleAfterTrigger && implementationResult.visibleAfterTrigger,
      behaviorId: behavior.id,
      branches: [{ id: "desktop-hover", outcome: true, viewportId: "desktop" as const }],
      mode: "interaction" as const,
    };
    assertThemeBehaviorModeEvidenceRecord(fashionStoreBehaviorContract, evidence);
    recordThemeBehaviorEvidence(testInfo, evidence);
  } finally {
    await source.close();
  }
});

test("marquee-paused temporal: behavior runner observes real displacement on both sides", async ({
  browser,
  page,
}, testInfo) => {
  const source = await browser.newPage({
    reducedMotion: "no-preference",
    viewport: page.viewportSize()!,
  });
  try {
    await Promise.all([prepare(source, "source"), prepare(page, "implementation")]);
    const behavior = behaviorRow(fashionStoreBehaviorContract, "promotional-marquee");
    const [sourceResult, implementationResult] = await Promise.all([
      runContinuousMovementBehavior({
        behavior,
        page: source,
        side: "source",
        trackSelector: "section:nth-of-type(9) .swiper-wrapper",
      }),
      runContinuousMovementBehavior({
        behavior,
        page,
        side: "implementation",
        trackSelector: "section:nth-of-type(9) .swiper-wrapper",
      }),
    ]);
    expect(sourceResult.displacement).toBeGreaterThan(1);
    expect(implementationResult.displacement).toBeGreaterThan(1);
    const evidence = {
      behaviorId: behavior.id,
      mode: "temporal" as const,
      temporalSamples: implementationResult,
    };
    assertThemeBehaviorModeEvidenceRecord(fashionStoreBehaviorContract, evidence);
    recordThemeBehaviorEvidence(testInfo, evidence);
  } finally {
    await source.close();
  }
});

test("scroll-progress-visible scroll-fixed: behavior runner verifies monotonic progress and back-to-top on both sides", async ({
  browser,
  page,
}, testInfo) => {
  const source = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await Promise.all([prepare(source, "source"), prepare(page, "implementation")]);
    const indicatorBehavior = behaviorRow(fashionStoreBehaviorContract, "scroll-progress-indicator");
    const backToTopBehavior = behaviorRow(fashionStoreBehaviorContract, "back-to-top-control");
    const [sourceResult, implementationResult] = await Promise.all([
      runScrollBehavior({
        backToTopBehavior,
        indicatorBehavior,
        page: source,
        progressSelector: ".scroll-progress .scroll-point",
        side: "source",
      }),
      runScrollBehavior({
        backToTopBehavior,
        indicatorBehavior,
        page,
        progressSelector: ".scroll-progress .scroll-point",
        side: "implementation",
      }),
    ]);
    expect(sourceResult.returnedToTop).toBe(true);
    expect(implementationResult.returnedToTop).toBe(true);
    const indicatorEvidence = {
      behaviorId: indicatorBehavior.id,
      branches: [{ id: "desktop-progress", outcome: true, viewportId: "desktop" as const }],
      mode: "scroll-fixed" as const,
      scrollSamples: implementationResult.progressSamples,
    };
    const backToTopInteraction = {
      actionOutcome: sourceResult.returnedToTop && implementationResult.returnedToTop,
      behaviorId: backToTopBehavior.id,
      mode: "interaction" as const,
    };
    const backToTopScroll = {
      behaviorId: backToTopBehavior.id,
      mode: "scroll-fixed" as const,
      scrollSamples: implementationResult.progressSamples,
    };
    assertThemeBehaviorModeEvidenceRecord(fashionStoreBehaviorContract, indicatorEvidence);
    assertThemeBehaviorModeEvidenceRecord(fashionStoreBehaviorContract, backToTopInteraction);
    assertThemeBehaviorModeEvidenceRecord(fashionStoreBehaviorContract, backToTopScroll);
    recordThemeBehaviorEvidence(testInfo, indicatorEvidence, backToTopInteraction, backToTopScroll);
  } finally {
    await source.close();
  }
});
