import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveTemplateOverride } from "../../../packages/domain/src/storefront-experience";
import { renderThemeTreePlan } from "../app/theme-engine/registry";
import { createFixturePresentationProvider } from "../app/theme-engine/providers/fixture-preview";
import { fashionStoreManifest as legacyFashionStoreManifest } from "../app/themes/fashion-store/manifest";
import { themeRegistry as legacyThemeRegistry } from "../app/themes/fashion-store/registry";

import {
  fashionStoreManifest,
  fashionStoreThemeDescriptor,
} from "../app/themes/fashion-store/successor/manifest";
import { fashionStorePreset } from "../app/themes/fashion-store/successor/presets/source-parity";
import { fashionStoreUnifiedPreset } from "../app/themes/fashion-store/successor/presets/unified-store";
import { themeRegistry } from "../app/themes/fashion-store/successor/registry";
import { fixtureThemeRegistry } from "../app/themes/fashion-store/successor/fixture-registry";
import {
  fashionStoreFixtureBindingAliases,
  fashionStoreProductSectionVariant,
} from "../app/themes/fashion-store/successor/composition";
import {
  fashionStoreHomePresentationSchema,
  resolveFashionStoreHomePresentation,
} from "../app/themes/fashion-store/contracts/home-presentation";
import {
  buildFashionStoreMerchandisingGroups,
  resolveFashionStoreMerchandising,
} from "../app/themes/fashion-store/contracts/home-merchandising";
import { fashionStoreDecorProductsMessage } from "../app/themes/fashion-store/contracts/decor-home";
import { fashionStoreHomeFixtures } from "../app/themes/fashion-store/fixtures/home";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import {
  renderActiveExperienceModule,
  renderActiveThemeModule,
} from "../scripts/prepare-experience";
import {
  assertFashionStoreDecorHeroSourceTiming,
  fashionStoreDecorHeroContract,
  fashionStoreDecorHeroLayerTimeline,
  fashionStoreDecorHeroSourceLayerTimeline,
} from "../app/themes/fashion-store/contracts/home-hero";
import { createFashionStoreDecorHeroTimeline } from "../app/themes/fashion-store/composables/useFashionStoreDecorHeroMotion";
import {
  defaultFashionStoreHomeDevelopmentProfile,
  parseFashionStoreHomeDevelopmentProfile,
} from "../app/themes/fashion-store/successor/home-development-profile";
import { fashionStoreBehaviorContract } from "../app/themes/fashion-store/behavior-contract";

