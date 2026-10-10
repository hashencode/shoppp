import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalStorefrontJson,
  type StorefrontPublicationBuildInput,
  type StorefrontThemeDescriptor,
} from "@shoppp/contracts";

import releaseFixture from "../fixtures/release.json";
import {
  experienceBuildInputSchema,
  prepareExperience,
  renderActiveExperienceModule,
  renderActiveThemeModule,
} from "../scripts/prepare-experience";
import {
  productionPlatformRoutes,
  resolveStorefrontPrerenderRoutes,
} from "../scripts/resolve-prerender-routes";
import storefrontWorker from "../worker";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const descriptor: StorefrontThemeDescriptor = {
  configurationSchemaVersion: 1,
  id: "synthetic",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  presets: ["editorial"],
  supportedPageTemplates: ["home"],
  themeVersion: "1.0.0",
};

function approvedInput(): StorefrontPublicationBuildInput {
  const snapshot = {
    approvedAt: "2026-10-11T00:00:00.000Z",
    approvedBy: "operator-1",
    bindings: [],
    configurationSchemaVersion: 1,
    contact: {
      version: "c".repeat(64),
      publicContact: {
        supportEmail: "help@example.test",
        privacyEmail: "privacy@example.test",
        publicPhone: null,
        serviceHours: null,
        timeZone: "UTC",
        locations: [],
        socials: [],
      },
    },
    experienceId: "experience-synthetic",
    id: "snapshot-synthetic-public-1",
    kind: "approved" as const,
    overrides: [],
    platformContractVersion: "1.0.0",
    provenance: {
      approvedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: "theme-team",
      license: "Internal",
      source: "internal://synthetic",
    },
    resolvedTemplates: [
      { id: "home", pageType: "home" as const, requiredCapabilities: [], sections: [] },
    ],
    themeId: "synthetic",
    themeVersion: "1.0.0",
    version: 1,
  };
  const catalogManifestJson = JSON.stringify(releaseFixture);
  return {
    catalogManifestJson,
    catalogRelease: structuredClone(releaseFixture),
    environment: "public",
    expectedOrigin: "https://storefront.example.test",
    inputIdentity: {
      catalogManifestDigest: sha256(catalogManifestJson),
      catalogReleaseId: releaseFixture.releaseId,
      catalogSourceDigest: null,
      contactVersion: snapshot.contact.version,
      experienceSnapshotId: snapshot.id,
      experienceVersion: snapshot.version,
      platformContractVersion: snapshot.platformContractVersion,
      snapshotDigest: sha256(canonicalStorefrontJson(snapshot)),
      themeId: snapshot.themeId,
      themeVersion: snapshot.themeVersion,
    },
    mediaOrigins: [],
    presentationMode: "live",
    publicationId: "publication-1",
    snapshot,
    sourceEnvironment: "staging",
    themeId: "synthetic",
  };
}

