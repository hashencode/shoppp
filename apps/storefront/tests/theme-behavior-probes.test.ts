import { describe, expect, test } from "bun:test";
import {
  assertMonotonicProgress,
  assertObservableDisplacement,
} from "../e2e/support/theme-behavior-probes";
import { assertCustomBehaviorAdaptersRegistered } from "../e2e/support/theme-behavior-runner";
import type { ThemeBehaviorContract } from "../e2e/support/theme-behavior-contract";

describe("theme behavior probes", () => {
  test("accepts monotonic scroll samples and observable timed movement", () => {
    expect(() => assertMonotonicProgress([4, 18, 41])).not.toThrow();
    expect(assertObservableDisplacement(100, 92, 2)).toBe(8);
  });

  test("rejects configured-but-static movement and regressing scroll progress", () => {
    expect(() => assertObservableDisplacement(100, 100, 1)).toThrow(/displacement/);
    expect(() => assertMonotonicProgress([10, 9, 20])).toThrow(/regressed/);
    expect(() => assertMonotonicProgress([10, 10])).toThrow(/did not increase/);
  });

  test("fails before browser execution when a named custom adapter is absent", () => {
    const contract = {
      behaviors: [],
      customAdapters: [{ id: "revolution-slider", reason: "Fixture-specific runtime." }],
      routeId: "fixture-home",
      suppressions: [],
      themeId: "fixture",
    } as const satisfies ThemeBehaviorContract;
    expect(() => assertCustomBehaviorAdaptersRegistered(contract, {})).toThrow(/revolution-slider/);
    expect(() =>
      assertCustomBehaviorAdaptersRegistered(contract, {
        "revolution-slider": async () => undefined,
      }),
    ).not.toThrow();
  });
});
