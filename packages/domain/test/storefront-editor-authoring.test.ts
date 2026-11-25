import { describe, expect, test } from "bun:test";
import { pageTemplateSchema, themeOverrideSchema } from "@shoppp/contracts";
import { resolveTemplateOverride } from "../src/storefront-experience";

const preset = pageTemplateSchema.parse({
  id: "home", pageType: "home", requiredCapabilities: [],
  sections: [{ id: "hero", type: "hero", capabilities: [], required: true,
    visible: true, settings: { title: "Original" }, blocks: [] }],
});
const override = (operations: unknown[]) => themeOverrideSchema.parse({
  templateId: "home", presetId: "default", schemaVersion: 4, operations,
});

describe("local theme authoring", () => {
  test("adds an independent section and edits it in the same saved document", () => {
    const result = resolveTemplateOverride(preset, override([
      { kind: "add-section", section: { ...preset.sections[0], id: "hero-copy", required: false } },
      { kind: "set-setting", instanceId: "hero-copy", settingId: "title", value: "New title" },
      { kind: "reorder-sections", instanceIds: ["hero-copy", "hero"] },
    ]));
    expect(result.sections.map(({ id }) => id)).toEqual(["hero-copy", "hero"]);
    expect(result.sections[0]!.settings.title).toBe("New title");
    expect(result.sections[1]!.settings.title).toBe("Original");
    expect(preset.sections).toHaveLength(1);
  });
  test("rejects duplicate IDs and removal of required regions", () => {
    expect(() => resolveTemplateOverride(preset, override([
      { kind: "add-section", section: preset.sections[0] },
    ]))).toThrow();
    expect(() => resolveTemplateOverride(preset, override([
      { kind: "remove-section", instanceId: "hero" },
    ]))).toThrow();
  });
  test("stores bounded global styles and rejects executable or unknown values", () => {
    const result = resolveTemplateOverride(preset, override([
      { kind: "set-theme-styles", styles: { accent: "#123456", font: "figtree", spacing: 24, buttonRadius: 8 } },
    ]));
    expect(result.styles).toEqual({ accent: "#123456", font: "figtree", spacing: 24, buttonRadius: 8 });
    expect(() => override([{ kind: "set-theme-styles", styles: { accent: "url(javascript:x)" } }])).toThrow();
    expect(() => override([{ kind: "set-theme-styles", styles: { customCss: "body{}" } }])).toThrow();
  });
});
