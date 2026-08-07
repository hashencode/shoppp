import { describe, expect, test } from "bun:test";

import {
  createThemeAssetResolver,
  mergeExperienceFixtureRegistries,
  paymentAssetName,
  validateThemeAssets,
} from "../app/theme-engine/assets";
import { renderActiveThemeModule } from "../scripts/prepare-experience";
import { fashionStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";

const fixture = {
  id: "fashion-home",
  label: "Fashion home",
  pageTypes: ["home"],
  viewModels: {
    hero: {
      data: { heading: "New collection" },
      kind: "theme-section",
      state: "populated",
    },
  },
} as const;

describe("selected theme resources", () => {
  test("keeps every enabled Fashion Store binding backed by a namespaced fixture", async () => {
    const input = await fashionStorePreviewBuildInput("https://preview.example.test");
    expect(input.snapshot.resolvedTemplates.map(({ pageType }) => pageType)).toEqual([
      "home",
      "collection",
    ]);
    expect(input.snapshot.bindings).toEqual([
      expect.objectContaining({
        fixtureId: "fashion-store-home",
        instanceId: "fashion-store-home",
      }),
      expect.objectContaining({
        fixtureId: "fashion-store-shop",
        instanceId: "fashion-store-collection",
      }),
    ]);
  });

  test("derives accessible payment names from namespaced asset IDs", () => {
    expect(paymentAssetName("fashion.payment-american-express")).toBe("American Express");
    expect(paymentAssetName("decor.payment-union-pay")).toBe("Union Pay");
  });

  test("validates namespaced assets and rejects missing or cross-theme IDs", () => {
    const assets = validateThemeAssets("fashion", {
      "fashion.hero-01": "/assets/hero-01.abc.jpg",
      "fashion.logo": "/assets/logo.abc.png",
    });
    const resolveAsset = createThemeAssetResolver("fashion", assets);

    expect(resolveAsset("fashion.hero-01")).toContain("hero-01");
    expect(() => resolveAsset("fashion.missing")).toThrow("missing");
    expect(() => resolveAsset("decor.hero-01")).toThrow("namespace");
    expect(() =>
      validateThemeAssets("fashion", { "fashion.hero": "https://example.test/x.jpg" }),
    ).toThrow("same-origin");
    expect(() =>
      validateThemeAssets("fashion", {
        "fashion.hero": "/assets/one.jpg",
        "fashion.logo": "/assets/one.jpg",
      }),
    ).toThrow("duplicate");
  });

  test("merges validated theme fixtures without disturbing core fixtures", () => {
    const core = { "core-populated": { ...fixture, id: "core-populated" } };
    const merged = mergeExperienceFixtureRegistries(core, { "fashion-home": fixture });

    expect(Object.keys(merged)).toEqual(["core-populated", "fashion-home"]);
    expect(merged["fashion-home"]?.viewModels.hero?.kind).toBe("theme-section");
    expect(() =>
      mergeExperienceFixtureRegistries(core, {
        "core-populated": { ...fixture, id: "core-populated" },
      }),
    ).toThrow("duplicate");
    expect(() => mergeExperienceFixtureRegistries(core, { mismatch: fixture })).toThrow(
      "stable ID",
    );
  });

  test("generates selected assets and fixtures while production stays empty", () => {
    const descriptor = {
      configurationSchemaVersion: 1,
      id: "fashion",
      platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
      platformContractVersion: "1.0.0",
      presets: ["editorial"],
      supportedPageTemplates: ["home"],
      themeVersion: "1.0.0",
    } as const;
    const snapshot = {
      approvedAt: "2026-07-30T01:00:00.000Z",
      approvedBy: "operator-1",
      bindings: [],
      configurationSchemaVersion: 1,
      experienceId: "experience-fashion",
      id: "snapshot-fashion-resource-test",
      kind: "approved",
      overrides: [],
      platformContractVersion: "1.0.0",
      provenance: {
        approvedAt: "2026-07-30T00:00:00.000Z",
        approvedBy: "theme-team",
        license: "Internal",
        source: "internal://fashion",
      },
      resolvedTemplates: [
        {
          id: "fashion-home-resource-test",
          pageType: "home",
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "resource-test",
              settings: {},
              type: "core.announcement",
              visible: true,
            },
          ],
        },
      ],
      themeId: "fashion",
      themeVersion: "1.0.0",
      version: 1,
    } as const;
    const preview = renderActiveThemeModule({
      catalog: [descriptor],
      input: {
        environment: "preview",
        expectedOrigin: "https://preview.example.test",
        snapshot,
        themeId: "fashion",
      },
      moduleAllowlist: { fashion: "../themes/fashion/registry" },
    });
    const fallback = renderActiveThemeModule({
      catalog: [],
      input: { environment: "production" },
      moduleAllowlist: {},
    });

    expect(preview).toContain("activeThemeAssets");
    expect(preview).toContain("activeThemeFixtures");
    expect(preview).not.toContain("../themes/decor");
    expect(fallback).toContain("activeThemeAssets = {}");
    expect(fallback).toContain("activeThemeFixtures = {}");
    expect(fallback).not.toContain("/themes/");
  });
});
