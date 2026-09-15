import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { composeExperienceRoute } from "../app/theme-engine/composer";
import { resolveThemeRoute } from "../app/theme-engine/routes";
import { fashionStoreLiveCapabilities } from "../app/themes/fashion-store/capability-matrix";
import { fashionStoreCompositionAdapter } from "../app/themes/fashion-store/composition";
import { fashionStoreThemeRoutes } from "../app/themes/fashion-store/page-contracts";
import { fashionStoreSectionComposition } from "../app/themes/fashion-store/successor/registry";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { experienceBuildInputSchema } from "../scripts/prepare-experience";

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

    expect(input.mediaOrigins).toEqual([]);
    expect(experienceBuildInputSchema.parse(input)).toEqual(input);
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
          sectionComposition: fashionStoreSectionComposition,
        }).ok,
      ).toBe(true);
    }
  });

  test("keeps every live Home Section truthful when the bound collection is empty", async () => {
    const script = await import("../scripts/prepare-fashion-store-live-e2e");
    const [fixtureInput, releaseFixture] = await Promise.all([
      fashionStorePreviewBuildInput("https://preview.example.test"),
      readFile(resolve(import.meta.dir, "../fixtures/release.json"), "utf8").then(JSON.parse),
    ]);
    const collection = releaseFixture.collections.find(({ status }) => status === "published");
    if (!collection) throw new Error("Published Home collection is missing.");
    collection.productSlugs = [];
    for (const product of releaseFixture.products) {
      product.collectionSlugs = product.collectionSlugs.filter(
        (collectionSlug: string) => collectionSlug !== collection.slug,
      );
    }
    const input = script.fashionStoreLiveBuildInput(fixtureInput, releaseFixture);
    const route = resolveThemeRoute("/", fashionStoreThemeRoutes, input.catalogRelease, "live")!;
    const composed = composeExperienceRoute({
      adapter: fashionStoreCompositionAdapter,
      experience: input.snapshot,
      locale: "en-US",
      path: "/",
      release: input.catalogRelease,
      route,
      sectionComposition: fashionStoreSectionComposition,
    });

    expect(composed.ok).toBe(true);
    expect(Object.keys(composed.viewModels)).toHaveLength(10);
    for (const viewModel of Object.values(composed.viewModels)) {
      expect(viewModel.kind).toBe("theme-section");
      if (viewModel.kind !== "theme-section") continue;
      const home = viewModel.data.home as { products: unknown[] };
      expect(home.products).toEqual([]);
    }
  });

  test("builds Product groups only from published collection membership", async () => {
    const script = await import("../scripts/prepare-fashion-store-live-e2e");
    const [fixtureInput, releaseFixture] = await Promise.all([
      fashionStorePreviewBuildInput("https://preview.example.test"),
      readFile(resolve(import.meta.dir, "../fixtures/release.json"), "utf8").then(JSON.parse),
    ]);
    const input = script.fashionStoreLiveBuildInput(fixtureInput, releaseFixture);
    const home = input.snapshot.resolvedTemplates.find(({ pageType }) => pageType === "home")!;
    const merchandising = home.sections.find(
      ({ id }) => id === "fashion-store-home-product-merchandising",
    )!;
    merchandising.visible = true;
    const route = resolveThemeRoute("/", fashionStoreThemeRoutes, input.catalogRelease, "live")!;
    const composed = composeExperienceRoute({
      adapter: fashionStoreCompositionAdapter,
      experience: input.snapshot,
      locale: "en-US",
      path: "/",
      release: input.catalogRelease,
      route,
      sectionComposition: fashionStoreSectionComposition,
    });

    expect(composed.ok).toBe(true);
    const viewModel = composed.viewModels[merchandising.id];
    expect(viewModel?.kind).toBe("theme-section");
    if (viewModel?.kind !== "theme-section") throw new Error("Merchandising ViewModel is missing.");
    const groups = (
      viewModel.data.merchandising as {
        groups: Array<{ id: string; products: Array<{ productId: string }> }>;
      }
    ).groups;
    expect(groups.map(({ id }) => id)).toEqual(["new-arrivals", "best-sellers", "featured"]);
    const publishedCollection = input.catalogRelease.collections.find(
      ({ status }) => status === "published",
    )!;
    const membership = new Set(publishedCollection.productIds);
    expect(
      groups
        .flatMap(({ products }) => products)
        .every(({ productId }) => membership.has(productId)),
    ).toBe(true);

    const outsideProduct = input.catalogRelease.products.find(
      ({ id, status }) => status === "published" && membership.has(id),
    );
    if (!outsideProduct) throw new Error("Fixture needs a published Home product.");
    publishedCollection.productIds = publishedCollection.productIds.filter(
      (id) => id !== outsideProduct.id,
    );
    publishedCollection.productSlugs = publishedCollection.productSlugs.filter(
      (slug) => slug !== outsideProduct.slug,
    );
    outsideProduct.collectionIds = outsideProduct.collectionIds.filter(
      (id) => id !== publishedCollection.id,
    );
    outsideProduct.collectionSlugs = outsideProduct.collectionSlugs.filter(
      (slug) => slug !== publishedCollection.slug,
    );
    input.snapshot.bindings.push({
      id: "fashion-store-live-home-featured-product-binding",
      instanceId: "fashion-store-home",
      kind: "catalog",
      reference: { id: outsideProduct.id, kind: "product" },
      settingId: "featured-product",
    });
    const recomposed = composeExperienceRoute({
      adapter: fashionStoreCompositionAdapter,
      experience: input.snapshot,
      locale: "en-US",
      path: "/",
      release: input.catalogRelease,
      route,
      sectionComposition: fashionStoreSectionComposition,
    });
    const recomposedViewModel = recomposed.viewModels[merchandising.id];
    if (recomposedViewModel?.kind !== "theme-section") {
      throw new Error(
        `Recomposed merchandising ViewModel is missing: ${JSON.stringify(recomposed)}`,
      );
    }
    const featured = (
      recomposedViewModel.data.merchandising as {
        groups: Array<{ id: string; products: Array<{ productId: string }> }>;
      }
    ).groups.find(({ id }) => id === "featured")!;
    const remainingMembership = new Set(publishedCollection.productIds);
    expect(featured.products.every(({ productId }) => remainingMembership.has(productId))).toBe(
      true,
    );
    expect(featured.products.some(({ productId }) => productId === outsideProduct.id)).toBe(false);
  });

  test("keeps live theme surfaces on presentation view models and injected intent ports", async () => {
    const liveSources = await Promise.all([
      source("themes/fashion-store/components/shared/FashionStoreLiveCatalog.vue"),
      source("themes/fashion-store/components/pages/FashionStoreProductPage.vue"),
    ]);
    for (const value of liveSources) {
      expect(value).not.toMatch(/\/fixtures\/|useCommerceApi|useGuestCart|\$fetch|\bfetch\s*\(/);
    }
    expect(liveSources[1]).toContain("useFashionStoreProductActionPort");
    expect(liveSources[1]).not.toContain("runtimeCommercePortKey");
    expect(liveSources[1]).not.toContain("storefrontActionAdapterKey");
  });

  test("keeps the remaining Home dispatcher while Product uses one visual component", async () => {
    const [homeRoute, productPage] = await Promise.all([
      source("themes/fashion-store/components/FashionStoreHomeRoute.vue"),
      source("themes/fashion-store/components/pages/FashionStoreProductPage.vue"),
    ]);
    expect(homeRoute).toContain("defineAsyncComponent");
    expect(homeRoute).toContain("viewModel.kind === 'home'");
    expect(productPage).not.toContain("defineAsyncComponent");
    expect(productPage).not.toMatch(/viewModel\.kind\s*===\s*["']product["']/);
  });

  test("renders the full live Home and keeps no-JavaScript purchase controls inert", async () => {
    const [liveHome, productCard] = await Promise.all([
      Promise.all(
        [
          "Hero",
          "Services",
          "Categories",
          "BestSellers",
          "Promotion",
          "CollectionFeature",
          "BrandStrip",
          "FeaturedProducts",
          "Marquee",
          "Editorial",
        ].map((name) =>
          source(`themes/fashion-store/components/sections/FashionStoreLive${name}Section.vue`),
        ),
      ).then((sources) => sources.join("\n")),
      source("themes/fashion-store/components/shared/FashionStoreProductCard.vue"),
    ]);

    expect(liveHome).not.toContain("FashionStoreLiveCatalog");
    expect(liveHome).toContain("FashionStoreProductCard");
    expect(liveHome).not.toMatch(/\/fixtures\/|useCommerceApi|useGuestCart|\$fetch|\bfetch\s*\(/);
    expect(liveHome.match(/This collection does not have published products yet\./g)).toHaveLength(
      2,
    );
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
    expect(productCard).toContain("onMounted(");
    expect(productCard).toContain('!hydrated.value ? "loading"');
    expect(productCard).toContain("data-action-state");
    expect(productCard).toContain('aria-live="polite"');
    expect(productCard).not.toContain("suppressNextProductLink");
    expect(productCard).not.toContain("exposeTouchActions");
  });

  test("uses the established accessible gallery for multi-media live products", async () => {
    const [liveProduct, gallery] = await Promise.all([
      source("themes/fashion-store/components/pages/FashionStoreProductPage.vue"),
      source("themes/fashion-store/components/shared/FashionStoreProductGallery.vue"),
    ]);

    expect(liveProduct).toContain("displayedGallery.value");
    expect(liveProduct).toContain("FashionStoreProductGallery");
    expect(liveProduct).toContain("FashionStoreProductLightbox");
    expect(liveProduct).toContain('v-if="galleryImages.length"');
    expect(gallery).toContain('aria-label="Product gallery"');
    expect(gallery).toContain(':alt="imageAlt(image)"');
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
        source("themes/fashion-store/components/pages/FashionStoreProductPage.vue"),
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
