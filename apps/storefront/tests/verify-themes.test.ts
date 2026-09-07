import { describe, expect, test } from "bun:test";
import type { ThemeMatrixEntry } from "../scripts/verify-themes";
import { storefrontThemeMatrix, verifyThemeMatrix } from "../scripts/verify-themes";

function copyEntry(entry: ThemeMatrixEntry): ThemeMatrixEntry {
  return structuredClone(entry);
}

function minimalThirdTheme(): ThemeMatrixEntry {
  const entry = copyEntry(storefrontThemeMatrix[0]!);
  const minimalType = (type: string) => type.replace(/^fashion-store\./, "minimal.");
  const homeTypes = new Set(
    entry.package.presets
      .flatMap(({ templates }) => templates)
      .find(({ pageType }) => pageType === "home")!
      .sections.map(({ type }) => type),
  );
  entry.package.manifest.id = "minimal";
  entry.package.manifest.provenance = {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "theme-reviewer",
    license: "Repository-owned test fixture",
    source: "internal://shoppp/themes/minimal",
  };
  entry.package.manifest.supportedPageTemplates = ["home"];
  entry.package.manifest.componentRegistry.sections =
    entry.package.manifest.componentRegistry.sections
      .filter((definition) =>
        definition.type.startsWith("fashion-store.") ? homeTypes.has(definition.type) : true,
      )
      .map((definition) => ({ ...definition, type: minimalType(definition.type) }));
  entry.package.presets = entry.package.presets.map((preset) => ({
    ...preset,
    templates: preset.templates
      .filter(({ pageType }) => pageType === "home")
      .map((template) => ({
        ...template,
        sections: template.sections.map((section) => ({
          ...section,
          type: minimalType(section.type),
        })),
      })),
  }));
  entry.descriptor = {
    ...entry.descriptor,
    id: "minimal",
    supportedPageTemplates: ["home"],
  };
  return entry;
}

describe("storefront theme matrix", () => {
  test("verifies every approved package, preset, compatibility range, and catalog descriptor", () => {
    expect(() =>
      verifyThemeMatrix(
        storefrontThemeMatrix,
        storefrontThemeMatrix.map(({ descriptor }) => descriptor),
      ),
    ).not.toThrow();
  });

  test("registers Fashion Store platform templates while readiness remains home-only", () => {
    const fashionStore = storefrontThemeMatrix.find(
      ({ descriptor }) => descriptor.id === "fashion-store",
    );
    expect(fashionStore?.assetPolicy).toBe("source-equivalent");
    expect(fashionStore?.requiredPageTypes).toEqual(["home"]);
    expect(fashionStore?.package.manifest.supportedPageTemplates).toEqual([
      "home",
      "collection",
      "product",
      "cart",
      "checkout",
      "content",
    ]);
  });

  test("rejects duplicate IDs, incomplete provenance, incompatibility, schema drift, and page gaps", () => {
    const duplicate = copyEntry(storefrontThemeMatrix[0]!);
    expect(() =>
      verifyThemeMatrix(
        [duplicate, copyEntry(duplicate)],
        [duplicate.descriptor, duplicate.descriptor],
      ),
    ).toThrow("Duplicate storefront theme ID");

    const incomplete = copyEntry(storefrontThemeMatrix[0]!);
    incomplete.package.manifest.provenance.source = "pending verification";
    expect(() => verifyThemeMatrix([incomplete], [incomplete.descriptor])).toThrow(
      "incomplete provenance",
    );

    const incompatible = copyEntry(storefrontThemeMatrix[0]!);
    incompatible.package.manifest.platformCompatibility = {
      maxExclusive: "3.0.0",
      min: "2.0.0",
    };
    incompatible.package.manifest.platformContractVersion = "2.0.0";
    incompatible.descriptor.platformCompatibility =
      incompatible.package.manifest.platformCompatibility;
    incompatible.descriptor.platformContractVersion = "2.0.0";
    expect(() => verifyThemeMatrix([incompatible], [incompatible.descriptor])).toThrow(
      "does not support",
    );

    const drifted = copyEntry(storefrontThemeMatrix[0]!);
    drifted.descriptor.configurationSchemaVersion += 1;
    expect(() => verifyThemeMatrix([drifted], [drifted.descriptor])).toThrow("drifted");

    const missingPage = copyEntry(storefrontThemeMatrix[0]!);
    missingPage.package.manifest.supportedPageTemplates =
      missingPage.package.manifest.supportedPageTemplates.filter((page) => page !== "home");
    missingPage.package.presets = missingPage.package.presets.map((preset) => ({
      ...preset,
      templates: preset.templates.filter(({ pageType }) => pageType !== "home"),
    }));
    missingPage.descriptor.supportedPageTemplates =
      missingPage.package.manifest.supportedPageTemplates;
    expect(() => verifyThemeMatrix([missingPage], [missingPage.descriptor])).toThrow(
      "missing required home support",
    );
  });

  test("keeps the Fashion source boundary structural until U6.2 registers a migration", () => {
    const fashionStore = storefrontThemeMatrix.find(
      ({ descriptor }) => descriptor.id === "fashion-store",
    );
    expect(fashionStore?.directPackageBoundaries).toEqual([
      { fromSchemaVersion: 1, toSchemaVersion: 2 },
    ]);
    expect("migrations" in (fashionStore ?? {})).toBe(false);
  });

  test("requires a contiguous direct package boundary for every schema version", () => {
    const entry = copyEntry(storefrontThemeMatrix[0]!);
    entry.directPackageBoundaries = [];
    entry.package.manifest.configurationSchemaVersion = 2;
    entry.descriptor.configurationSchemaVersion = 2;
    expect(() => verifyThemeMatrix([entry], [entry.descriptor])).toThrow(
      "missing direct package boundary 1 -> 2",
    );
    entry.directPackageBoundaries = [{ fromSchemaVersion: 1, toSchemaVersion: 2 }];
    expect(() => verifyThemeMatrix([entry], [entry.descriptor])).not.toThrow();
  });

  test("accepts a minimal third internal fixture without changing the renderer", () => {
    const third = minimalThirdTheme();
    expect(third.package.manifest.supportedPageTemplates).toEqual(["home"]);
    expect(() => verifyThemeMatrix([third], [third.descriptor])).not.toThrow();
  });
});
