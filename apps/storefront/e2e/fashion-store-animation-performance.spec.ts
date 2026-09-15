import { expect, test, type CDPSession, type Page, type TestInfo } from "@playwright/test";

import { pageActivityRunTaskDuration } from "./support/theme-motion-contract";

const CPU_THROTTLE_RATE = 4;
const TRACE_WINDOW_MS = 4_200;
const OFFSCREEN_WINDOW_MS = 10_200;
const OFFSCREEN_REPETITIONS = 3;
const VISIBLE_REPETITIONS = 3;
const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "toplevel",
].join(",");
const PAGE_ACTIVITY_EVENT_NAMES = new Set([
  "AnimationFrame",
  "EventDispatch",
  "FireAnimationFrame",
  "FunctionCall",
  "Layerize",
  "Layout",
  "Paint",
  "PrePaint",
  "RunPaintLifecyclePhase",
  "TimerFire",
  "UpdateLayoutTree",
]);
const thresholds = {
  frameIntervalMaxMs: 100,
  frameIntervalP95Ms: 50,
  layerizeMedianMs: 250,
  paintLifecycleMedianMs: 250,
  runTaskMedianMs: 1_200,
} as const;

type TraceEvent = {
  args?: { name?: string };
  dur?: number;
  name?: string;
  ph?: string;
  pid?: number;
  ts?: number;
  tid?: number;
};
type TraceMetrics = {
  layerizeMs: number;
  paintLifecycleMs: number;
  rawRunTaskMs?: number;
  runTaskMs: number;
};
type FrameMetrics = { count: number; maxMs: number; p95Ms: number };
type WindowMetrics = TraceMetrics & { frames: FrameMetrics };
type OwnerState = {
  animationTimeMs: number | null;
  index: string | null;
  phase: string | null;
  progressEvidence: string | null;
};
type DocumentAnimationState = {
  animationName: string;
  currentTimeMs: number | null;
  playState: AnimationPlayState;
  target: string;
};
type OffscreenMeasurement = {
  animationsAfter: DocumentAnimationState[];
  animationsBefore: DocumentAnimationState[];
  after: Record<string, OwnerState>;
  before: Record<string, OwnerState>;
  metrics: WindowMetrics;
  ownersFullyOffscreen: boolean;
  reducedMotion: boolean;
};
type OffscreenReport = OffscreenMeasurement & { samples: OffscreenMeasurement[] };

declare global {
  interface Window {
    __fashionMotionFrames?: {
      active: boolean;
      intervals: number[];
      last: number | null;
      pause(): void;
      reset(): void;
      resume(): void;
    };
  }
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) throw new Error("Missing requestAnimationFrame interval metrics.");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((percentileValue / 100) * sorted.length) - 1]!;
}

