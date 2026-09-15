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
import {
  auditFashionStorePresentationBoundary,
  diagnoseFashionStorePresentationBoundary,
} from "./support/fashion-store-presentation-boundary";
import {
  fashionStoreProductPresentationSchema,
  normalizeFashionStoreFixtureProductPresentation,
  normalizeFashionStoreLiveProductPresentation,
  type FashionStoreProductActionPort,
} from "../app/themes/fashion-store/contracts/product-card";
import { resolveFashionStoreMerchandising } from "../app/themes/fashion-store/contracts/home-merchandising";
import { resolveFashionStoreHomeSectionContext } from "../app/themes/fashion-store/components/sections/home-section-context";
import { fashionStoreProductData } from "../app/themes/fashion-store/fixtures/pages/product";

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

  test("normalizes equivalent fixture and live products into one Fashion render shape", () => {
    const fixture = normalizeFashionStoreFixtureProductPresentation({
      data: fashionStoreProductData,
      productId: "fixture-relaxed-shirt",
      slug: "relaxed-shirt",
      variants: [
        {
          id: "fixture-relaxed-shirt-blue",
          label: "Blue",
          optionValues: { Color: "Blue" },
          selected: true,
        },
      ],
    });
    const live = normalizeFashionStoreLiveProductPresentation({
      actions: [{ id: "select", intent: "variant.select", label: "Select", value: "live-blue" }],
      description: "Release-owned description.",
      heading: "Relaxed shirt",
      kind: "product",
      media: [
        {
          alt: "Relaxed shirt",
          height: 800,
          src: "https://media.example.test/relaxed-shirt.jpg",
          width: 600,
        },
      ],
      optionGroups: [{ name: "Color", values: ["Blue"] }],
      priceLabel: "$65.00",
      relatedProducts: [],
      resource: {
        availability: "unknown",
        id: "prod_01JFIXTURETEST000000000001",
        kind: "product",
        media: [
          {
            alt: "Relaxed shirt",
            height: 800,
            src: "https://media.example.test/relaxed-shirt.jpg",
            width: 600,
          },
        ],
        money: { amount: 6500, currency: "USD" },
        name: "Relaxed shirt",
        slug: "relaxed-shirt",
        variantIds: ["var_01JFIXTURETEST0000000000001"],
      },
      state: "populated",
      variants: [
        {
          id: "live-blue",
          label: "Blue",
          optionValues: { Color: "Blue" },
          selected: true,
        },
      ],
    });

    expect(Object.keys(fixture).sort()).toEqual(Object.keys(live).sort());
    expect(fashionStoreProductPresentationSchema.parse(fixture)).toEqual(fixture);
    expect(fashionStoreProductPresentationSchema.parse(live)).toEqual(live);
    expect(fixture.gallery[0]).toEqual({
      kind: "theme-asset",
      path: fashionStoreProductData.gallery[0],
    });
    expect(live.gallery[0]).toEqual({
      alt: "Relaxed shirt",
      height: 800,
      kind: "url",
      src: "https://media.example.test/relaxed-shirt.jpg",
      width: 600,
    });
    expect(
      fashionStoreProductPresentationSchema.safeParse({
        ...live,
        gallery: [{ ...live.gallery[0]!, src: "/media/relaxed-shirt.jpg" }],
      }).success,
    ).toBe(true);
    expect(
      fashionStoreProductPresentationSchema.safeParse({
        ...live,
        gallery: [{ ...live.gallery[0]!, src: "//evil.example/relaxed-shirt.jpg" }],
      }).success,
    ).toBe(false);
    expect(fixture.optionalRegions).toEqual({ reviews: "empty", specifications: "hidden" });
    expect(live.optionalRegions).toEqual(fixture.optionalRegions);
    expect(live.productId).toBe("prod_01JFIXTURETEST000000000001");
    expect(fixture.relatedProducts[0]).toMatchObject({
      actionState: { kind: "available" },
      destination: {
        href: `/products/${fashionStoreProductData.related[0]?.id}`,
        kind: "available",
      },
      media: { kind: "theme-asset" },
      name: fashionStoreProductData.related[0]?.name,
      priceLabel: fashionStoreProductData.related[0]?.price,
    });
    expect(fixture).not.toHaveProperty("actions");
    expect(() =>
      normalizeFashionStoreLiveProductPresentation({
        ...live,
        actions: [],
        heading: live.name,
        kind: "product",
        media: [],
        optionGroups: [],
        priceLabel: live.priceLabel,
        relatedProducts: [],
        resource: undefined,
        variants: live.variants,
      }),
    ).toThrow("requires a Catalog product resource");
  });

  test("defines one product action port without provider mode or Commerce DTOs", async () => {
    const calls: string[] = [];
    const port: FashionStoreProductActionPort = {
      async addToCart(input) {
        calls.push(`${input.productId}:${input.variantId}:${input.quantity}`);
        return { kind: "succeeded", message: "Added" };
      },
    };
    await expect(
      port.addToCart({ productId: "product", quantity: 1, variantId: "variant" }),
    ).resolves.toEqual({ kind: "succeeded", message: "Added" });
    expect(calls).toEqual(["product:variant:1"]);

    const contract = await readFile(
      resolve(import.meta.dir, "../app/themes/fashion-store/contracts/product-card.ts"),
      "utf8",
    );
    expect(contract).not.toMatch(/mode\s*:\s*["'](?:fixture|live)["']/);
    expect(contract).not.toMatch(/RuntimeCommercePort|StorefrontActionAdapter|AddCartLineRequest/);
    expect(contract).not.toMatch(/PreviewAction|previewActionSchema/);
  });

  test("resolves one mode-free Home context and merchandising envelope", () => {
    const fixtureProduct = {
      categories: [],
      colors: [],
      id: "fixture-product",
      name: "Fixture product",
      originalPrice: "$80.00",
      price: "$65.00",
      sizes: [],
      sourceImage: "images/product.jpg",
      tags: [],
    };
    const fixtureViewModel = {
      data: {
        merchandising: {
          groups: [
            { id: "new-arrivals", products: [fixtureProduct] },
            { id: "best-sellers", products: [fixtureProduct] },
            { id: "featured", products: [fixtureProduct] },
          ],
          mode: "fixture",
        },
        presentation: { "services-presentation": "source" },
      },
      kind: "theme-section",
      state: "populated",
    } as const;

    const merchandising = resolveFashionStoreMerchandising(fixtureViewModel);
    expect(merchandising.state).toBe("populated");
    if (merchandising.state !== "populated") throw new Error("Expected merchandising data.");
    expect(merchandising.data).not.toHaveProperty("mode");
    expect(merchandising.data.groups.map(({ id }) => id)).toEqual([
      "new-arrivals",
      "best-sellers",
      "featured",
    ]);
    expect(merchandising.data.groups[0]?.products[0]).toMatchObject({
      actionState: { kind: "available" },
      destination: { kind: "unavailable" },
      media: { kind: "theme-asset", path: "images/product.jpg" },
      name: "Fixture product",
      priceLabel: "$65.00",
    });
    expect(merchandising.data.groups[0]?.products[0]).not.toHaveProperty("sourceImage");
    expect(resolveFashionStoreHomeSectionContext(fixtureViewModel)).toEqual({
      merchandising,
      presentation: {
        brands: "source",
        categories: "source",
        collection: "source",
        editorial: "source",
        marquee: "source",
        services: "source",
      },
      state: "populated",
    });
  });

  test("rejects provider-aware layout, raw unions, duplicate contexts, and action selection", async () => {
    const synthetic = diagnoseFashionStorePresentationBoundary(
      "SyntheticProduct.vue",
      `
        type Product = FashionStoreLegacyProductCard | PresentationProductCard;
        const liveProduct = computed(() => viewModel.kind === 'product');
        if (liveProduct.value) return runtimeCommerce; else return previewCart;
      `,
    );
    expect(synthetic.map(({ rule }) => rule).sort()).toEqual([
      "direct-provider-action-selection",
      "provider-kind-layout-switch",
      "raw-provider-union",
    ]);
    expect(
      diagnoseFashionStorePresentationBoundary("fixture-home-section-context.ts", "export {}"),
    ).toEqual([{ file: "fixture-home-section-context.ts", rule: "duplicate-provider-context" }]);

    const findings = await auditFashionStorePresentationBoundary(
      resolve(import.meta.dir, "../app"),
      [
        "themes/fashion-store/components/FashionStoreHomeRoute.vue",
        "themes/fashion-store/components/pages/FashionStoreContentRoute.vue",
        "themes/fashion-store/components/shared/FashionStoreProductCard.vue",
        "themes/fashion-store/contracts/home-merchandising.ts",
      ],
    );
    expect(findings).toEqual([
      {
        file: "themes/fashion-store/components/FashionStoreHomeRoute.vue",
        rule: "provider-kind-layout-switch",
      },
      {
        file: "themes/fashion-store/components/pages/FashionStoreContentRoute.vue",
        rule: "provider-kind-layout-switch",
      },
    ]);
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
      "fashion-store.collection": "pages/FashionStoreCollectionPage.vue",
      "fashion-store.content": "pages/FashionStoreLiveContentPage.vue",
      "fashion-store.home": "FashionStoreLiveHomePage.vue",
      "fashion-store.product": "pages/FashionStoreProductPage.vue",
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
