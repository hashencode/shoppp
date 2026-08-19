import { describe, expect, test } from "bun:test";

import {
  decorStoreProductData,
  decorStoreWishlistData,
} from "../app/themes/decor-store/fixtures/pages/product";
import {
  decorStorePageContracts,
  resolveDecorStorePage,
} from "../app/themes/decor-store/page-contracts";

describe("Decor Store Product and Wishlist", () => {
  test("enables only the source-backed Product and Wishlist content in U4", () => {
    expect(resolveDecorStorePage("/products/minimalist-wooden-chair")?.id).toBe("product");
    expect(resolveDecorStorePage("/wishlist")?.id).toBe("wishlist");
    expect(decorStorePageContracts.find(({ id }) => id === "account")?.ready).toBe(false);
  });

  test("freezes the source product gallery, options, tabs, and related products", () => {
    expect(decorStoreProductData.name).toBe("Minimalist wooden chair");
    expect(decorStoreProductData.gallery).toHaveLength(4);
    expect(decorStoreProductData.colors).toEqual(["Natural", "Black", "Walnut"]);
    expect(decorStoreProductData.tabs).toEqual([
      "Description",
      "Additional information",
      "Shipping and return",
      "Reviews (3)",
    ]);
    expect(decorStoreProductData.related).toHaveLength(4);
  });

  test("keeps Wishlist deterministic and presentation-only", () => {
    expect(decorStoreWishlistData.items.map(({ name }) => name)).toEqual([
      "Table clock",
      "Wood stool",
      "Ceramic mug",
      "Decorative plants",
      "Ceramic pot",
      "Ceramic plate",
      "Ceramic container",
    ]);
    expect(decorStoreWishlistData).not.toHaveProperty("endpoint");
    expect(decorStoreProductData).not.toHaveProperty("cartAdapter");
  });
});
