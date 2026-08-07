import type { Page } from "@playwright/test";

export interface SearchBehaviorDiagnostics {
  dismissed: boolean;
  focusAfterDismissal: "input" | "other" | "trigger";
  focusWhileOpen: "input" | "other" | "trigger";
  opened: boolean;
  urlChanged: boolean;
}

export interface CollectionBehaviorDiagnostics {
  activeStateAfter: string;
  activeStateBefore: string;
  cardWidthRatio: number;
  elapsedMs: number;
  movementDisplacement: number;
  moved: boolean;
  visibleCardCount: number;
}

export interface PreviewBehaviorDiagnostics {
  content: string;
  hiddenAfterExit: boolean;
  visibleAfterTrigger: boolean;
}

export interface ContinuousMovementDiagnostics {
  after: number;
  before: number;
  displacement: number;
  elapsedMs: number;
}

export interface ScrollBehaviorDiagnostics {
  fixedXDelta: number;
  progressSamples: number[];
  returnedToTop: boolean;
  urlChanged: boolean;
}

export interface CursorBehaviorDiagnostics {
  cursor: string;
  visible: boolean;
}

export async function probeNativeCursorVisibility(
  page: Page,
  selector: string,
): Promise<CursorBehaviorDiagnostics> {
  const target = page.locator(selector).first();
  await target.waitFor({ state: "visible" });
  const cursor = await target.evaluate((element) => getComputedStyle(element).cursor);
  if (cursor === "none") throw new Error(`Native cursor is hidden over ${selector}.`);
  return { cursor, visible: true };
}

export async function probeRequiredVisibleElement(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  if (!(await target.isVisible())) throw new Error(`Required element is not visible: ${selector}.`);
}

export async function assertVisibleCopyAbsent(page: Page, text: string): Promise<void> {
  if (await page.getByText(text, { exact: true }).isVisible())
    throw new Error(`Implementation-only visible copy detected: "${text}".`);
}

export function assertMonotonicProgress(samples: readonly number[]): void {
  if (samples.length < 2) throw new Error("Scroll progress requires at least two samples.");
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index]! + 0.5 < samples[index - 1]!)
      throw new Error(`Scroll progress regressed from ${samples[index - 1]} to ${samples[index]}.`);
  }
  if (samples.at(-1)! <= samples[0]!)
    throw new Error(`Scroll progress did not increase: ${samples.join(" -> ")}.`);
}

export function assertObservableDisplacement(
  before: number,
  after: number,
  minimumDisplacement = 1,
): number {
  const displacement = Math.abs(after - before);
  if (!Number.isFinite(displacement) || displacement < minimumDisplacement)
    throw new Error(
      `Timed surface displacement was ${displacement}px; expected at least ${minimumDisplacement}px.`,
    );
  return displacement;
}

const focusedElement = async (
  page: Page,
  triggerSelector: string,
  inputSelector: string,
): Promise<"input" | "other" | "trigger"> =>
  page.evaluate(
    ({ input, trigger }) => {
      if (document.activeElement?.matches(input)) return "input";
      if (document.activeElement?.matches(trigger)) return "trigger";
      return "other";
    },
    { input: inputSelector, trigger: triggerSelector },
  );

export async function probeSearchOverlayOutcome(options: {
  expectedFocusWhileOpen: "input" | "trigger";
  inputSelector: string;
  page: Page;
  panelSelector: string;
  triggerSelector: string;
}): Promise<SearchBehaviorDiagnostics> {
  const { inputSelector, page, panelSelector, triggerSelector } = options;
  const originalUrl = page.url();
  await page.locator(triggerSelector).first().click();
  await page.locator(panelSelector).waitFor({ state: "visible" });
  const expectedFocusSelector =
    options.expectedFocusWhileOpen === "input" ? inputSelector : triggerSelector;
  await page
    .waitForFunction(
      (selector) => document.activeElement?.matches(selector),
      expectedFocusSelector,
      { timeout: 1_500 },
    )
    .catch(() => undefined);
  const focusWhileOpen = await focusedElement(page, triggerSelector, inputSelector);
  if (focusWhileOpen !== options.expectedFocusWhileOpen) {
    throw new Error(
      `Search opened with focus on ${focusWhileOpen}; expected ${options.expectedFocusWhileOpen}.`,
    );
  }
  await page.keyboard.press("Escape");
  await page.locator(panelSelector).waitFor({ state: "hidden" });
  const focusAfterDismissal = await focusedElement(page, triggerSelector, inputSelector);
  if (focusAfterDismissal !== "trigger") {
    throw new Error(`Search dismissal left focus on ${focusAfterDismissal}; expected the trigger.`);
  }
  const urlChanged = page.url() !== originalUrl;
  if (urlChanged)
    throw new Error(`Search activation navigated from ${originalUrl} to ${page.url()}.`);
  return {
    dismissed: true,
    focusAfterDismissal,
    focusWhileOpen,
    opened: true,
    urlChanged,
  };
}

