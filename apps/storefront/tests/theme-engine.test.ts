import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type {
  CanonicalCatalogRelease,
  ExperienceSnapshot,
  PageTemplate,
  StorefrontThemeDescriptor,
} from "@shoppp/contracts";
import type { Component } from "vue";

import {
  experienceBuildInputSchema,
  prepareExperience,
  renderActiveExperienceModule,
  renderActiveThemeModule,
} from "../scripts/prepare-experience";
import { packagePreviewArtifact } from "../scripts/package-preview-artifact";
import {
  composeThemeRegistries,
  renderTemplatePlan,
  type ThemeRegistry,
} from "../app/theme-engine/registry";
import {
  composeExperienceShell,
  composePlatformRoutePresentation,
  composeExperienceRoute as composeExperienceRouteWithoutAdapter,
  type ComposeExperienceRouteInput,
} from "../app/theme-engine/composer";
import {
  createFixturePresentationProvider,
  createLivePresentationProvider,
  selectLivePort,
  selectPresentationProvider,
} from "../app/theme-engine/providers";
import { resolveFixtureBinding } from "../app/theme-engine/view-models";
import {
  resolveThemeRoute,
  themeRoutePaths,
  type ResolvedThemeRouteContract,
} from "../app/theme-engine/routes";
import { fashionStoreCompositionAdapter } from "../app/themes/fashion-store/composition";
import { fashionStoreThemeRoutes } from "../app/themes/fashion-store/page-contracts";
import { fashionStorePreset } from "../app/themes/fashion-store/presets/source-parity";
import {
  createPreviewAccessHandler,
  normalizePreviewAssetPath,
  uploadPreviewArtifact,
  type PreviewArtifactBucket,
  type PreviewArtifactObject,
} from "../worker/preview-access";

const descriptor = {
  configurationSchemaVersion: 1,
  id: "synthetic",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  presets: ["editorial"],
  supportedPageTemplates: ["home"],
  themeVersion: "1.0.0",
} satisfies StorefrontThemeDescriptor;

function composeExperienceRoute(input: Omit<ComposeExperienceRouteInput, "adapter">) {
  return composeExperienceRouteWithoutAdapter({
    ...input,
    adapter: fashionStoreCompositionAdapter,
  });
}

function testRoute(
  pageType: PageTemplate["pageType"],
  path: string,
  parameters?: ResolvedThemeRouteContract["parameters"],
): ResolvedThemeRouteContract {
  return {
    id: path === "/" ? "home" : path.slice(1).replaceAll("/", "-"),
    pageType,
    path,
    ...(parameters ? { parameters } : {}),
    variant: "test",
  };
}

const template = {
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
          settings: { label: "Explore" },
          type: "core.action",
          visible: true,
        },
      ],
      capabilities: [],
      id: "hero",
      settings: { heading: "Editorial" },
      type: "synthetic.hero",
      visible: true,
    },
    {
      blocks: [],
      capabilities: [],
      id: "disabled",
      settings: {},
      type: "synthetic.editorial",
      visible: false,
    },
    {
      blocks: [],
      capabilities: ["legal.links"],
      id: "legal-footer",
      required: true,
      settings: {},
      type: "core.legal-footer",
      visible: true,
    },
  ],
} satisfies PageTemplate;

const snapshot = {
  approvedAt: "2026-07-30T01:00:00.000Z",
  approvedBy: "operator-1",
  bindings: [],
  configurationSchemaVersion: 1,
  experienceId: "experience-synthetic",
  id: "snapshot-synthetic-1",
  kind: "approved",
  overrides: [],
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "theme-team",
    license: "Internal",
    source: "internal://synthetic",
  },
  resolvedTemplates: [template],
  themeId: "synthetic",
  themeVersion: "1.0.0",
  version: 1,
} satisfies ExperienceSnapshot;

const previewInput = {
  environment: "preview",
  expectedOrigin: "https://preview.example.test",
  snapshot,
  themeId: "synthetic",
} as const;

const canonicalRelease = {
  collections: [
    {
      description: "Selected release collection",
      id: "col_01JTHEMEENGINE000000000001",
      name: "Selected collection",
      productIds: ["prod_01JTHEMEENGINE00000000001"],
      productSlugs: ["selected-product"],
      seoDescription: "Selected collection description",
      seoTitle: "Selected collection",
      slug: "selected-collection",
      status: "published",
    },
  ],
  generatedAt: "2026-08-11T00:00:00.000Z",
  policies: [
    {
      description: "Privacy policy",
      effectiveDate: "2026-08-11",
      sections: [{ body: "Policy body", heading: "Privacy" }],
      slug: "privacy",
      title: "Privacy",
    },
  ],
  products: [
    {
      collectionIds: ["col_01JTHEMEENGINE000000000001"],
      collectionSlugs: ["selected-collection"],
      description: "Selected release product",
      id: "prod_01JTHEMEENGINE00000000001",
      media: [
        {
          alt: "Selected product",
          height: 800,
          src: "https://media.example.test/catalog/selected-product.jpg",
          width: 600,
        },
      ],
      name: "Selected product",
      seoDescription: "Selected product description",
      seoTitle: "Selected product",
      slug: "selected-product",
      status: "published",
      variants: [
        {
          id: "var_01JTHEMEENGINE000000000001",
          optionValues: { size: "M" },
          prices: [{ amount: 6500, currency: "USD" }],
          sku: "SELECTED-M",
          status: "active",
          title: "Medium",
          weightGrams: 400,
        },
      ],
    },
  ],
  redirects: [],
  releaseId: "release-theme-engine-a",
  routes: ["/", "/collections/selected-collection", "/products/selected-product"],
  schemaVersion: 2,
  site: {
    defaultCurrency: "USD",
    freshnessHours: 24,
    name: "Theme Engine",
    origin: "https://shop.example.test",
  },
} satisfies CanonicalCatalogRelease;

const liveSnapshot = {
  ...snapshot,
  bindings: [
    {
      id: "featured-product",
      instanceId: "hero",
      kind: "catalog",
      reference: { id: canonicalRelease.products[0].id, kind: "product" },
      settingId: "featured-product-setting",
    },
  ],
  resolvedTemplates: [
    {
      id: "home",
      pageType: "home",
      requiredCapabilities: [],
      sections: [
        {
          blocks: [],
          capabilities: [],
          id: "hero",
          settings: {},
          type: "synthetic.product",
          visible: true,
        },
      ],
    },
  ],
} satisfies ExperienceSnapshot;

