import { describe, expect, test } from "bun:test";

import {
  fashionStoreManifest,
  fashionStoreThemeDescriptor,
} from "../app/themes/fashion-store/manifest";
import { fashionStorePreset } from "../app/themes/fashion-store/presets/source-parity";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { renderActiveThemeModule } from "../scripts/prepare-experience";

describe("Fashion Store preview registration", () => {
  test("declares one home-only preset and one namespaced section", () => {
    expect(fashionStoreManifest.id).toBe("fashion-store");
    expect(fashionStoreThemeDescriptor).toMatchObject({
      id: "fashion-store",
      presets: ["source-parity"],
      supportedPageTemplates: ["home"],
    });
    expect(fashionStorePreset.templates).toHaveLength(1);
    expect(fashionStorePreset.templates[0]).toMatchObject({
      pageType: "home",
      sections: [{ type: "fashion-store.home" }],
    });
  });

  test("prepares a signed descriptor-compatible snapshot and selects one static registry", async () => {
    const input = await fashionStorePreviewBuildInput("https://preview.example.test");
    const source = renderActiveThemeModule({
      catalog: [fashionStoreThemeDescriptor],
      input,
      moduleAllowlist: { "fashion-store": "../themes/fashion-store/registry" },
    });

    expect(input.snapshot.themeId).toBe("fashion-store");
    expect(input.snapshot.resolvedTemplates.map(({ pageType }) => pageType)).toEqual(["home"]);
    expect(source).toContain('from "../themes/fashion-store/registry"');
    expect(source).not.toContain("themes/fashion/registry");
    expect(source).not.toContain("themes/decor/registry");
  });

  test("rejects mismatched versions and non-home templates", async () => {
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
                id: "fashion-store-product",
                pageType: "product",
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
