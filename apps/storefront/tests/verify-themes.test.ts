import { describe, expect, test } from "bun:test";
import type { ThemeMatrixEntry } from "../scripts/verify-themes";
import {
  REQUIRED_STOREFRONT_PAGE_TYPES,
  storefrontThemeMatrix,
  verifyThemeMatrix,
} from "../scripts/verify-themes";

function copyEntry(entry: ThemeMatrixEntry): ThemeMatrixEntry {
  return structuredClone(entry);
}

function minimalThirdTheme(): ThemeMatrixEntry {
  const entry = copyEntry(
    storefrontThemeMatrix.find(({ descriptor }) => descriptor.id === "fashion")!,
  );
  entry.package.manifest.id = "minimal";
  entry.package.manifest.provenance = {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "theme-reviewer",
    license: "Repository-owned test fixture",
    source: "internal://shoppp/themes/minimal",
  };
  entry.package.manifest.componentRegistry.sections =
    entry.package.manifest.componentRegistry.sections.filter(({ type }) =>
      type.startsWith("core."),
    );
  entry.package.manifest.supportedPageTemplates = [...REQUIRED_STOREFRONT_PAGE_TYPES];
  for (const preset of entry.package.presets) {
    preset.templates = preset.templates.filter(({ pageType }) =>
      REQUIRED_STOREFRONT_PAGE_TYPES.some((candidate) => candidate === pageType),
    );
    for (const template of preset.templates) {
      for (const section of template.sections) {
        if (section.type.startsWith("core.")) continue;
        if (section.capabilities.includes("navigation.primary")) {
          section.type = "core.navigation";
          section.capabilities = ["navigation.primary", "focus.skip-link"];
        } else if (section.capabilities.includes("legal.links")) {
          section.type = "core.footer";
          section.capabilities = ["legal.links"];
        } else if (
          section.capabilities.includes("product.details") ||
          section.capabilities.includes("product.action")
        ) {
          section.type = "core.product";
          section.capabilities = ["product.details", "product.action"];
        } else if (section.capabilities.includes("cart.summary")) {
          section.type = "core.cart";
          section.capabilities = ["cart.summary", "cart.error"];
        } else if (section.capabilities.includes("checkout.summary")) {
          section.type = "core.checkout";
          section.capabilities = ["checkout.summary", "checkout.error"];
        } else {
          section.type = "core.editorial";
          section.capabilities = [];
        }
        section.settings = {};
      }
    }
  }
  entry.descriptor = {
    ...entry.descriptor,
    id: "minimal",
    supportedPageTemplates: [...REQUIRED_STOREFRONT_PAGE_TYPES],
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

  test("registers Fashion 2 as a source-equivalent, home-only preview", () => {
    const fashion2 = storefrontThemeMatrix.find(({ descriptor }) => descriptor.id === "fashion-2");
    expect(fashion2?.assetPolicy).toBe("source-equivalent");
    expect(fashion2?.requiredPageTypes).toEqual(["home"]);
    expect(fashion2?.package.manifest.supportedPageTemplates).toEqual(["home"]);
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
      missingPage.package.manifest.supportedPageTemplates.filter((page) => page !== "policy");
    missingPage.package.presets[0]!.templates = missingPage.package.presets[0]!.templates.filter(
      ({ pageType }) => pageType !== "policy",
    );
    missingPage.descriptor.supportedPageTemplates =
      missingPage.package.manifest.supportedPageTemplates;
    expect(() => verifyThemeMatrix([missingPage], [missingPage.descriptor])).toThrow(
      "missing required policy",
    );
  });

  test("requires a contiguous migration chain for every schema version", () => {
    const entry = copyEntry(storefrontThemeMatrix[0]!);
    entry.package.manifest.configurationSchemaVersion = 2;
    entry.descriptor.configurationSchemaVersion = 2;
    expect(() => verifyThemeMatrix([entry], [entry.descriptor])).toThrow(
      "missing configuration migration 1 -> 2",
    );
    entry.migrations = [{ fromSchemaVersion: 1, toSchemaVersion: 2 }];
    expect(() => verifyThemeMatrix([entry], [entry.descriptor])).not.toThrow();
  });

  test("accepts a minimal third internal fixture without changing the renderer", () => {
    const third = minimalThirdTheme();
    expect(third.package.manifest.supportedPageTemplates).toEqual([
      ...REQUIRED_STOREFRONT_PAGE_TYPES,
    ]);
    expect(() => verifyThemeMatrix([third], [third.descriptor])).not.toThrow();
  });
});
