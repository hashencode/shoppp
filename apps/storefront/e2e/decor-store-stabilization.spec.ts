import { writeFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

interface DecorRuntimeCounters {
  activeDecorAnimationFrames: number;
  activeDecorIntervals: number;
  activeDecorTimeoutSites: string[];
  activeDecorTimeouts: number;
  hiddenCallbacks: number;
  hiddenDomMutations: number;
  longTasks: { duration: number; startTime: number }[];
  phase: "active" | "hidden" | "teardown";
  postTeardownCallbacks: number;
  postTeardownDomMutations: number;
}

interface ResourceMeasurement {
  bytes: number;
  resourceType: string;
  url: string;
}

async function installRuntimeCounters(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters };
    const counters: DecorRuntimeCounters = {
      activeDecorAnimationFrames: 0,
      activeDecorIntervals: 0,
      activeDecorTimeoutSites: [],
      activeDecorTimeouts: 0,
      hiddenCallbacks: 0,
      hiddenDomMutations: 0,
      longTasks: [],
      phase: "active",
      postTeardownCallbacks: 0,
      postTeardownDomMutations: 0,
    };
    target.__decorRuntimeCounters = counters;
    const decorAnimationFrames = new Set<number>();
    const decorIntervals = new Set<number>();
    const decorTimeouts = new Set<number>();
    const decorTimeoutSites = new Map<number, string>();
    const refreshHandleCounts = () => {
      counters.activeDecorAnimationFrames = decorAnimationFrames.size;
      counters.activeDecorIntervals = decorIntervals.size;
      counters.activeDecorTimeouts = decorTimeouts.size;
      counters.activeDecorTimeoutSites = [...decorTimeoutSites.values()];
    };
    const decorRuntimeIsMounted = () =>
      Boolean(document.querySelector("[data-decor-store-source-parity]"));

    const countCallback = () => {
      if (counters.phase === "hidden") counters.hiddenCallbacks += 1;
      if (counters.phase === "teardown") counters.postTeardownCallbacks += 1;
    };
    const wrap =
      <Arguments extends unknown[]>(callback: (...arguments_: Arguments) => void) =>
      (...arguments_: Arguments) => {
        countCallback();
        callback(...arguments_);
      };
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      let handle = 0;
      handle = nativeRequestAnimationFrame((timestamp) => {
        decorAnimationFrames.delete(handle);
        refreshHandleCounts();
        wrap(callback)(timestamp);
      });
      if (decorRuntimeIsMounted()) decorAnimationFrames.add(handle);
      refreshHandleCounts();
      return handle;
    };
    window.cancelAnimationFrame = (handle) => {
      decorAnimationFrames.delete(handle);
      refreshHandleCounts();
      nativeCancelAnimationFrame(handle);
    };
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    window.setTimeout = ((callback: TimerHandler, timeout?: number, ...arguments_: unknown[]) => {
      let handle = 0;
      const countedCallback =
        typeof callback === "function"
          ? (...values: unknown[]) => {
              decorTimeouts.delete(handle);
              decorTimeoutSites.delete(handle);
              refreshHandleCounts();
              wrap(callback as (...items: unknown[]) => void)(...values);
            }
          : callback;
      handle = nativeSetTimeout(countedCallback, timeout, ...arguments_);
      if (decorRuntimeIsMounted()) {
        decorTimeouts.add(handle);
        decorTimeoutSites.set(handle, new Error("Decor-phase timeout").stack || "unknown");
      }
      refreshHandleCounts();
      return handle;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) decorTimeouts.delete(handle);
      if (handle !== undefined) decorTimeoutSites.delete(handle);
      refreshHandleCounts();
      nativeClearTimeout(handle);
    }) as typeof window.clearTimeout;
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    window.setInterval = ((callback: TimerHandler, timeout?: number, ...arguments_: unknown[]) => {
      const handle = nativeSetInterval(
        typeof callback === "function"
          ? wrap(callback as (...values: unknown[]) => void)
          : callback,
        timeout,
        ...arguments_,
      );
      if (decorRuntimeIsMounted()) decorIntervals.add(handle);
      refreshHandleCounts();
      return handle;
    }) as typeof window.setInterval;
    window.clearInterval = ((handle?: number) => {
      if (handle !== undefined) decorIntervals.delete(handle);
      refreshHandleCounts();
      nativeClearInterval(handle);
    }) as typeof window.clearInterval;

    new MutationObserver((records) => {
      if (counters.phase === "hidden") counters.hiddenDomMutations += records.length;
      if (counters.phase === "teardown") counters.postTeardownDomMutations += records.length;
    }).observe(document, { attributes: true, childList: true, subtree: true });

    try {
      new PerformanceObserver((list) => {
        counters.longTasks.push(
          ...list.getEntries().map(({ duration, startTime }) => ({ duration, startTime })),
        );
      }).observe({ buffered: true, type: "longtask" });
    } catch {
      // Some browser builds do not expose the optional long-task entry type.
    }
  });
}

