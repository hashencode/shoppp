import { describe, expect, test } from "bun:test";
import type { CatalogReleaseV3, ExperienceSnapshot } from "@shoppp/contracts";

import releaseFixture from "../fixtures/release.json";
import { composeExperienceRoute } from "../app/theme-engine/composer";
import { fashionStoreEditorDestinations } from "../app/themes/fashion-store/editor-destinations";
import { resolveThemeRoute, themeRoutePaths } from "../app/theme-engine/routes";
import { fashionStoreCompositionAdapter } from "../app/themes/fashion-store/composition";
import { fashionStoreThemeRoutes } from "../app/themes/fashion-store/page-contracts";
import { fashionStorePreset } from "../app/themes/fashion-store/presets/source-parity";
import { resolveReleasedContentSeo } from "../app/utils/seo";

const contentExperience = {
  approvedAt: "2026-09-23T00:00:00.000Z",
  approvedBy: "operator.content",
  bindings: [],
  configurationSchemaVersion: 2,
  experienceId: "experience-fashion-content",
  id: "snapshot-fashion-content-1",
  kind: "approved",
  overrides: [],
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-09-23T00:00:00.000Z",
    approvedBy: "shoppp-theme-team",
    license: "Internal",
    source: "internal://fashion-store",
  },
  resolvedTemplates: fashionStorePreset.templates,
  themeId: "fashion-store",
  themeVersion: "1.1.0",
  version: 1,
} satisfies ExperienceSnapshot;

function release(content: CatalogReleaseV3["content"]): CatalogReleaseV3 {
  return {
    ...structuredClone(releaseFixture),
    content,
    environment: "development",
    identity: {
      faviconAssetId: null,
      id: "identity.primary",
      logoAssets: [],
      seo: {},
      socialShareAssetId: null,
      storefrontName: "Shoppp",
      tagline: "",
      version: 1,
    },
    navigation: [],
    purpose: "private-preview",
    routeOutput: releaseFixture.routes,
    schemaVersion: 3,
    sourceVersionVector: [
      {
        digest: "a".repeat(64),
        id: "identity.primary",
        kind: "store-identity",
        version: 1,
      },
    ],
  };
}

