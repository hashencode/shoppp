import { describe, expect, test } from "bun:test";

import {
  fashionStoreShopData,
  filterFashionStoreShopProducts,
} from "../app/themes/fashion-store/fixtures/pages/shop";
import {
  fashionStoreShopSourcePages,
  resolveFashionStoreShopLayout,
} from "../app/themes/fashion-store/contracts/pages/shop";
import { fashionStoreEnabledPageContracts } from "../app/themes/fashion-store/page-contracts";

describe("Fashion Store Shop layout family", () => {
  test("pins the three source identities to one explicit layout model", () => {
    expect(
      fashionStoreShopSourcePages.map(({ id, layout, route, sourceEntry, sourceSha256 }) => ({
        id,
        layout,
        route,
        sourceEntry,
        sourceSha256,
      })),
    ).toEqual([
      {
        id: "shop-left",
        layout: "left",
        route: "/shop",
        sourceEntry: "demo-fashion-store-shop.html",
        sourceSha256: "1efb50af3ca47307a3c214457dacebb1493e97fb610dad5c28cc6c639c149af3",
      },
      {
        id: "shop-none",
        layout: "none",
        route: "/shop/no-sidebar",
        sourceEntry: "demo-fashion-store-no-sidebar.html",
        sourceSha256: "b4b91a8b91aac11fe333a1618e2923be8db5dafca734431dc897830ad8c29bc6",
      },
      {
        id: "shop-right",
        layout: "right",
        route: "/shop/right-sidebar",
        sourceEntry: "demo-fashion-store-right-sidebar.html",
        sourceSha256: "54d681fffdb48e25c230264a3fa896c12a488d3b3d817581d73a49784b6afbe9",
      },
    ]);
    expect(resolveFashionStoreShopLayout("/shop/").layout).toBe("left");
    expect(resolveFashionStoreShopLayout("/shop/no-sidebar").layout).toBe("none");
    expect(resolveFashionStoreShopLayout("/shop/right-sidebar").layout).toBe("right");
    expect(() => resolveFashionStoreShopLayout("/shop/unknown")).toThrow(
      "Unknown Fashion Store Shop route",
    );
  });

  test("keeps source product order and filters without adding result copy", () => {
    expect(fashionStoreShopData.products).toHaveLength(12);
    expect(fashionStoreShopData.products.map(({ name }) => name)).toEqual([
      "Textured sweater",
      "Traveller shirt",
      "Crewneck sweatshirt",
      "Skinny trousers",
      "Sleeve sweater",
      "Pocket sweatshirt",
      "Cotton sweater",
      "Texture regular",
      "Sequined dress",
      "Bermuda shorts",
      "Traveller shirt",
      "Textured sweater",
    ]);
    expect(filterFashionStoreShopProducts(fashionStoreShopData.products, {})).toHaveLength(12);
    expect(
      fashionStoreShopData.arrivals.flat().map(({ name, originalPrice, price }) => ({
        name,
        originalPrice,
        price,
      })),
    ).toEqual([
      { name: "Textured sweater", originalPrice: "$30.00", price: "$23.00" },
      { name: "Traveller shirt", originalPrice: "$50.00", price: "$43.00" },
      { name: "Crewneck tshirt", originalPrice: "$20.00", price: "$15.00" },
      { name: "Skinny trousers", originalPrice: "$15.00", price: "$10.00" },
      { name: "Sleeve sweater", originalPrice: "$35.00", price: "$30.00" },
      { name: "Pocket white", originalPrice: "$20.00", price: "$15.00" },
    ]);
    expect(
      filterFashionStoreShopProducts(fashionStoreShopData.products, {
        category: "Jeans",
        color: "Blue",
        size: "M",
        tag: "Cotton",
      }).map(({ id }) => id),
    ).toEqual(["textured-sweater-01"]);
  });

  test("readiness-enables exactly the complete Shop family plus home", () => {
    expect(fashionStoreEnabledPageContracts.map(({ id }) => id)).toEqual([
      "home",
      "shop-left",
      "shop-none",
      "shop-right",
    ]);
  });
});
