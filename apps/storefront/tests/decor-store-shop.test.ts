import { describe, expect, test } from "bun:test";

import {
  decorStorePageContracts,
  resolveDecorStorePage,
} from "../app/themes/decor-store/page-contracts";
import {
  decorStoreCollectionData,
  decorStoreShopData,
  pageDecorStoreProducts,
} from "../app/themes/decor-store/fixtures/pages/shop";

describe("Decor Store Shop and Collections", () => {
  test("enables exactly the three Shop layouts and Collections after focused evidence", () => {
    expect(decorStorePageContracts.filter(({ ready }) => ready).map(({ id }) => id)).toEqual([
      "home",
      "shop-left",
      "shop-none",
      "shop-right",
      "collection",
    ]);
    expect(resolveDecorStorePage("/shop")?.id).toBe("shop-left");
    expect(resolveDecorStorePage("/shop/no-sidebar")?.id).toBe("shop-none");
    expect(resolveDecorStorePage("/shop/right-sidebar")?.id).toBe("shop-right");
    expect(resolveDecorStorePage("/collections")?.id).toBe("collection");
  });

  test("freezes twelve source products and the three sidebar modes", () => {
    expect(decorStoreShopData.products.map(({ name }) => name)).toEqual([
      "Table clock",
      "Wood stool",
      "Ceramic mug",
      "Decorative plants",
      "Ceramic pot",
      "Ceramic plate",
      "Ceramic container",
      "Design wall clock",
      "Watch box",
      "Modern stool",
      "Nutcracker",
      "Decor lamp",
    ]);
    expect(decorStoreShopData.layouts).toEqual({
      "shop-left": "left",
      "shop-none": "none",
      "shop-right": "right",
    });
  });

  test("filters, sorts, and paginates deterministic local products", () => {
    expect(
      pageDecorStoreProducts({ category: "Decor", page: 1, sort: "default" }).items,
    ).toHaveLength(4);
    expect(
      pageDecorStoreProducts({ category: "All", page: 1, sort: "price-low" }).items[0]?.name,
    ).toBe("Ceramic mug");
    const second = pageDecorStoreProducts({ category: "All", page: 2, sort: "default" });
    expect(second.items).toHaveLength(4);
    expect(second.totalPages).toBe(3);
  });

  test("keeps Collections editorial and free of Shop controls", () => {
    expect(decorStoreCollectionData.items).toHaveLength(8);
    expect(decorStoreCollectionData.items.map(({ name }) => name)).toEqual([
      "Designer stool",
      "Modern chair",
      "Table clock",
      "Home decor",
      "Ceramic pots",
      "Table lamp",
      "Wooden table",
      "Designer sofa",
    ]);
    expect(decorStoreCollectionData).not.toHaveProperty("filters");
    expect(decorStoreCollectionData).not.toHaveProperty("sortOptions");
  });
});
