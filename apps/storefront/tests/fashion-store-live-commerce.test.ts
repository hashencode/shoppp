import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { composeExperienceRoute } from "../app/theme-engine/composer";
import { resolveThemeRoute } from "../app/theme-engine/routes";
import { fashionStoreLiveCapabilities } from "../app/themes/fashion-store/capability-matrix";
import { fashionStoreThemeRoutes } from "../app/themes/fashion-store/page-contracts";

const appRoot = resolve(import.meta.dir, "../app");

async function source(path: string): Promise<string> {
  return readFile(resolve(appRoot, path), "utf8");
}

describe("Fashion Store live commerce boundary", () => {
  test("generates Catalog bindings that compose the deployed U13 routes", async () => {
    const script = await import("../scripts/prepare-fashion-store-live-e2e");
    expect(typeof script.fashionStoreLiveBuildInput).toBe("function");

    const [fixtureInput, releaseFixture] = await Promise.all([
      readFile(
        resolve(
          import.meta.dir,
          "../fixtures/experience/.generated/fashion-store-preview-input.json",
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(resolve(import.meta.dir, "../fixtures/release.json"), "utf8").then(JSON.parse),
    ]);
    const input = script.fashionStoreLiveBuildInput(
      fixtureInput,
      releaseFixture,
      "https://shoppp-storefront-fashion-preview.example.test",
    );

    expect(input.snapshot.bindings).toEqual([
      expect.objectContaining({ instanceId: "fashion-store-home", kind: "catalog" }),
      expect.objectContaining({ instanceId: "fashion-store-collection", kind: "catalog" }),
      expect.objectContaining({ instanceId: "fashion-store-product", kind: "catalog" }),
    ]);
    for (const path of ["/", "/collections/travel-essentials", "/products/atlas-carry-on"]) {
      const route = resolveThemeRoute(path, fashionStoreThemeRoutes, input.catalogRelease, "live");
      expect(route).toBeDefined();
      expect(
        composeExperienceRoute({
          experience: input.snapshot,
          locale: "en-US",
          path,
          release: input.catalogRelease,
          route: route!,
        }).ok,
      ).toBe(true);
    }
  });

  test("keeps live theme surfaces on presentation view models and injected intent ports", async () => {
    const liveSources = await Promise.all([
      source("themes/fashion-store/components/shared/FashionStoreLiveCatalog.vue"),
      source("themes/fashion-store/components/pages/FashionStoreLiveProductPage.vue"),
    ]);
    for (const value of liveSources) {
      expect(value).not.toMatch(/\/fixtures\/|useCommerceApi|useGuestCart|\$fetch|\bfetch\s*\(/);
    }
    expect(liveSources[1]).toContain("runtimeCommercePortKey");
    expect(liveSources[1]).toContain("storefrontActionAdapterKey");
  });

  test("dispatches fixture-heavy home and product implementations only for fixture view models", async () => {
    const dispatchers = await Promise.all([
      source("themes/fashion-store/components/FashionStoreHomeRoute.vue"),
      source("themes/fashion-store/components/pages/FashionStoreProductRoute.vue"),
    ]);
    expect(dispatchers.every((value) => value.includes("defineAsyncComponent"))).toBe(true);
    expect(dispatchers[0]).toContain("viewModel.kind === 'collection-grid'");
    expect(dispatchers[1]).toContain("viewModel.kind === 'product'");
  });

  test("keeps unsupported capabilities absent from live surfaces while preserving truthful exits", async () => {
    expect(fashionStoreLiveCapabilities).toEqual({
      account: false,
      articleComments: false,
      catalogSearch: false,
      contactSubmission: false,
      newsletter: false,
      productCompare: false,
      productQuestion: false,
      productQuickView: true,
      productShare: true,
      reviews: false,
      wishlist: false,
    });
    const [contentRoute, liveContent] = await Promise.all([
      source("themes/fashion-store/components/pages/FashionStoreContentRoute.vue"),
      source("themes/fashion-store/components/pages/FashionStoreLiveContentPage.vue"),
    ]);
    expect(contentRoute).toContain("defineAsyncComponent");
    expect(contentRoute).toContain("viewModel.kind === 'state'");
    expect(liveContent).not.toMatch(/<form|useCommerceApi|useGuestCart|\/fixtures\//);
    expect(liveContent).toContain("viewModel.action.label");
    expect(liveContent).toContain("Return home");
  });

  test("shares the readonly guest cart with every mounted live cart surface", async () => {
    const [host, miniCart, cartPage, checkoutPage] = await Promise.all([
      source("StorefrontExperience.vue"),
      source("themes/fashion-store/components/shared/FashionStoreMiniCart.vue"),
      source("themes/fashion-store/components/pages/FashionStoreCartPage.vue"),
      source("themes/fashion-store/components/pages/FashionStoreCheckoutPage.vue"),
    ]);

    expect(host).toContain("provide(storefrontCartStateKey, readonly(guestCart))");
    for (const surface of [miniCart, cartPage, checkoutPage]) {
      expect(surface).toContain("inject(storefrontCartStateKey");
      expect(surface).not.toContain("useGuestCart(");
    }
    expect(miniCart).not.toContain("const liveCart = ref<Cart | null>");
  });
});