describe("selected storefront theme generation", () => {
  test("generates an unchanged fallback without importing a theme", () => {
    const source = renderActiveThemeModule({
      catalog: [],
      input: { environment: "production" },
      moduleAllowlist: {},
    });

    expect(source).toContain('"production-fallback"');
    expect(source).not.toContain("/themes/");
    expect(source).not.toContain("snapshot-synthetic-1");
  });

  test("generates one deterministic allowlisted import for a compatible preview", () => {
    const options = {
      catalog: [descriptor],
      input: previewInput,
      moduleAllowlist: {
        decor: "../themes/decor/registry",
        synthetic: "../themes/synthetic/registry",
      },
    };
    const first = renderActiveThemeModule(options);
    const second = renderActiveThemeModule(options);

    expect(second).toBe(first);
    expect(first).toContain('from "../themes/synthetic/registry"');
    expect(first).not.toContain("../themes/decor/registry");
    expect(first).toContain('"snapshot-synthetic-1"');
  });

  test("drives live provider selection from generated private input without importing fixtures", async () => {
    const liveInput = {
      catalogRelease: canonicalRelease,
      environment: "preview",
      expectedOrigin: "https://preview.example.test",
      inputIdentity: {
        catalogReleaseId: canonicalRelease.releaseId,
        experienceSnapshotId: liveSnapshot.id,
        experienceVersion: liveSnapshot.version,
        platformContractVersion: liveSnapshot.platformContractVersion,
        themeId: liveSnapshot.themeId,
        themeVersion: liveSnapshot.themeVersion,
      },
      mediaOrigins: ["https://media.example.test"],
      presentationMode: "live",
      snapshot: liveSnapshot,
      themeId: "synthetic",
    } as const;
    const liveThemeSource = renderActiveThemeModule({
      catalog: [descriptor],
      input: liveInput,
      moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
    });
    const providerSource = renderActiveExperienceModule(liveInput);
    const productionProviderSource = renderActiveExperienceModule({ environment: "production" });
    const storefrontExperienceSource = await readFile(
      resolve(import.meta.dir, "../app/StorefrontExperience.vue"),
      "utf8",
    );

    expect(liveThemeSource).not.toContain("selectedThemeFixtures");
    expect(providerSource).toContain('mode: "live"');
    expect(providerSource).toContain(canonicalRelease.releaseId);
    expect(providerSource).toContain(liveSnapshot.id);
    expect(providerSource).toContain("activeCatalogSearchIndex");
    expect(providerSource).toContain("Selected product");
    expect(productionProviderSource).not.toContain("/themes/");
    expect(productionProviderSource).not.toContain(canonicalRelease.releaseId);
    expect(productionProviderSource).toContain("activeCatalogSearchIndex = null");
    expect(storefrontExperienceSource).toContain("activeExperienceProviderInput.mode");
    expect(storefrontExperienceSource).toContain("preview-context");
    expect(storefrontExperienceSource).toContain("/__preview/context");
    expect(storefrontExperienceSource).toContain("Return to editor");
    expect(storefrontExperienceSource).toContain("contentDigest");
  });

  test("rejects unknown, incompatible, unapproved, or caller-supplied module paths", () => {
    expect(() =>
      renderActiveThemeModule({
        catalog: [],
        input: previewInput,
        moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
      }),
    ).toThrow("catalog");
    expect(() =>
      renderActiveThemeModule({
        catalog: [
          {
            ...descriptor,
            platformCompatibility: { maxExclusive: "3.0.0", min: "2.0.0" },
          },
        ],
        input: previewInput,
        moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
      }),
    ).toThrow("compatible");
    expect(() =>
      renderActiveThemeModule({
        catalog: [{ ...descriptor, id: "rogue" }],
        input: { ...previewInput, snapshot: { ...snapshot, themeId: "rogue" }, themeId: "rogue" },
        moduleAllowlist: {},
      }),
    ).toThrow("allowlist");
    expect(
      experienceBuildInputSchema.safeParse({
        ...previewInput,
        modulePath: "../../attacker/module",
      }).success,
    ).toBe(false);
    expect(
      experienceBuildInputSchema.safeParse({
        ...previewInput,
        expectedOrigin: "https://preview.example.test/",
      }).success,
    ).toBe(false);
  });

  test("writes the generated module to a fixed output path", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-active-theme-"));
    try {
      const outputPath = resolve(directory, "active-theme.ts");
      await prepareExperience({
        catalog: [descriptor],
        input: previewInput,
        moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
        outputPath,
      });
      expect(await readFile(outputPath, "utf8")).toBe(
        renderActiveThemeModule({
          catalog: [descriptor],
          input: previewInput,
          moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
        }),
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

describe("theme-neutral storefront composer", () => {
  test("resolves catalog route families only from the selected release manifest", () => {
    const routes = [
      {
        family: "catalog-product",
        id: "product",
        pageType: "product",
        path: "/products/:slug",
        variant: "product",
      },
      {
        family: "catalog-collection",
        id: "collection",
        pageType: "collection",
        path: "/collections/:slug",
        variant: "collection",
      },
    ] as const;

    expect(resolveThemeRoute("/products/selected-product", routes, canonicalRelease)).toMatchObject(
      {
        id: "product",
        parameters: { productId: canonicalRelease.products[0].id, slug: "selected-product" },
      },
    );
    expect(resolveThemeRoute("/products/missing", routes, canonicalRelease)).toBeUndefined();
    expect(
      resolveThemeRoute("/collections/selected-collection", routes, canonicalRelease),
    ).toMatchObject({
      id: "collection",
      parameters: {
        collectionId: canonicalRelease.collections[0].id,
        slug: "selected-collection",
      },
    });
  });

  test("resolves one Experience against the explicitly selected Catalog Release", () => {
    const secondRelease = structuredClone(canonicalRelease);
    secondRelease.releaseId = "release-theme-engine-b";
    secondRelease.products[0]!.name = "Product from release B";

    const first = composeExperienceRoute({
      experience: liveSnapshot,
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    });
    const second = composeExperienceRoute({
      experience: liveSnapshot,
      locale: "en-US",
      path: "/",
      release: secondRelease,
      route: testRoute("home", "/"),
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.viewModels.hero).toMatchObject({
      heading: "Selected product",
      kind: "product",
      optionGroups: [{ name: "size", values: ["M"] }],
      resource: { id: canonicalRelease.products[0].id, kind: "product" },
      variants: [
        {
          id: canonicalRelease.products[0].variants[0].id,
          optionValues: { size: "M" },
          selected: true,
        },
      ],
    });
    expect(second.viewModels.hero).toMatchObject({
      heading: "Product from release B",
      kind: "product",
      resource: { id: canonicalRelease.products[0].id, kind: "product" },
    });
  });

  test("uses the resolved product route instead of the template's representative binding", () => {
    const release = structuredClone(canonicalRelease);
    release.products.push({
      ...structuredClone(release.products[0]!),
      id: "prod_01JTHEMEENGINE00000000002",
      name: "Route-selected product",
      slug: "route-selected-product",
      variants: [
        {
          ...structuredClone(release.products[0]!.variants[0]!),
          id: "var_01JTHEMEENGINE000000000002",
        },
      ],
    });
    release.collections[0]!.productIds.push(release.products[1]!.id);
    release.collections[0]!.productSlugs.push(release.products[1]!.slug);
    release.routes.push("/products/route-selected-product");
    const productTemplate = {
      ...liveSnapshot,
      resolvedTemplates: [
        {
          id: "product-template",
          pageType: "product" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "hero",
              settings: {},
              type: "synthetic.product",
              visible: true,
            },
          ],
        },
      ],
    };

    const result = composeExperienceRoute({
      experience: productTemplate,
      locale: "en-US",
      path: "/products/route-selected-product",
      release,
      route: testRoute("product", "/products/route-selected-product", {
        productId: release.products[1]!.id,
        slug: "route-selected-product",
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.hero).toMatchObject({
      heading: "Route-selected product",
      resource: { id: release.products[1]!.id, slug: "route-selected-product" },
    });
  });

  test("composes every generated Fashion Store product route without a product binding", () => {
    const apiValidSnapshot = {
      ...liveSnapshot,
      bindings: [
        {
          id: "home-featured-collection",
          instanceId: "fashion-store-home",
          kind: "catalog",
          reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
          settingId: "featured-collection",
        },
        {
          id: "collection-default-collection",
          instanceId: "fashion-store-collection",
          kind: "catalog",
          reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
          settingId: "default-collection",
        },
      ],
      resolvedTemplates: fashionStorePreset.templates.map((template) => ({
        ...template,
        sections: template.sections.map((section) => ({
          ...section,
          blocks: [...section.blocks],
          capabilities: [...section.capabilities],
          settings: { ...section.settings },
        })),
      })),
      themeId: "fashion-store",
    } satisfies ExperienceSnapshot;
    expect(apiValidSnapshot.bindings.some(({ reference }) => reference.kind === "product")).toBe(
      false,
    );

    const productPaths = themeRoutePaths(fashionStoreThemeRoutes, "live", canonicalRelease).filter(
      (path) => path.startsWith("/products/"),
    );
    expect(productPaths).toHaveLength(canonicalRelease.products.length);
    for (const path of productPaths) {
      const route = resolveThemeRoute(path, fashionStoreThemeRoutes, canonicalRelease, "live");
      expect(route).toBeDefined();
      const result = composeExperienceRoute({
        experience: apiValidSnapshot,
        locale: "en-US",
        path,
        release: canonicalRelease,
        route: route!,
      });
      expect(result.ok, path).toBe(true);
      expect(result.viewModels["fashion-store-product"]).toMatchObject({
        kind: "product",
        resource: { id: route!.parameters!.productId },
      });
    }
  });

  test("projects selected-release products into collection browse view models", () => {
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-collection-binding",
            instanceId: "collection",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "selected-collection-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "collection-template",
            pageType: "collection",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "collection",
                settings: {},
                type: "synthetic.collection",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/collections/selected-collection",
      release: canonicalRelease,
      route: testRoute("collection", "/collections/selected-collection", {
        collectionId: canonicalRelease.collections[0].id,
        slug: "selected-collection",
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.collection).toMatchObject({
      kind: "collection-grid",
      products: [
        {
          href: "/products/selected-product",
          id: canonicalRelease.products[0].id,
          name: "Selected product",
          priceLabel: "$65.00",
        },
      ],
      resource: { id: canonicalRelease.collections[0].id, kind: "collection" },
    });
  });

  test("composes the complete live Home sequence and normalized representative card", () => {
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "home-collection-binding",
            instanceId: "home",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "featured-collection",
          },
        ],
        resolvedTemplates: [
          {
            id: "home-template",
            pageType: "home",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "home",
                settings: {
                  "announcement-text": "Editor announcement",
                  "hero-body": "Explore the selected release.",
                  "hero-eyebrow": "New collection",
                  "hero-image": {
                    alt: "Editor hero",
                    height: 600,
                    key: "catalog/editor-hero.webp",
                    kind: "catalog",
                    width: 800,
                  },
                  "hero-primary-link": {
                    label: "Open selected collection",
                    target: {
                      kind: "internal",
                      reference: {
                        id: canonicalRelease.collections[0].id,
                        kind: "collection",
                      },
                    },
                    targetBehavior: "same-window",
                  },
                  "hero-title": "Fashion for every day",
                  "merchandising-title": "Editor picks",
                },
                type: "fashion-store.home",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.home).toMatchObject({
      announcement: "Editor announcement",
      hero: {
        body: "Explore the selected release.",
        eyebrow: "New collection",
        heading: "Fashion for every day",
        media: {
          alt: "Editor hero",
          height: 600,
          src: "https://media.example.test/catalog/editor-hero.webp",
          width: 800,
        },
        primaryLink: {
          href: "/collections/selected-collection",
          label: "Open selected collection",
          targetBehavior: "same-window",
        },
      },
      kind: "home",
      merchandisingTitle: "Editor picks",
      products: [
        {
          actionState: { kind: "available" },
          href: "/products/selected-product",
          productId: canonicalRelease.products[0].id,
          staticPurchase: {
            kind: "direct-add",
            variantId: canonicalRelease.products[0].variants[0].id,
          },
          variantIds: [canonicalRelease.products[0].variants[0].id],
          visualVariant: "home",
        },
      ],
      sections: [
        { kind: "hero" },
        { kind: "services" },
        { kind: "categories" },
        { kind: "best-sellers" },
        { kind: "promotion" },
        { kind: "collection" },
        { kind: "brands" },
        { kind: "featured-products" },
        { kind: "marquee" },
        { kind: "magazine" },
      ],
    });
  });

  test("projects every Home shell control and independent Catalog reference into live rendering", () => {
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "home-featured-collection",
            instanceId: "home",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "featured-collection",
          },
          {
            id: "home-featured-product",
            instanceId: "home",
            kind: "catalog",
            reference: { id: canonicalRelease.products[0].id, kind: "product" },
            settingId: "featured-product",
          },
        ],
        resolvedTemplates: [
          {
            id: "home-template",
            pageType: "home",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "home",
                settings: {
                  "announcement-link": {
                    label: "About the offer",
                    target: { kind: "internal", reference: { id: "page.about", kind: "page" } },
                    targetBehavior: "same-window",
                  },
                  "announcement-text": "Editor announcement",
                  "announcement-visible": false,
                  "footer-contact-copy": "Footer support",
                  "footer-legal-link": {
                    label: "Privacy",
                    target: {
                      kind: "internal",
                      reference: { id: "policy.privacy", kind: "policy" },
                    },
                    targetBehavior: "same-window",
                  },
                  "footer-logo": {
                    alt: "Footer editor logo",
                    height: 30,
                    key: "catalog/footer-logo.png",
                    kind: "catalog",
                    width: 140,
                  },
                  "footer-social-link": {
                    label: "Community",
                    target: { kind: "external", url: "https://social.example.test/profile" },
                    targetBehavior: "new-window",
                  },
                  "header-contact-copy": "Header support",
                  "header-highlight-page": { id: "page.about", kind: "page" },
                  "header-legal-link": {
                    label: "Privacy",
                    target: {
                      kind: "internal",
                      reference: { id: "policy.privacy", kind: "policy" },
                    },
                    targetBehavior: "same-window",
                  },
                  "header-logo": {
                    alt: "Header editor logo",
                    height: 34,
                    key: "catalog/header-logo.png",
                    kind: "catalog",
                    width: 155,
                  },
                  "header-social-link": {
                    label: "Follow us",
                    target: { kind: "external", url: "https://social.example.test/store" },
                    targetBehavior: "new-window",
                  },
                  "hero-secondary-link": {
                    label: "Our story",
                    target: { kind: "internal", reference: { id: "page.about", kind: "page" } },
                    targetBehavior: "same-window",
                  },
                  "merchandising-order": 7,
                },
                type: "fashion-store.home",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.viewModels.home).toMatchObject({
      announcement: undefined,
      announcementLink: {
        href: "/about",
        label: "About the offer",
        targetBehavior: "same-window",
      },
      featuredProduct: { productId: canonicalRelease.products[0].id },
      hero: {
        secondaryLink: {
          href: "/about",
          label: "Our story",
          targetBehavior: "same-window",
        },
      },
      merchandisingOrder: 7,
      shell: {
        footer: {
          contactCopy: "Footer support",
          legalLink: { href: "/policies/privacy", label: "Privacy" },
          logo: { src: "https://media.example.test/catalog/footer-logo.png" },
          socialLink: { href: "https://social.example.test/profile", label: "Community" },
        },
        header: {
          contactCopy: "Header support",
          highlightLink: { href: "/about", label: "about" },
          legalLink: { href: "/policies/privacy", label: "Privacy" },
          logo: { src: "https://media.example.test/catalog/header-logo.png" },
          socialLink: { href: "https://social.example.test/store", label: "Follow us" },
        },
      },
    });
  });

  test("projects persisted Home shell settings for every live Fashion route", () => {
    const experience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "home-template",
          pageType: "home" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "home",
              settings: {
                "announcement-text": "One announcement across every route",
                "footer-contact-copy": "Global footer support",
                "header-contact-copy": "Global header support",
                "header-legal-link": {
                  label: "Privacy promise",
                  target: {
                    kind: "internal" as const,
                    reference: { id: "policy.privacy", kind: "policy" as const },
                  },
                  targetBehavior: "same-window" as const,
                },
              },
              type: "fashion-store.home",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    expect(
      composeExperienceShell({
        adapter: fashionStoreCompositionAdapter,
        experience,
        release: canonicalRelease,
      }),
    ).toMatchObject({
      announcement: "One announcement across every route",
      footer: { contactCopy: "Global footer support" },
      header: {
        contactCopy: "Global header support",
        legalLink: {
          href: "/policies/privacy",
          label: "Privacy promise",
          targetBehavior: "same-window",
        },
      },
    });
  });

  test("projects all Experience-owned controls onto authoritative order and policy routes", () => {
    const release = structuredClone(canonicalRelease);
    release.policies.push({
      description: "Shipping policy",
      effectiveDate: "2026-08-11",
      sections: [{ body: "Shipping body", heading: "Shipping" }],
      slug: "shipping",
      title: "Shipping",
    });
    const experience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "content-template",
          pageType: "content" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "content",
              settings: {
                "order.help-copy": "Order assistance from Experience",
                "order.policy-link": {
                  label: "Order privacy",
                  target: {
                    kind: "internal" as const,
                    reference: { id: "policy.privacy", kind: "policy" as const },
                  },
                  targetBehavior: "same-window" as const,
                },
                "policy.document": { id: "policy.privacy", kind: "policy" as const },
                "policy.help-copy": "Policy assistance from Experience",
                "policy.related-link": {
                  label: "Shipping terms",
                  target: {
                    kind: "internal" as const,
                    reference: { id: "policy.shipping", kind: "policy" as const },
                  },
                  targetBehavior: "same-window" as const,
                },
              },
              type: "fashion-store.content",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    expect(
      composePlatformRoutePresentation({
        adapter: fashionStoreCompositionAdapter,
        experience,
        path: "/orders/secure-token",
        release,
      }),
    ).toEqual({
      helpCopy: "Order assistance from Experience",
      kind: "order-presentation",
      policyLink: {
        href: "/policies/privacy",
        label: "Order privacy",
        targetBehavior: "same-window",
      },
    });
    expect(
      composePlatformRoutePresentation({
        adapter: fashionStoreCompositionAdapter,
        experience,
        path: "/policies/privacy",
        release,
      }),
    ).toEqual({
      documentLink: {
        href: "/policies/privacy",
        label: "Privacy",
        targetBehavior: "same-window",
      },
      helpCopy: "Policy assistance from Experience",
      kind: "policy-presentation",
      relatedLink: {
        href: "/policies/shipping",
        label: "Shipping terms",
        targetBehavior: "same-window",
      },
    });
  });

  test("projects content media and links plus Product related collection without binding ambiguity", () => {
    const about = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [],
        resolvedTemplates: [
          {
            id: "content-template",
            pageType: "content",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "content",
                settings: {
                  "about.heading": "Editor About",
                  "about.image": {
                    alt: "About editor image",
                    height: 600,
                    key: "catalog/about.webp",
                    kind: "catalog",
                    width: 800,
                  },
                  "about.link": {
                    label: "Read FAQs",
                    target: { kind: "internal", reference: { id: "page.faq", kind: "page" } },
                    targetBehavior: "same-window",
                  },
                  "about.message": "Editor About body",
                  "content-style": "editorial",
                },
                type: "fashion-store.content",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/about",
      release: canonicalRelease,
      route: testRoute("content", "/about"),
    });
    expect(about.viewModels.content).toMatchObject({
      action: { label: "Read FAQs", target: "/faq" },
      media: { src: "https://media.example.test/catalog/about.webp" },
      presentationStyle: "editorial",
    });

    const product = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "product-related",
            instanceId: "product",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "related-collection",
          },
        ],
        resolvedTemplates: [
          {
            id: "product-template",
            pageType: "product",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "product",
                settings: { "presentation-copy": "Editor product copy" },
                type: "fashion-store.product",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/products/selected-product",
      release: canonicalRelease,
      route: testRoute("product", "/products/selected-product", {
        productId: canonicalRelease.products[0].id,
        slug: canonicalRelease.products[0].slug,
      }),
    });
    expect(product.ok).toBe(true);
    expect(product.viewModels.product).toMatchObject({
      description: "Editor product copy",
      relatedCollection: {
        href: "/collections/selected-collection",
        id: canonicalRelease.collections[0].id,
        name: "Selected collection",
      },
    });
  });

  test("bounds Home to the first 24 eligible products", () => {
    const release = structuredClone(canonicalRelease);
    const sourceProduct = release.products[0]!;
    release.products = Array.from({ length: 25 }, (_, index) => ({
      ...structuredClone(sourceProduct),
      id: `prod_01JTHEMEHOME${String(index).padStart(10, "0")}`,
      name: `Home product ${index}`,
      slug: `home-product-${index}`,
      variants: sourceProduct.variants.map((variant) => ({
        ...structuredClone(variant),
        id: `var_01JTHEMEHOME${String(index).padStart(11, "0")}`,
      })),
    }));
    release.collections[0]!.productIds = release.products.map(({ id }) => id);
    release.collections[0]!.productSlugs = release.products.map(({ slug }) => slug);
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "home-collection-binding",
            instanceId: "home",
            kind: "catalog",
            reference: { id: release.collections[0]!.id, kind: "collection" },
            settingId: "featured-collection",
          },
        ],
        resolvedTemplates: [
          {
            id: "home-template",
            pageType: "home",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "home",
                settings: {},
                type: "fashion-store.home",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/",
      release,
      route: testRoute("home", "/"),
    });
    const products = (result.viewModels.home as { products: Array<{ slug: string }> }).products;

    expect(result.ok).toBe(true);
    expect(products).toHaveLength(24);
    expect(products.at(-1)?.slug).toBe("home-product-23");
  });

  test("routes multi-variant cards to canonical option selection", () => {
    const release = structuredClone(canonicalRelease);
    release.products[0]!.variants.push({
      ...release.products[0]!.variants[0]!,
      id: "var_01JTHEMEENGINE000000000002",
      sku: "SELECTED-L",
      title: "Large",
    });
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-collection-binding",
            instanceId: "collection",
            kind: "catalog",
            reference: { id: release.collections[0].id, kind: "collection" },
            settingId: "selected-collection-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "collection-template",
            pageType: "collection",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "collection",
                settings: {},
                type: "synthetic.collection",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/collections/selected-collection",
      release,
      route: testRoute("collection", "/collections/selected-collection", {
        collectionId: release.collections[0].id,
        slug: "selected-collection",
      }),
    });

    expect(result.viewModels.collection).toMatchObject({
      kind: "collection-grid",
      products: [
        {
          staticPurchase: {
            href: "/products/selected-product",
            kind: "choose-options",
          },
          variantIds: ["var_01JTHEMEENGINE000000000001", "var_01JTHEMEENGINE000000000002"],
        },
      ],
    });
  });

  test("does not publish a card when any active variant lacks the release currency", () => {
    const release = structuredClone(canonicalRelease);
    release.products[0]!.variants.push({
      ...structuredClone(release.products[0]!.variants[0]!),
      id: "var_01JTHEMEENGINE000000000002",
      prices: [{ amount: 6_500, currency: "EUR" }],
      sku: "SELECTED-EUR",
    });
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-collection-binding",
            instanceId: "collection",
            kind: "catalog",
            reference: { id: release.collections[0].id, kind: "collection" },
            settingId: "selected-collection-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "collection-template",
            pageType: "collection",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "collection",
                settings: {},
                type: "synthetic.collection",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/collections/selected-collection",
      release,
      route: testRoute("collection", "/collections/selected-collection", {
        collectionId: release.collections[0].id,
        slug: "selected-collection",
      }),
    });

    expect(result.viewModels.collection).toMatchObject({
      kind: "collection-grid",
      products: [],
    });
  });

  test("fails product composition closed when the release currency is unavailable", () => {
    const release = structuredClone(canonicalRelease);
    release.products[0]!.variants[0]!.prices = [{ amount: 6_500, currency: "EUR" }];
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-product-binding",
            instanceId: "product",
            kind: "catalog",
            reference: { id: release.products[0]!.id, kind: "product" },
            settingId: "selected-product-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "product-template",
            pageType: "product",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "product",
                settings: {},
                type: "synthetic.product",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/products/selected-product",
      release,
      route: testRoute("product", "/products/selected-product", {
        productId: release.products[0]!.id,
        slug: "selected-product",
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.viewModels.product).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "catalog-product-default-currency-missing",
        referenceId: release.products[0]!.id,
        sectionId: "product",
      }),
    );
  });

  test("composes collection aliases from the route registry contract", () => {
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-collection-binding",
            instanceId: "collection",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "selected-collection-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "collection-template",
            pageType: "collection",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "collection",
                settings: {},
                type: "synthetic.collection",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/shop/no-sidebar",
      release: canonicalRelease,
      route: {
        id: "shop-no-sidebar",
        pageType: "collection",
        path: "/shop/no-sidebar",
        variant: "no-sidebar",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.template?.pageType).toBe("collection");
  });

  test("composes cart and checkout shells without inventing catalog bindings", () => {
    for (const pageType of ["cart", "checkout"] as const) {
      const result = composeExperienceRoute({
        experience: {
          ...liveSnapshot,
          bindings: [],
          resolvedTemplates: [
            {
              id: `${pageType}-template`,
              pageType,
              requiredCapabilities: [],
              sections: [
                {
                  blocks: [],
                  capabilities: [],
                  id: pageType,
                  settings: {
                    "help-copy": `${pageType} editor help`,
                    "policy-link": {
                      label: "Privacy",
                      target: {
                        kind: "internal",
                        reference: { id: "policy.privacy", kind: "policy" },
                      },
                      targetBehavior: "same-window",
                    },
                  },
                  type: `synthetic.${pageType}`,
                  visible: true,
                },
              ],
            },
          ],
        },
        locale: "en-US",
        path: `/${pageType}`,
        release: canonicalRelease,
        route: testRoute(pageType, `/${pageType}`),
      });

      expect(result.ok).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(result.viewModels[pageType]).toMatchObject({
        helpCopy: `${pageType} editor help`,
        kind: pageType,
        policyLink: { href: "/policies/privacy", label: "Privacy" },
        state: "populated",
      });
    }
  });

  test("composes truthful content states from Experience settings without catalog or fixture bindings", () => {
    const contentExperience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "content-template",
          pageType: "content",
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "content",
              settings: {
                "account.heading": "Member area",
                "account.message": "Sign in to continue.",
                "magazine.heading": "Journal",
                "magazine.featured-article": {
                  id: "article.marketing-tips-and-tricks",
                  kind: "article",
                },
                "magazine.message": "Stories selected by the merchant.",
                "wishlist.heading": "Saved products",
                "wishlist.message": "Your saved products.",
              },
              type: "synthetic.content",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    const unavailable = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/account",
      release: canonicalRelease,
      route: testRoute("content", "/account"),
    });
    expect(unavailable.ok).toBe(true);
    expect(unavailable.viewModels.content).toMatchObject({
      action: { label: "Continue shopping", target: "/shop" },
      heading: "Member area",
      kind: "state",
      message: "Sign in to continue.",
      state: "unavailable",
    });

    const wishlist = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/wishlist",
      release: canonicalRelease,
      route: testRoute("content", "/wishlist"),
    });
    expect(wishlist.ok).toBe(true);
    expect(wishlist.viewModels.content).toMatchObject({
      description: "Your saved products.",
      heading: "Saved products",
      kind: "collection-grid",
      products: [
        expect.objectContaining({
          href: `/products/${canonicalRelease.products[0].slug}`,
          productId: canonicalRelease.products[0].id,
        }),
      ],
      state: "unavailable",
    });

    const releaseWithoutPublishedProducts = structuredClone(canonicalRelease);
    releaseWithoutPublishedProducts.products[0]!.status = "draft";
    const emptyWishlist = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/wishlist",
      release: releaseWithoutPublishedProducts,
      route: testRoute("content", "/wishlist"),
    });
    expect(emptyWishlist.viewModels.content).toMatchObject({
      kind: "collection-grid",
      products: [],
      state: "unavailable",
    });

    const wishlistRelease = structuredClone(canonicalRelease);
    const wishlistProduct = wishlistRelease.products[0]!;
    wishlistRelease.collections = [];
    wishlistRelease.products = Array.from({ length: 8 }, (_, index) => ({
      ...structuredClone(wishlistProduct),
      collectionIds: [],
      collectionSlugs: [],
      id: `prod_01JTHEMEWISHLIST${String(index).padStart(8, "0")}`,
      slug: `wishlist-product-${index}`,
      status: index === 0 ? ("draft" as const) : wishlistProduct.status,
      variants: wishlistProduct.variants.map((variant) => ({
        ...variant,
        id: `var_01JTHEMEWISHLIST${String(index).padStart(9, "0")}`,
        prices:
          index === 2 ? [{ amount: 6_500, currency: "EUR" }] : structuredClone(variant.prices),
        status: index === 4 ? ("disabled" as const) : variant.status,
      })),
    }));
    const boundedWishlist = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/wishlist",
      release: wishlistRelease,
      route: testRoute("content", "/wishlist"),
    });
    expect(
      (boundedWishlist.viewModels.content as { products: Array<{ slug: string }> }).products.map(
        ({ slug }) => slug,
      ),
    ).toEqual([
      "wishlist-product-1",
      "wishlist-product-3",
      "wishlist-product-5",
      "wishlist-product-6",
    ]);

    const configured = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/magazine",
      release: canonicalRelease,
      route: testRoute("content", "/magazine"),
    });
    expect(configured.ok).toBe(true);
    expect(configured.viewModels.content).toMatchObject({
      heading: "Journal",
      kind: "state",
      message: "Stories selected by the merchant.",
      relatedAction: {
        label: "article",
        target: "/magazine/marketing-tips-and-tricks",
      },
      state: "populated",
    });
  });

  test("returns actionable diagnostics for every product and collection reference state", () => {
    const cases = [
      {
        label: "missing product",
        code: "catalog-reference-missing",
        reference: { id: "prod_01JTHEMEENGINEMISSING00001", kind: "product" } as const,
        release: canonicalRelease,
      },
      {
        label: "deleted collection",
        code: "catalog-reference-missing",
        reference: { id: canonicalRelease.collections[0].id, kind: "collection" } as const,
        release: {
          ...canonicalRelease,
          collections: [],
          products: [
            {
              ...canonicalRelease.products[0],
              collectionIds: [],
              collectionSlugs: [],
            },
          ],
        } satisfies CanonicalCatalogRelease,
      },
      {
        label: "product reference with collection ID",
        code: "catalog-reference-wrong-kind",
        reference: { id: canonicalRelease.collections[0].id, kind: "product" } as const,
        release: canonicalRelease,
      },
      {
        label: "collection reference with product ID",
        code: "catalog-reference-wrong-kind",
        reference: { id: canonicalRelease.products[0].id, kind: "collection" } as const,
        release: canonicalRelease,
      },
      {
        label: "draft product",
        code: "catalog-reference-unpublished",
        reference: { id: canonicalRelease.products[0].id, kind: "product" } as const,
        release: {
          ...canonicalRelease,
          products: [{ ...canonicalRelease.products[0], status: "draft" }],
        } satisfies CanonicalCatalogRelease,
      },
      {
        label: "archived collection",
        code: "catalog-reference-unpublished",
        reference: { id: canonicalRelease.collections[0].id, kind: "collection" } as const,
        release: {
          ...canonicalRelease,
          collections: [{ ...canonicalRelease.collections[0], status: "archived" }],
        } satisfies CanonicalCatalogRelease,
      },
      {
        label: "product with no active variant",
        code: "catalog-reference-unpublished",
        reference: { id: canonicalRelease.products[0].id, kind: "product" } as const,
        release: {
          ...canonicalRelease,
          products: [
            {
              ...canonicalRelease.products[0],
              variants: canonicalRelease.products[0].variants.map((variant) => ({
                ...variant,
                status: "disabled" as const,
              })),
            },
          ],
        } satisfies CanonicalCatalogRelease,
      },
    ];

    for (const entry of cases) {
      const result = composeExperienceRoute({
        experience: {
          ...liveSnapshot,
          bindings: [
            {
              id: "featured-product",
              instanceId: "hero",
              kind: "catalog",
              reference: entry.reference,
              settingId: "featured-product-setting",
            },
          ],
        },
        locale: "en-US",
        path: "/",
        release: entry.release,
        route: testRoute("home", "/"),
      });
      expect(result.ok, entry.label).toBe(false);
      expect(result.diagnostics[0], entry.label).toMatchObject({
        code: entry.code,
        pageId: "home",
        path: "/",
        referenceId: entry.reference.id,
        referenceKind: entry.reference.kind,
        sectionId: "hero",
        settingId: "featured-product-setting",
      });
    }

    const empty = composeExperienceRoute({
      experience: { ...liveSnapshot, bindings: [] },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    });
    expect(empty.diagnostics[0]).toMatchObject({
      code: "catalog-binding-missing",
      pageId: "home",
      path: "/",
      sectionId: "hero",
    });
  });

  test("keeps fixture and live providers isolated with no fallback or Commerce request", () => {
    const fixtureProvider = createFixturePresentationProvider({
      bindings: [
        {
          fixtureId: "fixture-home",
          id: "fixture-home-binding",
          instanceId: "hero",
          kind: "fixture",
          resource: "hero",
          state: "populated",
        },
      ],
      fixtures: {
        "fixture-home": {
          id: "fixture-home",
          label: "Fixture home",
          pageTypes: ["home"],
          viewModels: {
            hero: {
              body: "Fixture body",
              eyebrow: "Fixture",
              heading: "Fixture heading",
              kind: "hero",
              state: "populated",
            },
          },
        },
      },
    });
    const first = fixtureProvider.resolve({ instanceId: "hero" });
    const second = fixtureProvider.resolve({ instanceId: "hero" });
    expect(second).toEqual(first);
    expect(selectPresentationProvider({ fixtureProvider, mode: "fixture-preview" })).toBe(
      fixtureProvider,
    );
    expect(selectPresentationProvider({ fixtureProvider, mode: "live" })).toBeUndefined();

    const commercePort = () => "commerce-called";
    expect(selectLivePort("fixture-preview", commercePort)).toBeUndefined();
    expect(selectLivePort("production", commercePort)).toBeUndefined();
    expect(selectLivePort("live", commercePort)).toBe(commercePort);

    const liveInput = {
      experience: { ...liveSnapshot, bindings: [] },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    };
    const liveProvider = createLivePresentationProvider(liveInput);
    expect(selectPresentationProvider({ fixtureProvider, liveInput, mode: "live" })).not.toBe(
      fixtureProvider,
    );
    expect(() => liveProvider.resolve({ instanceId: "hero" })).toThrow("catalog-binding-missing");
    expect(() =>
      resolveFixtureBinding(
        "hero",
        liveSnapshot.bindings.filter((binding) => binding.kind === "fixture"),
      ),
    ).toThrow("missing a fixture binding");
  });
});