async function collectionSnapshot(page: Page, carouselSelector: string) {
  return page
    .locator(carouselSelector)
    .first()
    .evaluate((carousel) => {
      const root = carousel as HTMLElement & {
        swiper?: { activeIndex?: number; realIndex?: number; translate?: number };
      };
      const rootRect = root.getBoundingClientRect();
      const slides = [...root.querySelectorAll<HTMLElement>(".swiper-slide")];
      const visibleSlides = slides.filter((slide) => {
        const rect = slide.getBoundingClientRect();
        const intersection = Math.max(
          0,
          Math.min(rect.right, rootRect.right) - Math.max(rect.left, rootRect.left),
        );
        return rect.width > 0 && intersection >= rect.width * 0.5;
      });
      const firstVisibleWidth = visibleSlides[0]?.getBoundingClientRect().width ?? 0;
      const declaredIndex = root.getAttribute("data-collection-index");
      const swiperState = root.swiper;
      const trackX = root.querySelector<HTMLElement>(".swiper-wrapper")?.getBoundingClientRect().x;
      return {
        activeState:
          declaredIndex ??
          String(
            swiperState?.realIndex ??
              swiperState?.activeIndex ??
              swiperState?.translate ??
              "missing",
          ),
        cardWidthRatio: rootRect.width > 0 ? firstVisibleWidth / rootRect.width : 0,
        trackX: trackX ?? Number.NaN,
        visibleCardCount: visibleSlides.length,
      };
    });
}

export async function probeCollectionCarouselOutcome(options: {
  advanceKey?: string;
  advanceSelector?: string;
  carouselSelector: string;
  maximumCardWidthRatio: number;
  minimumVisibleCards: number;
  page: Page;
  timeoutMs?: number;
}): Promise<CollectionBehaviorDiagnostics> {
  const { carouselSelector, page } = options;
  const carousel = page.locator(carouselSelector).first();
  await carousel.scrollIntoViewIfNeeded();
  await carousel.waitFor({ state: "visible" });
  const interactionRequested = Boolean(options.advanceSelector || options.advanceKey);
  if (interactionRequested) {
    await carousel.hover();
    await carousel.evaluate((element) => {
      const swiper = (element as HTMLElement & { swiper?: { autoplay?: { stop(): void } } }).swiper;
      swiper?.autoplay?.stop();
    });
  }
  const before = await collectionSnapshot(page, carouselSelector);
  if (before.visibleCardCount < options.minimumVisibleCards) {
    throw new Error(
      `Collection exposes ${before.visibleCardCount} visible card(s); expected at least ${options.minimumVisibleCards}.`,
    );
  }
  if (before.cardWidthRatio <= 0 || before.cardWidthRatio > options.maximumCardWidthRatio) {
    throw new Error(
      `Collection card width ratio is ${before.cardWidthRatio.toFixed(3)}; expected 0 < ratio <= ${options.maximumCardWidthRatio}.`,
    );
  }
  const timeoutMs = options.timeoutMs ?? (interactionRequested ? 2_500 : 6_500);
  const startedAt = performance.now();
  if (options.advanceSelector) await page.locator(options.advanceSelector).first().click();
  if (options.advanceKey) {
    await carousel.evaluate((element) => {
      const target = element as HTMLElement;
      if (target.tabIndex < 0) target.tabIndex = -1;
      target.focus();
    });
    await page.keyboard.press(options.advanceKey);
  }
  await page.waitForFunction(
    ({ initialState, initialTrackX, selector }) => {
      const root = document.querySelector(selector) as
        | (HTMLElement & {
            swiper?: { activeIndex?: number; realIndex?: number; translate?: number };
          })
        | null;
      if (!root) return false;
      const state =
        root.getAttribute("data-collection-index") ??
        String(
          root.swiper?.realIndex ?? root.swiper?.activeIndex ?? root.swiper?.translate ?? "missing",
        );
      const trackX = root.querySelector<HTMLElement>(".swiper-wrapper")?.getBoundingClientRect().x;
      return (
        state !== initialState &&
        typeof trackX === "number" &&
        Math.abs(trackX - initialTrackX) >= 1
      );
    },
    { initialState: before.activeState, initialTrackX: before.trackX, selector: carouselSelector },
    { timeout: timeoutMs },
  );
  const after = await collectionSnapshot(page, carouselSelector);
  if (after.activeState === before.activeState) {
    throw new Error(`Collection did not move within ${timeoutMs}ms.`);
  }
  const movementDisplacement = assertObservableDisplacement(before.trackX, after.trackX, 1);
  return {
    activeStateAfter: after.activeState,
    activeStateBefore: before.activeState,
    cardWidthRatio: before.cardWidthRatio,
    elapsedMs: performance.now() - startedAt,
    movementDisplacement,
    moved: true,
    visibleCardCount: before.visibleCardCount,
  };
}

