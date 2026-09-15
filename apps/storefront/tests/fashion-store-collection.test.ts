import { describe, expect, test } from "bun:test";

import type { PresentationViewModel } from "../app/theme-engine/view-models";
import { normalizeFashionStoreCatalogPresentation } from "../app/themes/fashion-store/contracts/catalog-presentation";
import {
  fashionStoreCollectionBehaviorContract,
  fashionStoreCollectionSourceContract,
  fashionStoreCollectionSourcePage,
} from "../app/themes/fashion-store/contracts/pages/collection";
import { fashionStoreCollectionData } from "../app/themes/fashion-store/fixtures/pages/collection";
import { fashionStoreShopFixtures } from "../app/themes/fashion-store/fixtures/pages/shop";
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

  test("keeps the fixture collection landing distinct from its shared product grid", () => {
    const presentation = normalizeFashionStoreCatalogPresentation(
      fashionStoreShopFixtures["fashion-store-shop"].viewModels.shop,
      "/collections",
    );
    expect(presentation).toEqual({
      announcement: fashionStoreCollectionData.announcement,
      cards: fashionStoreCollectionData.cards.map(({ count, destination, label, sourceImage }) => ({
        count,
        destination,
        image: { kind: "theme-asset", path: sourceImage },
        label,
      })),
      title: "Collection",
      variant: "landing",
    });
  });

  test("maps live landing and detail routes without fixture catalog fallback", () => {
    const liveViewModel = {
      collections: [
        {
          action: {
            id: "open-collection",
            intent: "navigation",
            label: "View Travel essentials",
            target: "/collections/travel-essentials",
          },
          id: "col_01J00000000000000000000000",
          name: "Travel essentials",
        },
      ],
      description: "Published travel products.",
      heading: "Travel essentials",
      kind: "collection-grid",
      products: [],
      resource: {
        id: "col_01J00000000000000000000000",
        kind: "collection",
        name: "Travel essentials",
        productIds: ["prod_01J0000000000000000000000"],
        slug: "travel-essentials",
      },
      state: "populated",
    } as unknown as PresentationViewModel;

    const landing = normalizeFashionStoreCatalogPresentation(liveViewModel, "/collections");
    expect(landing).toEqual({
      cards: [
        {
          count: "1 item",
          destination: "/collections/travel-essentials",
          label: "Travel essentials",
        },
      ],
      title: "Collection",
      variant: "landing",
    });

    const grid = normalizeFashionStoreCatalogPresentation(
      liveViewModel,
      "/collections/travel-essentials",
    );
    expect(grid).toEqual(
      expect.objectContaining({
        arrivals: [],
        filters: {},
        items: [],
        layout: "none",
        pagination: false,
        title: "Travel essentials",
        variant: "grid",
      }),
    );
  });
});
