import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveTemplateOverride } from "../../../packages/domain/src/storefront-experience";
import { renderThemeTreePlan } from "../app/theme-engine/registry";
import { fashionStoreManifest as legacyFashionStoreManifest } from "../app/themes/fashion-store/manifest";
import { themeRegistry as legacyThemeRegistry } from "../app/themes/fashion-store/registry";

import {
  fashionStoreManifest,
  fashionStoreThemeDescriptor,
} from "../app/themes/fashion-store/successor/manifest";
import { fashionStorePreset } from "../app/themes/fashion-store/successor/presets/source-parity";
import { themeRegistry } from "../app/themes/fashion-store/successor/registry";
import { fixtureThemeRegistry } from "../app/themes/fashion-store/successor/fixture-registry";
import { fashionStoreProductSectionVariant } from "../app/themes/fashion-store/successor/composition";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { renderActiveThemeModule } from "../scripts/prepare-experience";
import {
  assertFashionStoreDecorHeroSourceTiming,
  fashionStoreDecorHeroContract,
  fashionStoreDecorHeroLayerTimeline,
} from "../app/themes/fashion-store/contracts/home-hero";
import { createFashionStoreDecorHeroTimeline } from "../app/themes/fashion-store/composables/useFashionStoreDecorHeroMotion";

