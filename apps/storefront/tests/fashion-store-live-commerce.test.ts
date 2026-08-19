import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { composeExperienceRoute } from "../app/theme-engine/composer";
import { resolveThemeRoute } from "../app/theme-engine/routes";
import { fashionStoreLiveCapabilities } from "../app/themes/fashion-store/capability-matrix";
import { fashionStoreCompositionAdapter } from "../app/themes/fashion-store/composition";
import { fashionStoreThemeRoutes } from "../app/themes/fashion-store/page-contracts";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";

const appRoot = resolve(import.meta.dir, "../app");

async function source(path: string): Promise<string> {
  return readFile(resolve(appRoot, path), "utf8");
}

describe("Fashion Store live commerce boundary", () => {
  test("generates Catalog bindings that compose the deployed U13 routes", async () => {
    const script = await import("../scripts/prepare-fashion-store-live-e2e");
    expect(typeof script.fashionStoreLiveBuildInput).toBe("function");

    const [fixtureInput, releaseFixture] = await Promise.all([
      fashionStorePreviewBuildInput("https://preview.example.test"),
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
          adapter: fashionStoreCompositionAdapter,
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
    expect(dispatchers[0]).toContain("viewModel.kind === 'home'");
    expect(dispatchers[1]).toContain("viewModel.kind === 'product'");
  });

  test("renders the full live Home and one stateful shared Home card without first-touch suppression", async () => {
    const [liveHome, productCard] = await Promise.all([
      source("themes/fashion-store/components/FashionStoreLiveHomePage.vue"),
      source("themes/fashion-store/components/shared/FashionStoreProductCard.vue"),
    ]);

    expect(liveHome).not.toContain("FashionStoreLiveCatalog");
    expect(liveHome).toContain("FashionStoreProductCard");
    for (const section of [
      "hero",
      "services",
      "categories",
      "best-sellers",
      "promotion",
      "collection",
      "brands",
      "featured-products",
      "marquee",
      "magazine",
    ]) {
      expect(liveHome).toContain(`data-home-section="${section}"`);
    }
    expect(liveHome).not.toContain('visual-variant="home"');
    expect(productCard).toContain("runtimeCommercePortKey");
    expect(productCard).toContain("storefrontActionAdapterKey");
    expect(productCard).toContain("verifyProductCartAdd(");
    expect(productCard).not.toContain("onMounted(");
    expect(productCard).toContain("data-action-state");
    expect(productCard).toContain('aria-live="polite"');
    expect(productCard).not.toContain("suppressNextProductLink");
    expect(productCard).not.toContain("exposeTouchActions");
  });

  test("keeps unsupported capabilities absent from live surfaces while preserving truthful exits", async () => {
    expect(fashionStoreLiveCapabilities).toEqual({
      account: false,
      articleComments: false,
      catalogSearch: true,
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
    expect(liveContent).toContain('href="/shop"');
    expect(liveContent).toContain("no recovery products are currently published");
    expect(liveContent).toContain("Return home");
    expect(liveContent).toContain("FashionStoreProductCard");
    expect(liveContent).toContain("viewModel.products");
    expect(liveContent).not.toContain("fashion-wishlist-remove");
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

  test("shares Home shell edits and platform presentation without replacing Commerce facts", async () => {
    const [host, shell, content, product, catalog, cart, checkout, order, policy] =
      await Promise.all([
        source("StorefrontExperience.vue"),
        source("themes/fashion-store/components/shared/FashionStoreShell.vue"),
        source("themes/fashion-store/components/pages/FashionStoreLiveContentPage.vue"),
        source("themes/fashion-store/components/pages/FashionStoreLiveProductPage.vue"),
        source("themes/fashion-store/components/shared/FashionStoreLiveCatalog.vue"),
        source("themes/fashion-store/components/pages/FashionStoreCartPage.vue"),
        source("themes/fashion-store/components/pages/FashionStoreCheckoutPage.vue"),
        source("pages/orders/[token].vue"),
        source("pages/policies/[slug].vue"),
      ]);

    expect(host).toContain("provide(storefrontPresentationShellKey, experienceShell)");
    expect(host).toContain("provide(storefrontPlatformPresentationKey, platformPresentation)");
    expect(shell).toContain("inject(storefrontPresentationShellKey");
    for (const surface of [content, product, catalog]) {
      expect(surface).not.toMatch(/announcement=(?:"|')/);
    }
    for (const surface of [cart, checkout]) {
      expect(surface).not.toContain("totals are verified by Commerce");
    }
    expect(order).toContain("data-order-presentation-help");
    expect(order).toContain("data-order-presentation-policy-link");
    expect(order).toContain("access.order.lines");
    expect(policy).toContain("data-policy-presentation-document-link");
    expect(policy).toContain("data-policy-presentation-related-link");
    expect(policy).toContain("policy.sections");
  });
});
