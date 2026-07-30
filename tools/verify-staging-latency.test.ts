import { describe, expect, test } from "bun:test";

import { mapWithConcurrency, percentile95 } from "./verify-staging-latency";

describe("staging latency verifier", () => {
  test("calculates p95 without treating the sample count as concurrency", () => {
    expect(percentile95(Array.from({ length: 20 }, (_, index) => index + 1))).toBe(19);
  });

  test("preserves result order while enforcing the configured concurrency", async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, value % 2 === 0 ? 2 : 1));
      active -= 1;
      return value * 2;
    });

    expect(maximumActive).toBe(3);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  test("rejects invalid concurrency", async () => {
    await expect(mapWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(
      "concurrency must be a positive integer",
    );
  });
});