describe("Fashion Store preview registration", () => {
  test("rejects controlled drift from the independently observed Decor timing ledger", () => {
    const observed = {
      autoplayMs: fashionStoreDecorHeroContract.autoplayMs,
      layers: fashionStoreDecorHeroLayerTimeline.map(({ delayMs, durationMs, role }) => ({
        delayMs,
        durationMs,
        role,
      })),
      stopAfterReturnToFirst: true,
      swipeThresholdPx: fashionStoreDecorHeroContract.swipeThresholdPx,
      transitionMs: fashionStoreDecorHeroContract.transitionMs,
    };
    expect(() => assertFashionStoreDecorHeroSourceTiming(observed)).not.toThrow();
    expect(() =>
      assertFashionStoreDecorHeroSourceTiming({
        ...observed,
        layers: observed.layers.map((layer, index) =>
          index === 3 ? { ...layer, delayMs: layer.delayMs + 1 } : layer,
        ),
      }),
    ).toThrow(/does not match/);
    expect(() =>
      assertFashionStoreDecorHeroSourceTiming({
        ...observed,
        layers: observed.layers.slice(0, -1),
      }),
    ).toThrow(/does not match/);
  });

  test("reverts a partial timeline and enters fallback when GSAP layer construction throws", () => {
    let failed = false;
    let reverted = false;
    const timeline = {
      fromTo: () => {
        throw new Error("controlled GSAP population failure");
      },
      kill: () => undefined,
      pause: () => undefined,
      play: () => undefined,
      revert: () => {
        reverted = true;
      },
    };
    const result = createFashionStoreDecorHeroTimeline(
      { timeline: () => timeline },
      { querySelector: () => ({}) as HTMLElement },
      () => undefined,
      () => {
        failed = true;
      },
    );
    expect(result).toBeUndefined();
    expect(reverted).toBe(true);
    expect(failed).toBe(true);
  });

  test("uses one Fashion-owned Decor Hero contract in fixture and live Home renderers", async () => {
    const [fixtureHome, liveHome, contract] = await Promise.all([
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/sections/FashionStoreFixtureHeroSection.vue",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/sections/FashionStoreLiveHeroSection.vue",
        ),
        "utf8",
      ),
      import("../app/themes/fashion-store/contracts/home-hero"),
    ]);

    expect(fixtureHome).toContain("<FashionStoreDecorHero");
    expect(liveHome).toContain("<FashionStoreDecorHero");
    expect(contract.fashionStoreDecorHeroSlides.map(({ title, price }) => [title, price])).toEqual([
      ["Corby sofas", "$199.00"],
      ["Verona sofas", "$259.00"],
      ["Lewis sofas", "$259.00"],
    ]);
    expect(contract.fashionStoreDecorHeroSlides.every(({ href }) => href === "/shop")).toBe(true);
    expect(contract.fashionStoreDecorHeroContract.moreInformation).toBe("omitted-all-viewports");
    expect(contract.fashionStoreDecorHeroContract.swipeThresholdPx).toBe(75);
    expect(contract.fashionStoreDecorHeroContract.transitionMs).toBe(300);
    expect(contract.fashionStoreDecorHeroContract.autoplayMs).toBe(9_000);
  });

  test("keeps first-paint typography invariant and preloads both fonts", async () => {
    const [nuxtConfig, criticalStyles, integrationStyles, shell, hero] = await Promise.all([
      readFile(resolve(import.meta.dir, "../nuxt.config.ts"), "utf8"),
      readFile(resolve(import.meta.dir, "../app/themes/fashion-store/critical.css"), "utf8"),
      readFile(resolve(import.meta.dir, "../app/themes/fashion-store/integration.css"), "utf8"),
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/shared/FashionStoreShell.vue",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/FashionStoreDecorHero.vue",
        ),
        "utf8",
      ),
    ]);

    const criticalIndex = nuxtConfig.indexOf('"~/themes/fashion-store/critical.css"');
    const upstreamIndex = nuxtConfig.indexOf('"~/themes/fashion-store/upstream/css/style.css"');
    expect(criticalIndex).toBeGreaterThan(-1);
    expect(upstreamIndex).toBeGreaterThan(criticalIndex);
    expect(criticalStyles.match(/@font-face/g)).toHaveLength(3);
    expect(criticalStyles).toContain("font-display: swap");
    expect(criticalStyles).toContain('body[data-fashion-store-shell="true"]');
    expect(criticalStyles).toContain('--primary-font: "Figtree", sans-serif');
    expect(criticalStyles).toContain('--alt-font: "Outfit", sans-serif');
    expect(criticalStyles).toContain("font-size: 17px");
    expect(integrationStyles).not.toContain("@font-face");
    expect(shell).toContain('"data-fashion-store-shell": "true"');
    for (const [fontPath, variable] of [
      ["../../upstream/fonts/figtree-latin.woff2?url", "figtreeFontUrl"],
      ["../../upstream/fonts/outfit-latin.woff2?url", "outfitFontUrl"],
    ] as const) {
      expect(shell).toContain(`from "${fontPath}"`);
      const hrefIndex = shell.indexOf(`href: ${variable}`);
      const fontLink = shell.slice(Math.max(0, hrefIndex - 100), hrefIndex + 150);
      expect(fontLink).toContain('as: "font" as const');
      expect(fontLink).toContain('rel: "preload" as const');
      expect(fontLink).toContain('type: "font/woff2"');
    }
    expect(shell).toContain('key: "fashion-store-figtree-font"');
    expect(shell).toContain('key: "fashion-store-outfit-font"');
    expect(shell.match(/as: "font" as const/g)).toHaveLength(2);
    expect(shell.match(/type: "font\/woff2"/g)).toHaveLength(2);
    expect(hero).toContain('from "../assets/hero/plus-jakarta-sans-latin.woff2?url"');
    expect(hero).toContain('key: "fashion-store-plus-jakarta-font"');
    expect(hero).toContain('rel: "preload"');
  });

  test("declares the complete bounded First Editor Inventory from manifest settings", () => {
    const settingsByType = new Map(
      fashionStoreManifest.componentRegistry.sections
        .filter(({ type }) => type.startsWith("fashion-store."))
        .map(({ settings, type }) => [
          type,
          new Map(settings.map((setting) => [setting.id, setting])),
        ]),
    );
    const expectedInventory = {
      cart: ["help-copy", "policy-link"],
      checkout: ["help-copy", "policy-link"],
      collection: ["intro-title", "intro-copy", "default-collection"],
      content: [
        "about.heading",
        "about.message",
        "about.image",
        "faq.heading",
        "faq.message",
        "faq.image",
        "contact.heading",
        "contact.message",
        "contact.image",
        "magazine.heading",
        "magazine.message",
        "magazine.image",
        "magazine.featured-article",
        "order.help-copy",
        "order.policy-link",
        "policy.help-copy",
        "policy.document",
        "policy.related-link",
      ],
      hero: [
        "announcement-text",
        "announcement-link",
        "announcement-visible",
        "header-logo",
        "header-contact-copy",
        "header-social-link",
        "header-legal-link",
        "header-highlight-page",
        "footer-logo",
        "footer-contact-copy",
        "footer-social-link",
        "footer-legal-link",
        "merchandising-title",
        "featured-collection",
        "featured-product",
        "merchandising-visible",
      ],
      product: ["presentation-copy", "related-collection"],
    } as const;

    for (const [pageType, settingIds] of Object.entries(expectedInventory)) {
      const settings = settingsByType.get(`fashion-store.${pageType}`);
      expect(settings, pageType).toBeDefined();
      for (const settingId of settingIds) {
        const setting = settings?.get(settingId);
        expect(setting, `${pageType}.${settingId}`).toBeDefined();
        expect(setting?.label, `${pageType}.${settingId} label`).toBeTruthy();
        expect(setting?.helpText, `${pageType}.${settingId} help text`).toBeTruthy();
      }
    }

    expect(settingsByType.get("fashion-store.product")?.get("related-collection")?.kind).toBe(
      "collection-reference",
    );
    expect(
      settingsByType.get("fashion-store.content")?.get("magazine.featured-article")?.kind,
    ).toBe("article-reference");
    expect(settingsByType.get("fashion-store.content")?.get("policy.document")?.kind).toBe(
      "policy-reference",
    );
    expect(settingsByType.get("fashion-store.hero")?.get("header-highlight-page")?.kind).toBe(
      "page-reference",
    );
    expect(settingsByType.get("fashion-store.hero")?.get("featured-collection")?.required).toBe(
      true,
    );
    expect(
      settingsByType.get("fashion-store.collection")?.get("default-collection")?.required,
    ).toBe(true);

    const linkDefinitions = [...settingsByType.values()].flatMap((settings) =>
      [...settings.values()].filter((setting) => setting.kind === "link"),
    );
    expect(linkDefinitions.length).toBeGreaterThan(0);
    for (const definition of linkDefinitions) {
      expect(definition.required).toBe(false);
      expect(definition.allowedTargets).not.toHaveLength(0);
      expect("default" in definition).toBe(false);
    }

    const editableIds = [...settingsByType.values()].flatMap((settings) => [...settings.keys()]);
    for (const commerceOrLegalFact of [
      "sku",
      "price",
      "currency",
      "inventory",
      "tax",
      "shipping-rule",
      "payment-state",
      "order-state",
      "policy-body",
      "legal-approval",
    ]) {
      expect(editableIds.join(" ")).not.toMatch(
        new RegExp(`(^|[.\\s-])${commerceOrLegalFact}([.\\s-]|$)`),
      );
    }
  });

  test("moves successor merchandising order ownership to stable Section order", () => {
    const legacyHome = legacyFashionStoreManifest.componentRegistry.sections.find(
      ({ type }) => type === "fashion-store.home",
    )!;
    const successorHero = fashionStoreManifest.componentRegistry.sections.find(
      ({ type }) => type === "fashion-store.hero",
    )!;

    expect(legacyHome.settings.some(({ id }) => id === "merchandising-order")).toBe(true);
    expect(successorHero.settings.some(({ id }) => id === "merchandising-order")).toBe(false);
  });

  test("keeps collection looping aligned with its four semantic cards", async () => {
    const component = await readFile(
      resolve(import.meta.dir, "../app/themes/fashion-store/components/FashionStoreHome.vue"),
      "utf8",
    );
    expect(component).toContain("[...data.value.collection, ...data.value.collection]");
    expect(component).toContain(':semantic-slide-count="data.collection.length"');
    expect(component).toContain('@active-index-change="collectionIndex = $event"');
  });

  test("decomposes only the successor Home into the frozen stable Section sequence", () => {
    expect(fashionStoreManifest.id).toBe("fashion-store");
    expect(fashionStoreThemeDescriptor).toMatchObject({
      id: "fashion-store",
      presets: ["source-parity"],
      supportedPageTemplates: ["home", "collection", "product", "cart", "checkout", "content"],
    });
    const home = fashionStorePreset.templates.find(({ pageType }) => pageType === "home")!;
    expect(
      home.sections.map(({ id, required, type, visible }) => ({ id, required, type, visible })),
    ).toEqual([
      { id: "fashion-store-home", required: true, type: "fashion-store.hero", visible: true },
      {
        id: "fashion-store-home-services",
        required: false,
        type: "fashion-store.services",
        visible: true,
      },
      {
        id: "fashion-store-home-categories",
        required: false,
        type: "fashion-store.categories",
        visible: true,
      },
      {
        id: "fashion-store-home-best-sellers",
        required: false,
        type: "fashion-store.products",
        visible: true,
      },
      {
        id: "fashion-store-home-promotion",
        required: false,
        type: "fashion-store.promotion",
        visible: true,
      },
      {
        id: "fashion-store-home-collection",
        required: false,
        type: "fashion-store.collection-feature",
        visible: true,
      },
      {
        id: "fashion-store-home-brands",
        required: false,
        type: "fashion-store.brand-strip",
        visible: true,
      },
      {
        id: "fashion-store-home-featured-products",
        required: false,
        type: "fashion-store.products",
        visible: true,
      },
      {
        id: "fashion-store-home-marquee",
        required: false,
        type: "fashion-store.marquee",
        visible: true,
      },
      {
        id: "fashion-store-home-magazine",
        required: false,
        type: "fashion-store.editorial",
        visible: true,
      },
    ]);
    expect(themeRegistry.sectionComposition?.rendererShell).toMatchObject({
      owner: "renderer",
      sourceSectionType: "fashion-store.hero",
    });
    expect(themeRegistry.platformShell).toBe(legacyThemeRegistry.platformShell);
    expect(themeRegistry.rendererShell).not.toBe(themeRegistry.platformShell);
    expect(Object.keys(themeRegistry.sectionComposition?.sections ?? {}).sort()).toEqual(
      [...new Set(home.sections.map(({ type }) => type))].sort(),
    );
    const stableTypeCount = new Set(home.sections.map(({ type }) => type)).size;
    expect(new Set(home.sections.map(({ type }) => themeRegistry.sections[type])).size).toBe(
      stableTypeCount,
    );
    expect(new Set(home.sections.map(({ type }) => fixtureThemeRegistry.sections[type])).size).toBe(
      stableTypeCount,
    );
    expect(fashionStoreProductSectionVariant("fashion-store-home-best-sellers")).toBe(
      "best-sellers",
    );
    expect(fashionStoreProductSectionVariant("fashion-store-home-featured-products")).toBe(
      "featured-products",
    );
    expect(() => fashionStoreProductSectionVariant("fashion-store-home-unknown")).toThrow(
      "Unknown Fashion Store products Section instance",
    );
  });

  test("uses the existing fixed override model for Home visibility, order, and reset", () => {
    const home = fashionStorePreset.templates.find(({ pageType }) => pageType === "home")!;
    const reorderedIds = [
      home.sections[0]!.id,
      home.sections[2]!.id,
      home.sections[1]!.id,
      ...home.sections.slice(3).map(({ id }) => id),
    ];
    const resolved = resolveTemplateOverride(home, {
      operations: [
        {
          instanceId: "fashion-store-home-magazine",
          kind: "set-visibility",
          visible: false,
        },
        { instanceIds: reorderedIds, kind: "reorder-sections" },
      ],
      templateId: home.id,
    });

    expect(resolved.sections.map(({ id }) => id)).toEqual(reorderedIds);
    expect(resolved.sections.find(({ id }) => id === "fashion-store-home-magazine")?.visible).toBe(
      false,
    );
    expect(resolveTemplateOverride(home, { operations: [], templateId: home.id }).sections).toEqual(
      home.sections,
    );
    expect(() =>
      resolveTemplateOverride(home, {
        operations: [{ instanceId: "fashion-store-home", kind: "set-visibility", visible: false }],
        templateId: home.id,
      }),
    ).toThrow(/required section/);
  });

  test("renders persisted successor Home visibility and order in fixture and live modes", () => {
    const home = fashionStorePreset.templates.find(({ pageType }) => pageType === "home")!;
    const reorderedIds = [
      "fashion-store-home",
      "fashion-store-home-categories",
      "fashion-store-home-services",
      ...home.sections
        .map(({ id }) => id)
        .filter(
          (id) =>
            ![
              "fashion-store-home",
              "fashion-store-home-services",
              "fashion-store-home-categories",
            ].includes(id),
        ),
    ];
    const override = {
      operations: [
        { instanceId: "fashion-store-home-magazine", kind: "set-visibility", visible: false },
        { instanceIds: reorderedIds, kind: "reorder-sections" },
      ],
      templateId: home.id,
    } as const;
    const reloaded = resolveTemplateOverride(home, structuredClone(override));

    for (const registry of [fixtureThemeRegistry, themeRegistry]) {
      const tree = renderThemeTreePlan(reloaded, registry);
      expect(tree.shell).toBeDefined();
      expect(tree.sections.map(({ instance }) => instance.id)).toEqual(
        reorderedIds.filter((id) => id !== "fashion-store-home-magazine"),
      );
    }
  });

  test("removes page-owned Home shells and landmarks from both presentation modes", async () => {
    const sectionDirectory = resolve(
      import.meta.dir,
      "../app/themes/fashion-store/components/sections",
    );
    const sectionNames = [
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
    ];
    const sectionSources = await Promise.all(
      ["Fixture", "Live"].flatMap((mode) =>
        sectionNames.map((name) =>
          readFile(resolve(sectionDirectory, `FashionStore${mode}${name}Section.vue`), "utf8"),
        ),
      ),
    );
    for (const source of sectionSources) {
      expect(source).not.toContain("<FashionStoreShell");
      expect(source).not.toContain('id="fashion-store-main"');
    }
    const [legacyFixtureHome, legacyLiveHome] = await Promise.all([
      readFile(
        resolve(import.meta.dir, "../app/themes/fashion-store/components/FashionStoreHome.vue"),
        "utf8",
      ),
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/FashionStoreLiveHomePage.vue",
        ),
        "utf8",
      ),
    ]);
    for (const source of [legacyFixtureHome, legacyLiveHome]) {
      expect(source).toContain("<FashionStoreShell");
      expect(source).toContain('id="fashion-store-main"');
    }
  });

  test("prepares a signed descriptor-compatible snapshot and selects one static registry", async () => {
    const input = await fashionStorePreviewBuildInput("https://preview.example.test");
    const source = renderActiveThemeModule({
      catalog: [fashionStoreThemeDescriptor],
      input,
      moduleAllowlist: { "fashion-store": "../themes/fashion-store/successor/registry" },
    });

    expect(input.snapshot.themeId).toBe("fashion-store");
    expect(input.snapshot.resolvedTemplates.map(({ pageType }) => pageType)).toEqual([
      "home",
      "collection",
      "product",
      "cart",
      "checkout",
      "content",
    ]);
    expect(source).toContain('from "../themes/fashion-store/successor/registry"');
    expect(source).not.toContain("themes/fashion/registry");
    expect(source).not.toContain("themes/decor/registry");
  });

  test("rejects mismatched versions and templates outside the platform vocabulary", async () => {
    const input = await fashionStorePreviewBuildInput("https://preview.example.test");
    const options = {
      catalog: [fashionStoreThemeDescriptor],
      moduleAllowlist: { "fashion-store": "../themes/fashion-store/successor/registry" },
    };

    expect(() =>
      renderActiveThemeModule({
        ...options,
        input: {
          ...input,
          snapshot: { ...input.snapshot, themeVersion: "9.9.9" },
        },
      }),
    ).toThrow("descriptor");

    expect(() =>
      renderActiveThemeModule({
        ...options,
        input: {
          ...input,
          snapshot: {
            ...input.snapshot,
            resolvedTemplates: [
              {
                ...input.snapshot.resolvedTemplates[0]!,
                id: "fashion-store-order",
                pageType: "order",
              },
            ],
          },
        },
      }),
    ).toThrow("does not support");
  });

  test("keeps production fallback free of Fashion Store imports", () => {
    const source = renderActiveThemeModule({
      catalog: [fashionStoreThemeDescriptor],
      input: { environment: "production" },
      moduleAllowlist: { "fashion-store": "../themes/fashion-store/successor/registry" },
    });

    expect(source).not.toContain("fashion-store");
    expect(source).not.toContain("/themes/");
  });
});
