import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  compareMotionContractSnapshots,
  pageActivityRunTaskDuration,
  type MotionContractSnapshot,
} from "../e2e/support/theme-motion-contract";
import { fashionStoreMotionIntersectionVisible } from "../app/themes/fashion-store/composables/useFashionStoreMotionViewport";

function snapshot(): MotionContractSnapshot {
  return {
    activeIndex: 0,
    checkpoint: "midpoint",
    direction: "vertical",
    easing: "ease",
    layers: [
      {
        id: "background",
        opacity: 1,
        transform: "matrix(1, 0, 0, 1, 0, -250)",
        zIndex: 1,
      },
    ],
    pausedReasons: [],
    timing: { autoplayDelayMs: 4_000, delayMs: 0, durationMs: 1_000 },
  };
}

describe("motion contract comparison", () => {
  test("requires positive intersection before an automatic motion owner runs", () => {
    expect(
      fashionStoreMotionIntersectionVisible({ intersectionRatio: 0, isIntersecting: false }),
    ).toBe(false);
    expect(
      fashionStoreMotionIntersectionVisible({ intersectionRatio: 0, isIntersecting: true }),
    ).toBe(false);
    expect(
      fashionStoreMotionIntersectionVisible({ intersectionRatio: 0.001, isIntersecting: true }),
    ).toBe(true);
  });

  test("accepts numeric drift inside the contract tolerance", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    implementation.layers[0]!.opacity = 0.9998;

    expect(compareMotionContractSnapshots(reference, implementation)).toEqual([]);
  });

  test("keeps recovered Decor motion on one lifecycle owner with static fallbacks", async () => {
    const [component, integration] = await Promise.all([
      readFile(
        new URL(
          "../app/themes/fashion-store/components/home/FashionStoreDecorHomeBody.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../app/themes/fashion-store/integration.css", import.meta.url), "utf8"),
    ]);

    expect(component).toContain('import { Autoplay, EffectFade, Keyboard } from "swiper/modules"');
    expect(component).toContain('import { Swiper, SwiperSlide } from "swiper/vue"');
    expect(component).toContain(':autoplay="collectionAutoplay"');
    expect(component).toContain('effect="fade"');
    expect(component).toContain(':fade-effect="{ crossFade: true }"');
    expect(component).toContain(':speed="collectionSpeed"');
    expect(component).not.toContain("setInterval(");
    expect(component).not.toContain("v-show=");
    expect(component).toContain(
      'document.addEventListener("visibilitychange", updateDocumentMotion)',
    );
    expect(component).toContain(
      'document.removeEventListener("visibilitychange", updateDocumentMotion)',
    );
    expect(component).toContain(
      'reducedMotionQuery.addEventListener("change", updateDocumentMotion)',
    );
    expect(component).toContain(
      'reducedMotionQuery?.removeEventListener("change", updateDocumentMotion)',
    );
    expect(component).toContain("syncCollectionAutoplay()");
    expect(component).toContain('new Set<MotionPauseReason>(["viewport-hidden"])');
    expect(component).toContain("promotionalMarqueePauseReason");
    expect(component).toContain("clientMarqueePauseReason");
    expect(component).toContain("onBeforeUnmount");
    expect(integration).toContain("animation: decor-store-promotion-marquee 16s linear infinite");
    expect(integration).toContain("animation: decor-store-client-marquee 12s linear infinite");
    expect(integration).toContain('[data-decor-promotion-track]:not([data-motion-paused=""])');
    expect(integration).toContain("will-change: auto");
    expect(integration).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*animation:\s*none\s*!important/,
    );
  });

  test("suspends only the Hero timeline owned by the composable", async () => {
    const motion = await readFile(
      new URL(
        "../app/themes/fashion-store/composables/useFashionStoreDecorHeroMotion.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(motion).not.toContain(".ticker.sleep()");
    expect(motion).not.toContain(".ticker.wake()");
    expect(motion).toContain("timeline?.pause()");
    expect(motion).toContain("timeline.play()");
    expect(motion).toContain("timeline?.revert()");
  });

  test("counts only RunTasks that fully contain page activity intervals", () => {
    const activityNames = new Set(["Paint"]);
    const events = [
      { dur: 100, name: "RunTask", ph: "X", pid: 1, tid: 2, ts: 0 },
      { dur: 140, name: "Paint", ph: "X", pid: 1, tid: 2, ts: 10 },
      { dur: 100, name: "RunTask", ph: "X", pid: 1, tid: 2, ts: 200 },
      { dur: 180, name: "Paint", ph: "X", pid: 1, tid: 2, ts: 210 },
      { dur: 10, name: "Paint", ph: "X", pid: 1, tid: 2, ts: 240 },
      { dur: 100, name: "RunTask", ph: "X", pid: 1, tid: 2, ts: 400 },
      { dur: 10, name: "Paint", ph: "X", pid: 9, tid: 9, ts: 420 },
    ];

    expect(pageActivityRunTaskDuration(events, { pid: 1, tid: 2 }, activityNames)).toBe(0.1);
  });

  test("names timing, direction, transform, opacity, order, and pause mismatches", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    implementation.activeIndex = 1;
    implementation.direction = "horizontal";
    implementation.easing = "linear";
    implementation.pausedReasons = ["hover"];
    implementation.timing.durationMs = 700;
    implementation.layers[0]!.transform = "none";
    implementation.layers[0]!.opacity = 0.8;
    implementation.layers[0]!.zIndex = 4;

    expect(compareMotionContractSnapshots(reference, implementation)).toEqual([
      "activeIndex: expected 0, received 1",
      'direction: expected "vertical", received "horizontal"',
      'easing: expected "ease", received "linear"',
      "pausedReasons: expected [], received [hover]",
      "timing.durationMs: expected 1000, received 700",
      'background.transform: expected "matrix(1, 0, 0, 1, 0, -250)", received "none"',
      "background.opacity: expected 1, received 0.8",
      "background.zIndex: expected 1, received 4",
    ]);
  });

  test("keeps motion performance separate from the reduced-motion Lighthouse path", async () => {
    const [packageJson, motionConfig, motionSpec, lighthouseSpec] = await Promise.all([
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(
        new URL("../playwright.fashion-store-animation-performance.config.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../e2e/fashion-store-animation-performance.spec.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../e2e/performance.spec.ts", import.meta.url), "utf8"),
    ]);

    expect(packageJson).toContain('"test:perf:motion"');
    expect(motionConfig).toContain('browserName: "chromium"');
    expect(motionConfig).toContain("deviceScaleFactor: 2");
    expect(motionConfig).toContain("deviceScaleFactor: 3");
    expect(motionConfig).toContain("workers: 1");
    expect(motionSpec).toContain("Emulation.setCPUThrottlingRate");
    expect(motionSpec).toContain("VISIBLE_REPETITIONS = 3");
    expect(motionSpec).toContain("TRACE_WINDOW_MS = 4_200");
    expect(motionSpec).toContain('["RunPaintLifecyclePhase", "PrePaint"]');
    expect(motionSpec).toContain("settleVisualAssets(page)");
    expect(motionSpec).toContain("assertCompleteReport");
    expect(motionSpec).toContain("assertMotionBudgets");
    expect(lighthouseSpec).toContain('reducedMotion: "reduce"');
    expect(lighthouseSpec).toContain("performanceMotionPolicy");
    expect(lighthouseSpec).not.toContain("Emulation.setCPUThrottlingRate");
  });
});