function median(values: number[]): number {
  if (values.length === 0) throw new Error("Cannot aggregate an empty measurement set.");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function traceDuration(
  events: TraceEvent[],
  names: readonly string[],
  thread: Pick<TraceEvent, "pid" | "tid">,
): number {
  return (
    events
      .filter(
        (event) =>
          event.ph === "X" &&
          event.pid === thread.pid &&
          event.tid === thread.tid &&
          names.includes(event.name ?? ""),
      )
      .reduce((total, event) => total + (event.dur ?? 0), 0) / 1_000
  );
}

async function captureTrace(
  session: CDPSession,
  page: Page,
  durationMs: number,
  trigger?: () => Promise<void>,
  requireActivityMetrics = true,
  captureFrames = true,
): Promise<WindowMetrics> {
  const events: TraceEvent[] = [];
  const completed = new Promise<void>((resolve) =>
    session.once("Tracing.tracingComplete", resolve),
  );
  const collect = ({ value }: { value: unknown[] }) => events.push(...(value as TraceEvent[]));
  session.on("Tracing.dataCollected", collect);
  if (!captureFrames) {
    // Keep the control call itself outside the idle trace. Otherwise the
    // page.evaluate used to pause the probe becomes the dominant RunTask.
    await page.evaluate(() => {
      window.__fashionMotionFrames?.pause();
      window.__fashionMotionFrames?.reset();
    });
  }
  await session.send("Tracing.start", {
    categories: TRACE_CATEGORIES,
    options: "record-as-much-as-possible",
    transferMode: "ReportEvents",
  });
  // Tracing.start can itself stall the renderer. Reset after it resolves so
  // the frame budget covers only the requested motion window.
  if (captureFrames) {
    await page.evaluate(() => {
      window.__fashionMotionFrames?.resume();
      window.__fashionMotionFrames?.reset();
    });
  }
  await trigger?.();
  await page.waitForTimeout(durationMs);
  await session.send("Tracing.end");
  await completed;
  session.off("Tracing.dataCollected", collect);

  const intervals = await page.evaluate(() => window.__fashionMotionFrames?.intervals ?? []);
  const mainThread = events.find(
    (event) =>
      event.ph === "M" && event.name === "thread_name" && event.args?.name === "CrRendererMain",
  );
  if (mainThread?.pid === undefined || mainThread.tid === undefined)
    throw new Error("Missing Chromium renderer-main trace metadata.");
  const rawRunTaskMs = traceDuration(events, ["RunTask"], mainThread);
  const metrics: WindowMetrics = {
    frames: {
      count: intervals.length,
      maxMs: captureFrames ? Math.max(...intervals) : 0,
      p95Ms: captureFrames ? percentile(intervals, 95) : 0,
    },
    layerizeMs: traceDuration(events, ["Layerize"], mainThread),
    // Chromium 140+ reports the paint lifecycle as PrePaint, while older
    // revisions exposed the equivalent RunPaintLifecyclePhase event.
    paintLifecycleMs: traceDuration(events, ["RunPaintLifecyclePhase", "PrePaint"], mainThread),
    ...(captureFrames ? {} : { rawRunTaskMs }),
    runTaskMs: captureFrames
      ? rawRunTaskMs
      : pageActivityRunTaskDuration(events, mainThread, PAGE_ACTIVITY_EVENT_NAMES),
  };
  if (requireActivityMetrics && (metrics.paintLifecycleMs <= 0 || metrics.runTaskMs <= 0)) {
    const paintEventNames = [
      ...new Set(
        events
          .map((event) => event.name)
          .filter((name): name is string => Boolean(name && /paint/i.test(name))),
      ),
    ].sort();
    throw new Error(
      `Missing required CDP trace metrics: ${JSON.stringify(metrics)}; paint events: ${JSON.stringify(paintEventNames)}`,
    );
  }
  return metrics;
}

async function installFrameProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      active: true,
      intervals: [] as number[],
      last: null as number | null,
      pause() {
        this.active = false;
        this.last = null;
      },
      reset() {
        this.intervals = [];
        this.last = null;
      },
      resume() {
        if (this.active) return;
        this.active = true;
        requestAnimationFrame(sample);
      },
    };
    window.__fashionMotionFrames = state;
    const sample = (time: number) => {
      if (!state.active) return;
      if (state.last !== null) state.intervals.push(time - state.last);
      state.last = time;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function expectOperationalHome(page: Page): Promise<void> {
  await expect(page.locator("#fashion-store-decor-hero")).toHaveAttribute(
    "data-runtime-status",
    "operational",
  );
  await expect(page.locator('[data-decor-region="collection-carousel"] .swiper')).toHaveAttribute(
    "data-motion-ready",
    "true",
  );
}

async function settleVisualAssets(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function warmHome(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await expectOperationalHome(page);
  await page.reload({ waitUntil: "networkidle" });
  await expectOperationalHome(page);
  await settleVisualAssets(page);
}

async function resetAndTriggerHero(page: Page): Promise<void> {
  const hero = page.locator("#fashion-store-decor-hero");
  await hero.scrollIntoViewIfNeeded();
  await hero.evaluate((element) => {
    const swiper = (
      element as HTMLElement & {
        swiper?: {
          autoplay?: { stop(): void };
          slideTo(index: number, speed: number, callbacks: boolean): void;
        };
      }
    ).swiper;
    if (!swiper) throw new Error("Hero Swiper is unavailable.");
    swiper.autoplay?.stop();
    swiper.slideTo(0, 0, false);
  });
  await expect(hero).toHaveAttribute("data-motion-active-index", "0");
  await expect(hero).toHaveAttribute("data-motion-phase", "idle");
  await hero.locator("[data-hero-layer='next']").first().click();
  await expect(hero).toHaveAttribute("data-motion-active-index", "1");
}

const ownerSelectors = {
  collection: '[data-decor-region="collection-carousel"] .swiper',
  fashionMarquee: '[data-home-section="marquee"] [data-fashion-store-marquee]',
  hero: "#fashion-store-decor-hero",
  promotionalMarquee: '[data-decor-region="promotional-marquee"] .swiper-wrapper',
  clientMarquee: '[data-decor-region="client-marquee"] .swiper-wrapper',
} as const;

async function ownerStates(page: Page): Promise<Record<string, OwnerState>> {
  return page.evaluate((selectors) => {
    const inspect = (selector: string): OwnerState => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing motion owner: ${selector}`);
      const animation = element.getAnimations()[0];
      const layers = [...element.querySelectorAll<HTMLElement>("[data-hero-layer]")];
      return {
        animationTimeMs: typeof animation?.currentTime === "number" ? animation.currentTime : null,
        index: element.dataset.motionActiveIndex ?? element.dataset.activeSlide ?? null,
        phase: element.dataset.motionPhase ?? element.dataset.actionPhase ?? null,
        progressEvidence:
          layers.length === 0
            ? null
            : JSON.stringify(
                layers.map((layer) => ({
                  filter: getComputedStyle(layer).filter,
                  opacity: getComputedStyle(layer).opacity,
                  transform: getComputedStyle(layer).transform,
                })),
              ),
      };
    };
    return Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => [name, inspect(selector)]),
    );
  }, ownerSelectors);
}

async function documentAnimationStates(page: Page): Promise<DocumentAnimationState[]> {
  return page.evaluate(() =>
    document.getAnimations({ subtree: true }).map((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      const element = target instanceof Element ? target : undefined;
      return {
        animationName: element ? getComputedStyle(element).animationName : "",
        currentTimeMs: typeof animation.currentTime === "number" ? animation.currentTime : null,
        playState: animation.playState,
        target: element
          ? [element.tagName.toLowerCase(), element.id && `#${element.id}`, ...element.classList]
              .filter(Boolean)
              .join(".")
          : "unknown",
      };
    }),
  );
}

