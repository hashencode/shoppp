import { describe, expect, test } from "bun:test";

import {
  fashionCollectionNavigationKeys,
  fashionNamedStateHeroHeight,
  namedStateFractionalOriginOffset,
} from "./capture-theme-named-states";

describe("Fashion named-state capture", () => {
  test("uses the same canonical hero height as regional capture", () => {
    expect(fashionNamedStateHeroHeight({ height: 1000, width: 1440 })).toBe(1000);
    expect(fashionNamedStateHeroHeight({ height: 900, width: 1200 })).toBe(900);
    expect(fashionNamedStateHeroHeight({ height: 900, width: 768 })).toBe(600);
    expect(fashionNamedStateHeroHeight({ height: 844, width: 390 })).toBe(500);
  });

  test("resets the implementation collection rail before selecting a named slide", () => {
    expect(fashionCollectionNavigationKeys(3, 2)).toEqual([
      "ArrowLeft",
      "ArrowLeft",
      "ArrowLeft",
      "ArrowRight",
      "ArrowRight",
    ]);
  });

  test("normalizes fractional element origins without changing integer origins", () => {
    expect(namedStateFractionalOriginOffset(337.40625)).toBe(-0.40625);
    expect(namedStateFractionalOriginOffset(337)).toBe(0);
  });
});
