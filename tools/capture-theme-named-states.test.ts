import { describe, expect, test } from "bun:test";

import {
  fashionCollectionNavigationKeys,
  fashionNamedStateHeroHeight,
  fashionNamedStatePreservesPointer,
  fashionStoreNamedStateSelection,
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

  test("preserves pointer state for hover-revealed keyboard controls", () => {
    expect(fashionNamedStatePreservesPointer({ kind: "product-focus" })).toBe(true);
    expect(fashionNamedStatePreservesPointer({ kind: "product-hover" })).toBe(true);
    expect(fashionNamedStatePreservesPointer({ kind: "initial" })).toBe(false);
  });

  test("selects independent page contracts and evidence identities", () => {
    expect(fashionStoreNamedStateSelection()).toMatchObject({
      evidenceThemeId: "fashion-store",
      routeId: "fashion-store-home",
    });
    expect(fashionStoreNamedStateSelection("cart")).toMatchObject({
      evidenceThemeId: "fashion-store/cart",
      routeId: "fashion-store-cart",
    });
    expect(fashionStoreNamedStateSelection("cart").contracts.map(({ id }) => id)).toEqual([
      "cart-first-line-quantity-2",
      "cart-shipping-open",
      "cart-coupon-invalid",
    ]);
    expect(
      fashionStoreNamedStateSelection("shop-left").contracts.map(
        ({ geometrySpace, implementationSelector }) => ({
          geometrySpace,
          implementationSelector,
        }),
      ),
    ).toContainEqual({
      geometrySpace: "viewport",
      implementationSelector: ".category-filter",
    });
    expect(() => fashionStoreNamedStateSelection("missing")).toThrow(/Unknown Fashion Store page/);
  });
});