async function measureOffscreenIdle(
  session: CDPSession,
  page: Page,
  reducedMotion: boolean,
): Promise<OffscreenMeasurement> {
  await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  await expectOperationalHome(page);
  await page.evaluate(() => {
    if (!document.querySelector("[data-motion-performance-spacer]")) {
      const spacer = document.createElement("div");
      spacer.dataset.motionPerformanceSpacer = "true";
      spacer.style.height = `${window.innerHeight * 2}px`;
      document.body.append(spacer);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(250);
  await settleVisualAssets(page);
  await page.waitForFunction(
    () =>
      document.getAnimations({ subtree: true }).every(({ playState }) => playState !== "running"),
    undefined,
    { timeout: 3_000 },
  );
  // Give compositor cleanup and idle callbacks a fixed grace period before
  // comparing normal motion with the reduced-motion idle control.
  await page.waitForTimeout(2_000);
  const ownersFullyOffscreen = await page.evaluate(
    (selectors) =>
      Object.values(selectors).every((selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing motion owner: ${selector}`);
        const rectangle = element.getBoundingClientRect();
        return rectangle.bottom <= 0 || rectangle.top >= window.innerHeight;
      }),
    ownerSelectors,
  );
  if (!ownersFullyOffscreen)
    throw new Error("The offscreen window includes a visible motion owner.");
  const before = await ownerStates(page);
  const animationsBefore = await documentAnimationStates(page);
  const metrics = await captureTrace(session, page, OFFSCREEN_WINDOW_MS, undefined, false, false);
  const after = await ownerStates(page);
  const animationsAfter = await documentAnimationStates(page);
  return {
    after,
    animationsAfter,
    animationsBefore,
    before,
    metrics,
    ownersFullyOffscreen,
    reducedMotion,
  };
}

function aggregateOffscreenMeasurements(samples: OffscreenMeasurement[]): OffscreenReport {
  if (samples.length !== OFFSCREEN_REPETITIONS)
    throw new Error(
      `Expected ${OFFSCREEN_REPETITIONS} offscreen samples, received ${samples.length}.`,
    );
  const first = samples[0]!;
  const last = samples.at(-1)!;
  return {
    ...first,
    after: last.after,
    animationsAfter: last.animationsAfter,
    metrics: {
      frames: {
        count: median(samples.map(({ metrics }) => metrics.frames.count)),
        maxMs: median(samples.map(({ metrics }) => metrics.frames.maxMs)),
        p95Ms: median(samples.map(({ metrics }) => metrics.frames.p95Ms)),
      },
      layerizeMs: median(samples.map(({ metrics }) => metrics.layerizeMs)),
      paintLifecycleMs: median(samples.map(({ metrics }) => metrics.paintLifecycleMs)),
      rawRunTaskMs: median(samples.map(({ metrics }) => metrics.rawRunTaskMs ?? 0)),
      runTaskMs: median(samples.map(({ metrics }) => metrics.runTaskMs)),
    },
    ownersFullyOffscreen: samples.every(({ ownersFullyOffscreen }) => ownersFullyOffscreen),
    samples,
  };
}

function assertCompleteReport(report: {
  environment: Record<string, unknown>;
  offscreen: OffscreenReport;
  reducedIdle: OffscreenReport;
  visibleRuns: WindowMetrics[];
}): void {
  expect(report.environment.browserName).toBe("chromium");
  expect(report.environment.cpuRate).toBe(CPU_THROTTLE_RATE);
  expect(report.visibleRuns).toHaveLength(VISIBLE_REPETITIONS);
  for (const run of report.visibleRuns) {
    expect(Number.isFinite(run.paintLifecycleMs) && run.paintLifecycleMs > 0).toBe(true);
    expect(Number.isFinite(run.layerizeMs) && run.layerizeMs > 0).toBe(true);
    expect(Number.isFinite(run.runTaskMs) && run.runTaskMs > 0).toBe(true);
    expect(run.frames.count).toBeGreaterThan(0);
  }
  expect(report.offscreen.ownersFullyOffscreen).toBe(true);
  expect(report.reducedIdle.ownersFullyOffscreen).toBe(true);
  expect(report.offscreen.samples).toHaveLength(OFFSCREEN_REPETITIONS);
  expect(report.reducedIdle.samples).toHaveLength(OFFSCREEN_REPETITIONS);
  for (const sample of [...report.offscreen.samples, ...report.reducedIdle.samples]) {
    expect(sample.ownersFullyOffscreen).toBe(true);
    expect(sample.animationsBefore).toEqual([]);
    expect(sample.animationsAfter).toEqual([]);
  }
}

function assertMotionBudgets(report: {
  medians: TraceMetrics;
  offscreen: OffscreenReport;
  reducedIdle: OffscreenReport;
  visibleRuns: WindowMetrics[];
}): void {
  const failures: string[] = [];
  for (const [index, run] of report.visibleRuns.entries()) {
    if (run.frames.p95Ms > thresholds.frameIntervalP95Ms)
      failures.push(`run ${index + 1} rAF p95 ${run.frames.p95Ms}ms > 50ms`);
    if (run.frames.maxMs > thresholds.frameIntervalMaxMs)
      failures.push(`run ${index + 1} rAF max ${run.frames.maxMs}ms > 100ms`);
  }
  if (report.medians.paintLifecycleMs > thresholds.paintLifecycleMedianMs)
    failures.push(`median Paint Lifecycle ${report.medians.paintLifecycleMs}ms > 250ms`);
  if (report.medians.layerizeMs > thresholds.layerizeMedianMs)
    failures.push(`median Layerize ${report.medians.layerizeMs}ms > 250ms`);
  if (report.medians.runTaskMs > thresholds.runTaskMedianMs)
    failures.push(`median RunTask ${report.medians.runTaskMs}ms > 1200ms`);

  for (const metric of ["paintLifecycleMs", "layerizeMs", "runTaskMs"] as const) {
    const allowed = report.reducedIdle.metrics[metric] * 1.2;
    if (report.offscreen.metrics[metric] > allowed)
      failures.push(
        `offscreen ${metric} ${report.offscreen.metrics[metric]}ms > reduced idle ${allowed}ms`,
      );
  }
  for (const [sampleIndex, sample] of report.offscreen.samples.entries()) {
    for (const name of Object.keys(sample.before)) {
      const before = sample.before[name]!;
      const after = sample.after[name]!;
      const label = `${name} offscreen sample ${sampleIndex + 1}`;
      if (before.index !== after.index) failures.push(`${label} semantic index advanced`);
      if (before.phase !== after.phase) failures.push(`${label} motion phase advanced`);
      if (before.progressEvidence !== after.progressEvidence)
        failures.push(`${label} Hero timeline progress changed`);
      if (before.animationTimeMs !== after.animationTimeMs)
        failures.push(`${label} CSS animation time advanced`);
    }
  }
  expect(failures, `FS-F6 motion budget failures:\n${failures.join("\n")}`).toEqual([]);
}

test("meets visible Hero and offscreen owner motion budgets", async ({
  browserName,
  page,
}, testInfo: TestInfo) => {
  const metadata = testInfo.project.metadata as Record<string, unknown>;
  const expectedViewport = { height: Number(metadata.height), width: Number(metadata.width) };
  const expectedProfile =
    testInfo.project.name === "motion-desktop-1440-dpr2"
      ? { deviceScaleFactor: 2, height: 900, motionProfile: "desktop", width: 1_440 }
      : testInfo.project.name === "motion-mobile-390-dpr3"
        ? { deviceScaleFactor: 3, height: 844, motionProfile: "mobile", width: 390 }
        : undefined;
  if (browserName !== "chromium")
    throw new Error(`Motion performance requires Chromium, received ${browserName}.`);
  if (!expectedProfile) throw new Error(`Unsupported motion profile: ${testInfo.project.name}.`);
  expect(metadata).toMatchObject({ ...expectedProfile, cpuRate: CPU_THROTTLE_RATE });
  expect(page.viewportSize()).toEqual(expectedViewport);
  await installFrameProbe(page);
  await warmHome(page);
  const environment = await page.evaluate(() => ({
    deviceScaleFactor: window.devicePixelRatio,
    height: window.innerHeight,
    userAgent: navigator.userAgent,
    width: window.innerWidth,
  }));
  expect(environment.deviceScaleFactor).toBe(metadata.deviceScaleFactor);
  expect(environment.width).toBe(expectedViewport.width);
  expect(environment.height).toBe(expectedViewport.height);

  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE_RATE });
  const visibleRuns: WindowMetrics[] = [];
  try {
    // The fixed contract calls for warmed transitions, not merely warmed
    // navigations. Keep startup/JIT work out of all three scored windows.
    await resetAndTriggerHero(page);
    await expect(page.locator("#fashion-store-decor-hero")).toHaveAttribute(
      "data-motion-phase",
      "idle",
      { timeout: 5_000 },
    );
    for (let repetition = 0; repetition < VISIBLE_REPETITIONS; repetition += 1) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expectOperationalHome(page);
      await settleVisualAssets(page);
      visibleRuns.push(
        await captureTrace(session, page, TRACE_WINDOW_MS, () => resetAndTriggerHero(page)),
      );
    }
    // Use the same warmed document for both controls so reload, cache, and
    // runtime-startup work cannot masquerade as offscreen animation cost.
    const offscreenSamples: OffscreenMeasurement[] = [];
    const reducedIdleSamples: OffscreenMeasurement[] = [];
    // Alternate the two controls so slow browser housekeeping cannot be
    // attributed systematically to whichever mode happens to run first.
    for (let repetition = 0; repetition < OFFSCREEN_REPETITIONS; repetition += 1) {
      offscreenSamples.push(await measureOffscreenIdle(session, page, false));
      reducedIdleSamples.push(await measureOffscreenIdle(session, page, true));
    }
    const offscreen = aggregateOffscreenMeasurements(offscreenSamples);
    const reducedIdle = aggregateOffscreenMeasurements(reducedIdleSamples);
    const medians = {
      layerizeMs: median(visibleRuns.map(({ layerizeMs }) => layerizeMs)),
      paintLifecycleMs: median(visibleRuns.map(({ paintLifecycleMs }) => paintLifecycleMs)),
      runTaskMs: median(visibleRuns.map(({ runTaskMs }) => runTaskMs)),
    };
    const report = {
      environment: {
        ...environment,
        browserName,
        chromiumVersion: await page.context().browser()?.version(),
        cpuRate: CPU_THROTTLE_RATE,
        profile: metadata.motionProfile,
        warmedNavigations: 2,
        warmedTransitions: 1,
      },
      medians,
      offscreen,
      reducedIdle,
      thresholds,
      traceWindowMs: TRACE_WINDOW_MS,
      visibleRuns,
    };
    console.log(
      `FS-F6 motion summary ${testInfo.project.name}: ${JSON.stringify({
        medians,
        offscreen: offscreen.metrics,
        reducedIdle: reducedIdle.metrics,
        visibleRuns,
      })}`,
    );
    await testInfo.attach(`fs-f6-motion-${testInfo.project.name}.json`, {
      body: Buffer.from(JSON.stringify(report, null, 2)),
      contentType: "application/json",
    });
    assertCompleteReport(report);
    assertMotionBudgets(report);
  } finally {
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => undefined);
    await session.detach();
  }
});
