import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { themePackageSchema } from "@shoppp/contracts";

import { fashionPreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { renderActiveThemeModule } from "../scripts/prepare-experience";
import { fashionManifest, fashionThemeDescriptor } from "../app/themes/fashion/manifest";
import { fashionPreset } from "../app/themes/fashion/presets/editorial";
import { fashionHomeFixtures } from "../app/themes/fashion/fixtures/home";
import { themeAssets } from "../app/themes/fashion/resources";
import { fashionSourceContract } from "../app/themes/fashion/source-contract";

describe("Fashion theme package", () => {
  test("validates a versioned package with all in-scope presentation templates", () => {
    const parsed = themePackageSchema.parse({
      manifest: fashionManifest,
      presets: [fashionPreset],
    });

    expect(parsed.manifest.id).toBe("fashion");
    expect(parsed.presets[0]?.templates.map(({ pageType }) => pageType).sort()).toEqual([
      "cart",
      "checkout",
      "collection",
      "content",
      "home",
      "order",
      "policy",
      "product",
    ]);
  });

  test("keeps an explicit route inventory for all 15 Fashion reference pages", () => {
    expect(fashionSourceContract.referencePages).toHaveLength(15);
    expect(new Set(fashionSourceContract.referencePages.map(([source]) => source)).size).toBe(15);
    expect(fashionSourceContract.referencePages.map(([, route]) => route)).toContain("/account");
    expect(fashionSourceContract.referencePages.map(([, route]) => route)).toContain("/magazine");
    expect(fashionSourceContract.referencePages.map(([, route]) => route)).not.toContain(
      "/#fashion-magazine",
    );
  });

  test("binds every visible instance to fixture data without ambiguous IDs", async () => {
    const input = await fashionPreviewBuildInput("https://preview.example.test");
    const visibleInstanceIds = new Set(
      input.snapshot.resolvedTemplates.flatMap(({ sections }) =>
        sections
          .filter(({ visible }) => visible)
          .flatMap((section) => [
            section.id,
            ...section.blocks.filter(({ visible }) => visible).map(({ id }) => id),
          ]),
      ),
    );
    const bindingInstanceIds = input.snapshot.bindings.map(({ instanceId }) => instanceId);

    expect(new Set(bindingInstanceIds).size).toBe(bindingInstanceIds.length);
    expect(bindingInstanceIds.every((id) => visibleInstanceIds.has(id))).toBe(true);
    expect([...visibleInstanceIds].every((id) => bindingInstanceIds.includes(id))).toBe(true);
  });

  test("declares the complete reference-backed Fashion home inventory in order", () => {
    const home = fashionPreset.templates.find(({ pageType }) => pageType === "home")!;
    expect(home.sections.map(({ type }) => type)).toEqual([
      "fashion.header",
      "fashion.hero-carousel",
      "fashion.service-strip",
      "fashion.category-tiles",
      "fashion.product-showcase",
      "fashion.promo-band",
      "fashion.collection-carousel",
      "fashion.brand-strip",
      "fashion.product-showcase",
      "fashion.promise-strip",
      "fashion.magazine",
      "fashion.footer",
    ]);
    const serialized = JSON.stringify(fashionHomeFixtures);
    const fixtureAssetIds = new Set(serialized.match(/fashion\.[a-z0-9-]+/g) ?? []);
    expect(serialized).not.toContain("Atlas");
    expect(serialized).toContain("fashion.slider-01");
    expect([...fixtureAssetIds].every((id) => id in themeAssets)).toBe(true);
    expect(Object.keys(themeAssets).every((id) => id.startsWith("fashion."))).toBe(true);
    expect(fashionSourceContract.regions).toEqual([
      "header",
      "hero",
      "services",
      "categories",
      "best-sellers",
      "promotion",
      "collection",
      "brands",
      "featured-products",
      "promises",
      "magazine",
      "footer",
      "cookie-message",
      "sticky-elements",
      "scroll-progress",
    ]);
  });

  test("uses exact source copy, product mappings, navigation panels, and footer assets", () => {
    const models = fashionHomeFixtures["fashion-home"].viewModels;
    expect(models.header.data).toEqual(fashionSourceContract.header);
    expect(fashionSourceContract.header.destinations.shop).toEqual({
      Accessories: "/collections/accessories",
      Divided: "/collections/divided",
      Kids: "/collections/kids",
      Men: "/collections/men",
      Women: "/collections/women",
    });
    expect(models.categories.data.items.map(({ href }) => href)).toEqual(
      fashionSourceContract.categories.map(([, , , href]) => href),
    );
    expect(models.hero.data.slides).toEqual(fashionSourceContract.hero.slides);
    expect(
      models.bestsellers.data.products.map(
        ({ assetId, badge, comparePrice, name, price }) =>
          [assetId, name, comparePrice, price, badge] as const,
      ),
    ).toEqual(fashionSourceContract.bestSellers);
    expect(
      models.featured.data.products.map(
        ({ assetId, badge, comparePrice, name, price }) =>
          [assetId, name, comparePrice, price, badge] as const,
      ),
    ).toEqual(fashionSourceContract.featuredProducts);
    expect(models.promotion.data).toEqual(fashionSourceContract.promotion);
    expect(models.collection.data.items).toHaveLength(8);
    expect(models.collection.data.options).toEqual(fashionSourceContract.collection.options);
    expect(models.collection.data.eyebrow).toBe("Lookbook 2023");
    expect(models.collection.data.body).toBe(
      "Flash summer sale 70% off on selected collection for him.",
    );
    expect(models.promises.data).toEqual({
      items: fashionSourceContract.promises,
      options: fashionSourceContract.promiseMarquee,
    });
    expect(fashionSourceContract.promises).toHaveLength(8);
    expect(new Set(fashionSourceContract.promises).size).toBe(5);
    expect(models.magazine.data.items).toEqual(
      fashionSourceContract.magazine.map(([assetId, author, date, title]) => ({
        assetId,
        author,
        date,
        title,
      })),
    );
    expect(models.footer.data).toEqual(fashionSourceContract.footer);
    expect(
      [
        ...fashionSourceContract.brands.map(([assetId]) => assetId),
        ...fashionSourceContract.footer.payments,
      ].every((id) => id in themeAssets),
    ).toBe(true);
  });

  test("records the complete Fashion hero motion and font contracts", () => {
    expect(fashionSourceContract.hero.options).toEqual({
      autoplayMs: 4_000,
      breakpointPx: 1_199,
      desktopDirection: "vertical",
      disableOnInteraction: false,
      effect: "slide",
      keyboard: true,
      loop: true,
      mobileDirection: "horizontal",
      parallaxPx: 500,
      progress: "numeric-line",
      speedMs: 1_000,
      touch: true,
    });
    expect(fashionSourceContract.fonts).toEqual({
      alt: {
        binary: "outfit-latin.woff2",
        family: "Outfit",
        hash: "92684e4acde79ef07758cd09380b7e01e9824d8b061eddeda046f78c166d7b12",
        weights: [300, 400, 500, 600, 700, 800, 900],
      },
      primary: {
        binary: "figtree-latin.woff2",
        family: "Figtree",
        hash: "8330490a01c60c196eae00b823de8102275aaa5862e7b76a7af21b8745338928",
        weights: [300, 400, 500, 600, 700, 800],
      },
    });
    expect(fashionSourceContract.promiseMarquee).toEqual({
      allowTouchMove: false,
      autoplayMs: 0,
      disableOnInteraction: false,
      keyboard: true,
      loop: true,
      speedMs: 10_000,
    });
    expect(fashionSourceContract.revealGroups.magazine).toEqual({
      delayMs: 300,
      durationMs: 500,
      initialTransform: "translate3d(-15px, 15px, 0)",
      staggerMs: 300,
    });
  });

  test("binds unique Fashion products to the dedicated namespaced product template", () => {
    const productTemplate = fashionPreset.templates.find(({ pageType }) => pageType === "product")!;
    expect(productTemplate.sections.find(({ id }) => id === "product-main")).toMatchObject({
      capabilities: ["product.details", "product.action"],
      type: "fashion.product-details",
    });
    const products = fashionHomeFixtures["fashion-home"].viewModels.product.data.products;
    expect(new Set(products.map(({ slug }) => slug)).size).toBe(products.length);
    expect(products.map(({ slug }) => slug)).not.toContain("atlas-carry-on");
    expect(
      fashionManifest.componentRegistry.sections.some(
        ({ type }) => type === "fashion.product-details",
      ),
    ).toBe(true);
    expect(fashionSourceContract.productDetail).toEqual({
      actions: ["Compare", "Ask a question", "Share"],
      gallery: {
        assetIds: [
          "fashion.product-01",
          "fashion.product-02",
          "fashion.product-03",
          "fashion.product-04",
          "fashion.product-05",
          "fashion.product-06",
        ],
        autoplayMs: 2_000,
        count: 6,
        direction: "vertical",
        lightbox: true,
        loop: true,
      },
      reviewCount: 165,
      paymentAssets: [
        "fashion.payment-visa",
        "fashion.payment-mastercard",
        "fashion.payment-american-express",
        "fashion.payment-discover",
        "fashion.payment-diners-club",
        "fashion.payment-union-pay",
      ],
      product: {
        category: "Woman",
        comparePrice: "$85.00",
        description:
          "Lorem ipsum is simply dummy text of the printing and typesetting industry lorem ipsum standard.",
        name: "Relaxed corduroy shirt",
        price: "$65.00",
        sku: "M492300",
        vendor: "Zalando",
      },
      tabs: ["Description", "Additional information", "Shipping and return", "Reviews (3)"],
      tags: ["Shirts", "Cotton", "Printed"],
    });
  });

  test("uses Fashion-owned cart, checkout, and content templates", () => {
    expect(fashionPreset.templates.find(({ pageType }) => pageType === "cart")?.sections).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "fashion.cart" })]),
    );
    expect(
      fashionPreset.templates.find(({ pageType }) => pageType === "checkout")?.sections,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ type: "fashion.checkout" })]));
    expect(
      fashionPreset.templates.find(({ pageType }) => pageType === "content")?.sections,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ type: "fashion.content-page" })]));
  });

  test("uses source-backed Fashion fixtures for cart and checkout instead of core placeholders", async () => {
    const input = await fashionPreviewBuildInput("https://preview.example.test");
    const fixtureFor = (resource: string) =>
      input.snapshot.bindings.find((binding) => binding.resource === resource)?.fixtureId;

    expect(fixtureFor("cart")).toBe("fashion-home");
    expect(fixtureFor("checkout")).toBe("fashion-home");
    expect(fashionHomeFixtures["fashion-home"].pageTypes).toEqual(
      expect.arrayContaining(["cart", "checkout"]),
    );
  });

  test("preserves source interaction structure for navigation, search, categories, and commerce pages", async () => {
    const [header, categories, wishlist, cart, checkout, footer, styles] = await Promise.all(
      [
        "FashionHeader.vue",
        "FashionCategoryTiles.vue",
        "FashionWishlistPage.vue",
        "FashionCart.vue",
        "FashionCheckout.vue",
        "FashionFooter.vue",
      ]
        .map((name) =>
          readFile(resolve(import.meta.dir, `../app/themes/fashion/components/${name}`), "utf8"),
        )
        .concat([readFile(resolve(import.meta.dir, "../app/themes/fashion/tokens.css"), "utf8")]),
    );

    expect(header).toContain('type="text"');
    expect(header).not.toContain('type="search"');
    expect(header).toContain('@pointerdown.self="closeSearch"');
    expect(header).toContain('<NuxtLink class="fashion-nav-link"');
    expect(footer).toContain('<NuxtLink to="/">Home</NuxtLink>');
    expect(categories).toContain('class="fashion-category-label"');
    expect(categories).toContain('class="fashion-category-text"');
    expect(wishlist).toContain('class="fashion-wishlist-actions"');
    expect(wishlist).not.toContain('from wishlist`">×');
    expect(cart).toContain('class="fashion-cart-shipping-toggle"');
    expect(cart).not.toContain("<details>");
    expect(cart).toContain('class="fashion-cart-checkout" to="/checkout"');
    expect(checkout).toContain('class="fashion-checkout-payment-logos"');
    expect(checkout).toContain("resolveAsset(assetId)");
    expect(styles).not.toContain("transition: opacity 200ms ease 400ms");
    expect(styles).toContain(".fashion-search-leave-active {\n  transition: opacity 600ms ease;");
  });

  test("maps the four large Fashion services to original Crafto glyph assets", async () => {
    const services = fashionHomeFixtures["fashion-home"].viewModels.services.data.items;
    expect(services.map(({ assetId }) => assetId)).toEqual([
      "fashion.service-box",
      "fashion.service-return",
      "fashion.service-payment",
      "fashion.service-support",
    ]);
    expect(services.map(({ label }) => label)).toEqual([
      "Free shipping",
      "15 days returns",
      "Secure payment",
      "Online support",
    ]);
    expect(services.every(({ assetId }) => assetId in themeAssets)).toBe(true);

    const [component, iconMap] = await Promise.all([
      readFile(
        resolve(import.meta.dir, "../app/themes/fashion/components/FashionServiceStrip.vue"),
        "utf8",
      ),
      readFile(
        resolve(import.meta.dir, "../../../docs/architecture/storefront-theme-icon-map.md"),
        "utf8",
      ),
    ]);
    expect(component).not.toContain("@lucide/vue");
    expect(component).toContain("resolveAsset(item.assetId)");
    for (const glyph of ["U+E6E5", "U+EBD7", "U+E7C3", "U+EB58"]) {
      expect(iconMap).toContain(glyph);
    }
  });

  test("selects only Fashion and contains no prohibited legacy or external runtime", async () => {
    const input = await fashionPreviewBuildInput("https://preview.example.test");
    const activeModule = renderActiveThemeModule({
      catalog: [fashionThemeDescriptor],
      input,
      moduleAllowlist: { fashion: "../themes/fashion/registry" },
    });
    const sources = await Promise.all(
      [
        "../app/themes/fashion/manifest.ts",
        "../app/themes/fashion/registry.ts",
        "../app/themes/fashion/tokens.css",
      ].map((path) => readFile(resolve(import.meta.dir, path), "utf8")),
    );
    const source = sources.join("\n").toLowerCase();

    expect(activeModule).toContain('../themes/fashion/registry"');
    expect(activeModule).not.toContain("themes/decor");
    expect(source).not.toMatch(/jquery|revolution|contact\.php|https?:\/\//);
    expect(source).toContain("@font-face");
  });
});
