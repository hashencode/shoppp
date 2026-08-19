import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertDecorStorePageContracts,
  decorStorePageContracts,
  decorStorePreviewRoutes,
  resolveDecorStorePage,
  type DecorStorePageContract,
} from "../app/themes/decor-store/page-contracts";
import { validateIndependentReferenceSource } from "../../../tools/capture-storefront-theme-reference";

const expectedSecondaryPages = [
  ["shop-left", "/shop", "collection", "demo-decor-store-shop.html"],
  ["shop-none", "/shop/no-sidebar", "collection", "demo-decor-store-no-sidebar.html"],
  ["shop-right", "/shop/right-sidebar", "collection", "demo-decor-store-right-sidebar.html"],
  ["collection", "/collections", "collection", "demo-decor-store-collections.html"],
  [
    "product",
    "/products/minimalist-wooden-chair",
    "product",
    "demo-decor-store-single-product.html",
  ],
  ["wishlist", "/wishlist", "content", "demo-decor-store-wishlist.html"],
  ["cart", "/cart", "cart", "demo-decor-store-cart.html"],
  ["checkout", "/checkout", "checkout", "demo-decor-store-checkout.html"],
  ["account", "/account", "content", "demo-decor-store-account.html"],
  ["blog", "/blog", "content", "demo-decor-store-blog.html"],
  [
    "article",
    "/blog/best-influencers-for-decor-inspiration",
    "content",
    "demo-decor-store-blog-single-classic.html",
  ],
  ["about", "/about", "content", "demo-decor-store-about.html"],
  ["faq", "/faq", "content", "demo-decor-store-faq.html"],
  ["contact", "/contact", "content", "demo-decor-store-contact.html"],
] as const;

describe("Decor Store remaining-page route authority", () => {
  test("freezes all fourteen secondary source routes and exposes only evidenced families", () => {
    expect(
      decorStorePageContracts
        .filter(({ id }) => id !== "home")
        .map(({ id, path, pageType, ready, sourceEntry }) => [
          id,
          path,
          pageType,
          sourceEntry,
          ready,
        ]),
    ).toEqual(
      expectedSecondaryPages.map((row) => [
        ...row,
        ["shop-left", "shop-none", "shop-right", "collection"].includes(row[0]),
      ]),
    );
    expect(decorStorePreviewRoutes).toEqual([
      "/",
      "/shop",
      "/shop/no-sidebar",
      "/shop/right-sidebar",
      "/collections",
    ]);
  });

  test("normalizes trailing slashes without exposing unknown or unready routes", () => {
    expect(resolveDecorStorePage("///")?.id).toBe("home");
    expect(resolveDecorStorePage("/shop/")?.id).toBe("shop-left");
    expect(resolveDecorStorePage("/shop/", { includeDisabled: true })?.id).toBe("shop-left");
    expect(resolveDecorStorePage("/not-a-decor-page", { includeDisabled: true })).toBeUndefined();
  });

  test("rejects an incorrect source entry", () => {
    const contracts = structuredClone(decorStorePageContracts) as DecorStorePageContract[];
    contracts.find(({ id }) => id === "shop-left")!.sourceEntry =
      "demo-decor-store-right-sidebar.html";
    expect(() => assertDecorStorePageContracts(contracts, ["decor-store-home"])).toThrow(
      "shop-left source entry",
    );
  });

  test("rejects a ready page without its fixture binding", () => {
    const contracts = structuredClone(decorStorePageContracts) as DecorStorePageContract[];
    contracts.find(({ id }) => id === "shop-left")!.ready = true;
    expect(() => assertDecorStorePageContracts(contracts, ["decor-store-home"])).toThrow(
      "shop-left fixture binding",
    );
  });

  test("rejects prematurely enabled pages without completion evidence", () => {
    const contracts = structuredClone(decorStorePageContracts) as DecorStorePageContract[];
    const product = contracts.find(({ id }) => id === "product")!;
    product.ready = true;
    product.fixtureId = "decor-store-product";
    expect(() =>
      assertDecorStorePageContracts(contracts, [
        "decor-store-home",
        "decor-store-collection",
        "decor-store-product",
      ]),
    ).toThrow("product readiness evidence");
  });

  test("keeps shared acceptance policy identity aligned without advertising unready pages", async () => {
    const policy = JSON.parse(
      await readFile(
        resolve(import.meta.dir, "../../../tools/storefront-source-equivalence-policy.json"),
        "utf8",
      ),
    );
    const decor = policy.themes.find(({ id }: { id: string }) => id === "decor-store");
    expect(decor.equivalenceScope).toEqual(["home"]);
    expect(decor.pages.map(({ id }: { id: string }) => id)).toEqual(["home"]);
    expect(decor.declaredPages).toEqual(
      decorStorePageContracts.map(({ id, pageType, path, ready, sourceEntry }) => ({
        id,
        implementationRoute: path,
        pageType,
        ready,
        sourceEntry,
      })),
    );
  });

  test("passes static and interaction-heavy source identities through the shared intake guard", async () => {
    const repositoryRoot = resolve(import.meta.dir, "../../..");
    const sourceRoot = resolve(
      repositoryRoot,
      "templates/Crafto - The Multipurpose HTML5 Template/html",
    );
    const implementationThemeRoot = resolve(
      repositoryRoot,
      "apps/storefront/app/themes/decor-store",
    );
    for (const id of ["blog", "product"] as const) {
      const page = decorStorePageContracts.find((candidate) => candidate.id === id)!;
      const validated = await validateIndependentReferenceSource({
        config: {
          entry: page.sourceEntry,
          firstHero: page.firstReferenceAsset,
          themeId: "decor-store",
        },
        expectedEntrySha256: page.sourceEntrySha256,
        implementationThemeRoot,
        sourceRoot,
      });
      expect(validated.entrySha256).toBe(page.sourceEntrySha256);
    }
  });
});
