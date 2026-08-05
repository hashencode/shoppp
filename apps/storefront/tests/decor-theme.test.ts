import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { themePackageSchema } from "@shoppp/contracts";

import { decorHomeFixtures } from "../app/themes/decor/fixtures/home";
import { decorManifest, decorThemeDescriptor } from "../app/themes/decor/manifest";
import { decorPreset } from "../app/themes/decor/presets/layered";
import { themeAssets } from "../app/themes/decor/resources";
import { decorSourceContract } from "../app/themes/decor/source-contract";
import { renderActiveThemeModule } from "../scripts/prepare-experience";
import { decorPreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";

describe("Decor theme package", () => {
  test("validates a distinct versioned package with all in-scope templates", () => {
    const parsed = themePackageSchema.parse({
      manifest: decorManifest,
      presets: [decorPreset],
    });

    expect(parsed.manifest.id).toBe("decor");
    expect(parsed.presets[0]?.templates.map(({ pageType }) => pageType).sort()).toEqual([
      "cart",
      "checkout",
      "collection",
      "home",
      "order",
      "policy",
      "product",
    ]);
  });

  test("binds every visible instance to shared fixture ViewModels", async () => {
    const input = await decorPreviewBuildInput("https://preview.example.test");
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
    expect([...visibleInstanceIds].every((id) => bindingInstanceIds.includes(id))).toBe(true);
  });

  test("declares the complete reference-backed Decor home inventory in order", () => {
    const home = decorPreset.templates.find(({ pageType }) => pageType === "home")!;
    expect(home.sections.map(({ type }) => type)).toEqual([
      "decor.header",
      "decor.hero-carousel",
      "decor.category-showcase",
      "decor.product-tabs",
      "decor.marquee",
      "decor.collection-feature",
      "decor.client-strip",
      "decor.journal",
      "decor.service-strip",
      "decor.footer",
    ]);
    const serialized = JSON.stringify(decorHomeFixtures);
    const fixtureAssetIds = new Set(serialized.match(/decor\.[a-z0-9-]+/g) ?? []);
    expect(serialized).not.toContain("Atlas");
    expect(serialized).toContain("decor.slider-01-img-01");
    expect([...fixtureAssetIds].every((id) => id in themeAssets)).toBe(true);
    expect(Object.keys(themeAssets).every((id) => id.startsWith("decor."))).toBe(true);
  });

  test("keeps exact source content, slide timing, and interactive inventory", () => {
    expect(decorSourceContract.font).toEqual({
      family: "Plus Jakarta Sans",
      hash: "cd8db90cd950e26bc8761f65d323588bd5cd112d326d6d322bc7c8ea86771215",
      source: "Crafto Google Fonts Plus Jakarta Sans v12 Latin variable binary",
      weightAxis: { maximum: 800, minimum: 200 },
    });
    expect(decorSourceContract.hero.slides.map(({ heading, price }) => [heading, price])).toEqual([
      ["Corby sofas", "$199.00"],
      ["Verona sofas", "$259.00"],
      ["Lewis sofas", "$259.00"],
    ]);
    expect(decorSourceContract.hero.autoplayMs).toBe(9_000);
    expect(decorSourceContract.hero.transition).toEqual({
      direction: "horizontal",
      durationMs: 300,
      easing: "ease-in-out",
      effect: "fade",
    });
    expect(decorSourceContract.hero.layerTimeline).toEqual({
      accent: { delayMs: 500, durationMs: 300 },
      product: { delayMs: 1_000, durationMs: 800 },
      heading: { delayMs: 1_200, durationMs: 1_000 },
      price: { delayMs: 1_500, durationMs: 1_000 },
      action: { delayMs: 1_700, durationMs: 1_000 },
    });
    expect(decorSourceContract.collection.interaction).toMatchObject({
      allowTouchMove: true,
      autoplayDelayMs: 3_000,
      effect: "fade",
    });
    expect(decorSourceContract.marqueeMotion).toMatchObject({
      allowTouchMove: false,
      autoplayDelayMs: 1,
      durationMs: 8_000,
    });
    expect(decorSourceContract.clientMotion).toMatchObject({
      allowTouchMove: false,
      pauseOnMouseEnter: false,
      slideDurationMs: 3_000,
    });
    expect(decorSourceContract.bestSellers).toHaveLength(8);
    expect(decorSourceContract.newArrivals).toHaveLength(8);
    expect(decorSourceContract.journal.items).toHaveLength(4);
    expect(decorSourceContract.header.cart).toMatchObject({
      count: 2,
      subtotal: "$199.99",
    });
    expect(decorSourceContract.header.language).toEqual({
      initial: "English",
      options: [
        ["English", "decor.flag-usa"],
        ["France", "decor.flag-france"],
        ["Russian", "decor.flag-russian"],
        ["Spain", "decor.flag-spain"],
      ],
      persistence: "session-only",
    });
    expect(
      decorSourceContract.header.language.options.every(([, assetId]) => assetId in themeAssets),
    ).toBe(true);
    expect(decorSourceContract.regions).toEqual([
      "header",
      "hero",
      "categories",
      "product-tabs",
      "marquee",
      "collection",
      "clients",
      "journal",
      "services",
      "footer",
      "cookie-message",
      "sticky-elements",
      "scroll-progress",
    ]);
  });

  test("binds unique Decor products to the dedicated namespaced product template", () => {
    const productTemplate = decorPreset.templates.find(({ pageType }) => pageType === "product")!;
    expect(productTemplate.sections.find(({ id }) => id === "decor-product")).toMatchObject({
      capabilities: ["product.details", "product.action"],
      type: "decor.product-details",
    });
    const products = decorHomeFixtures["decor-home"].viewModels.product.data.products;
    expect(new Set(products.map(({ slug }) => slug)).size).toBe(products.length);
    expect(products.map(({ slug }) => slug)).not.toContain("atlas-carry-on");
    expect(
      decorManifest.componentRegistry.sections.some(({ type }) => type === "decor.product-details"),
    ).toBe(true);
    expect(decorSourceContract.productDetail).toEqual({
      actions: ["Compare", "Ask a question", "Share"],
      gallery: { autoplayMs: 0, count: 7, direction: "horizontal", lightbox: true, loop: false },
      reviewCount: 165,
      paymentAssets: [
        "decor.payment-visa",
        "decor.payment-mastercard",
        "decor.payment-american-express",
        "decor.payment-discover",
        "decor.payment-diners-club",
        "decor.payment-union-pay",
      ],
      product: {
        comparePrice: "$85.00",
        description:
          "Lorem ipsum is simply dummy text of the printing and typesetting industry lorem ipsum standard.",
        name: "Minimalist wooden chair",
        price: "$65.00",
        sku: "M492300",
        vendor: "Interio",
      },
      tabs: ["Description", "Additional information", "Shipping and return", "Reviews (3)"],
      tags: ["Chair", "Modern", "Wooden"],
    });
  });

  test("maps original Crafto category and service artwork to namespaced assets", async () => {
    expect(
      [
        "decor.icon-01",
        "decor.icon-03",
        "decor.icon-02",
        "decor.icon-10",
        "decor.icon-04",
        "decor.icon-05",
        "decor.icon-06",
        "decor.icon-07",
        "decor.icon-08",
        "decor.icon-09",
      ].every((id) => id in themeAssets),
    ).toBe(true);
    expect(
      ["decor.main-banner-01", "decor.main-banner-02", "decor.main-banner-03"].every(
        (id) => id in themeAssets,
      ),
    ).toBe(true);
    const [categorySource, serviceSource, iconMap] = await Promise.all([
      readFile(
        resolve(import.meta.dir, "../app/themes/decor/components/DecorCategoryShowcase.vue"),
        "utf8",
      ),
      readFile(
        resolve(import.meta.dir, "../app/themes/decor/components/DecorServiceStrip.vue"),
        "utf8",
      ),
      readFile(
        resolve(import.meta.dir, "../../../docs/architecture/storefront-theme-icon-map.md"),
        "utf8",
      ),
    ]);
    expect(categorySource).toContain('width="65"');
    expect(categorySource).toContain('height="65"');
    expect(serviceSource).toContain('width="60"');
    expect(serviceSource).toContain('height="50"');
    expect(serviceSource).not.toContain("@lucide/vue");
    expect(iconMap).toContain("demo-decor-store-icon-06.png");
    expect(iconMap).toContain("Original 60 × 50 PNG");
  });

  test("selects only Decor and excludes Fashion and prohibited runtimes", async () => {
    const input = await decorPreviewBuildInput("https://preview.example.test");
    const activeModule = renderActiveThemeModule({
      catalog: [decorThemeDescriptor],
      input,
      moduleAllowlist: { decor: "../themes/decor/registry" },
    });
    const sources = await Promise.all(
      [
        "../app/themes/decor/manifest.ts",
        "../app/themes/decor/registry.ts",
        "../app/themes/decor/tokens.css",
      ].map((path) => readFile(resolve(import.meta.dir, path), "utf8")),
    );
    const source = sources.join("\n").toLowerCase();

    expect(activeModule).toContain('../themes/decor/registry"');
    expect(activeModule).not.toContain("themes/fashion");
    expect(source).not.toMatch(/jquery|revolution|contact\.php|https?:\/\//);
    expect(source).toContain("@font-face");
  });
});
