import { describe, expect, test } from "bun:test";

import {
  fashionStoreManifest,
  fashionStoreThemeDescriptor,
} from "../app/themes/fashion-store/manifest";
import { fashionStorePreset } from "../app/themes/fashion-store/presets/source-parity";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { renderActiveThemeModule } from "../scripts/prepare-experience";

describe("Fashion Store preview registration", () => {
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
