import { describe, expect, test } from "bun:test";

import { equivalentRoundedSectionTarget } from "./capture-theme-route-region";

describe("full-page section origin normalization", () => {
  test("normalizes only already-equivalent section origins", () => {
    expect(
      equivalentRoundedSectionTarget({ left: 0.04, top: 100.04 }, { left: 0.08, top: 100.08 }),
    ).toEqual({ left: 0, top: 100 });
    expect(
      equivalentRoundedSectionTarget({ left: 0, top: 100 }, { left: 0, top: 100.11 }),
    ).toBeNull();
  });
});
