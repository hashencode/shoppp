import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  fashionStoreManifest,
  fashionStoreThemeDescriptor,
} from "../app/themes/fashion-store/manifest";
import { fashionStorePreset } from "../app/themes/fashion-store/presets/source-parity";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { renderActiveThemeModule } from "../scripts/prepare-experience";

describe("Fashion Store preview registration", () => {
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
      home: [
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
        "hero-eyebrow",
        "hero-title",
        "hero-body",
        "hero-image",
        "hero-primary-link",
        "hero-secondary-link",
        "merchandising-title",
        "featured-collection",
        "featured-product",
        "merchandising-visible",
        "merchandising-order",
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
    expect(settingsByType.get("fashion-store.home")?.get("header-highlight-page")?.kind).toBe(
      "page-reference",
    );
    expect(settingsByType.get("fashion-store.home")?.get("featured-collection")?.required).toBe(
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

  test("keeps collection steps aligned with fractional card widths", async () => {
    const [component, integration] = await Promise.all([
      readFile(
        resolve(import.meta.dir, "../app/themes/fashion-store/components/FashionStoreHome.vue"),
        "utf8",
      ),
      readFile(resolve(import.meta.dir, "../app/themes/fashion-store/integration.css"), "utf8"),
    ]);
    expect(component).toContain("collectionIndex.value * 0.09765625");
    expect(component).toContain("collectionIndex.value / 12");
    expect(integration).toContain("calc((100% - 60px) / 3 + 0.078125px)");
  });

  test("declares the existing platform templates while keeping one section per page type", () => {
    expect(fashionStoreManifest.id).toBe("fashion-store");
    expect(fashionStoreThemeDescriptor).toMatchObject({
      id: "fashion-store",
      presets: ["source-parity"],
      supportedPageTemplates: ["home", "collection", "product", "cart", "checkout", "content"],
    });
    expect(
      fashionStorePreset.templates.map(({ pageType, sections }) => ({
        pageType,
        sectionType: sections[0]?.type,
      })),
    ).toEqual([
      { pageType: "home", sectionType: "fashion-store.home" },
      { pageType: "collection", sectionType: "fashion-store.collection" },
      { pageType: "product", sectionType: "fashion-store.product" },
      { pageType: "cart", sectionType: "fashion-store.cart" },
      { pageType: "checkout", sectionType: "fashion-store.checkout" },
      { pageType: "content", sectionType: "fashion-store.content" },
    ]);
  });

  test("prepares a signed descriptor-compatible snapshot and selects one static registry", async () => {
    const input = await fashionStorePreviewBuildInput("https://preview.example.test");
    const source = renderActiveThemeModule({
      catalog: [fashionStoreThemeDescriptor],
      input,
      moduleAllowlist: { "fashion-store": "../themes/fashion-store/registry" },
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
    expect(source).toContain('from "../themes/fashion-store/registry"');
    expect(source).not.toContain("themes/fashion/registry");
    expect(source).not.toContain("themes/decor/registry");
  });

  test("rejects mismatched versions and templates outside the platform vocabulary", async () => {
    const input = await fashionStorePreviewBuildInput("https://preview.example.test");
    const options = {
      catalog: [fashionStoreThemeDescriptor],
      moduleAllowlist: { "fashion-store": "../themes/fashion-store/registry" },
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
      moduleAllowlist: { "fashion-store": "../themes/fashion-store/registry" },
    });

    expect(source).not.toContain("fashion-store");
    expect(source).not.toContain("/themes/");
  });
});
