import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  fashionStoreAccountBehaviorContract,
  fashionStoreAccountSourceContract,
  fashionStoreAccountSourcePage,
} from "../app/themes/fashion-store/contracts/pages/account";
import {
  fashionStoreWishlistBehaviorContract,
  fashionStoreWishlistSourceContract,
  fashionStoreWishlistSourcePage,
} from "../app/themes/fashion-store/contracts/pages/wishlist";
import { fashionStoreContentData } from "../app/themes/fashion-store/fixtures/pages/content";
import { resolveFashionStorePage } from "../app/themes/fashion-store/page-contracts";

describe("Fashion Store Wishlist and Account", () => {
  test("pins independent source identities and the eight-product wishlist baseline", () => {
    expect(fashionStoreWishlistSourcePage).toEqual({
      id: "wishlist",
      route: "/wishlist",
      sourceEntry: "demo-fashion-store-wishlist.html",
      sourceSha256: "b1531a70ce47ae1f79da4026ad918b8796582c4fdb1b2e852454b5306a3e13fc",
    });
    expect(fashionStoreAccountSourcePage).toEqual({
      id: "account",
      route: "/account",
      sourceEntry: "demo-fashion-store-account.html",
      sourceSha256: "1b7c1cc83c0f224f8f95dec2ded2246a9ebcc52a7011acd3d5afcfdd4248da62",
    });
    expect(fashionStoreWishlistSourceContract.productCount).toBe(8);
    expect(
      fashionStoreContentData.wishlist.products.map(({ name, price }) => [name, price]),
    ).toEqual([
      ["Textured sweater", "$189.00"],
      ["Traveller shirt", "$289.00"],
      ["Crewneck sweatshirt", "$199.00"],
      ["Skinny trousers", "$259.00"],
      ["Sleeve sweater", "$239.00"],
      ["Pocket sweatshirt", "$189.00"],
      ["Cotton sweater", "$129.00"],
      ["Texture regular", "$120.00"],
    ]);
  });

  test("keeps both content variants independently routable and behavior-owned", () => {
    expect(resolveFashionStorePage("/wishlist")?.variant).toBe("wishlist");
    expect(resolveFashionStorePage("/account")?.variant).toBe("account");
    expect(fashionStoreWishlistBehaviorContract.behaviors.map(({ id }) => id)).toEqual([
      "wishlist-product-actions",
      "wishlist-local-removal",
    ]);
    expect(fashionStoreAccountBehaviorContract.behaviors.map(({ id }) => id)).toEqual([
      "account-login-validation",
      "account-register-validation",
    ]);
    expect(fashionStoreAccountSourceContract.formCount).toBe(2);
  });

  test("keeps Account forms local and free of credential or PHP submission endpoints", async () => {
    const source = await readFile(
      resolve(
        import.meta.dir,
        "../app/themes/fashion-store/components/pages/FashionStoreAccountPage.vue",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/\.php(?:["'?]|\b)/i);
    expect(source).not.toMatch(/\bfetch\s*\(|\$fetch\s*\(|useFetch\s*\(|axios/i);
    expect(source.match(/@submit\.prevent/g)?.length).toBe(2);
    expect(source).not.toMatch(/success|account created|logged in/i);
  });
});