describe("Fashion Store preview registration", () => {
  test("ships every bounded marketing Block with a Section-owned visible consumer", () => {
    const home = fashionStorePreset.templates.find(({ pageType }) => pageType === "home")!;
    const expected = new Map<string, readonly [string, number]>([
      ["fashion-store.hero", ["fashion-store.hero-slide", 3]],
      ["fashion-store.services", ["fashion-store.service", 4]],
      ["fashion-store.categories", ["fashion-store.category", 4]],
      ["fashion-store.promotion", ["fashion-store.promotion-item", 1]],
      ["fashion-store.brand-strip", ["fashion-store.brand", 5]],
      ["fashion-store.marquee", ["fashion-store.marquee-item", 4]],
      ["fashion-store.editorial", ["fashion-store.editorial-card", 4]],
    ]);
    for (const section of home.sections) {
      const contract = expected.get(section.type);
      if (!contract) continue;
      expect(section.blocks).toHaveLength(contract[1]);
      expect(section.blocks.every(({ type }) => type === contract[0])).toBe(true);
    }
    expect(JSON.stringify(home)).not.toContain("Corby sofas");
    expect(JSON.stringify(home)).not.toContain("Verona sofas");
    expect(JSON.stringify(home)).not.toContain("Lewis sofas");
    const heroDefinition = fashionStoreManifest.componentRegistry.blocks.find(
      ({ type }) => type === "fashion-store.hero-slide",
    )!;
    const firstHero = home.sections.find(({ type }) => type === "fashion-store.hero")!.blocks[0]!;
    for (const settingId of [
      "title",
      "price",
      "pattern-desktop",
      "pattern-mobile",
      "product-image",
      "thumbnail",
      "background-color",
      "foreground-color",
    ]) {
      const definition = heroDefinition.settings.find(({ id }) => id === settingId)!;
      expect(firstHero.settings[settingId]).not.toEqual(
        "default" in definition ? definition.default : undefined,
      );
    }
    const plan = renderThemeTreePlan(home, themeRegistry);
    expect(
      plan.sections.find(({ instance }) => instance.type === "fashion-store.hero")?.blocks,
    ).toEqual([]);
  });
  test("keeps Logo media Store Identity-owned and optional Block regions truthful", async () => {
    const heroDefinition = fashionStoreManifest.componentRegistry.sections.find(
      ({ type }) => type === "fashion-store.hero",
    )!;
    const settingIds = heroDefinition.settings.map(({ id }) => id);
    expect(settingIds).toContain("identity-logo-variant");
    expect(settingIds).toContain("identity-logo-width");
    expect(settingIds).toContain("identity-logo-placement");
    expect(settingIds).toContain("identity-logo-spacing");
    expect(settingIds).toContain("identity-logo-visible");
    expect(settingIds).toContain("identity-logo-mobile-visible");
    expect(settingIds).not.toContain("header-logo");
    expect(settingIds).not.toContain("footer-logo");
    const home = fashionStorePreset.templates.find(({ pageType }) => pageType === "home")!;
    expect(home.sections[0]!.settings).not.toHaveProperty("header-logo");
    expect(home.sections[0]!.settings).not.toHaveProperty("footer-logo");

    const header = await readFile(
      resolve(
        import.meta.dir,
        "../app/themes/fashion-store/components/shared/FashionStoreHeader.vue",
      ),
      "utf8",
    );
    expect(header).toContain("data-logo-asset-id");
    expect(header).toContain("data-logo-variant");
    for (const [file, condition] of [
      ["FashionStoreServicesSection.vue", "foundation.services.length > 0"],
      ["FashionStoreBrandStripSection.vue", "foundation.brands.length > 0"],
      ["FashionStoreMarqueeSection.vue", "marqueeMessages.length > 0"],
      ["FashionStoreEditorialSection.vue", "editorial.magazine.length > 0"],
    ] as const) {
      const source = await readFile(
        resolve(import.meta.dir, `../app/themes/fashion-store/components/sections/${file}`),
        "utf8",
      );
      expect(source).toContain(`v-if="${condition}"`);
    }
  });
  test("routes generic motion and marquee behavior through their stable owners", async () => {
    const genericConfig = await readFile(
      resolve(import.meta.dir, "../playwright.fashion-store.config.ts"),
      "utf8",
    );
    expect(genericConfig).toMatch(
      /testIgnore:\s*\[[\s\S]*"fashion-store-animation-performance\.spec\.ts"/,
    );

    const marquee = fashionStoreBehaviorContract.behaviors.find(
      ({ id }) => id === "promotional-marquee",
    );
    expect(marquee?.actions.source.selector).toBe("section:nth-of-type(9)");
    expect(marquee?.actions.implementation.selector).toBe('[data-home-section="marquee"]');
    expect(marquee?.evidenceStates[0]?.namedState).toMatchObject({
      implementationSelector: '[data-home-section="marquee"]',
      sourceSelector: "section:nth-of-type(9)",
    });
  });

  test("keeps the Home development profile composition-only", () => {
    expect(defaultFashionStoreHomeDevelopmentProfile).toBe("combined");
    expect(parseFashionStoreHomeDevelopmentProfile()).toEqual({
      composition: "combined",
      serialized: "combined",
    });
    expect(parseFashionStoreHomeDevelopmentProfile("isolated")).toEqual({
      composition: "isolated",
      serialized: "isolated",
    });
    for (const obsoleteProfile of [
      "combined:decor:transparent-overlay",
      "combined:fashion:solid",
      "isolated:decor:transparent-overlay",
    ]) {
      expect(() => parseFashionStoreHomeDevelopmentProfile(obsoleteProfile)).toThrow();
    }
  });

  test("keeps active Fashion Store commands on the composition-only profile", async () => {
    const [packageSource, repositoryPackageSource, animationConfig, unifiedHomeSpec] =
      await Promise.all([
        readFile(resolve(import.meta.dir, "../package.json"), "utf8"),
        readFile(resolve(import.meta.dir, "../../../package.json"), "utf8"),
        readFile(
          resolve(import.meta.dir, "../playwright.fashion-store-animation-performance.config.ts"),
          "utf8",
        ),
        readFile(
          resolve(import.meta.dir, "../e2e/fashion-store-live-unified-home.spec.ts"),
          "utf8",
        ),
      ]);
    const scripts = (JSON.parse(packageSource) as { scripts: Record<string, string> }).scripts;
    const repositoryScripts = (
      JSON.parse(repositoryPackageSource) as { scripts: Record<string, string> }
    ).scripts;

    expect(scripts["dev:fashion-store"]).toBe(
      "bun scripts/dev-fashion-store.ts --source=local --home=combined",
    );
    expect(scripts["dev:fashion-store:staging"]).toBe(
      "bun scripts/dev-fashion-store.ts --source=staging",
    );
    expect(scripts["dev:fashion-store:isolated"]).toBe(
      "bun scripts/dev-fashion-store.ts --source=local --home=isolated",
    );
    expect(scripts["dev:fashion-store:live"]).toBe("bun run dev:fashion-store:staging");
    expect(scripts["dev:fashion-store:home-isolated"]).toBe("bun run dev:fashion-store:isolated");
    expect(repositoryScripts["dev:fashion-store"]).toBe(
      "bun run --cwd apps/storefront dev:fashion-store",
    );
    expect(scripts["dev:fashion-store:decor-isolated"]).toBeUndefined();
    expect(scripts["test:fashion-store-home:headers"]).toBeUndefined();
    expect(scripts["test:fashion-store"]).toBe(
      "bun run test:fashion-store:unit && bun run test:fashion-store:browser && bun run test:fashion-store:acceptance",
    );
    expect(scripts["test:fashion-store:acceptance"]).toBe(
      "bun ../../tools/run-fashion-store-acceptance.ts --scope=theme --stage=integrated",
    );
    expect(scripts["test:fashion-store:unit"]).toBe(
      "bun ../../tools/run-fashion-store-acceptance.ts --scope=theme --stage=unit",
    );
    expect(animationConfig).toContain('const profile = "combined"');
    expect(animationConfig).toContain('testMatch: "fashion-store-animation-performance.spec.ts"');
    expect(animationConfig.match(/name: "motion-/g)).toHaveLength(2);
    expect(unifiedHomeSpec).not.toContain('.split(\n  ":",');
  });

  test("publishes unified defaults without changing source-parity defaults", () => {
    const sourceHome = fashionStorePreset.templates.find(({ pageType }) => pageType === "home")!;
    const unifiedHome = fashionStoreUnifiedPreset.templates.find(
      ({ pageType }) => pageType === "home",
    )!;

    expect(fashionStoreUnifiedPreset).toMatchObject({
      id: "unified-store",
      label: "Unified store",
    });
    expect(sourceHome.sections.map(({ id, visible }) => ({ id, visible }))).toEqual(
      unifiedHome.sections.map(({ id, visible }) => ({ id, visible })),
    );
    expect(unifiedHome.sections.map(({ settings, type }) => ({ settings, type }))).toEqual(
      sourceHome.sections.map(({ settings, type }) => ({ settings, type })),
    );
    expect(
      unifiedHome.sections.find(({ id }) => id === "fashion-store-home-product-merchandising")
        ?.visible,
    ).toBe(false);
    expect(
      sourceHome.sections.find(({ type }) => type === "fashion-store.categories")?.settings,
    ).toMatchObject({ "categories-presentation": "source" });
  });
  test("rejects controlled drift from the independently observed Decor timing ledger", () => {
    const observed = {
      autoplayMs: fashionStoreDecorHeroContract.autoplayMs,
      layers: fashionStoreDecorHeroSourceLayerTimeline.map(({ delayMs, durationMs, role }) => ({
        delayMs,
        durationMs,
        role,
      })),
      stopAfterReturnToFirst: true,
      swipeThresholdPx: fashionStoreDecorHeroContract.swipeThresholdPx,
      transitionMs: fashionStoreDecorHeroContract.transitionMs,
    };
    expect(() => assertFashionStoreDecorHeroSourceTiming(observed)).not.toThrow();
    expect(
      fashionStoreDecorHeroLayerTimeline.filter(
        (layer, index) =>
          layer.delayMs !== fashionStoreDecorHeroSourceLayerTimeline[index]!.delayMs ||
          layer.durationMs !== fashionStoreDecorHeroSourceLayerTimeline[index]!.durationMs,
      ),
    ).toEqual([
      expect.objectContaining({ delayMs: 1_000, durationMs: 400, role: "product" }),
      expect.objectContaining({ delayMs: 1_200, durationMs: 400, role: "title" }),
      expect.objectContaining({ delayMs: 1_500, durationMs: 400, role: "price" }),
      expect.objectContaining({ delayMs: 1_700, durationMs: 400, role: "cta" }),
      expect.objectContaining({ delayMs: 2_200, durationMs: 400, role: "next" }),
    ]);
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
    const animation = {
      cancel: () => undefined,
      pause: () => undefined,
      play: () => undefined,
    } as unknown as Animation;
    const timeline = {
      call: () => undefined,
      to: () => {
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
      { querySelector: () => ({ animate: () => animation }) as unknown as HTMLElement },
      () => undefined,
      () => {
        failed = true;
      },
    );
    expect(result).toBeUndefined();
    expect(reverted).toBe(true);
    expect(failed).toBe(true);
  });

  test("delegates Hero layer interpolation to compositor animations", () => {
    const keyframes: Keyframe[][] = [];
    const options: KeyframeAnimationOptions[] = [];
    const animation = {
      cancel: () => undefined,
      pause: () => undefined,
      play: () => undefined,
    } as unknown as Animation;
    const timeline = {
      call: (callback: () => void) => callback(),
      kill: () => undefined,
      pause: () => undefined,
      play: () => undefined,
      revert: () => undefined,
      to: () => undefined,
    };
    const result = createFashionStoreDecorHeroTimeline(
      { timeline: () => timeline },
      {
        querySelector: () =>
          ({
            animate: (frames: Keyframe[], timing: KeyframeAnimationOptions) => {
              keyframes.push(frames);
              options.push(timing);
              return animation;
            },
          }) as unknown as HTMLElement,
      },
      () => undefined,
      () => undefined,
    );

    expect(result).toBeDefined();
    expect(keyframes).toHaveLength(fashionStoreDecorHeroLayerTimeline.length);
    expect(options.map(({ delay, duration }) => ({ delay, duration }))).toEqual(
      fashionStoreDecorHeroLayerTimeline.map(({ delayMs, durationMs }) => ({
        delay: delayMs,
        duration: durationMs,
      })),
    );
    expect(JSON.stringify(keyframes)).not.toContain("filter");
  });

  test("uses one Fashion-owned Decor Hero contract in the shared Home renderer", async () => {
    const [home, contract] = await Promise.all([
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/sections/FashionStoreHeroSection.vue",
        ),
        "utf8",
      ),
      import("../app/themes/fashion-store/contracts/home-hero"),
    ]);

    expect(home).toContain("<FashionStoreDecorHero");
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
        "identity-logo-variant",
        "identity-logo-width",
        "identity-logo-placement",
        "identity-logo-spacing",
        "identity-logo-visible",
        "identity-logo-mobile-visible",
        "header-legal-link",
        "header-highlight-page",
        "footer-legal-link",
        "merchandising-title",
        "featured-collection",
        "featured-product",
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
    expect(legacyHome.settings.some(({ id }) => id === "merchandising-visible")).toBe(true);
    expect(successorHero.settings.some(({ id }) => id === "merchandising-order")).toBe(false);
    expect(successorHero.settings.some(({ id }) => id === "merchandising-visible")).toBe(false);
  });

  test("keeps collection looping aligned with its semantic cards", async () => {
    const component = await readFile(
      resolve(
        import.meta.dir,
        "../app/themes/fashion-store/components/sections/FashionStoreCollectionFeatureSection.vue",
      ),
      "utf8",
    );
    expect(component).toContain("[...items, ...items]");
    expect(component).toContain(':semantic-slide-count="editorial.collection.items.length"');
    expect(component).toContain('@active-index-change="collectionIndex = $event"');
  });

  test("decomposes only the successor Home into the frozen stable Section sequence", () => {
    expect(fashionStoreManifest.id).toBe("fashion-store");
    expect(fashionStoreThemeDescriptor).toMatchObject({
      id: "fashion-store",
      presets: ["source-parity", "unified-store"],
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
      {
        id: "fashion-store-home-product-merchandising",
        required: false,
        type: "fashion-store.product-merchandising",
        visible: false,
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

  test("exposes only the six approved bounded Home presentation variants", () => {
    const settingsByType = new Map(
      fashionStoreManifest.componentRegistry.sections.map((section) => [
        section.type,
        new Map(section.settings.map((setting) => [setting.id, setting])),
      ]),
    );
    const approved = [
      ["fashion-store.categories", "categories-presentation", "source"],
      ["fashion-store.marquee", "marquee-presentation", "source"],
      ["fashion-store.collection-feature", "collection-presentation", "source"],
      ["fashion-store.brand-strip", "brand-strip-presentation", "source"],
      ["fashion-store.editorial", "editorial-presentation", "source"],
      ["fashion-store.services", "services-presentation", "source"],
    ] as const;

    for (const [type, settingId, defaultValue] of approved) {
      expect(settingsByType.get(type)?.get(settingId)).toMatchObject({
        default: defaultValue,
        kind: "select",
        required: true,
      });
    }
    expect(
      fashionStoreManifest.componentRegistry.sections
        .filter(
          ({ type }) => type === "fashion-store.collection" || type === "fashion-store.product",
        )
        .flatMap(({ settings }) => settings.map(({ id }) => id)),
    ).not.toContain("presentation-variant");
  });

  test("validates presentation settings carried by fixture and live Section ViewModels", () => {
    expect(
      fashionStoreHomePresentationSchema.parse({
        "categories-presentation": "decor-icons",
        "marquee-presentation": "decor-reverse",
      }),
    ).toMatchObject({
      "categories-presentation": "decor-icons",
      "marquee-presentation": "decor-reverse",
    });
    expect(() =>
      fashionStoreHomePresentationSchema.parse({ "categories-presentation": "unbounded" }),
    ).toThrow();
    expect(
      resolveFashionStoreHomePresentation({
        data: { presentation: { "services-presentation": "decor-compact" } },
        kind: "theme-section",
        state: "populated",
      }).services,
    ).toBe("decor-compact");

    const fixtureProvider = createFixturePresentationProvider({
      bindingAliases: fashionStoreFixtureBindingAliases,
      bindings: [
        {
          fixtureId: "fashion-store-home",
          id: "legacy-home-binding",
          instanceId: "fashion-store-home",
          kind: "fixture",
          resource: "home",
          state: "populated",
        },
      ],
      fixtures: fashionStoreHomeFixtures,
    });
    const fixtureViewModel = fixtureProvider.resolve({
      instanceId: "fashion-store-home-services",
      settings: { "services-presentation": "decor-compact" },
    });
    expect(resolveFashionStoreHomePresentation(fixtureViewModel).services).toBe("decor-compact");
    expect(fixtureThemeRegistry.fixtureBindingAliases).toBe(fashionStoreFixtureBindingAliases);
  });

  test("resolves Product group membership, fallback, and local states", () => {
    expect(buildFashionStoreMerchandisingGroups([1, 2, 3, 4, 5], 3)).toEqual([
      { id: "new-arrivals", products: [5, 4, 3, 2, 1] },
      { id: "best-sellers", products: [1, 2, 3, 4, 5] },
      { id: "featured", products: [3] },
    ]);
    expect(buildFashionStoreMerchandisingGroups([1, 2], undefined)[2]).toEqual({
      id: "featured",
      products: [1],
    });
    expect(buildFashionStoreMerchandisingGroups([1, 2, 3, 4, 5, 6, 7, 8, 9])[0]?.products).toEqual([
      9, 8, 7, 6, 5, 4, 3, 2,
    ]);

    for (const state of ["loading", "empty", "validation-error", "unavailable"] as const) {
      expect(resolveFashionStoreMerchandising({ data: {}, kind: "theme-section", state })).toEqual({
        state,
      });
    }
    expect(
      resolveFashionStoreMerchandising({ data: {}, kind: "theme-section", state: "populated" }),
    ).toEqual({ state: "validation-error" });

    expect(fashionStoreDecorProductsMessage({ state: "loading" }, 0)).toBe("Products are loading…");
    expect(fashionStoreDecorProductsMessage({ state: "empty" }, 0)).toBe(
      "No products are available.",
    );
    expect(fashionStoreDecorProductsMessage({ state: "unavailable" }, 0)).toBe(
      "Products are temporarily unavailable.",
    );
    expect(fashionStoreDecorProductsMessage({ state: "validation-error" }, 0)).toBe(
      "Products could not be loaded.",
    );
  });

  test("keeps Product groups on native controls and local state ownership", async () => {
    const component = await readFile(
      resolve(
        import.meta.dir,
        "../app/themes/fashion-store/components/home/FashionStoreDecorHomeBody.vue",
      ),
      "utf8",
    );
    expect(component).toContain("<button");
    expect(component).toContain(":aria-pressed=\"selectedGroup === 'best-sellers'\"");
    expect(component).not.toMatch(/role=["']tab(?:list)?["']/);
    expect(component).toContain("selectedGroup = 'new-arrivals'");
    expect(component).toContain(':data-merchandising-panel="selectedGroup"');
    expect(component).toContain("<FashionStoreProductCard");
    expect(component).toContain("collectionProducts");
    expect(component).toContain(':data-product-id="product.id"');
    expect(component).toContain(':href="product.href"');
    expect(component).not.toMatch(/Wooden cabinet|Modern chair|Classic stools/);
    expect(component).not.toContain(".focus(");
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
        reorderedIds.filter(
          (id) =>
            id !== "fashion-store-home-magazine" &&
            id !== "fashion-store-home-product-merchandising",
        ),
      );
    }
  });

  test("shares converged Home section owners across fixture and live registries", () => {
    for (const type of [
      "fashion-store.hero",
      "fashion-store.services",
      "fashion-store.promotion",
      "fashion-store.brand-strip",
      "fashion-store.marquee",
      "fashion-store.categories",
      "fashion-store.collection-feature",
      "fashion-store.editorial",
      "fashion-store.products",
      "fashion-store.product-merchandising",
    ]) {
      expect(fixtureThemeRegistry.sections[type]).toBe(themeRegistry.sections[type]);
    }
  });

  test("keeps the shared Home sections free of page-owned shells and landmarks", async () => {
    const sectionDirectory = resolve(
      import.meta.dir,
      "../app/themes/fashion-store/components/sections",
    );
    const sectionSources = await Promise.all(
      [
        "FashionStoreHeroSection.vue",
        "FashionStoreServicesSection.vue",
        "FashionStorePromotionSection.vue",
        "FashionStoreBrandStripSection.vue",
        "FashionStoreMarqueeSection.vue",
        "FashionStoreProductsSection.vue",
        "FashionStoreCategoriesSection.vue",
        "FashionStoreCollectionFeatureSection.vue",
        "FashionStoreEditorialSection.vue",
      ].map((name) => readFile(resolve(sectionDirectory, name), "utf8")),
    );
    for (const source of sectionSources) {
      expect(source).not.toContain("<FashionStoreShell");
      expect(source).not.toContain('id="fashion-store-main"');
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
    expect(input.catalogRelease?.products).toContainEqual(
      expect.objectContaining({ slug: "relaxed-corduroy-shirt", status: "published" }),
    );
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
    const providerSource = renderActiveExperienceModule(input);
    expect(providerSource).toContain('mode: "fixture-preview"');
    expect(providerSource).toContain(input.catalogRelease?.releaseId);
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

  test("exposes stable per-owner Home motion observation surfaces", async () => {
    const [hero, fashionMarquee, decorHome] = await Promise.all([
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/FashionStoreDecorHero.vue",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/sections/FashionStoreMarqueeSection.vue",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          import.meta.dir,
          "../app/themes/fashion-store/components/home/FashionStoreDecorHomeBody.vue",
        ),
        "utf8",
      ),
    ]);

    expect(hero).toContain('id="fashion-store-decor-hero"');
    expect(hero).toContain(":data-motion-active-index=");
    expect(hero).toContain(":data-motion-phase=");
    expect(hero).toContain("data-hero-layer=");
    expect(fashionMarquee).toContain("data-fashion-store-marquee");
    expect(decorHome).toContain('data-decor-region="promotional-marquee"');
    expect(decorHome).toContain('data-decor-region="collection-carousel"');
    expect(decorHome).toContain('data-decor-region="client-marquee"');
    expect(decorHome).toContain(":data-motion-active-index=");
    expect(decorHome).toContain(":data-motion-phase=");
  });
});