describe("Fashion Store released Content destinations", () => {
  test("uses frozen Page and Article SEO for their released routes", () => {
    const candidate = release([
      {
        digest: "b".repeat(64),
        id: "page.about",
        kind: "page",
        payload: {
          sections: [],
          seo: { title: "Our story | Shoppp", description: "Meet our makers." },
          summary: "Our story summary",
        },
        route: "/about",
        slug: "about",
        title: "Our story",
        version: 2,
      },
      {
        digest: "c".repeat(64),
        id: "article.notes",
        kind: "article",
        payload: { sections: [], seo: {}, summary: "Notes summary" },
        route: "/magazine/notes",
        slug: "notes",
        title: "Useful notes",
        version: 1,
      },
    ]);
    expect(resolveReleasedContentSeo(candidate, "/about")).toEqual({
      description: "Meet our makers.",
      title: "Our story | Shoppp",
    });
    expect(resolveReleasedContentSeo(candidate, "/magazine/notes")).toEqual({
      description: "Notes summary",
      title: "Useful notes",
    });
    expect(resolveReleasedContentSeo(candidate, "/missing")).toBeUndefined();
  });
  test("exposes only Page and Article records frozen in a schema-v3 Release", () => {
    const destinations = fashionStoreEditorDestinations(
      release([
        {
          digest: "b".repeat(64),
          id: "page.about",
          kind: "page",
          payload: {
            sections: [{ id: "section.intro", kind: "paragraph", text: "Our story." }],
            seo: { title: "About" },
            summary: "Our story",
          },
          route: "/about",
          slug: "about",
          title: "Our story",
          version: 2,
        },
        {
          digest: "c".repeat(64),
          id: "article.useful-notes",
          kind: "article",
          payload: {
            sections: [{ id: "section.intro", kind: "paragraph", text: "Useful notes." }],
            seo: { title: "Useful notes" },
            summary: "Useful notes",
          },
          route: "/magazine/useful-notes",
          slug: "useful-notes",
          title: "Useful notes",
          version: 1,
        },
      ]),
    );
    expect(destinations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "page.about", name: "Our story", path: "/about" }),
        expect.objectContaining({
          id: "article.useful-notes",
          name: "Useful notes",
          path: "/magazine/useful-notes",
        }),
      ]),
    );
    expect(destinations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "article.marketing-tips-and-tricks" }),
      ]),
    );
  });

  test("does not invent a sample Article when the Release has zero Articles", () => {
    const selected = release([]);
    const destinations = fashionStoreEditorDestinations(selected);
    expect(destinations.filter(({ kind }) => kind === "article")).toEqual([]);
    expect(destinations.some(({ path }) => path === "/magazine/marketing-tips-and-tricks")).toBe(
      false,
    );
    expect(themeRoutePaths(fashionStoreThemeRoutes, "live", selected)).not.toContain(
      "/magazine/marketing-tips-and-tricks",
    );
    expect(
      resolveThemeRoute(
        "/magazine/marketing-tips-and-tricks",
        fashionStoreThemeRoutes,
        selected,
        "live",
      ),
    ).toBeUndefined();
  });

  test("resolves only Page and Article routes frozen into the selected Release", () => {
    const selected = release([
      {
        digest: "d".repeat(64),
        id: "page.story",
        kind: "page",
        payload: {
          sections: [{ id: "section.intro", kind: "paragraph", text: "Our story." }],
        },
        route: "/pages/our-story",
        slug: "our-story",
        title: "Our story",
        version: 1,
      },
      {
        digest: "e".repeat(64),
        id: "article.notes",
        kind: "article",
        payload: {
          sections: [{ id: "section.intro", kind: "paragraph", text: "Notes." }],
        },
        route: "/magazine/notes",
        slug: "notes",
        title: "Notes",
        version: 1,
      },
    ]);

    expect(themeRoutePaths(fashionStoreThemeRoutes, "live", selected)).toEqual(
      expect.arrayContaining(["/pages/our-story", "/magazine/notes"]),
    );
    expect(
      resolveThemeRoute("/pages/our-story", fashionStoreThemeRoutes, selected, "live"),
    ).toMatchObject({ family: "released-page", parameters: { slug: "our-story" } });
    expect(
      resolveThemeRoute("/magazine/missing", fashionStoreThemeRoutes, selected, "live"),
    ).toBeUndefined();
  });

  test("composes the frozen structured document for the resolved release route", () => {
    const selected = release([
      {
        digest: "f".repeat(64),
        id: "article.notes",
        kind: "article",
        payload: {
          sections: [
            { id: "section.heading", kind: "heading", level: 2, text: "Released heading" },
            { id: "section.body", kind: "paragraph", text: "Released body." },
          ],
          summary: "Frozen summary",
        },
        route: "/magazine/notes",
        slug: "notes",
        title: "Notes",
        version: 4,
      },
    ]);
    const route = resolveThemeRoute("/magazine/notes", fashionStoreThemeRoutes, selected, "live")!;
    const result = composeExperienceRoute({
      adapter: fashionStoreCompositionAdapter,
      experience: contentExperience,
      locale: "en-US",
      path: "/magazine/notes",
      release: selected,
      route,
    });

    expect(result.ok).toBe(true);
    expect(Object.values(result.viewModels)).toContainEqual(
      expect.objectContaining({
        kind: "released-content",
        sections: expect.arrayContaining([
          expect.objectContaining({ kind: "heading", text: "Released heading" }),
          expect.objectContaining({ kind: "paragraph", text: "Released body." }),
        ]),
        title: "Notes",
        version: 4,
      }),
    );
  });

  test("keeps frozen Contact merchant content alongside canonical public channels", () => {
    const selected = release([
      {
        digest: "1".repeat(64),
        id: "page.contact",
        kind: "page",
        payload: {
          sections: [{ id: "section.intro", kind: "paragraph", text: "Visit our studio." }],
          summary: "Talk with our team.",
        },
        route: "/contact",
        slug: "contact",
        title: "Contact our studio",
        version: 2,
      },
    ]);
    const route = resolveThemeRoute("/contact", fashionStoreThemeRoutes, selected, "live")!;
    const result = composeExperienceRoute({
      adapter: fashionStoreCompositionAdapter,
      experience: {
        ...contentExperience,
        contact: {
          publicContact: {
            locations: [],
            privacyEmail: null,
            publicPhone: null,
            serviceHours: null,
            socials: [],
            supportEmail: "help@example.test",
            timeZone: null,
          },
          version: "a".repeat(64),
        },
      },
      locale: "en-US",
      path: "/contact",
      release: selected,
      route,
    });

    expect(Object.values(result.viewModels)).toContainEqual(
      expect.objectContaining({
        kind: "released-content",
        publicContact: expect.objectContaining({ supportEmail: "help@example.test" }),
        title: "Contact our studio",
      }),
    );
  });
});
