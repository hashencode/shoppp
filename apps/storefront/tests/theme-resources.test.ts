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
  id: "synthetic-home",
  label: "Synthetic home",
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
      "product",
      "cart",
      "checkout",
      "content",
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
      expect.objectContaining({
        fixtureId: "fashion-store-product",
        instanceId: "fashion-store-product",
      }),
      expect.objectContaining({
        fixtureId: "fashion-store-cart",
        instanceId: "fashion-store-cart",
      }),
      expect.objectContaining({
        fixtureId: "fashion-store-checkout",
        instanceId: "fashion-store-checkout",
      }),
      expect.objectContaining({
        fixtureId: "fashion-store-content",
        instanceId: "fashion-store-content",
      }),
    ]);
  });

  test("derives accessible payment names from namespaced asset IDs", () => {
    expect(paymentAssetName("synthetic.payment-american-express")).toBe("American Express");
    expect(paymentAssetName("decor.payment-union-pay")).toBe("Union Pay");
  });

  test("validates namespaced assets and rejects missing or cross-theme IDs", () => {
    const assets = validateThemeAssets("synthetic", {
      "synthetic.hero-01": "/assets/hero-01.abc.jpg",
      "synthetic.logo": "/assets/logo.abc.png",
    });
    const resolveAsset = createThemeAssetResolver("synthetic", assets);

    expect(resolveAsset("synthetic.hero-01")).toContain("hero-01");
    expect(() => resolveAsset("synthetic.missing")).toThrow("missing");
    expect(() => resolveAsset("decor.hero-01")).toThrow("namespace");
    expect(() =>
      validateThemeAssets("synthetic", { "synthetic.hero": "https://example.test/x.jpg" }),
    ).toThrow("same-origin");
    expect(() =>
      validateThemeAssets("synthetic", {
        "synthetic.hero": "/assets/one.jpg",
        "synthetic.logo": "/assets/one.jpg",
      }),
    ).toThrow("duplicate");
  });

  test("merges validated theme fixtures without disturbing core fixtures", () => {
    const core = { "core-populated": { ...fixture, id: "core-populated" } };
    const merged = mergeExperienceFixtureRegistries(core, { "synthetic-home": fixture });

    expect(Object.keys(merged)).toEqual(["core-populated", "synthetic-home"]);
    expect(merged["synthetic-home"]?.viewModels.hero?.kind).toBe("theme-section");
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
      id: "synthetic",
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
      experienceId: "experience-synthetic",
      id: "snapshot-synthetic-resource-test",
      kind: "approved",
      overrides: [],
      platformContractVersion: "1.0.0",
      provenance: {
        approvedAt: "2026-07-30T00:00:00.000Z",
        approvedBy: "theme-team",
        license: "Internal",
        source: "internal://synthetic",
      },
      resolvedTemplates: [
        {
          id: "synthetic-home-resource-test",
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
      themeId: "synthetic",
      themeVersion: "1.0.0",
      version: 1,
    } as const;
    const preview = renderActiveThemeModule({
      catalog: [descriptor],
      input: {
        environment: "preview",
        expectedOrigin: "https://preview.example.test",
        snapshot,
        themeId: "synthetic",
      },
      moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
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
