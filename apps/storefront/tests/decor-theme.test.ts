import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { themePackageSchema } from "@shoppp/contracts";

import { decorHomeFixtures } from "../app/themes/decor/fixtures/home";
import { decorManifest, decorThemeDescriptor } from "../app/themes/decor/manifest";
import { decorPreset } from "../app/themes/decor/presets/layered";
import { themeAssets } from "../app/themes/decor/resources";
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
    expect(serialized).not.toContain("Atlas");
    expect(serialized).toContain("decor.slider-01-img-01");
    expect(Object.keys(themeAssets).length).toBeGreaterThanOrEqual(40);
    expect(Object.keys(themeAssets).every((id) => id.startsWith("decor."))).toBe(true);
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
