import { describe, expect, test } from "bun:test";

import type { PageTemplate, ThemeOverride, ThemePackageRegistration } from "@shoppp/contracts";

import {
  findUpgradeConflicts,
  immutableExperienceValue,
  packageRegistrationSupports,
  resolveThemePackageRegistration,
  resolveTemplateOverride,
  validateRequiredCapabilities,
} from "../src/storefront-experience";

const preset = {
  id: "home",
  pageType: "home",
  requiredCapabilities: ["legal.links"],
  sections: [
    {
      blocks: [
        {
          actions: [],
          capabilities: [],
          id: "hero-action",
          settings: { label: "Shop now" },
          type: "core.product-action",
          visible: true,
        },
      ],
      capabilities: ["product.details"],
      id: "hero",
      settings: { heading: "Original heading", tone: "dark" },
      type: "fashion.hero",
      visible: true,
    },
    {
      blocks: [],
      capabilities: ["legal.links"],
      id: "footer",
      required: true,
      settings: {},
      type: "core.legal-footer",
      visible: true,
    },
  ],
} satisfies PageTemplate;

const heroSection = preset.sections[0]!;

const override = {
  operations: [
    {
      instanceId: "hero",
      kind: "set-setting",
      settingId: "heading",
      value: "Merchant heading",
    },
    { instanceId: "hero", kind: "set-visibility", visible: false },
    { instanceId: "hero", kind: "reset-setting", settingId: "tone" },
    {
      instanceId: "hero-action",
      kind: "set-setting",
      settingId: "label",
      value: "Explore",
    },
    { instanceIds: ["footer", "hero"], kind: "reorder-sections" },
  ],
  presetId: "editorial",
  schemaVersion: 1,
  templateId: "home",
} satisfies ThemeOverride;

describe("storefront experience invariants", () => {
  test("resolves exact packages without granting historical lifecycle writes", () => {
    const historical = {
      lifecycle: "historical",
      package: {
        manifest: {
          configurationSchemaVersion: 1,
          id: "fashion-store",
          themeVersion: "1.0.0",
        },
      },
    } as unknown as ThemePackageRegistration;
    const successor = {
      lifecycle: "successor",
      package: {
        manifest: {
          configurationSchemaVersion: 2,
          id: "fashion-store",
          themeVersion: "1.1.0",
        },
      },
    } as unknown as ThemePackageRegistration;

    expect(resolveThemePackageRegistration([historical, successor], "fashion-store", "1.0.0")).toBe(
      historical,
    );
    expect(packageRegistrationSupports(historical, "immutableRead")).toBe(true);
    expect(packageRegistrationSupports(historical, "historicalValidation")).toBe(true);
    expect(packageRegistrationSupports(historical, "migrationSource")).toBe(true);
    expect(packageRegistrationSupports(historical, "creation")).toBe(false);
    expect(packageRegistrationSupports(historical, "activation")).toBe(false);
    expect(packageRegistrationSupports(historical, "mutation")).toBe(false);
    expect(packageRegistrationSupports(successor, "creation")).toBe(true);
    expect(
      resolveThemePackageRegistration([historical, successor], "fashion-store", "1.0.0", 2),
    ).toBeUndefined();
    expect(() =>
      resolveThemePackageRegistration([historical, historical], "fashion-store", "1.0.0"),
    ).toThrow(/duplicate/i);
  });

  test("applies content, visibility, reset, and reorder operations without mutating the preset", () => {
    const original = structuredClone(preset);
    const resolved = resolveTemplateOverride(preset, override);

    expect(resolved.sections.map(({ id }) => id)).toEqual(["footer", "hero"]);
    expect(resolved.sections[1]?.visible).toBe(false);
    expect(resolved.sections[1]?.settings).toEqual({
      heading: "Merchant heading",
      tone: "dark",
    });
    expect(resolved.sections[1]?.blocks[0]?.settings).toEqual({ label: "Explore" });
    expect(preset).toEqual(original);
  });

  test("rejects hiding required instances and removing required capabilities", () => {
    expect(() =>
      resolveTemplateOverride(preset, {
        ...override,
        operations: [{ instanceId: "footer", kind: "set-visibility", visible: false }],
      }),
    ).toThrow("required");

    expect(
      validateRequiredCapabilities({
        ...preset,
        requiredCapabilities: ["legal.links", "product.details"],
        sections: [heroSection],
      }),
    ).toEqual(["legal.links"]);
  });

  test("rejects duplicate, missing, or partial reorder targets", () => {
    for (const instanceIds of [["hero"], ["hero", "missing"], ["hero", "hero"]]) {
      expect(() =>
        resolveTemplateOverride(preset, {
          ...override,
          operations: [{ instanceIds, kind: "reorder-sections" }],
        }),
      ).toThrow("reorder");
    }
  });

  test("reports upgrade conflicts for removed instances and changed settings", () => {
    const upgraded: PageTemplate = {
      ...preset,
      sections: [
        {
          ...heroSection,
          settings: { heading: "Updated default" },
        },
      ],
    };

    expect(findUpgradeConflicts(preset, upgraded, override)).toEqual([
      {
        code: "setting-removed",
        instanceId: "hero",
        operationIndex: 2,
        settingId: "tone",
      },
      {
        code: "instance-removed",
        instanceId: "footer",
        operationIndex: 4,
      },
    ]);
  });

  test("deep-freezes a cloned snapshot value", () => {
    const source = { nested: { value: "approved" } };
    const immutable = immutableExperienceValue(source);

    expect(Object.isFrozen(immutable)).toBe(true);
    expect(Object.isFrozen(immutable.nested)).toBe(true);
    expect(() => {
      immutable.nested.value = "mutated";
    }).toThrow();
    expect(source.nested.value).toBe("approved");
  });
});
