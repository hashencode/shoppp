import { describe, expect, test } from "bun:test";

import {
  compareMotionContractSnapshots,
  type MotionContractSnapshot,
} from "../e2e/support/theme-motion-contract";

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
  test("accepts numeric drift inside the contract tolerance", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    implementation.layers[0]!.opacity = 0.9998;

    expect(compareMotionContractSnapshots(reference, implementation)).toEqual([]);
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
});
