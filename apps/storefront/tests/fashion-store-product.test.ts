import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  buildFashionStoreProductCartRequest,
  clampFashionStoreProductQuantity,
  fashionStoreProductData,
} from "../app/themes/fashion-store/fixtures/pages/product";
import {
  fashionStoreProductAuthorityExceptions,
  fashionStoreProductParityProfile,
  fashionStoreProductRegionLedger,
  fashionStoreProductSinglePathContract,
  fashionStoreProductSourcePage,
} from "../app/themes/fashion-store/contracts/pages/product";
import { fashionStoreEnabledPageContracts } from "../app/themes/fashion-store/page-contracts";

const productPageSource = readFile(
  new URL(
    "../app/themes/fashion-store/components/pages/FashionStoreProductPage.vue",
    import.meta.url,
  ),
  "utf8",
);
const shellSource = readFile(
  new URL("../app/themes/fashion-store/components/shared/FashionStoreShell.vue", import.meta.url),
  "utf8",
);
const footerSource = readFile(
  new URL("../app/themes/fashion-store/components/shared/FashionStoreFooter.vue", import.meta.url),
  "utf8",
);
const integrationSource = readFile(
  new URL("../app/themes/fashion-store/integration.css", import.meta.url),
  "utf8",
);

describe("Fashion Store product detail", () => {
  test("keeps internal page fit owned by the shared canonical shell", async () => {
    const [shell, footer, integration] = await Promise.all([
      shellSource,
      footerSource,
      integrationSource,
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
      /\[data-fashion-store-product\] \.product-info\s*\{[^}]*min-height/,
    );
    expect(integration).toMatch(
      /\.fashion-product-related\s+\[data-fashion-store-product-card\]\s+\.shop-image\s+img\s*\{[^}]*aspect-ratio:\s*600 \/ 765/,
    );
    expect(integration).not.toMatch(
      /\[data-fashion-store-product\] \.fashion-product-tabs\s*\{[^}]*min-height/,
    );
    expect(integration).not.toMatch(
      /\[data-fashion-store-header\] \+ main > \.top-space-margin\s*\{[^}]*margin-top:\s*(?:79|118|119)px/,
    );
  });

  test("pins the user-approved Product omissions", async () => {
    const [component, footer] = await Promise.all([productPageSource, footerSource]);

    expect(component).not.toContain("['compare', 'question', 'share']");
    expect(footer).not.toContain("liveMode ? 'col-12' : 'col-6'");
  });

  test("pins the approved Product review and interaction state polish", async () => {
    const [component, integration] = await Promise.all([productPageSource, integrationSource]);

    expect(component).not.toContain(
      "Rating breakdown is unavailable for this historical review snapshot.",
    );
    expect(component).toContain("hoveredReviewRating");
    expect(component).toContain('@mouseenter="hoveredReviewRating = star"');
    expect(component).toContain('@mouseleave="hoveredReviewRating = 0"');
    expect(integration).toMatch(
      /\.fashion-product-review-form legend\.form-label\s*\{[^}]*font-size:\s*17px;[^}]*line-height:\s*32px;/,
    );
    expect(integration).toMatch(
      /\.fashion-product-secondary-actions button:disabled\s*\{[^}]*cursor:\s*default;[^}]*opacity:/,
    );
    expect(integration).toMatch(
      /\.fashion-store-footer-canonical a\[href\]:not\(\[aria-disabled="true"\]\):hover\s*\{[^}]*color:\s*var\(--base-color\)\s*!important;/,
    );
    expect(integration).toMatch(
      /\.fashion-product-review-rating-option\[data-preview-active="true"\]\s+span/,
    );
    expect(integration).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.fashion-product-review-rating-option\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/,
    );
    expect(integration).toContain(".btn.btn-switch-text:hover .btn-double-text.btn-double-text");
  });

  test("pins the product source and its deterministic presentation facts", () => {
    expect(fashionStoreProductSourcePage).toMatchObject({
      baselineComponentCommit: "f3be48b38cd265ae16a65394431901e1f4b1cd5b",
      baselineComponentSha256: "9788cad519037756258d65691152b97f1b5aacfc6a07f1245302dc7c97dd2060",
      id: "product",
      route: "/products/relaxed-corduroy-shirt",
      sourceEntry: "demo-fashion-store-single-product.html",
      sourceRole: "secondary-design-reference",
      sourceSha256: "9f2a5cb42d81df1505c3a911c59544eefd8a0a60e6b27791d8469fd552179f43",
      visualAuthority: "historical-vue-component",
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

  test("pins the FS-F11 Product target and its truthful live-data exceptions", () => {
    expect(fashionStoreProductParityProfile.capture).toEqual({
      colorScheme: "light",
      cookieState: "accepted",
      deviceScaleFactor: 1,
      screenshotChangedPixelRatioMax: 0.01,
      screenshotMeanChannelDeltaMax: 5,
    });
    expect(fashionStoreProductParityProfile.dynamicMasks).toEqual([
      "decoded pixels inside released gallery, detail, review, and related image boxes",
    ]);
    expect(
      fashionStoreProductParityProfile.viewports.flatMap(({ pixelMasks }) => pixelMasks),
    ).toEqual([]);
    expect(fashionStoreProductParityProfile.authority).toEqual({
      commit: "f3be48b38cd265ae16a65394431901e1f4b1cd5b",
      component: "FashionStoreProductPage.vue",
      kind: "historical-vue-component",
    });
    expect(fashionStoreProductParityProfile.viewports.map(({ viewport }) => viewport)).toEqual([
      { height: 1000, width: 1440 },
      { height: 844, width: 390 },
    ]);
    expect(
      fashionStoreProductParityProfile.viewports.map(({ screenshotSha256 }) => screenshotSha256),
    ).toEqual([
      "aebbf5e0dd62f3466b21873330aeda31a9c82ee1958036e794c7db66ffd7c9c4",
      "42a4a489f10386539523f57cd13fe6686b378b5200ac7af8d3410eaf8a6a55ce",
    ]);
    expect(fashionStoreProductAuthorityExceptions).toHaveLength(5);
    expect(fashionStoreProductSinglePathContract).toMatchObject({
      component: "FashionStoreProductPage",
      model: "ProductPageModel",
      releaseBacked: true,
    });
  });

  test("rejects every current Product path until all entries use one release-backed model", async () => {
    const [experience, fixtureProvider, productContract, productionRoute] = await Promise.all([
      readFile(new URL("../app/StorefrontExperience.vue", import.meta.url), "utf8"),
      readFile(
        new URL("../app/theme-engine/providers/fixture-preview.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/themes/fashion-store/contracts/product-card.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/pages/products/[slug].vue", import.meta.url), "utf8"),
    ]);

    expect(experience).not.toContain(
      'activeExperienceProviderInput.mode === "live" ? "live" : "fixture-preview"',
    );
    expect(fixtureProvider).not.toContain('resolved.kind === "theme-section"');
    expect(productContract).not.toContain("normalizeFashionStoreFixtureProductPresentation");
    expect(productContract).not.toContain("normalizeFashionStoreLiveProductPresentation");
    expect(productionRoute).toContain("ActiveProductPage");
    expect(productionRoute).not.toContain("composeProductPageModel");
    expect(productionRoute).toContain("return loadProductPage(slug)");
    expect(productionRoute).toContain('from "~/generated/active-theme"');
    expect(productionRoute).not.toContain('from "~/themes/fashion-store/');
    expect(productionRoute).toContain(
      "const { collection, product, releaseId, siteOrigin, viewModel } = page.value",
    );
    expect(productionRoute).toContain("if (pageError.value) throw pageError.value");
    expect(productionRoute).not.toContain("const { collection, product, release } = page.value");
    expect(productionRoute).toContain("definePageMeta({ layout: false })");
    expect(productionRoute).not.toContain("fixtures/");
    expect(productionRoute).not.toContain('<article class="product-page">');
  });

  test("preserves every required Product baseline relationship named by the region ledger", async () => {
    const component = await productPageSource;
    const missingRelationships = fashionStoreProductRegionLedger.flatMap((region) =>
      region.implementationEvidence
        .filter((evidence) => !component.includes(evidence))
        .map((evidence) => `${region.id}: missing ${evidence}`),
    );

    expect(missingRelationships).toEqual([]);
  });

  test("declares truthful treatment for every Product region without fixture-only live defaults", () => {
    expect(
      fashionStoreProductRegionLedger.every(({ allowedTreatments }) => allowedTreatments.length),
    ).toBe(true);
    expect(JSON.stringify(fashionStoreProductRegionLedger)).not.toContain("fixtureTreatments");
    expect(JSON.stringify(fashionStoreProductRegionLedger)).not.toContain("liveTreatments");
    for (const id of ["information-panel", "shipping-panel", "reviews-panel"]) {
      expect(
        fashionStoreProductRegionLedger.find((region) => region.id === id)?.allowedTreatments,
      ).toContain("source-shaped-empty");
    }
  });

  test("rejects the reduced Product component when frozen right-rail and rich-detail bindings are absent", async () => {
    const component = await productPageSource;
    const requiredBindings = [
      "presentation.brand",
      "presentation.reviewSummary.label",
      "Delivery timing:",
      "Shipping &amp; returns:",
      "Payment methods",
      "Category:",
      "Tags:",
      "presentation.descriptionDetail.eyebrow",
      "presentation.descriptionDetail.heading",
      "presentation.descriptionDetail.bullets",
      "presentation.specifications",
      "presentation.shipping.standard",
      "presentation.reviews",
    ];

    expect(requiredBindings.filter((content) => !component.includes(content))).toEqual([]);
  });

  test("keeps unsupported Product facts out when their ledger owner is unavailable", async () => {
    const [component, header, searchOverlay, shell] = await Promise.all([
      productPageSource,
      readFile(
        new URL(
          "../app/themes/fashion-store/components/shared/FashionStoreHeader.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/themes/fashion-store/components/shared/FashionStoreSearchOverlay.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/themes/fashion-store/components/shared/FashionStoreShell.vue",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
    expect(component).not.toContain('<template v-if="presentation.assurance">');
    expect(component).toContain('data-product-region-state="assurance"');
    expect(component).toContain(
      "v-else-if=\"presentation.optionalRegions.shipping === 'source-shaped-empty'\"",
    );
    expect(component).toContain(
      "v-else-if=\"presentation.optionalRegions.reviews === 'source-shaped-empty'\"",
    );
    expect(component).not.toContain("25,000+");
    expect(component).not.toContain("<strong>Express:</strong>");
    expect(component).toContain("Related products are not available for this item.");
    expect(component).not.toContain(
      '<section v-if="presentation.relatedProducts.length" class="pt-0 fashion-product-related">',
    );
    expect(component).not.toContain("2,488 Reviews");
    expect(component).not.toContain('href="/shop"');
    expect(component).toContain(
      ":href=\"publishedRouteHref(fashionStoreRoutePaths['shop-left'])\"",
    );
    expect(shell).not.toContain('href="/shop"');
    expect(searchOverlay).not.toContain('href="/shop"');
    expect(header).toContain('<div v-if="!liveMode" class="widget-text icon alt-font">');
    expect(header).not.toContain("123 456 7890");
    expect(header).not.toContain("info@domain.com");
  });

  test("keeps option controls injective and never fabricates neutral color swatches", async () => {
    const [component, integration] = await Promise.all([
      productPageSource,
      readFile(new URL("../app/themes/fashion-store/integration.css", import.meta.url), "utf8"),
    ]);

    expect(component).toContain("optionInputId(groupIndex, valueIndex)");
    expect(component).not.toContain("optionIdPart");
    expect(component).not.toContain(
      "presentation.optionPresentationFallback === 'historical-neutral'",
    );
    expect(component).not.toContain("?? '#d9d9d9'");
    expect(component).toContain("optionValueDefinition(group.name, value)?.swatch");
    expect(component).not.toMatch(
      /data-product-option-label[\s\S]*?<span class="visually-hidden">\{\{ value \}\}<\/span>[\s\S]*?<\/span>/,
    );
    expect(integration).not.toContain(".fashion-product-color-swatches li {");
    expect(integration).not.toContain(".fashion-product-color-swatches input + label > span {");
  });

  test("keeps the Product related collection fashion-only and donor ordered", async () => {
    const release = JSON.parse(
      await readFile(new URL("../fixtures/release.json", import.meta.url), "utf8"),
    ) as {
      collections: Array<{ slug: string; productSlugs: string[] }>;
    };
    const collection = release.collections.find(({ slug }) => slug === "travel-essentials");

    expect(collection?.productSlugs).toEqual([
      "relaxed-corduroy-shirt",
      "textured-sweater-01",
      "traveller-shirt-02",
      "crewneck-sweatshirt-03",
      "skinny-trousers-04",
    ]);
    expect(collection?.productSlugs).not.toContain("atlas-carry-on");
  });

  test("uses one effective description media object for its source, alt, and error identity", async () => {
    const component = await productPageSource;

    expect(component).toContain("const descriptionMedia = computed");
    expect(component).toContain(':src="descriptionMediaSource"');
    expect(component).toContain(':alt="descriptionMediaAlt"');
    expect(component).toContain('@error="failedDescriptionMediaSource = descriptionMediaSource"');
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
    const source = await productPageSource;

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
