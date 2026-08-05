import { describe, expect, test } from "bun:test";

import {
  createInteractionController,
  type InteractionPauseReason,
} from "../app/theme-engine/interaction-controller";
import { ManualInteractionClock } from "../app/theme-engine/interaction-clock";

describe("shared interaction controller", () => {
  test("advances on deterministic boundaries and locks overlapping transitions", () => {
    const clock = new ManualInteractionClock();
    const controller = createInteractionController({
      autoplayDelayMs: 4_000,
      clock,
      count: 3,
      transitionDurationMs: 1_000,
    });

    controller.start();
    clock.advanceBy(3_999);
    expect(controller.snapshot()).toMatchObject({ currentIndex: 0, phase: "idle" });

    clock.advanceBy(1);
    expect(controller.snapshot()).toMatchObject({
      currentIndex: 0,
      direction: 1,
      phase: "transitioning",
      targetIndex: 1,
    });
    expect(controller.next()).toBe(false);

    clock.advanceBy(1_000);
    expect(controller.snapshot()).toMatchObject({
      currentIndex: 1,
      phase: "idle",
      targetIndex: 1,
    });

    clock.advanceBy(4_000);
    expect(controller.snapshot()).toMatchObject({ targetIndex: 2, phase: "transitioning" });
  });

  test("normalizes keyboard and swipe input into semantic movement", () => {
    const clock = new ManualInteractionClock();
    const controller = createInteractionController({
      autoplayDelayMs: 0,
      clock,
      count: 3,
      transitionDurationMs: 100,
    });

    expect(controller.handleKey("ArrowLeft")).toBe(true);
    clock.advanceBy(100);
    expect(controller.snapshot().currentIndex).toBe(2);

    expect(
      controller.handleSwipe({
        axis: "horizontal",
        deltaX: -48,
        deltaY: 3,
        threshold: 24,
      }),
    ).toBe(true);
    clock.advanceBy(100);
    expect(controller.snapshot().currentIndex).toBe(0);

    expect(
      controller.handleSwipe({
        axis: "vertical",
        deltaX: 2,
        deltaY: 8,
        threshold: 24,
      }),
    ).toBe(false);
  });

  test("pauses for every lifecycle guard and disposes all scheduled work", () => {
    const clock = new ManualInteractionClock();
    const controller = createInteractionController({
      autoplayDelayMs: 1_000,
      clock,
      count: 2,
      transitionDurationMs: 200,
    });
    const reasons: InteractionPauseReason[] = [
      "hover",
      "focus",
      "document-hidden",
      "reduced-motion",
    ];

    controller.start();
    for (const reason of reasons) {
      controller.pause(reason);
      clock.advanceBy(2_000);
      expect(controller.snapshot().currentIndex).toBe(0);
      controller.resume(reason);
    }

    expect(clock.pendingCount()).toBe(1);
    controller.dispose();
    expect(clock.pendingCount()).toBe(0);
    expect(controller.next()).toBe(false);
  });
});
