import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { decorStoreManifest, decorStoreThemeDescriptor } from "../app/themes/decor-store/manifest";
import { decorStoreEnabledPageContracts } from "../app/themes/decor-store/page-contracts";
import { decorStorePreset } from "../app/themes/decor-store/presets/source-parity";
import {
  themeFixtures as decorStoreFixtures,
  themeRegistry as decorStoreRegistry,
  themeRoutes as decorStoreRoutes,
} from "../app/themes/decor-store/registry";
import { decorStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import {
  assertSourceRuntimePolicy,
  collectInitialJavaScriptAssets,
} from "../scripts/check-bundle-budget";
import { renderActiveThemeModule } from "../scripts/prepare-experience";

describe("Decor Store U2 registration", () => {
  test("admits the existing platform page types through Decor-owned sections", () => {
    expect(decorStoreManifest.id).toBe("decor-store");
    expect(decorStoreThemeDescriptor).toMatchObject({
      id: "decor-store",
      presets: ["source-parity"],
      supportedPageTemplates: ["home", "collection", "product", "cart", "checkout", "content"],
    });
    expect(
      decorStorePreset.templates.map(({ pageType, sections }) => ({
        pageType,
        sectionType: sections[0]?.type,
      })),
    ).toEqual(
      ["home", "collection", "product", "cart", "checkout", "content"].map((pageType) => ({
        pageType,
        sectionType: `decor-store.${pageType}`,
      })),
    );
    expect(Object.keys(decorStoreRegistry.sections).sort()).toEqual(
      ["home", "collection", "product", "cart", "checkout", "content"]
        .map((pageType) => `decor-store.${pageType}`)
        .sort(),
    );
    expect(
      Object.values(decorStoreFixtures)
        .map(({ pageTypes }) => pageTypes[0])
        .sort(),
    ).toEqual(["home", "collection", "product", "cart", "checkout", "content"].sort());
  });

  test("prepares only readiness-gated fixtures and one isolated static registry import", async () => {
    const input = await decorStorePreviewBuildInput("https://preview.example.test");
    const source = renderActiveThemeModule({
      catalog: [decorStoreThemeDescriptor],
      input,
      moduleAllowlist: { "decor-store": "../themes/decor-store/registry" },
    });

    expect(input.snapshot.bindings).toHaveLength(2);
    expect(input.snapshot.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fixtureId: "decor-store-home",
          instanceId: "decor-store-home",
        }),
        expect.objectContaining({
          fixtureId: "decor-store-collection",
          instanceId: "decor-store-collection",
        }),
      ]),
    );
    expect(input.snapshot.resolvedTemplates.map(({ pageType }) => pageType).sort()).toEqual([
      "collection",
      "home",
    ]);
    expect(decorStoreRoutes).toEqual(decorStoreEnabledPageContracts);
    expect(source).toContain('from "../themes/decor-store/registry"');
    expect(source).not.toContain("themes/fashion-store/registry");
    expect(source).not.toContain("themes/fashion/registry");
    expect(source).not.toContain("themes/decor/registry");
  });

  test("keeps Fashion and production fallback free of Decor Store imports", async () => {
    const fashionInput = await import("../scripts/prepare-theme-preview-fixture").then(
      ({ fashionStorePreviewBuildInput }) =>
        fashionStorePreviewBuildInput("https://preview.example.test"),
    );
    const fashionSource = renderActiveThemeModule({
      catalog: [
        await import("../app/themes/fashion-store/manifest").then(
          ({ fashionStoreThemeDescriptor }) => fashionStoreThemeDescriptor,
        ),
      ],
      input: fashionInput,
      moduleAllowlist: { "fashion-store": "../themes/fashion-store/registry" },
    });
    const fallbackSource = renderActiveThemeModule({
      catalog: [decorStoreThemeDescriptor],
      input: { environment: "production" },
      moduleAllowlist: { "decor-store": "../themes/decor-store/registry" },
    });

    expect(fashionSource).not.toContain("decor-store");
    expect(fallbackSource).not.toContain("decor-store");
    expect(fallbackSource).not.toContain("/themes/");
  });

  test("registers dedicated commands and leaves preview prerendering selected-theme driven", async () => {
    const [homeSource, packageJson, nuxtConfig, playwrightConfig] = await Promise.all([
      readFile(
        resolve(import.meta.dir, "../app/themes/decor-store/components/DecorStoreHome.vue"),
        "utf8",
      ),
      readFile(resolve(import.meta.dir, "../package.json"), "utf8"),
      readFile(resolve(import.meta.dir, "../nuxt.config.ts"), "utf8"),
      readFile(resolve(import.meta.dir, "../playwright.decor-store.config.ts"), "utf8"),
    ]);
    const scripts = JSON.parse(packageJson).scripts as Record<string, string>;

    expect(scripts["build:preview:decor-store"]).toContain("decor-store");
    expect(scripts["dev:decor-store"]).toContain("decor-store");
    expect(scripts["test:decor-store"]).toContain("decor-store-registration.test.ts");
    expect(nuxtConfig).toContain('"/decor-store-preview-input.json"');
    expect(nuxtConfig).toContain("decorStorePreviewRoutes");
    expect(playwrightConfig).toContain("decor-store-shell.spec.ts");
    expect(homeSource).not.toContain("DecorStoreShell");
    expect(homeSource).not.toContain("components/shared");
  });

  test("allows only hash-pinned Decor runtime and rejects cross-theme or main.js leakage", () => {
    const approvedBytes = new TextEncoder().encode("audited revolution fixture");
    const approvedHash = new Bun.CryptoHasher("sha256").update(approvedBytes).digest("hex");
    const approvedDecorRuntimeHashes = new Set([approvedHash]);

    expect(
      assertSourceRuntimePolicy({
        activeThemeId: "decor-store",
        approvedDecorRuntimeHashes,
        contents: approvedBytes,
        file: "_nuxt/revolution.extension.actions.abc.js",
      }),
    ).toBe(approvedHash);
    expect(() =>
      assertSourceRuntimePolicy({
        activeThemeId: "fashion-store",
        approvedDecorRuntimeHashes,
        contents: approvedBytes,
        file: "_nuxt/revolution.extension.actions.abc.js",
      }),
    ).toThrow("Decor Store Revolution runtime");
    expect(() =>
      assertSourceRuntimePolicy({
        activeThemeId: "production-fallback",
        approvedDecorRuntimeHashes,
        contents: approvedBytes,
        file: "_nuxt/revolution.extension.actions.abc.js",
      }),
    ).toThrow("Decor Store Revolution runtime");
    expect(() =>
      assertSourceRuntimePolicy({
        activeThemeId: "decor-store",
        approvedDecorRuntimeHashes,
        contents: new TextEncoder().encode("not audited"),
        file: "_nuxt/revolution.extension.navigation.rogue.js",
      }),
    ).toThrow("unapproved");
    expect(() =>
      assertSourceRuntimePolicy({
        activeThemeId: "decor-store",
        approvedDecorRuntimeHashes,
        contents: approvedBytes,
        file: "_nuxt/main.js",
      }),
    ).toThrow("main entrypoint");
  });

  test("counts transitive static chunks in the initial JavaScript closure", async () => {
    const modules = new Map([
      ["/_nuxt/entry.js", 'import "./shared.js"; import("./lazy.js");'],
      ["/_nuxt/shared.js", 'export { value } from "./nested.js";'],
      ["/_nuxt/nested.js", "export const value = 1;"],
    ]);
    const assets = await collectInitialJavaScriptAssets(["/_nuxt/entry.js"], async (asset) => {
      const source = modules.get(asset);
      if (!source) throw new Error(`Unexpected module: ${asset}`);
      return source;
    });
    expect([...assets].sort()).toEqual(["/_nuxt/entry.js", "/_nuxt/nested.js", "/_nuxt/shared.js"]);
  });
});
