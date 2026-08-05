import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { themePackageSchema } from "@shoppp/contracts";

import { resolveTemplateOverride } from "../../../packages/domain/src/storefront-experience";
import { decorManifest, decorThemeDescriptor } from "../app/themes/decor/manifest";
import { decorPreset } from "../app/themes/decor/presets/layered";
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

  test("supports stable visibility, ordering, settings, and preset reset", () => {
    const home = decorPreset.templates.find(({ pageType }) => pageType === "home")!;
    const changed = resolveTemplateOverride(home, {
      operations: [
        { instanceId: "decor-feature", kind: "set-visibility", visible: false },
        {
          instanceId: "decor-hero",
          kind: "set-setting",
          settingId: "heading",
          value: "Layered living",
        },
        {
          instanceIds: [
            "decor-navigation",
            "decor-announcement",
            "decor-hero",
            "decor-feature",
            "decor-products",
            "decor-trust",
            "decor-footer",
          ],
          kind: "reorder-sections",
        },
        { instanceId: "decor-hero", kind: "reset-setting", settingId: "heading" },
      ],
      presetId: decorPreset.id,
      schemaVersion: 1,
      templateId: home.id,
    });

    expect(changed.sections.find(({ id }) => id === "decor-feature")?.visible).toBe(false);
    expect(changed.sections.find(({ id }) => id === "decor-hero")?.settings.heading).toBe(
      home.sections.find(({ id }) => id === "decor-hero")?.settings.heading,
    );
    expect(home.sections.find(({ id }) => id === "decor-feature")?.visible).toBe(true);
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
    expect(source).not.toMatch(/jquery|revolution|crafto|contact\.php|@font-face|https?:\/\//);
  });
});
