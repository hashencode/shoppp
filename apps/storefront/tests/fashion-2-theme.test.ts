import { describe, expect, test } from "bun:test";

import { fashion2Manifest, fashion2ThemeDescriptor } from "../app/themes/fashion-2/manifest";
import { fashion2Preset } from "../app/themes/fashion-2/presets/source-parity";
import { fashion2PreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { renderActiveThemeModule } from "../scripts/prepare-experience";

describe("Fashion 2 preview registration", () => {
  test("declares one home-only preset and one namespaced section", () => {
    expect(fashion2Manifest.id).toBe("fashion-2");
    expect(fashion2ThemeDescriptor).toMatchObject({
      id: "fashion-2",
      presets: ["source-parity"],
      supportedPageTemplates: ["home"],
    });
    expect(fashion2Preset.templates).toHaveLength(1);
    expect(fashion2Preset.templates[0]).toMatchObject({
      pageType: "home",
      sections: [{ type: "fashion-2.home" }],
    });
  });

  test("prepares a signed descriptor-compatible snapshot and selects one static registry", async () => {
    const input = await fashion2PreviewBuildInput("https://preview.example.test");
    const source = renderActiveThemeModule({
      catalog: [fashion2ThemeDescriptor],
      input,
      moduleAllowlist: { "fashion-2": "../themes/fashion-2/registry" },
    });

    expect(input.snapshot.themeId).toBe("fashion-2");
    expect(input.snapshot.resolvedTemplates.map(({ pageType }) => pageType)).toEqual(["home"]);
    expect(source).toContain('from "../themes/fashion-2/registry"');
    expect(source).not.toContain("themes/fashion/registry");
    expect(source).not.toContain("themes/decor/registry");
  });

  test("rejects mismatched versions and non-home templates", async () => {
    const input = await fashion2PreviewBuildInput("https://preview.example.test");
    const options = {
      catalog: [fashion2ThemeDescriptor],
      moduleAllowlist: { "fashion-2": "../themes/fashion-2/registry" },
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
                id: "fashion-2-product",
                pageType: "product",
              },
            ],
          },
        },
      }),
    ).toThrow("does not support");
  });

  test("keeps production fallback free of Fashion 2 imports", () => {
    const source = renderActiveThemeModule({
      catalog: [fashion2ThemeDescriptor],
      input: { environment: "production" },
      moduleAllowlist: { "fashion-2": "../themes/fashion-2/registry" },
    });

    expect(source).not.toContain("fashion-2");
    expect(source).not.toContain("/themes/");
  });
});
