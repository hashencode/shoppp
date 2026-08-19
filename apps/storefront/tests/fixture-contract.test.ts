import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  PreviewIntentRecorder,
  previewActionSchema,
  type PreviewAction,
} from "../app/theme-engine/actions";
import {
  experienceFixtureSchema,
  resolveFixtureBinding,
  resolveFixtureViewModel,
} from "../app/theme-engine/view-models";
import { coreBlockDefinitions, coreSectionDefinitions } from "../app/theme-engine/core-manifest";
import { experienceFixtureRegistry } from "../fixtures/experience";
import {
  auditLiveComponentGraph,
  diagnoseLiveComponentImports,
} from "./support/live-component-boundary";

describe("storefront experience fixtures", () => {
  test("validates representative fixtures for every page type and meaningful state", () => {
    const fixtures = Object.values(experienceFixtureRegistry).map((fixture) =>
      experienceFixtureSchema.parse(fixture),
    );
    const pageTypes = new Set(fixtures.flatMap(({ pageTypes }) => pageTypes));
    const states = new Set(
      fixtures.flatMap(({ viewModels }) => Object.values(viewModels).map(({ state }) => state)),
    );

    expect([...pageTypes].sort()).toEqual([
      "cart",
      "checkout",
      "collection",
      "home",
      "order",
      "policy",
      "product",
    ]);
    expect([...states].sort()).toEqual([
      "empty",
      "loading",
      "populated",
      "success",
      "unavailable",
      "validation-error",
    ]);
  });

  test("provides every required presentation surface with semantic content", () => {
    const kinds = new Set(
      Object.values(experienceFixtureRegistry).flatMap(({ viewModels }) =>
        Object.values(viewModels).map(({ kind }) => kind),
      ),
    );

    expect([...kinds].sort()).toEqual([
      "announcement",
      "cart",
      "checkout",
      "collection-grid",
      "editorial",
      "footer",
      "hero",
      "navigation",
      "order",
      "policy",
      "product",
      "product-grid",
      "promotion",
      "state",
      "trust-strip",
    ]);
  });

  test("resolves bindings by stable instance and fixture identifiers", () => {
    const binding = {
      fixtureId: "core-populated",
      id: "home-hero-binding",
      instanceId: "home-hero",
      kind: "fixture",
      resource: "home-hero",
      state: "populated",
    } as const;
    const viewModel = resolveFixtureViewModel(
      resolveFixtureBinding("home-hero", [binding]),
      experienceFixtureRegistry,
    );

    expect(viewModel.kind).toBe("hero");
    expect(viewModel.state).toBe("populated");
    expect(() => resolveFixtureBinding("missing", [binding])).toThrow("missing");
    expect(() => resolveFixtureBinding("home-hero", [binding, binding])).toThrow("ambiguous");
    expect(() =>
      resolveFixtureViewModel(
        {
          fixtureId: "core-populated",
          id: "missing-binding",
          instanceId: "home-hero",
          kind: "fixture",
          resource: "missing",
          state: "populated",
        },
        experienceFixtureRegistry,
      ),
    ).toThrow("missing");
  });

  test("defines required transaction, legal, focus, status, and error capabilities", () => {
    const capabilities = new Set(
      [...coreSectionDefinitions, ...coreBlockDefinitions].flatMap(
        ({ capabilities: values }) => values,
      ),
    );

    expect(capabilities).toEqual(
      new Set([
        "cart.error",
        "cart.summary",
        "checkout.error",
        "checkout.summary",
        "error.summary",
        "focus.skip-link",
        "legal.links",
        "navigation.primary",
        "order.error",
        "order.status",
        "policy.content",
        "product.action",
        "product.details",
        "status.feedback",
      ]),
    );
  });

  test("records only validated preview intents without invoking commerce", () => {
    const recorder = new PreviewIntentRecorder();
    const actions = [
      { id: "navigate", intent: "navigation", label: "View", target: "/collections/new" },
      { id: "variant", intent: "variant.select", label: "Small", value: "small" },
      { id: "add", intent: "cart.add-preview", label: "Add to preview bag" },
      { id: "quantity", intent: "cart.quantity-preview", label: "Increase", value: "2" },
      { id: "checkout", intent: "checkout.start-preview", label: "Preview checkout" },
    ] satisfies PreviewAction[];

    actions.forEach((action) => recorder.record(previewActionSchema.parse(action), "fixture-test"));

    expect(recorder.all().map(({ intent }) => intent)).toEqual([
      "navigation",
      "variant.select",
      "cart.add-preview",
      "cart.quantity-preview",
      "checkout.start-preview",
    ]);
    expect(recorder.all().every(({ recordedAt }) => recordedAt === null)).toBe(true);
  });

  test("keeps fixture presentation code free of network and live commerce imports", async () => {
    const roots = [
      resolve(import.meta.dir, "../app/components/sections"),
      resolve(import.meta.dir, "../app/components/blocks"),
      resolve(import.meta.dir, "../app/theme-engine/actions.ts"),
      resolve(import.meta.dir, "../fixtures/experience"),
      resolve(import.meta.dir, "../app/themes/fashion-store/components"),
    ];
    const sources: string[] = [];
    for (const root of roots) {
      if (root.endsWith(".ts")) {
        sources.push(await readFile(root, "utf8"));
        continue;
      }
      const entries = await readdir(root, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          sources.push(await readFile(resolve(entry.parentPath, entry.name), "utf8"));
        }
      }
    }
    const source = sources.join("\n");

    expect(source).not.toMatch(/\bfetch\s*\(|\$fetch|XMLHttpRequest|useCommerceApi|useGuestCart/);
    expect(source).not.toMatch(/\.php(?:["'?]|\b)/i);
    expect(source).not.toContain("@shoppp/db");
  });

  test("keeps renderer provider-neutral and the live provider free of fixture fallback", async () => {
    const [renderer, liveProvider] = await Promise.all([
      readFile(resolve(import.meta.dir, "../app/theme-engine/renderer.vue"), "utf8"),
      readFile(resolve(import.meta.dir, "../app/theme-engine/providers/live.ts"), "utf8"),
    ]);

    expect(renderer).toContain("provider.resolve");
    expect(renderer).not.toContain("resolveFixtureBinding");
    expect(renderer).not.toContain("resolveFixtureViewModel");
    expect(liveProvider).not.toMatch(/fixture-preview|resolveFixture|fixtures\/experience/);
  });

  test("wires live route composition reactively and keeps the live registry fixture-free", async () => {
    const [experience, liveRegistry, fixtureRegistry] = await Promise.all([
      readFile(resolve(import.meta.dir, "../app/StorefrontExperience.vue"), "utf8"),
      readFile(resolve(import.meta.dir, "../app/themes/fashion-store/registry.ts"), "utf8"),
      readFile(resolve(import.meta.dir, "../app/themes/fashion-store/fixture-registry.ts"), "utf8"),
    ]);

    expect(experience).toMatch(
      /resolveThemeRoute\([\s\S]*activeThemeRoutes,[\s\S]*activeExperienceProviderInput\.release/,
    );
    expect(experience).toContain("path: currentRoute.value.path");
    expect(liveRegistry).not.toMatch(/\.\/fixtures\//);
    expect(liveRegistry).not.toContain("themeFixtures");
    expect(fixtureRegistry).toMatch(/\.\/fixtures\//);
    expect(fixtureRegistry).toContain("themeFixtures");
  });

  test("rejects each prohibited dependency class at the live component boundary", () => {
    const diagnostics = diagnoseLiveComponentImports(
      "SyntheticLiveComponent.vue",
      `
        import type { Cart } from "@shoppp/contracts";
        import type { FixtureProduct } from "../../fixtures/pages/shop";
        import { useGuestCart } from "~/composables/use-guest-cart";
        const provider = import("../../fixtures/provider");
      `,
    );

    expect(diagnostics.map(({ rule }) => rule).sort()).toEqual([
      "commerce-composable",
      "commerce-contract",
      "fixture-owned",
      "fixture-owned",
    ]);
    expect(
      diagnoseLiveComponentImports(
        "AllowedLiveComponent.vue",
        'import type { PresentationViewModel } from "../../../../theme-engine/view-models";',
      ),
    ).toEqual([]);
    expect(
      diagnoseLiveComponentImports(
        "AutoImportedLiveComponent.vue",
        `<script setup lang="ts">
          const api = useCommerceApi();
          const cart = useGuestCart();
        </script>`,
      ).map(({ rule }) => rule),
    ).toEqual(["commerce-composable", "commerce-composable"]);
  });

  test("keeps injected presentation port contracts independent from Commerce DTOs", async () => {
    const portRoot = resolve(import.meta.dir, "../app/theme-engine");
    const portFiles = ["actions.ts", "cart-state.ts", "checkout.ts"];
    const diagnostics = (
      await Promise.all(
        portFiles.map(async (file) =>
          diagnoseLiveComponentImports(file, await readFile(resolve(portRoot, file), "utf8")),
        ),
      )
    ).flat();

    expect(diagnostics).toEqual([]);
  });

  test("keeps the complete Fashion Store live component graph behind presentation ports", async () => {
    const appRoot = resolve(import.meta.dir, "../app");
    const componentRoot = resolve(import.meta.dir, "../app/themes/fashion-store/components");
    const registrySource = await readFile(
      resolve(import.meta.dir, "../app/themes/fashion-store/registry.ts"),
      "utf8",
    );
    const componentPathBySymbol = new Map<string, string>();
    for (const match of registrySource.matchAll(
      /^import\s+(\w+)\s+from\s+["']\.\/components\/([^"']+\.vue)["'];/gm,
    )) {
      componentPathBySymbol.set(match[1]!, match[2]!);
    }
    for (const match of registrySource.matchAll(
      /const\s+(\w+)\s*=\s*defineAsyncComponent\(\s*\(\)\s*=>\s*import\(["']\.\/components\/([^"']+\.vue)["']\)/g,
    )) {
      componentPathBySymbol.set(match[1]!, match[2]!);
    }
    const registryRootBySection = Object.fromEntries(
      [...registrySource.matchAll(/^\s*"(fashion-store\.[^"]+)"\s*:\s*(\w+),/gm)].map((match) => [
        match[1]!,
        componentPathBySymbol.get(match[2]!),
      ]),
    );

    expect(registryRootBySection).toEqual({
      "fashion-store.cart": "pages/FashionStoreCartPage.vue",
      "fashion-store.checkout": "pages/FashionStoreCheckoutPage.vue",
      "fashion-store.collection": "pages/FashionStoreLiveCollectionPage.vue",
      "fashion-store.content": "pages/FashionStoreLiveContentPage.vue",
      "fashion-store.home": "FashionStoreLiveHomePage.vue",
      "fashion-store.product": "pages/FashionStoreLiveProductPage.vue",
    });
    const roots = [...new Set(Object.values(registryRootBySection))].map((path) =>
      resolve(componentRoot, path),
    );

    expect(
      await auditLiveComponentGraph(componentRoot, roots, {
        aliases: { "~/": appRoot },
        componentDependencyRoot: appRoot,
      }),
    ).toEqual([]);
  });

  test("follows dynamically imported live descendants when auditing the component graph", async () => {
    const componentRoot = await mkdtemp(resolve(tmpdir(), "shoppp-live-boundary-"));
    try {
      const root = resolve(componentRoot, "Root.vue");
      await Promise.all([
        writeFile(
          root,
          '<script setup lang="ts">const Child = defineAsyncComponent(() => import("./Child.vue"));</script>',
        ),
        writeFile(
          resolve(componentRoot, "Child.vue"),
          '<script setup lang="ts">\nimport type { Cart } from "@shoppp/contracts";\n</script>',
        ),
      ]);

      expect(await auditLiveComponentGraph(componentRoot, [root])).toEqual([
        {
          file: "Child.vue",
          importSpecifier: "@shoppp/contracts",
          rule: "commerce-contract",
        },
      ]);
    } finally {
      await rm(componentRoot, { force: true, recursive: true });
    }
  });

  test("follows Nuxt-alias component dependencies outside the theme directory", async () => {
    const appRoot = await mkdtemp(resolve(tmpdir(), "shoppp-live-alias-boundary-"));
    const componentRoot = resolve(appRoot, "themes/fashion-store/components");
    try {
      const root = resolve(componentRoot, "Root.vue");
      await mkdir(componentRoot, { recursive: true });
      await mkdir(resolve(appRoot, "features/checkout"), { recursive: true });
      await Promise.all([
        writeFile(
          root,
          '<script setup lang="ts">\nimport Child from "~/features/checkout/Child.vue";\n</script>',
        ),
        writeFile(
          resolve(appRoot, "features/checkout/Child.vue"),
          '<script setup lang="ts">\nimport type { Cart } from "@shoppp/contracts";\n</script>',
        ),
      ]);

      expect(
        await auditLiveComponentGraph(componentRoot, [root], {
          aliases: { "~/": appRoot },
          componentDependencyRoot: appRoot,
        }),
      ).toEqual([
        {
          file: "../../../features/checkout/Child.vue",
          importSpecifier: "@shoppp/contracts",
          rule: "commerce-contract",
        },
      ]);
    } finally {
      await rm(appRoot, { force: true, recursive: true });
    }
  });
});