describe("typed theme registry", () => {
  const components = {
    action: {} as Component,
    footer: {} as Component,
    hero: {} as Component,
  };
  const core = {
    blocks: { "core.action": components.action },
    sections: { "core.legal-footer": components.footer },
  } satisfies ThemeRegistry;
  const synthetic = {
    blocks: {},
    sections: {
      "synthetic.editorial": {} as Component,
      "synthetic.hero": components.hero,
    },
  } satisfies ThemeRegistry;

  test("composes core and namespaced registries and keeps configured order", () => {
    const plan = renderTemplatePlan(template, composeThemeRegistries(core, synthetic));

    expect(plan.map(({ instance }) => instance.id)).toEqual(["hero", "legal-footer"]);
    expect(plan[0]?.component).toBe(components.hero);
    expect(plan[0]?.blocks.map(({ instance }) => instance.id)).toEqual(["hero-action"]);
    expect(plan[1]?.component).toBe(components.footer);
  });

  test("rejects duplicate registrations and unknown visible components", () => {
    expect(() =>
      composeThemeRegistries(core, {
        blocks: { "core.action": {} as Component },
        sections: {},
      }),
    ).toThrow("duplicate");
    expect(() =>
      renderTemplatePlan(
        {
          ...template,
          sections: [{ ...template.sections[0]!, type: "synthetic.unknown" }],
        },
        composeThemeRegistries(core, synthetic),
      ),
    ).toThrow("not registered");
  });
});

