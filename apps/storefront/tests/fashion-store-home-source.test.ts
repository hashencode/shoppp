import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  fashionStoreShellSourceInventory,
  fashionStoreDecorHomeContract,
  fashionStoreImplementationHomeSectionOrder,
  fashionStoreImplementationRegions,
  fashionStoreNestedDecorRegionOrder,
  fashionStoreSourceContract,
  fashionStoreSourceEntries,
  fashionStoreSourceRegions,
} from "../app/themes/fashion-store/source-contract";
import { fashionStoreHomeData } from "../app/themes/fashion-store/fixtures/home";
import { resolveFashionStoreHomeEditorial } from "../app/themes/fashion-store/components/sections/home-section-context";
import type { PresentationViewModel } from "../app/theme-engine/view-models";
import { fashionStoreAssetId, themeAssets } from "../app/themes/fashion-store/resources";

const componentRoot = new URL("../app/themes/fashion-store/components/", import.meta.url);
const fixtureSectionPaths = [
  "sections/FashionStoreHeroSection.vue",
  "sections/FashionStoreServicesSection.vue",
  "sections/FashionStoreCategoriesSection.vue",
  "sections/FashionStoreProductsSection.vue",
  "sections/FashionStorePromotionSection.vue",
  "sections/FashionStoreCollectionFeatureSection.vue",
  "sections/FashionStoreBrandStripSection.vue",
  "sections/FashionStoreProductsSection.vue",
  "sections/FashionStoreMarqueeSection.vue",
  "sections/FashionStoreEditorialSection.vue",
] as const;
const regionMarkers: Readonly<Record<string, string>> = {
  brands: 'data-home-section="brands"',
  "best-sellers": ':data-home-section="variant"',
  categories: 'data-home-section="categories"',
  collection: 'data-home-section="collection"',
  cookie: "cookie-message",
  "featured-products": ':data-home-section="variant"',
  footer: "footer-dark",
  header: "header-with-topbar",
  hero: 'data-home-section="hero"',
  magazine: 'data-home-section="magazine"',
  marquee: 'data-home-section="marquee"',
  promo: 'data-home-section="promotion"',
  "scroll-progress": "scroll-progress",
  services: 'data-home-section="services"',
  sticky: "sticky-wrap",
};

