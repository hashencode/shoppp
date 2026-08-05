import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { themePackageSchema } from "@shoppp/contracts";

import { resolveTemplateOverride } from "../../../packages/domain/src/storefront-experience";
import { fashionPreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { renderActiveThemeModule } from "../scripts/prepare-experience";
import { fashionManifest, fashionThemeDescriptor } from "../app/themes/fashion/manifest";
import { fashionPreset } from "../app/themes/fashion/presets/editorial";

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

  test("preserves preset defaults while applying visibility, order, content, and reset overrides", () => {
    const home = fashionPreset.templates.find(({ pageType }) => pageType === "home")!;
    const changed = resolveTemplateOverride(home, {
      operations: [
        { instanceId: "home-story", kind: "set-visibility", visible: false },
        { instanceId: "home-hero", kind: "set-setting", settingId: "heading", value: "New season" },
        {
          instanceIds: [
            "site-navigation",
            "announcement",
            "home-products",
            "home-hero",
            "home-story",
            "trust-strip",
            "site-footer",
          ],
          kind: "reorder-sections",
        },
        { instanceId: "home-hero", kind: "reset-setting", settingId: "heading" },
      ],
      presetId: fashionPreset.id,
      schemaVersion: 1,
      templateId: home.id,
    });

    expect(changed.sections.find(({ id }) => id === "home-story")?.visible).toBe(false);
    expect(changed.sections.map(({ id }) => id)[2]).toBe("home-products");
    expect(changed.sections.find(({ id }) => id === "home-hero")?.settings.heading).toBe(
      home.sections.find(({ id }) => id === "home-hero")?.settings.heading,
    );
    expect(home.sections.find(({ id }) => id === "home-story")?.visible).toBe(true);
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
    expect(source).not.toMatch(/jquery|revolution|crafto|contact\.php|@font-face|https?:\/\//);
  });
});