export async function probePreviewCardOutcome(options: {
  contentPattern: RegExp;
  page: Page;
  panelSelector: string;
  triggerSelector: string;
}): Promise<PreviewBehaviorDiagnostics> {
  const trigger = options.page.locator(options.triggerSelector).first();
  const panel = options.page.locator(options.panelSelector).first();
  await trigger.hover();
  await panel.waitFor({ state: "visible" });
  const content = (await panel.textContent())?.replaceAll(/\s+/g, " ").trim() ?? "";
  if (!options.contentPattern.test(content))
    throw new Error(`Preview card content did not match ${options.contentPattern}: "${content}".`);
  const viewport = options.page.viewportSize();
  await options.page.mouse.move(0, Math.max(0, (viewport?.height ?? 1) - 1));
  await panel.waitFor({ state: "hidden" });
  return { content, hiddenAfterExit: true, visibleAfterTrigger: true };
}

export async function probeContinuousMovement(options: {
  minimumDisplacementPx?: number;
  page: Page;
  sampleIntervalMs?: number;
  trackSelector: string;
}): Promise<ContinuousMovementDiagnostics> {
  const track = options.page.locator(options.trackSelector).first();
  await track.waitFor({ state: "visible" });
  const position = () => track.evaluate((element) => element.getBoundingClientRect().left);
  const before = await position();
  const startedAt = performance.now();
  const minimum = options.minimumDisplacementPx ?? 1;
  await options.page.waitForFunction(
    ({ initial, minimum, selector }) => {
      const element = document.querySelector(selector);
      return element ? Math.abs(element.getBoundingClientRect().left - initial) >= minimum : false;
    },
    { initial: before, minimum, selector: options.trackSelector },
    { polling: 100, timeout: options.sampleIntervalMs ?? 2_500 },
  );
  const after = await position();
  return {
    after,
    before,
    displacement: assertObservableDisplacement(before, after, minimum),
    elapsedMs: performance.now() - startedAt,
  };
}

export async function probeScrollProgressAndReturn(options: {
  backToTopSelector: string;
  controlSelector: string;
  page: Page;
  progressSelector: string;
  scrollSamples?: readonly number[];
}): Promise<ScrollBehaviorDiagnostics> {
  const originalUrl = options.page.url();
  const control = options.page.locator(options.controlSelector).first();
  const samples: number[] = [];
  let firstX: number | undefined;
  let lastX: number | undefined;
  for (const scrollY of options.scrollSamples ?? [500, 1_500]) {
    await options.page.evaluate((top) => scrollTo(0, top), scrollY);
    await control.waitFor({ state: "visible" });
    await options.page.waitForTimeout(100);
    const [progress, box] = await Promise.all([
      options.page
        .locator(options.progressSelector)
        .first()
        .evaluate((element) => element.getBoundingClientRect().height),
      control.boundingBox(),
    ]);
    samples.push(progress);
    if (!box) throw new Error("Scroll progress control has no geometry.");
    firstX ??= box.x;
    lastX = box.x;
  }
  assertMonotonicProgress(samples);
  await options.page.locator(options.backToTopSelector).first().click();
  await options.page.waitForFunction(() => scrollY <= 1, undefined, { timeout: 3_000 });
  const urlChanged = options.page.url() !== originalUrl;
  if (urlChanged) throw new Error("Back-to-top control changed the route.");
  const fixedXDelta = Math.abs((lastX ?? 0) - (firstX ?? 0));
  if (fixedXDelta > 1) throw new Error(`Fixed control moved ${fixedXDelta}px horizontally.`);
  return { fixedXDelta, progressSamples: samples, returnedToTop: true, urlChanged };
}
