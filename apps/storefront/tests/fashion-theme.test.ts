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
      "home",
      "order",
      "policy",
      "product",
    ]);
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
      "fashion.product-showcase",
      "fashion.magazine",
      "fashion.footer",
    ]);
    const serialized = JSON.stringify(fashionHomeFixtures);
    expect(serialized).not.toContain("Atlas");
    expect(serialized).toContain("fashion.slider-01");
    expect(Object.keys(themeAssets).length).toBeGreaterThanOrEqual(40);
    expect(Object.keys(themeAssets).every((id) => id.startsWith("fashion."))).toBe(true);
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
