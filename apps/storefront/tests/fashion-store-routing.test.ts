import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  fashionStoreEnabledPageContracts,
  fashionStorePageContracts,
  fashionStorePreviewRoutes,
  resolveFashionStorePage,
} from "../app/themes/fashion-store/page-contracts";

describe("Fashion Store route readiness", () => {
  test("keeps the complete source route matrix while enabling only complete page contracts", () => {
    expect(
      fashionStorePageContracts.map(({ id, path, pageType, variant }) => ({
        id,
        path,
        pageType,
        variant,
      })),
    ).toEqual([
      { id: "home", path: "/", pageType: "home", variant: "home" },
      { id: "shop-left", path: "/shop", pageType: "collection", variant: "shop-left" },
      { id: "shop-none", path: "/shop/no-sidebar", pageType: "collection", variant: "shop-none" },
      {
        id: "shop-right",
        path: "/shop/right-sidebar",
        pageType: "collection",
        variant: "shop-right",
      },
      { id: "collection", path: "/collections", pageType: "collection", variant: "collection" },
      {
        id: "product",
        path: "/products/relaxed-corduroy-shirt",
        pageType: "product",
        variant: "product",
      },
      { id: "cart", path: "/cart", pageType: "cart", variant: "cart" },
      { id: "checkout", path: "/checkout", pageType: "checkout", variant: "checkout" },
      { id: "wishlist", path: "/wishlist", pageType: "content", variant: "wishlist" },
      { id: "account", path: "/account", pageType: "content", variant: "account" },
      { id: "magazine", path: "/magazine", pageType: "content", variant: "magazine" },
      {
        id: "article",
        path: "/magazine/marketing-tips-and-tricks",
        pageType: "content",
        variant: "article",
      },
      { id: "about", path: "/about", pageType: "content", variant: "about" },
      { id: "faq", path: "/faq", pageType: "content", variant: "faq" },
      { id: "contact", path: "/contact", pageType: "content", variant: "contact" },
    ]);
    expect(fashionStoreEnabledPageContracts.map(({ id }) => id)).toEqual([
      "home",
      "shop-left",
      "shop-none",
      "shop-right",
      "product",
      "cart",
      "checkout",
    ]);
    expect(fashionStorePreviewRoutes).toEqual([
      "/",
      "/shop",
      "/shop/no-sidebar",
      "/shop/right-sidebar",
      "/products/relaxed-corduroy-shirt",
      "/cart",
      "/checkout",
    ]);
  });

  test("normalizes trailing slashes and never falls through to a sibling variant", () => {
    expect(resolveFashionStorePage("/")?.id).toBe("home");
    expect(resolveFashionStorePage("///")?.id).toBe("home");
    expect(resolveFashionStorePage("/shop/")?.id).toBe("shop-left");
    expect(resolveFashionStorePage("/shop/no-sidebar/")?.id).toBe("shop-none");
    expect(resolveFashionStorePage("/shop/right-sidebar/")?.id).toBe("shop-right");
    expect(resolveFashionStorePage("/products/relaxed-corduroy-shirt/")?.id).toBe("product");
    expect(resolveFashionStorePage("/cart/")?.id).toBe("cart");
    expect(resolveFashionStorePage("/checkout/")?.id).toBe("checkout");
    expect(resolveFashionStorePage("/shop/unknown")).toBeUndefined();
    expect(resolveFashionStorePage("/magazine/unknown")).toBeUndefined();
    expect(
      resolveFashionStorePage("/magazine/marketing-tips-and-tricks", { includeDisabled: true })?.id,
    ).toBe("article");
  });

  test("discovers bounded Fashion Store page specs without pulling in unrelated E2E files", async () => {
    const config = await readFile(
      resolve(import.meta.dir, "../playwright.fashion-store.config.ts"),
      "utf8",
    );
    expect(config).toContain('"fashion-store-*.spec.ts"');
    expect(config).toContain('"theme-behavior-contract.spec.ts"');
    expect(config).not.toContain('testMatch: ["*.spec.ts"');
  });

  test("keeps non-backed preview forms local and free of Crafto endpoints", async () => {
    const componentRoot = resolve(import.meta.dir, "../app/themes/fashion-store/components/shared");
    const source = await Promise.all(
      ["FashionStoreFooter.vue", "FashionStoreSearchOverlay.vue"].map((name) =>
        readFile(resolve(componentRoot, name), "utf8"),
      ),
    ).then((files) => files.join("\n"));
    expect(source).not.toMatch(/\.php(?:["'?]|\b)/i);
    expect(source.match(/(?:@submit|v-on:submit)\.prevent/g)?.length).toBe(2);
  });
});