function sumBytes(resources: readonly ResourceMeasurement[], predicate: (url: URL) => boolean) {
  return resources
    .filter(({ url }) => predicate(new URL(url)))
    .reduce((total, { bytes }) => total + bytes, 0);
}

test("motion-enabled cold navigation records bounded runtime and teardown evidence", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-store-desktop");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installRuntimeCounters(page);

  const resources: ResourceMeasurement[] = [];
  page.on("response", async (response) => {
    if (!response.ok()) return;
    const request = response.request();
    try {
      resources.push({
        bytes: (await response.body()).byteLength,
        resourceType: request.resourceType(),
        url: response.url(),
      });
    } catch {
      // Navigation can dispose an in-flight response before Playwright reads its body.
    }
  });

  const coldStarted = performance.now();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-decor-store-source-parity]");
  await expect(root).toHaveAttribute("data-runtime-status", "ready", { timeout: 15_000 });
  const heroReadyMs = performance.now() - coldStarted;

  const hero = page.locator("#decor-store-slider");
  await hero.press("ArrowRight");
  await expect(hero).toHaveAttribute("data-decor-hero-transition", "moving");
  await expect(hero).toHaveAttribute("data-decor-hero-transition", "settled", {
    timeout: 5_000,
  });
  await expect(hero).toHaveAttribute("data-decor-hero-active-slide", "rs-72");
  await page.waitForTimeout(2_800);

  await page.evaluate(() => {
    const target = window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters };
    if (target.__decorRuntimeCounters) target.__decorRuntimeCounters.phase = "hidden";
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(hero).toHaveAttribute("data-decor-hero-page-hidden", "true");
  for (const key of ["promotional-marquee", "collection-carousel", "client-marquee"]) {
    await expect(page.locator(`[data-decor-region='${key}']`)).toHaveAttribute(
      "data-motion-paused",
      "true",
    );
  }
  await page.evaluate(() => {
    const counters = (window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters })
      .__decorRuntimeCounters!;
    counters.hiddenCallbacks = 0;
    counters.hiddenDomMutations = 0;
  });
  await page.waitForTimeout(750);
  const hidden = await page.evaluate(() => {
    const counters = (window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters })
      .__decorRuntimeCounters!;
    return {
      callbacks: counters.hiddenCallbacks,
      mutations: counters.hiddenDomMutations,
    };
  });

  await page.evaluate(() => {
    const target = window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters };
    target.__decorRuntimeCounters!.phase = "active";
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    const appRoot = document.querySelector("#__nuxt") as
      (HTMLElement & { __vue_app__?: { unmount(): void } }) | null;
    appRoot?.__vue_app__?.unmount();
  });
  await expect(
    page.locator("[data-decor-store-source-parity], .revslider-initialised"),
  ).toHaveCount(0);
  await page.evaluate(async () => {
    const counters = (window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters })
      .__decorRuntimeCounters!;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    counters.phase = "teardown";
    counters.postTeardownCallbacks = 0;
    counters.postTeardownDomMutations = 0;
  });
  await page.evaluate(() => {
    dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(750);
  const teardown = await page.evaluate(() => {
    const counters = (window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters })
      .__decorRuntimeCounters!;
    return {
      activeHandles: {
        animationFrames: counters.activeDecorAnimationFrames,
        intervals: counters.activeDecorIntervals,
        timeoutSites: counters.activeDecorTimeoutSites,
        timeouts: counters.activeDecorTimeouts,
      },
      callbacks: counters.postTeardownCallbacks,
      longTasks: counters.longTasks,
      mutations: counters.postTeardownDomMutations,
    };
  });
  const coldResources = [...resources];

  const repeatStarted = performance.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-decor-store-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    "ready",
    { timeout: 15_000 },
  );
  const repeatReadyMs = performance.now() - repeatStarted;
  await expect(page.locator(".revslider-initialised")).toHaveCount(1);
  await page.evaluate(() => {
    const counters = (window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters })
      .__decorRuntimeCounters!;
    counters.phase = "active";
    const appRoot = document.querySelector("#__nuxt") as
      (HTMLElement & { __vue_app__?: { unmount(): void } }) | null;
    appRoot?.__vue_app__?.unmount();
  });
  await expect(
    page.locator("[data-decor-store-source-parity], .revslider-initialised"),
  ).toHaveCount(0);
  await page.evaluate(async () => {
    const counters = (window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters })
      .__decorRuntimeCounters!;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    counters.phase = "teardown";
    counters.postTeardownCallbacks = 0;
    counters.postTeardownDomMutations = 0;
    dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(750);
  const repeatTeardown = await page.evaluate(() => {
    const counters = (window as typeof window & { __decorRuntimeCounters?: DecorRuntimeCounters })
      .__decorRuntimeCounters!;
    return {
      activeHandles: {
        animationFrames: counters.activeDecorAnimationFrames,
        intervals: counters.activeDecorIntervals,
        timeoutSites: counters.activeDecorTimeoutSites,
        timeouts: counters.activeDecorTimeouts,
      },
      callbacks: counters.postTeardownCallbacks,
      mutations: counters.postTeardownDomMutations,
    };
  });
  const initialResources = coldResources.filter(({ url }) => new URL(url).pathname !== "/");
  const metrics = {
    cssBytes: sumBytes(initialResources, (url) => url.pathname.endsWith(".css")),
    decorVendorJavaScriptBytes: sumBytes(initialResources, (url) =>
      url.pathname.startsWith("/theme-preview-generated/decor-store/"),
    ),
    fontBytes: sumBytes(initialResources, (url) => /\.(?:eot|ttf|woff2?)$/i.test(url.pathname)),
    heroReadyMs: Math.round(heroReadyMs),
    hidden,
    imageBytes: sumBytes(initialResources, (url) =>
      /\.(?:gif|jpe?g|png|webp)$/i.test(url.pathname),
    ),
    initialApplicationJavaScriptBytes: sumBytes(
      initialResources,
      (url) => url.pathname.startsWith("/_nuxt/") && url.pathname.endsWith(".js"),
    ),
    longTaskCount: teardown.longTasks.length,
    longTaskTotalMs: Math.round(
      teardown.longTasks.reduce((total, { duration }) => total + duration, 0),
    ),
    repeatReadyMs: Math.round(repeatReadyMs),
    repeatTeardown,
    requestCount: initialResources.length,
    teardown,
  };
  const metricsPath = testInfo.outputPath("decor-store-motion-runtime-profile.json");
  await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  await testInfo.attach("motion-runtime-profile", {
    contentType: "application/json",
    path: metricsPath,
  });

  expect(metrics.initialApplicationJavaScriptBytes).toBeGreaterThan(0);
  expect(metrics.decorVendorJavaScriptBytes).toBeGreaterThan(0);
  expect(metrics.cssBytes).toBeGreaterThan(0);
  expect(metrics.fontBytes).toBeGreaterThan(0);
  expect(metrics.imageBytes).toBeGreaterThan(0);
  expect(metrics.heroReadyMs).toBeLessThan(15_000);
  expect(hidden.mutations).toBe(0);
  expect(teardown.callbacks).toBeLessThanOrEqual(64);
  expect(teardown.mutations).toBe(0);
  expect(teardown.activeHandles.animationFrames).toBe(0);
  expect(teardown.activeHandles.intervals).toBe(0);
  expect(teardown.activeHandles.timeouts).toBeLessThanOrEqual(2);
  expect(repeatTeardown.mutations).toBe(0);
  expect(repeatTeardown.activeHandles.animationFrames).toBe(0);
  expect(repeatTeardown.activeHandles.intervals).toBe(0);
  expect(repeatTeardown.activeHandles.timeouts).toBeLessThanOrEqual(
    teardown.activeHandles.timeouts,
  );
  expect(repeatTeardown.callbacks).toBeLessThanOrEqual(64);
});

test("Decor Store has no serious structural accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-decor-store-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    "ready",
    { timeout: 15_000 },
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .disableRules(["color-contrast"])
    .analyze();
  expect(
    result.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
  ).toEqual([]);
});
