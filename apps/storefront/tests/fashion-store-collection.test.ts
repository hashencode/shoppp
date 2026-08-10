import { describe, expect, test } from "bun:test";

import {
  fashionStoreCollectionBehaviorContract,
  fashionStoreCollectionSourceContract,
  fashionStoreCollectionSourcePage,
} from "../app/themes/fashion-store/contracts/pages/collection";
import { fashionStoreCollectionData } from "../app/themes/fashion-store/fixtures/pages/collection";
import { resolveFashionStorePage } from "../app/themes/fashion-store/page-contracts";
import { fashionStoreAssetId, themeAssets } from "../app/themes/fashion-store/resources";

describe("Fashion Store collection", () => {
  test("pins the dedicated collection source and preserves its editorial card order", () => {
    expect(fashionStoreCollectionSourcePage).toEqual({
      id: "collection",
      route: "/collections",
      sourceEntry: "demo-fashion-store-collection.html",
      sourceSha256: "66f7ef2c07925577063efb4a60355857f2a70af0cff1955648ec2ba1401e2f1d",
    });
    expect(fashionStoreCollectionSourceContract.cardCount).toBe(6);
    expect(fashionStoreCollectionData.cards.map(({ label, count }) => [label, count])).toEqual([
      ["Polo t-shirts", "8 items"],
      ["Sunglasses", "9 items"],
      ["Skinny blazer", "8 items"],
      ["Casual shoes", "5 items"],
      ["Winter jackets", "7 items"],
      ["Men's shorts", "3 items"],
    ]);
    expect(
      new Set(fashionStoreCollectionData.cards.map(({ sourceImage }) => sourceImage)).size,
    ).toBe(6);
    expect(
      fashionStoreCollectionData.cards.every(({ destination }) => destination === "/shop"),
    ).toBe(true);
    expect(
      fashionStoreCollectionData.cards.every(
        ({ sourceImage }) => typeof themeAssets[fashionStoreAssetId(sourceImage)] === "string",
      ),
    ).toBe(true);
  });

  test("keeps collection distinct from Shop while owning category navigation behavior", () => {
    expect(resolveFashionStorePage("/collections")?.variant).toBe("collection");
    expect(resolveFashionStorePage("/shop")?.variant).toBe("shop-left");
    expect(resolveFashionStorePage("/collections/summer")).toBeUndefined();
    expect(fashionStoreCollectionBehaviorContract.behaviors.map(({ id }) => id)).toEqual([
      "collection-card-state",
      "collection-category-navigation",
    ]);
  });
});