class MemoryBucket implements PreviewArtifactBucket {
  readonly objects = new Map<
    string,
    {
      body: Uint8Array;
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    }
  >();
  puts = 0;

  async get(key: string): Promise<PreviewArtifactObject | null> {
    const value = this.objects.get(key);
    if (!value) return null;
    return {
      body: value.body,
      customMetadata: value.customMetadata,
      httpMetadata: value.httpMetadata,
    };
  }

  async head(key: string): Promise<PreviewArtifactObject | null> {
    return this.get(key);
  }

  async put(
    key: string,
    body: Uint8Array,
    options: {
      customMetadata: Record<string, string>;
      httpMetadata: { contentType: string };
    },
  ): Promise<void> {
    this.puts += 1;
    this.objects.set(key, {
      body: structuredClone(body),
      customMetadata: options.customMetadata,
      httpMetadata: options.httpMetadata,
    });
  }
}

const previewFiles = [
  {
    body: new TextEncoder().encode("<!doctype html><h1>Preview</h1>"),
    contentType: "text/html; charset=utf-8",
    path: "index.html",
  },
  {
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    path: "_nuxt/image.png",
  },
];

describe("private preview artifacts", () => {
  test("uploads identical output idempotently and isolates snapshot prefixes", async () => {
    const bucket = new MemoryBucket();
    const first = await uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles);
    const putCount = bucket.puts;
    const repeated = await uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles);
    const other = await uploadPreviewArtifact(bucket, "snapshot-fashion-store", previewFiles);

    expect(repeated).toEqual(first);
    expect(bucket.puts).toBe(putCount + previewFiles.length + 1);
    expect(other.digest).toBe(first.digest);
    expect(other.prefix).not.toBe(first.prefix);
    await expect(
      uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles, "0".repeat(64)),
    ).rejects.toThrow("digest");
  });

  test("binds live artifact storage to the selected Catalog Release", async () => {
    const bucket = new MemoryBucket();
    const artifact = await uploadPreviewArtifact(
      bucket,
      "snapshot-synthetic-1",
      previewFiles,
      undefined,
      "release-theme-engine-a",
    );

    expect(artifact.prefix).toBe(
      `snapshots/snapshot-synthetic-1/release-theme-engine-a/${artifact.digest}`,
    );
    expect(bucket.objects.get(`${artifact.prefix}/index.html`)?.customMetadata).toMatchObject({
      catalogReleaseId: "release-theme-engine-a",
      snapshotId: "snapshot-synthetic-1",
    });
  });

  test("normalizes assets and rejects traversal including encoded traversal", () => {
    expect(normalizePreviewAssetPath("/")).toBe("index.html");
    expect(normalizePreviewAssetPath("/products/")).toBe("products/index.html");
    expect(normalizePreviewAssetPath("/_nuxt/app.js")).toBe("_nuxt/app.js");
    for (const path of ["/../secret", "/%2e%2e/secret", "/%252e%252e/secret", "/a\\b"]) {
      expect(() => normalizePreviewAssetPath(path)).toThrow("path");
    }
  });

  test("packages complete static output with declared content types", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-preview-output-"));
    try {
      const output = resolve(directory, "public");
      const manifestPath = resolve(directory, "artifact-manifest.json");
      await mkdir(resolve(output, "_nuxt"), { recursive: true });
      await Promise.all([
        writeFile(resolve(output, "index.html"), "<!doctype html><h1>Preview</h1>"),
        writeFile(resolve(output, "_nuxt/app.js"), "export {};\n"),
      ]);

      const artifact = await packagePreviewArtifact({
        manifestPath,
        outputRoot: output,
        snapshotId: "snapshot-synthetic-1",
      });

      expect(artifact.files.map(({ path }) => path)).toEqual(["_nuxt/app.js", "index.html"]);
      expect(artifact.files[0]?.contentType).toBe("text/javascript; charset=utf-8");
      expect(JSON.parse(await readFile(manifestPath, "utf8"))).toMatchObject({
        schemaVersion: 1,
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("serves only authorized exact-prefix objects with private security headers", async () => {
    const bucket = new MemoryBucket();
    const artifact = await uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles);
    const auth = {
      fetch: async () =>
        Response.json({
          artifactPrefix: artifact.prefix,
          authorized: true,
          expiresAt: "2026-07-30T02:00:00.000Z",
          mediaOrigins: ["https://media.example.test"],
          origin: "https://preview.example.test",
        }),
    };
    const handler = createPreviewAccessHandler({
      now: () => new Date("2026-07-30T01:30:00.000Z"),
    });
    const response = await handler(
      new Request("https://preview.example.test/", {
        headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
      }),
      {
        PREVIEW_ARTIFACTS: bucket,
        PREVIEW_AUTH: auth,
        PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
        PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
        PREVIEW_ORIGIN: "https://preview.example.test",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<h1>Preview</h1>");
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://preview.example.test",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain("connect-src 'self'");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "img-src https://preview.example.test https://media.example.test",
    );
  });

  test("rejects malformed, duplicate, or over-broad media origins from preview authorization", async () => {
    const bucket = new MemoryBucket();
    const artifact = await uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles);
    const handler = createPreviewAccessHandler({
      now: () => new Date("2026-07-30T01:30:00.000Z"),
    });
    for (const mediaOrigins of [
      ["http://media.example.test"],
      ["https://media.example.test/path"],
      ["https://user@media.example.test"],
      ["https://media.example.test", "https://media.example.test"],
      Array.from({ length: 9 }, (_, index) => `https://media-${index}.example.test`),
    ]) {
      const response = await handler(
        new Request("https://preview.example.test/", {
          headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
        }),
        {
          PREVIEW_ARTIFACTS: bucket,
          PREVIEW_AUTH: {
            fetch: async () =>
              Response.json({
                artifactPrefix: artifact.prefix,
                authorized: true,
                expiresAt: "2026-07-30T02:00:00.000Z",
                mediaOrigins,
                origin: "https://preview.example.test",
              }),
          },
          PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
          PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
          PREVIEW_ORIGIN: "https://preview.example.test",
        },
      );
      expect(response.status).toBe(403);
      for (const mediaOrigin of mediaOrigins) {
        expect(response.headers.get("Content-Security-Policy")).not.toContain(mediaOrigin);
      }
    }
  });

  test("redeems a grant only through POST and sets a strict host-only session cookie", async () => {
    const grant = "grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const authRequests: Request[] = [];
    const handler = createPreviewAccessHandler();
    const environment = {
      PREVIEW_ARTIFACTS: new MemoryBucket(),
      PREVIEW_AUTH: {
        fetch: async (request: Request) => {
          authRequests.push(request);
          return Response.json({
            data: {
              expiresAt: "2099-07-30T02:00:00.000Z",
              session: "session_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
            },
          });
        },
      },
      PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
      PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
      PREVIEW_ORIGIN: "https://preview.example.test",
    };
    const rejected = await handler(
      new Request("https://preview.example.test/__preview/session", {
        body: new URLSearchParams({ grant }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://attacker.example.test",
        },
        method: "POST",
      }),
      environment,
    );
    expect(rejected.status).toBe(403);
    expect(authRequests).toHaveLength(0);
    const response = await handler(
      new Request("https://preview.example.test/__preview/session", {
        body: new URLSearchParams({ grant }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://admin.example.test",
        },
        method: "POST",
      }),
      environment,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Location")).not.toContain(grant);
    expect(response.headers.get("Set-Cookie")).toContain(
      "__Host-shoppp-preview=session_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    );
    expect(response.headers.get("Set-Cookie")).toContain("Path=/; Expires=");
    expect(response.headers.get("Set-Cookie")).toContain("Secure; HttpOnly; SameSite=Strict");
    expect(authRequests).toHaveLength(1);
    expect(authRequests[0]?.url).toBe("https://preview-auth.internal/internal/preview/redeem");
    expect(authRequests[0]?.headers.get("Authorization")).toBe(
      "Bearer preview-auth-token-000000000000000001",
    );
  });

  test("returns authorization or real 404 responses without crossing prefixes", async () => {
    const bucket = new MemoryBucket();
    const handler = createPreviewAccessHandler({
      now: () => new Date("2026-07-30T03:00:00.000Z"),
    });
    const environment = {
      PREVIEW_ARTIFACTS: bucket,
      PREVIEW_AUTH: {
        fetch: async () =>
          Response.json({
            artifactPrefix: `snapshots/snapshot-synthetic-1/${"a".repeat(64)}`,
            authorized: true,
            expiresAt: "2026-07-30T02:00:00.000Z",
            origin: "https://preview.example.test",
          }),
      },
      PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
      PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
      PREVIEW_ORIGIN: "https://preview.example.test",
    };

    expect((await handler(new Request("https://preview.example.test/"), environment)).status).toBe(
      401,
    );
    expect(
      (
        await handler(
          new Request("https://preview.example.test/", {
            headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
          }),
          environment,
        )
      ).status,
    ).toBe(403);

    const unexpired = {
      ...environment,
      PREVIEW_AUTH: {
        fetch: async () =>
          Response.json({
            artifactPrefix: `snapshots/snapshot-synthetic-1/${"a".repeat(64)}`,
            authorized: true,
            expiresAt: "2026-07-30T04:00:00.000Z",
            origin: "https://preview.example.test",
          }),
      },
    };
    expect(
      (
        await handler(
          new Request("https://preview.example.test/missing.html", {
            headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
          }),
          unexpired,
        )
      ).status,
    ).toBe(404);
  });
});

test("production Wrangler configuration has no preview binding or entrypoint", async () => {
  const configuration = await readFile(resolve(import.meta.dir, "../wrangler.jsonc"), "utf8");

  expect(configuration).not.toContain("PREVIEW_ARTIFACTS");
  expect(configuration).not.toContain("preview-access.ts");
});
