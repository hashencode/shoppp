import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { decorStoreManifest, decorStoreThemeDescriptor } from "../app/themes/decor-store/manifest";
import { decorStorePreset } from "../app/themes/decor-store/presets/source-parity";
import { decorStorePreviewBuildInput } from "../scripts/prepare-theme-preview-fixture";
import { assertSourceRuntimePolicy } from "../scripts/check-bundle-budget";
import { renderActiveThemeModule } from "../scripts/prepare-experience";

describe("Decor Store U2 registration", () => {
  test("advertises exactly one source-parity home template", () => {
    expect(decorStoreManifest.id).toBe("decor-store");
    expect(decorStoreThemeDescriptor).toMatchObject({
      id: "decor-store",
      presets: ["source-parity"],
      supportedPageTemplates: ["home"],
    });
    expect(
      decorStorePreset.templates.map(({ pageType, sections }) => ({
        pageType,
        sectionType: sections[0]?.type,
      })),
    ).toEqual([{ pageType: "home", sectionType: "decor-store.home" }]);
  });

  test("prepares a home-only fixture and one isolated static registry import", async () => {
    const input = await decorStorePreviewBuildInput("https://preview.example.test");
    const source = renderActiveThemeModule({
      catalog: [decorStoreThemeDescriptor],
      input,
      moduleAllowlist: { "decor-store": "../themes/decor-store/registry" },
    });

    expect(input.snapshot.bindings).toEqual([
      expect.objectContaining({
        fixtureId: "decor-store-home",
        instanceId: "decor-store-home",
      }),
    ]);
    expect(input.snapshot.resolvedTemplates.map(({ pageType }) => pageType)).toEqual(["home"]);
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
    const [packageJson, nuxtConfig] = await Promise.all([
      readFile(resolve(import.meta.dir, "../package.json"), "utf8"),
      readFile(resolve(import.meta.dir, "../nuxt.config.ts"), "utf8"),
    ]);
    const scripts = JSON.parse(packageJson).scripts as Record<string, string>;

    expect(scripts["build:preview:decor-store"]).toContain("decor-store");
    expect(scripts["dev:decor-store"]).toContain("decor-store");
    expect(scripts["test:decor-store"]).toContain("decor-store-registration.test.ts");
    expect(nuxtConfig).toContain('"/decor-store-preview-input.json"');
    expect(nuxtConfig).toContain('? ["/"]');
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
});