describe("approved public storefront compilation", () => {
  test("gives the public live renderer its own frozen-release SEO boundary", async () => {
    const source = await readFile(
      new URL("../app/StorefrontExperience.vue", import.meta.url),
      "utf8",
    );
    const publicSeo = source
      .split("if (activeExperienceSnapshot && liveRelease && !previewOrigin) {")[1]
      ?.split("if (activeExperienceSnapshot && previewOrigin) {")[0];
    expect(publicSeo).toBeDefined();
    expect(publicSeo).toContain(
      "canonicalUrl(liveRelease.site.origin, routeSeo.value.canonicalPath)",
    );
    expect(publicSeo).toContain(
      "productStructuredData(routeSeo.value.product, liveRelease.site.origin)",
    );
    expect(publicSeo).toContain('pageContract.value?.indexing === "noindex"');
    expect(publicSeo).not.toContain("Private preview");
  });

  test("uses the approved live Theme, Contact and Catalog without enabling Preview", () => {
    const input = approvedInput();
    const parsed = experienceBuildInputSchema.parse(input);
    const theme = renderActiveThemeModule({
      catalog: [descriptor],
      input: parsed,
      moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
    });
    const experience = renderActiveExperienceModule(parsed);
    expect(theme).toContain('from "../themes/synthetic/registry"');
    expect(theme).toContain(input.snapshot.id);
    expect(theme).toContain("help@example.test");
    expect(theme).toContain("activePreviewOrigin = null");
    expect(experience).toContain('mode: "live"');
    expect(experience).toContain(input.catalogRelease.releaseId);
    expect(experience).not.toContain("fixture-preview");
    expect(experience).not.toContain("fixtures/experience");
  });

  test.each(["catalog", "snapshot", "raw-catalog"])(
    "rejects changed %s bytes before compiling",
    (change) => {
      const input = approvedInput();
      if (change === "catalog") input.inputIdentity.catalogManifestDigest = "a".repeat(64);
      if (change === "snapshot")
        input.snapshot.contact!.publicContact.supportEmail = "changed@example.test";
      if (change === "raw-catalog") {
        const changed = { ...input.catalogRelease, releaseId: "other-release" };
        input.catalogManifestJson = JSON.stringify(changed);
        input.inputIdentity.catalogManifestDigest = sha256(input.catalogManifestJson);
      }
      expect(experienceBuildInputSchema.safeParse(input).success).toBe(false);
    },
  );

  test("writes the same approved live modules into the compilation input", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shoppp-public-experience-"));
    const input = approvedInput();
    try {
      await prepareExperience({
        catalog: [descriptor],
        input,
        moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
        outputPath: join(directory, "active-theme.ts"),
        providerOutputPath: join(directory, "active-experience.ts"),
      });
      const theme = await readFile(join(directory, "active-theme.ts"), "utf8");
      const provider = await readFile(join(directory, "active-experience.ts"), "utf8");
      expect(theme).toContain("activePreviewOrigin = null");
      expect(theme).toContain("help@example.test");
      expect(provider).toContain(input.snapshot.id);
      expect(provider).not.toContain("fixtures/experience");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("prerenders live catalog and public Commerce shells instead of fallback or fixture routes", () => {
    const input = { ...approvedInput(), themeId: "fashion-store" };
    input.catalogRelease.products = input.catalogRelease.products.slice(0, 1);
    const routes = resolveStorefrontPrerenderRoutes({
      experience: input,
      previewBuild: false,
      productionRoutes: ["/fallback-only"],
    });
    expect(routes).toContain("/shop");
    expect(routes).toContain(`/products/${releaseFixture.products[0]!.slug}`);
    for (const route of productionPlatformRoutes) expect(routes).toContain(route);
    expect(routes).not.toContain("/fallback-only");
    expect(routes).not.toContain("/products/relaxed-corduroy-shirt");
  });
});

describe("public storefront activation marker", () => {
  test("preserves the legacy API path when the artifact has no compiled public marker", async () => {
    let upstream: Request | undefined;
    const response = await storefrontWorker.fetch(
      new Request("https://shop.example.test/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Preview-Catalog-Release": "legacy-release",
        },
        body: JSON.stringify({ quantity: 2 }),
      }),
      {
        API: {
          fetch: async (request) => {
            upstream = request;
            return new Response("legacy");
          },
        },
        ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
        CF_VERSION_METADATA: { id: "fallback-worker-version" },
      },
    );
    expect(await response.text()).toBe("legacy");
    expect(upstream!.url).toBe("https://shop.example.test/cart");
    expect(upstream!.headers.get("X-Preview-Catalog-Release")).toBe("legacy-release");
    expect(upstream!.headers.get("X-Storefront-Catalog-Manifest-Digest")).toBeNull();
    expect(await upstream!.json()).toEqual({ quantity: 2 });
  });

  test("binds public API requests to the compiled release and digest, overriding browser headers", async () => {
    const input = approvedInput();
    let upstream: Request | undefined;
    const response = await storefrontWorker.fetch(
      new Request("https://shop.example.test/api/products/product-1?currency=USD", {
        headers: {
          "X-Preview-Catalog-Release": "browser-release",
          "X-Storefront-Catalog-Release": "browser-public-release",
          "X-Storefront-Catalog-Manifest-Digest": "b".repeat(64),
        },
      }),
      {
        API: {
          fetch: async (request) => {
            upstream = request;
            return new Response("product");
          },
        },
        ASSETS: {
          fetch: async () =>
            Response.json({
              schemaVersion: 1,
              sourceEnvironment: input.sourceEnvironment,
              identity: input.inputIdentity,
            }),
        },
        CF_VERSION_METADATA: { id: "worker-version-actual" },
      },
    );
    expect(await response.text()).toBe("product");
    expect(upstream!.url).toBe("https://shop.example.test/products/product-1?currency=USD");
    expect(upstream!.headers.get("X-Preview-Catalog-Release")).toBeNull();
    expect(upstream!.headers.get("X-Storefront-Catalog-Release")).toBe(
      input.inputIdentity.catalogReleaseId,
    );
    expect(upstream!.headers.get("X-Storefront-Catalog-Manifest-Digest")).toBe(
      input.inputIdentity.catalogManifestDigest,
    );
  });

  test("returns the exact raw Catalog bytes from the same artifact with current Worker identity", async () => {
    const input = approvedInput();
    const marker = {
      schemaVersion: 1,
      sourceEnvironment: input.sourceEnvironment,
      identity: input.inputIdentity,
    };
    const response = await storefrontWorker.fetch(
      new Request("https://shop.example.test/.well-known/shoppp-release/catalog"),
      {
        API: {
          fetch: async () => {
            throw new Error("observation must not call API");
          },
        },
        ASSETS: {
          fetch: async (request) =>
            new URL(request.url).pathname === "/__shoppp-release.json"
              ? Response.json(marker)
              : new Response(input.catalogManifestJson),
        },
        CF_VERSION_METADATA: { id: "worker-version-actual" },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...marker,
      workerVersionId: "worker-version-actual",
      catalogManifestJson: input.catalogManifestJson,
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("rejects Catalog observation when the asset bytes differ from the compiled digest", async () => {
    const input = approvedInput();
    const response = await storefrontWorker.fetch(
      new Request("https://shop.example.test/.well-known/shoppp-release/catalog"),
      {
        API: { fetch: async () => new Response("unused") },
        ASSETS: {
          fetch: async (request) =>
            new URL(request.url).pathname === "/__shoppp-release.json"
              ? Response.json({
                  schemaVersion: 1,
                  sourceEnvironment: input.sourceEnvironment,
                  identity: input.inputIdentity,
                })
              : new Response(`${input.catalogManifestJson}\n`),
        },
        CF_VERSION_METADATA: { id: "worker-version-actual" },
      },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("combines the immutable compiled identity with the actual runtime Worker version", async () => {
    const input = approvedInput();
    const requests: string[] = [];
    const marker = {
      schemaVersion: 1,
      sourceEnvironment: input.sourceEnvironment,
      identity: input.inputIdentity,
    };
    const response = await storefrontWorker.fetch(
      new Request("https://shop.example.test/.well-known/shoppp-release"),
      {
        API: {
          fetch: async () => {
            throw new Error("marker must not call API");
          },
        },
        ASSETS: {
          fetch: async (request) => {
            requests.push(request.url);
            return Response.json(marker);
          },
        },
        CF_VERSION_METADATA: { id: "worker-version-actual" },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...marker, workerVersionId: "worker-version-actual" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(requests).toEqual(["https://shop.example.test/__shoppp-release.json"]);
  });

  test("cannot report activation for a fallback artifact", async () => {
    const response = await storefrontWorker.fetch(
      new Request("https://shop.example.test/.well-known/shoppp-release"),
      {
        API: { fetch: async () => new Response("unused") },
        ASSETS: { fetch: async () => new Response("not found", { status: 404 }) },
        CF_VERSION_METADATA: { id: "fallback-worker-version" },
      },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("cannot report activation for a valid compiled marker without runtime version metadata", async () => {
    const input = approvedInput();
    const response = await storefrontWorker.fetch(
      new Request("https://shop.example.test/.well-known/shoppp-release"),
      {
        API: { fetch: async () => new Response("unused") },
        ASSETS: {
          fetch: async () =>
            Response.json({
              schemaVersion: 1,
              sourceEnvironment: input.sourceEnvironment,
              identity: input.inputIdentity,
            }),
        },
      },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  test("rejects corrupt compiled markers rather than returning a runtime-only online claim", async () => {
    const response = await storefrontWorker.fetch(
      new Request("https://shop.example.test/.well-known/shoppp-release"),
      {
        API: { fetch: async () => new Response("unused") },
        ASSETS: { fetch: async () => Response.json({ identity: { catalogReleaseId: "release" } }) },
        CF_VERSION_METADATA: { id: "worker-version-actual" },
      },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
