import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { composeExperienceRoute } from "../app/theme-engine/composer";
import { resolveThemeRoute } from "../app/theme-engine/routes";
import type { PresentationViewModel } from "../app/theme-engine/view-models";
import { fashionStoreLiveCapabilities } from "../app/themes/fashion-store/capability-matrix";
import { fashionStoreCompositionAdapter } from "../app/themes/fashion-store/composition";
import { normalizeFashionStoreRuntimeProductState } from "../app/themes/fashion-store/composables/useFashionStoreProductActionPort";
import type { FashionStoreProductPresentation } from "../app/themes/fashion-store/contracts/product-card";
import { resolveFashionStoreContentPresentation } from "../app/themes/fashion-store/contracts/content-presentation";
import { fashionStoreContentData } from "../app/themes/fashion-store/fixtures/pages/content";
import { fashionStoreThemeRoutes } from "../app/themes/fashion-store/page-contracts";
import { fashionStoreSectionComposition } from "../app/themes/fashion-store/successor/registry";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { experienceBuildInputSchema } from "../scripts/prepare-experience";

const appRoot = resolve(import.meta.dir, "../app");

async function source(path: string): Promise<string> {
  return readFile(resolve(appRoot, path), "utf8");
}

describe("Fashion Store live commerce boundary", () => {
  test("overlays only released Variant price and availability while preserving presentation", () => {
    const releasedPresentation = {
      currency: "USD",
      gallery: [
        {
          alt: "Released gallery",
          height: 900,
          kind: "url",
          src: "https://media.example.test/released-gallery.jpg",
          width: 700,
        },
      ],
      optionGroups: [{ name: "Color", values: ["Blue", "Green", "Gold"] }],
      productId: "product-release",
      slug: "released-product",
      variants: [
        {
          id: "var-blue",
          label: "Released Blue",
          optionValues: { Color: "Blue" },
          selected: true,
          sku: "RELEASE-BLUE",
        },
        {
          id: "var-green",
          label: "Released Green",
          optionValues: { Color: "Green" },
          selected: false,
          sku: "RELEASE-GREEN",
        },
        {
          id: "var-gold",
          label: "Released Gold",
          optionValues: { Color: "Gold" },
          selected: false,
          sku: "RELEASE-GOLD",
        },
      ],
    } as FashionStoreProductPresentation;
    const runtime = normalizeFashionStoreRuntimeProductState(
      {
        availability: "in-stock",
        id: "product-release",
        media: [],
        optionGroups: [{ name: "Color", values: ["Blue", "Green"] }],
        slug: "released-product",
        variants: [
          {
            availability: "out-of-stock",
            id: "var-blue",
            label: "Blue",
            money: { amount: 6500, compareAtAmount: 8500, currency: "USD" },
            options: { Color: "Blue" },
            sku: "LIVE-BLUE",
          },
          {
            availability: "in-stock",
            id: "var-green",
            label: "Green",
            money: { amount: 7200, currency: "USD" },
            options: { Color: "Green" },
            sku: "LIVE-GREEN",
          },
          {
            availability: "in-stock",
            id: "var-unknown",
            label: "Unknown",
            money: { amount: 9900, currency: "USD" },
            options: { Color: "Unknown" },
            sku: "LIVE-UNKNOWN",
          },
        ],
      },
      releasedPresentation,
    );

    expect(runtime.availability).toBe("in-stock");
    expect(runtime).not.toHaveProperty("gallery");
    expect(runtime).not.toHaveProperty("optionGroups");
    expect(runtime.variants).toEqual([
      expect.objectContaining({
        availability: "out-of-stock",
        compareAtPriceLabel: "$85.00",
        id: "var-blue",
        priceLabel: "$65.00",
        label: "Released Blue",
        selected: true,
        sku: "RELEASE-BLUE",
      }),
      expect.objectContaining({
        availability: "in-stock",
        compareAtPriceLabel: undefined,
        id: "var-green",
        priceLabel: "$72.00",
        label: "Released Green",
        sku: "RELEASE-GREEN",
      }),
      expect.objectContaining({
        availability: "out-of-stock",
        id: "var-gold",
        label: "Released Gold",
        sku: "RELEASE-GOLD",
      }),
    ]);
    expect(runtime.variants).not.toContainEqual(expect.objectContaining({ id: "var-unknown" }));
    expect(() =>
      normalizeFashionStoreRuntimeProductState(
        { ...({} as Parameters<typeof normalizeFashionStoreRuntimeProductState>[0]), id: "wrong" },
        releasedPresentation,
      ),
    ).toThrow("identity");
    expect(() =>
      normalizeFashionStoreRuntimeProductState(
        {
          availability: "in-stock",
          id: "product-release",
          media: [],
          optionGroups: [],
          slug: "released-product",
          variants: [
            {
              availability: "in-stock",
              id: "var-blue",
              label: "Blue",
              money: { amount: 6500, currency: "EUR" },
              options: { Color: "Blue" },
              sku: "LIVE-BLUE",
            },
          ],
        },
        releasedPresentation,
      ),
    ).toThrow("currency");
  });

  test("normalizes complete content, unavailable routes, and wishlist recovery without provider layout state", () => {
    const fixture = resolveFashionStoreContentPresentation(
      {
        data: fashionStoreContentData,
        kind: "theme-section",
        state: "populated",
      },
      "about",
    );
    expect(fixture.detail).toBe(fashionStoreContentData.about);
    expect(fixture.state).toMatchObject({ heading: "About", state: "populated" });

    const unavailable = resolveFashionStoreContentPresentation(
      {
        action: { id: "shop", intent: "navigation", label: "Shop", target: "/shop" },
        heading: "Account unavailable",
        kind: "state",
        message: "Accounts are unavailable.",
        state: "unavailable",
      },
      "account",
    );
    expect(unavailable).toEqual({
      state: {
        action: { id: "shop", intent: "navigation", label: "Shop", target: "/shop" },
        heading: "Account unavailable",
        media: undefined,
        message: "Accounts are unavailable.",
        products: [],
        relatedAction: undefined,
        state: "unavailable",
      },
    });

    const product = { productId: "catalog-product" } as Extract<
      PresentationViewModel,
      { kind: "collection-grid" }
    >["products"][number];
    const wishlist = resolveFashionStoreContentPresentation(
      {
        collections: [],
        description: "Wishlist recovery",
        heading: "Wishlist",
        kind: "collection-grid",
        products: [product],
        state: "unavailable",
      },
      "wishlist",
    );
    expect(wishlist.detail).toBeUndefined();
    expect(wishlist.state.products).toEqual([product]);
    expect(wishlist.state.action).toEqual({ label: "Continue shopping", target: "/shop" });
  });

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
      source("themes/fashion-store/components/pages/FashionStoreCollectionPage.vue"),
      source("themes/fashion-store/components/pages/FashionStoreShopPage.vue"),
      source("themes/fashion-store/components/pages/FashionStoreProductPage.vue"),
    ]);
    for (const value of liveSources.slice(0, 2)) {
      expect(value).not.toMatch(/\/fixtures\/|useCommerceApi|useGuestCart|\$fetch|\bfetch\s*\(/);
    }
    expect(liveSources[2]).not.toMatch(/\/fixtures\/|useGuestCart|\$fetch|\bfetch\s*\(/);
    expect(liveSources[2]).toContain("useFashionStoreProductActionPort");
    expect(liveSources[2]).not.toContain("runtimeCommercePortKey");
    expect(liveSources[2]).not.toContain("storefrontActionAdapterKey");
  });

  test("keeps Product on one visual component after removing the retired Home dispatcher", async () => {
    const productPage = await source(
      "themes/fashion-store/components/pages/FashionStoreProductPage.vue",
    );
    expect(productPage).not.toContain("defineAsyncComponent");
    expect(productPage).not.toMatch(/viewModel\.kind\s*===\s*["']product["']/);
  });

  test("renders the full live Home and keeps no-JavaScript purchase controls inert", async () => {
    const [liveHome, productCard] = await Promise.all([
      Promise.all(
        [
          "FashionStoreHeroSection.vue",
          "FashionStoreServicesSection.vue",
          "FashionStoreCategoriesSection.vue",
          "FashionStoreProductsSection.vue",
          "FashionStorePromotionSection.vue",
          "FashionStoreCollectionFeatureSection.vue",
          "FashionStoreBrandStripSection.vue",
          "FashionStoreMarqueeSection.vue",
          "FashionStoreEditorialSection.vue",
        ].map((name) => source(`themes/fashion-store/components/sections/${name}`)),
      ).then((sources) => sources.join("\n")),
      source("themes/fashion-store/components/shared/FashionStoreProductCard.vue"),
    ]);

    expect(liveHome).toContain("FashionStoreProductCard");
    expect(liveHome).not.toMatch(/\/fixtures\/|useCommerceApi|useGuestCart|\$fetch|\bfetch\s*\(/);
    expect(liveHome.match(/This collection does not have published products yet\./g)).toHaveLength(
      1,
    );
    for (const section of [
      "hero",
      "services",
      "categories",
      "promotion",
      "collection",
      "brands",
      "marquee",
      "magazine",
    ]) {
      expect(liveHome).toContain(`data-home-section="${section}"`);
    }
    expect(liveHome).toContain(':data-home-section="variant"');
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
    const [
      contentPage,
      contentState,
      contentContract,
      pageRegistry,
      fixtureRegistry,
      liveRegistry,
    ] = await Promise.all([
      source("themes/fashion-store/components/pages/FashionStoreContentPage.vue"),
      source("themes/fashion-store/components/pages/FashionStoreContentState.vue"),
      source("themes/fashion-store/contracts/content-presentation.ts"),
      source("themes/fashion-store/page-registry.ts"),
      source("themes/fashion-store/fixture-registry.ts"),
      source("themes/fashion-store/registry.ts"),
    ]);
    expect(pageRegistry).toContain('import("./components/pages/FashionStoreContentPage.vue")');
    expect(fixtureRegistry).toContain('from "./page-registry"');
    expect(liveRegistry).toContain('from "./page-registry"');
    expect(contentPage).not.toContain("viewModel.kind");
    expect(contentPage).toContain("resolveFashionStoreContentPresentation");
    expect(contentContract).toContain('viewModel.kind === "theme-section"');
    expect(contentContract).toContain('viewModel.kind === "collection-grid"');
    expect(contentState).not.toMatch(/<form|useCommerceApi|useGuestCart|\/fixtures\//);
    expect(contentState).toContain("presentation.action.label");
    expect(contentContract).toContain('target: "/shop"');
    expect(contentContract).toContain("no recovery products are currently published");
    expect(contentState).toContain("Return home");
    expect(contentState).toContain("FashionStoreProductCard");
    expect(contentState).toContain("presentation.products");
    expect(contentState).not.toContain("fashion-wishlist-remove");
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
    const [host, shell, content, product, collection, shop, cart, checkout, order, policy] =
      await Promise.all([
        source("StorefrontExperience.vue"),
        source("themes/fashion-store/components/shared/FashionStoreShell.vue"),
        source("themes/fashion-store/components/pages/FashionStoreContentPage.vue"),
        source("themes/fashion-store/components/pages/FashionStoreProductPage.vue"),
        source("themes/fashion-store/components/pages/FashionStoreCollectionPage.vue"),
        source("themes/fashion-store/components/pages/FashionStoreShopPage.vue"),
        source("themes/fashion-store/components/pages/FashionStoreCartPage.vue"),
        source("themes/fashion-store/components/pages/FashionStoreCheckoutPage.vue"),
        source("pages/orders/[token].vue"),
        source("pages/policies/[slug].vue"),
      ]);

    expect(host).toContain("provide(storefrontPresentationShellKey, experienceShell)");
    expect(host).toContain("provide(storefrontPlatformPresentationKey, platformPresentation)");
    expect(shell).toContain("inject(storefrontPresentationShellKey");
    for (const surface of [content, product, collection, shop]) {
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
