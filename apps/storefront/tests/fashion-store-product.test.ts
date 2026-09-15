import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  buildFashionStoreProductCartRequest,
  clampFashionStoreProductQuantity,
  fashionStoreProductData,
} from "../app/themes/fashion-store/fixtures/pages/product";
import { fashionStoreProductSourcePage } from "../app/themes/fashion-store/contracts/pages/product";
import { fashionStoreEnabledPageContracts } from "../app/themes/fashion-store/page-contracts";

describe("Fashion Store product detail", () => {
  test("keeps internal page fit owned by the shared canonical shell", async () => {
    const [shell, footer, integration] = await Promise.all([
      readFile(
        new URL(
          "../app/themes/fashion-store/components/shared/FashionStoreShell.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/themes/fashion-store/components/shared/FashionStoreFooter.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../app/themes/fashion-store/integration.css", import.meta.url), "utf8"),
    ]);

    expect(shell).not.toContain("home-layout");
    expect(footer).toContain("fashion-store-footer-canonical");
    expect(footer).not.toContain("fashion-store-footer-home");
    expect(integration).toContain("--fashion-store-shell-main-offset: 80px");
    expect(integration).toMatch(
      /@media \(min-width: 992px\)[\s\S]*--fashion-store-shell-main-offset:\s*96px/,
    );
    expect(integration).toMatch(
      /\[data-fashion-store-header\] \+ main > \.top-space-margin\s*\{[\s\S]*margin-top:\s*var\(--fashion-store-shell-main-offset\)/,
    );
    expect(integration).not.toMatch(
      /\[data-fashion-store-header\] \+ main > \.top-space-margin\s*\{[^}]*margin-top:\s*(?:79|118|119)px/,
    );
  });

  test("pins the product source and its deterministic presentation facts", () => {
    expect(fashionStoreProductSourcePage).toMatchObject({
      id: "product",
      route: "/products/relaxed-corduroy-shirt",
      sourceEntry: "demo-fashion-store-single-product.html",
      sourceSha256: "9f2a5cb42d81df1505c3a911c59544eefd8a0a60e6b27791d8469fd552179f43",
    });
    expect(fashionStoreProductData.gallery).toHaveLength(6);
    expect(fashionStoreProductData.product).toMatchObject({
      name: "Relaxed corduroy shirt",
      originalPrice: "$85.00",
      price: "$65.00",
      sku: "M492300",
    });
    expect(fashionStoreProductData.options.colors.map(({ label }) => label)).toEqual([
      "Gold",
      "Blue",
      "Green",
    ]);
    expect(fashionStoreProductData.options.sizes.map(({ label }) => label)).toEqual([
      "S",
      "M",
      "L",
      "XL",
    ]);
    expect(fashionStoreProductData.related.map(({ name }) => name)).toEqual([
      "Textured sweater",
      "Traveller shirt",
      "Crewneck sweatshirt",
      "Skinny trousers",
    ]);
  });

  test("builds one bounded typed cart request from the selected fixture state", () => {
    expect(clampFashionStoreProductQuantity(0)).toBe(1);
    expect(clampFashionStoreProductQuantity(21)).toBe(20);
    expect(clampFashionStoreProductQuantity(3.8)).toBe(3);
    expect(buildFashionStoreProductCartRequest(2, "blue", "m")).toEqual({
      expectedUnitPrice: { amount: 6500, currency: "USD" },
      quantity: 2,
      releaseId: "representative-release-2026-07-30",
      variantId: "var_01JFSHIRTBLUEM00000000001",
    });
    expect(() => buildFashionStoreProductCartRequest(1, "missing", "xl")).toThrow(/Unavailable/);
  });

  test("keeps a meaningful product heading in prerendered preview HTML", async () => {
    const source = await readFile(
      new URL(
        "../app/themes/fashion-store/components/pages/FashionStoreProductPage.vue",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain('<h1 class="visually-hidden">{{ presentation.name }}</h1>');
    expect(source).toContain("useFashionStoreProductActionPort");
    expect(source).toContain("resetProductState");
    expect(source).toContain("previousIdentity");
    expect(source).not.toMatch(/\/fixtures\/|runtimeCommercePortKey|storefrontActionAdapterKey/);
    expect(source).not.toContain("25,000+");
    expect(source).not.toContain("2,488 Reviews");
  });

  test("readiness enables product only after its page contract is complete", () => {
    expect(fashionStoreEnabledPageContracts.map(({ id }) => id)).toEqual([
      "home",
      "shop-left",
      "shop-none",
      "shop-right",
      "collection",
      "product",
      "cart",
      "checkout",
      "wishlist",
      "account",
      "magazine",
      "article",
      "about",
      "faq",
      "contact",
    ]);
  });
});