describe("Fashion Store complete static source home", () => {
  test("live collection cards retain the source title and replaceable subtitle", () => {
    const home = {
      kind: "home",
      featuredCollection: { href: "/collections/travel-essentials", name: "Travel essentials" },
    } as PresentationViewModel;
    const items = resolveFashionStoreHomeEditorial(home).collection.items;

    expect(items).toHaveLength(4);
    expect(items.map(({ name, subtitle }) => ({ name, subtitle }))).toEqual([
      { name: "Travel essentials", subtitle: "Look 1" },
      { name: "Travel essentials", subtitle: "Look 2" },
      { name: "Travel essentials", subtitle: "Look 3" },
      { name: "Travel essentials", subtitle: "Look 4" },
    ]);
  });

  test("keeps source positions separate from stable implementation Home owners", () => {
    expect(fashionStoreImplementationHomeSectionOrder).toEqual([
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
      "product-merchandising",
    ]);
    expect(fashionStoreNestedDecorRegionOrder).toEqual([
      "featured-categories",
      "products",
      "promotional-marquee",
      "collection-carousel",
      "client-marquee",
      "journal",
      "services",
    ]);
    expect(fashionStoreImplementationRegions.find(({ key }) => key === "marquee")?.selector).toBe(
      '[data-home-section="marquee"]',
    );
    expect(
      fashionStoreImplementationRegions.find(({ key }) => key === "best-sellers")?.selector,
    ).toBe('[data-home-section="best-sellers"]');
    expect(fashionStoreSourceRegions.find(({ key }) => key === "marquee")?.selector).toBe(
      "section:nth-of-type(9) .swiper-slide",
    );
  });

  test("freezes the Decor-derived Home region mapping and approved Fashion shell deviations", () => {
    expect(fashionStoreDecorHomeContract.regions.map(({ id }) => id)).toEqual([
      "hero",
      "categories",
      "product-merchandising",
      "marquee",
      "collection",
      "brands",
      "magazine",
      "services",
    ]);
    expect(fashionStoreDecorHomeContract.approvedFashionRegions).toEqual([
      "announcement",
      "sticky-social-rail",
      "footer",
      "scroll-progress",
    ]);
    expect(fashionStoreDecorHomeContract.mountHost).toBe("fashion-store.product-merchandising");
    expect(
      fashionStoreDecorHomeContract.regions
        .filter(({ id }) => id !== "hero")
        .map(({ owner }) => owner),
    ).toEqual(Array(7).fill("FashionStoreDecorHomeBody"));
  });

  test("mounts one Fashion-owned source-shaped Decor body with seven ordered regions", async () => {
    const [body, host, model] = await Promise.all([
      readFile(new URL("home/FashionStoreDecorHomeBody.vue", componentRoot), "utf8"),
      readFile(
        new URL("sections/FashionStoreProductMerchandisingSection.vue", componentRoot),
        "utf8",
      ),
      readFile(new URL("../contracts/decor-home.ts", componentRoot), "utf8"),
    ]);
    const regions = [...body.matchAll(/data-decor-region="([^"]+)"/g)].map(([, region]) => region);
    expect(regions).toEqual([
      "featured-categories",
      "products",
      "promotional-marquee",
      "collection-carousel",
      "client-marquee",
      "journal",
      "services",
    ]);
    for (const marker of [
      "data-decor-collection-slide",
      "data-decor-client-track",
      "data-decor-promotion-track",
      "<FashionStoreProductCard",
      ':data-product-id="product.id"',
      ':href="product.href"',
      "product.price",
    ]) {
      expect(body).toContain(marker);
    }
    expect(body).not.toMatch(/Wooden cabinet|Modern chair|Classic stools/);
    expect(body).not.toContain("decor-home-content");
    expect(body).not.toContain("v-html");
    expect(body).toContain("fashionStoreAssetId");
    expect(host).toContain("<FashionStoreDecorHomeBody");
    expect(model).toContain("FashionStoreDecorHomeModel");
    expect(model).toContain("resolveFashionStoreMerchandising");
  });

  test("pins the canonical Header, product-card, carousel, CTA, and footer seams", async () => {
    const [body, header, search, productCard, host, integration] = await Promise.all([
      readFile(new URL("home/FashionStoreDecorHomeBody.vue", componentRoot), "utf8"),
      readFile(new URL("shared/FashionStoreHeader.vue", componentRoot), "utf8"),
      readFile(new URL("shared/FashionStoreSearchOverlay.vue", componentRoot), "utf8"),
      readFile(new URL("shared/FashionStoreProductCard.vue", componentRoot), "utf8"),
      readFile(
        new URL("sections/FashionStoreProductMerchandisingSection.vue", componentRoot),
        "utf8",
      ),
      readFile(new URL("../integration.css", componentRoot), "utf8"),
    ]);

    expect(header).not.toContain("fashion-store-decor-desktop-menu");
    expect(header).toContain("navbar-collapse justify-content-between");
    expect(header).toMatch(/fashion-store-header-canonical[\s\S]*font-size:\s*17px/);
    expect(header).toMatch(/fashion-store-header-canonical[\s\S]*font-weight:\s*600/);
    expect(header).toContain('class="fashion-store-header-labeled-action"');
    expect(search).toContain("fashion-store-header-labeled-action");
    expect(header).toMatch(
      /fashion-store-header-canonical :deep\(\.fashion-store-header-labeled-action\)[\s\S]*font-weight:\s*600/,
    );
    expect(body).toContain(":surface=\"'home-merchandising'\"");
    expect(productCard).toContain('surface?: "catalog" | "home-merchandising"');
    expect(productCard).toContain(':data-product-surface="properties.surface"');
    expect(productCard).not.toContain("data-product-presentation");
    expect(integration).toContain("aspect-ratio: 6 / 7");
    expect(integration).toContain("width: 45px");
    expect(integration).toContain("height: 45px");

    expect(body).toContain('from "swiper/modules"');
    expect(body).toContain('from "swiper/vue"');
    expect(body).toContain('effect="fade"');
    expect(body).toContain(':loop="collectionProducts.length > 1"');
    expect(body).not.toContain("setInterval(");
    expect(body).not.toContain("v-show=");
    expect(integration).not.toMatch(/\.col-md-8\s+span,[\s\S]*color:\s*#18202b\s*!important/);
    expect(host).toContain("fashion-store-product-merchandising py-0");
  });

  test("keeps source-width review while opting the combined Home into bounded wide content", async () => {
    const [homeShell, shell, integration] = await Promise.all([
      readFile(new URL("FashionStoreHomeShell.vue", componentRoot), "utf8"),
      readFile(new URL("shared/FashionStoreShell.vue", componentRoot), "utf8"),
      readFile(new URL("../integration.css", componentRoot), "utf8"),
    ]);

    expect(homeShell).toContain(":content-layout=");
    expect(homeShell).toContain("homeProfile.composition === 'combined' ? 'wide' : 'source'");
    expect(shell).toContain('contentLayout?: "source" | "wide"');
    expect(shell).toContain('"data-fashion-store-content-layout": properties.contentLayout');
    expect(integration).toContain("--fashion-store-shell-gutter: 30px");
    expect(integration).toContain("--fashion-store-shell-max-width: 1320px");
    expect(integration).toContain('[data-fashion-store-content-layout="wide"]');
    expect(integration).toMatch(/\.fashion-store-footer-canonical\s+\.container/);
    expect(integration).not.toMatch(
      /\[data-fashion-store-content-layout="wide"\]\s+\.fashion-store-footer-canonical/,
    );
    for (const region of ["featured-categories", "products", "journal", "client-marquee"]) {
      expect(integration).toMatch(
        new RegExp(`\\[data-decor-region="${region}"\\]\\s*>\\s*\\.container`),
      );
    }
    expect(integration).not.toMatch(/^\s*\.container\s*\{[^}]*1320px/ms);
  });
  test("records the fifteen-entry shell inventory and its two source-driven differences", () => {
    expect(fashionStoreSourceEntries).toHaveLength(15);
    expect(fashionStoreShellSourceInventory.footer.entryCount).toBe(15);
    expect(fashionStoreShellSourceInventory.header.commonEntryCount).toBe(14);
    expect(fashionStoreShellSourceInventory.header.exceptions).toEqual([
      expect.objectContaining({ entry: "demo-fashion-store-checkout.html" }),
    ]);
    expect(fashionStoreShellSourceInventory.conditionalRegions.stickySocialRail).toEqual([
      "demo-fashion-store.html",
    ]);
  });

  test("extracts one reusable source shell without duplicating shell regions in home", async () => {
    const [homeSections, homeShell, shell, header, search, cart, footer] = await Promise.all(
      [
        Promise.all(
          fixtureSectionPaths.map((path) => readFile(new URL(path, componentRoot), "utf8")),
        ).then((sources) => sources.join("\n")),
        "FashionStoreHomeShell.vue",
        "shared/FashionStoreShell.vue",
        "shared/FashionStoreHeader.vue",
        "shared/FashionStoreSearchOverlay.vue",
        "shared/FashionStoreMiniCart.vue",
        "shared/FashionStoreFooter.vue",
      ].map((path) =>
        typeof path === "string" ? readFile(new URL(path, componentRoot), "utf8") : path,
      ),
    );
    expect(homeSections).not.toContain("<FashionStoreShell");
    expect(homeShell).toContain("<FashionStoreShell");
    expect(homeShell).toContain('id="fashion-store-main"');
    expect(homeSections).not.toContain('<header class="header-with-topbar"');
    expect(homeSections).not.toContain('<footer class="footer-dark');
    expect(shell).toContain("<FashionStoreHeader");
    expect(shell).toContain("<FashionStoreFooter");
    expect(header).toMatch(/<header\s+class="header-with-topbar fashion-store-header-canonical"/);
    expect(header).not.toContain('class="header-top-bar');
    expect(header).toContain("<FashionStoreSearchOverlay");
    expect(header).toContain("<FashionStoreMiniCart");
    expect(search).toContain('class="search-form-wrapper"');
    expect(cart).toContain('class="header-cart dropdown"');
    expect(footer).toMatch(/<footer\s+[\s\S]*class="footer-dark/);
  });

  test("uses one canonical Header layout with route-derived surface state", async () => {
    const [homeShell, shell, header, footer, miniCart, experience, registry, successorRegistry] =
      await Promise.all([
        readFile(new URL("FashionStoreHomeShell.vue", componentRoot), "utf8"),
        readFile(new URL("shared/FashionStoreShell.vue", componentRoot), "utf8"),
        readFile(new URL("shared/FashionStoreHeader.vue", componentRoot), "utf8"),
        readFile(new URL("shared/FashionStoreFooter.vue", componentRoot), "utf8"),
        readFile(new URL("shared/FashionStoreMiniCart.vue", componentRoot), "utf8"),
        readFile(new URL("../../../StorefrontExperience.vue", componentRoot), "utf8"),
        readFile(new URL("../registry.ts", componentRoot), "utf8"),
        readFile(new URL("../successor/registry.ts", componentRoot), "utf8"),
      ]);

    // Home templates are renderer-owned, while product/content templates use the
    // same registry and platform routes mount its shared shell directly.
    expect(successorRegistry).toContain("rendererShell: FashionStoreHomeShell");
    expect(registry).toContain("platformShell: FashionStoreShell");
    expect(experience).toMatch(
      /<ThemeRenderer[\s\S]*v-if="previewTemplate && presentationProvider"/,
    );
    expect(experience).toMatch(
      /:is="themeRegistry\.platformShell"[\s\S]*v-else-if="activeExperienceSnapshot && rendersPlatformRoute/,
    );

    // Visible shell content remains owned by one injected presentation-shell view model.
    expect(shell).toContain("inject(storefrontPresentationShellKey, undefined)");
    expect(shell).toContain("properties.header ?? experienceShell?.value?.header");
    expect(shell).toContain("properties.footer ?? experienceShell?.value?.footer");

    // Home composition remains configurable, but Header identity and surface are
    // owned by the shared shell rather than the development profile.
    expect(homeShell).not.toContain("header-background");
    expect(homeShell).not.toContain("header-layout");
    expect(shell).toContain(":background=\"variant === 'home' ? 'transparent-overlay' : 'solid'\"");
    expect(shell).not.toContain("headerBackground");
    expect(shell).not.toContain("headerLayout");
    expect(header).toContain("fashion-store-header-canonical");
    expect(header).toContain("`fashion-store-header-surface-${background ?? 'solid'}`");
    expect(header).not.toContain("fashion-store-header-layout-");
    expect(header).not.toContain("center-logo");
    expect(header).not.toContain("demo-decor-store-logo");
    expect(header).toContain("demo-fashion-store-logo-black.png");
    expect(header).toContain("configuredBrandName");
    expect(header).toContain('v-bind:data-at2x="configuredLogo() ?? fallbackLogoAt2x()"');
    expect(header).toContain("min-height: 96px");
    expect(header).toContain("min-height: 80px");
    expect(header).toContain("padding-right: 45px");
    expect(header).toContain("padding-right: 35px");

    // Mini-cart and Footer spacing are canonical across Home and internal routes.
    expect(header).not.toContain("home-layout");
    expect(miniCart).not.toContain("homeLayout");
    expect(miniCart).not.toContain("home-layout");
    expect(miniCart).toMatch(
      /\.header-cart > \.fashion-store-source-action[\s\S]*padding-left:\s*14px/,
    );
    expect(shell).not.toContain("home-layout");
    expect(footer).not.toContain("homeLayout");
    expect(footer).not.toContain("fashion-store-footer-home");
    expect(footer).toContain("fashion-store-footer-canonical");
    expect(footer).toContain(":where(.fashion-store-footer-canonical) .container");
    expect(footer).toContain("configuredBrandName");
    expect(footer).toContain('v-bind:data-at2x="configuredLogo() ?? fallbackLogoAt2x()"');
  });

  test("keeps all declared regions and source sentinels in source order", async () => {
    const component = (
      await Promise.all(
        [
          "shared/FashionStoreHeader.vue",
          ...fixtureSectionPaths,
          "shared/FashionStoreFooter.vue",
          "shared/FashionStoreShell.vue",
        ].map((path) => readFile(new URL(path, componentRoot), "utf8")),
      )
    ).join("\n");
    let cursor = -1;
    // The source notice is deliberately omitted from the product shell.
    for (const region of fashionStoreSourceRegions.filter(({ key }) => key !== "cookie")) {
      const marker = regionMarkers[region.key] ?? "section class=";
      const next = component.indexOf(marker, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(component.match(/<section\b/g)).toHaveLength(
      fashionStoreSourceContract.homeSectionCount,
    );
    expect(component).toContain("<FashionStoreDecorHero");
    expect(component).toContain("data-anime");
    expect(component).toContain('<noscript v-html="noScriptMarkup" />');
    expect(component.match(/\bv-html=/g)).toHaveLength(1);
    expect(component).not.toContain("<iframe");
  });

  test("pins fixture counts and ordering to the source contract", () => {
    expect(fashionStoreHomeData.services).toHaveLength(4);
    expect(fashionStoreHomeData.categories.map(({ name }) => name)).toEqual([
      "Women",
      "Men",
      "Accessories",
      "Kids",
    ]);
    expect(fashionStoreHomeData.bestSellers).toHaveLength(10);
    expect(fashionStoreHomeData.collection).toHaveLength(4);
    expect(fashionStoreHomeData.brands.map(({ name }) => name)).toEqual([
      "ASOS",
      "Chanel",
      "Gucci",
      "Celine",
      "Adidas",
    ]);
    expect(fashionStoreHomeData.featuredProducts).toHaveLength(5);
    expect(fashionStoreHomeData.marquee).toHaveLength(8);
    expect(fashionStoreHomeData.magazine).toHaveLength(4);
  });

  test("resolves every fixture image through a namespaced local resource ID", () => {
    const sourceImages = [
      ...fashionStoreHomeData.categories,
      ...fashionStoreHomeData.bestSellers,
      ...fashionStoreHomeData.collection,
      ...fashionStoreHomeData.brands,
      ...fashionStoreHomeData.featuredProducts,
      ...fashionStoreHomeData.magazine,
    ].map(({ sourceImage }) => sourceImage);
    for (const sourceImage of sourceImages) {
      const assetId = fashionStoreAssetId(sourceImage);
      expect(assetId).toStartWith("fashion-store.");
      expect(themeAssets[assetId]).toBeTruthy();
    }
  });
});
