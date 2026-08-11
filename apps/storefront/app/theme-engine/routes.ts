import type { CanonicalCatalogRelease, PageTemplate } from "@shoppp/contracts";

export interface ThemeRouteContract {
  canonicalPath?: string;
  family?: "catalog-collection" | "catalog-product" | "exact";
  id: string;
  indexing?: "index" | "noindex";
  modes?: readonly ThemePresentationMode[];
  pageType: PageTemplate["pageType"];
  path: string;
  variant: string;
}

export type ThemePresentationMode = "fixture-preview" | "live";

export interface ResolvedThemeRouteContract extends ThemeRouteContract {
  parameters?: {
    collectionId?: string;
    productId?: string;
    slug: string;
  };
}

export function normalizeThemeRoutePath(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

export function staticThemeRoutePaths(routes: readonly ThemeRouteContract[]): string[] {
  return routes
    .filter(({ family }) => family === undefined || family === "exact")
    .map(({ path }) => path);
}

function availableInMode(route: ThemeRouteContract, mode?: ThemePresentationMode): boolean {
  return !mode || !route.modes || route.modes.includes(mode);
}

export function themeRoutePaths(
  routes: readonly ThemeRouteContract[],
  mode: ThemePresentationMode,
  release?: CanonicalCatalogRelease,
): string[] {
  const paths = routes
    .filter(
      (route) =>
        availableInMode(route, mode) && (route.family === undefined || route.family === "exact"),
    )
    .map(({ path }) => path);
  if (!release) return [...new Set(paths)];
  if (routes.some((route) => route.family === "catalog-product" && availableInMode(route, mode))) {
    paths.push(
      ...release.products
        .filter(
          ({ status, variants }) =>
            status === "published" && variants.some((variant) => variant.status === "active"),
        )
        .map(({ slug }) => `/products/${slug}`),
    );
  }
  if (
    routes.some((route) => route.family === "catalog-collection" && availableInMode(route, mode))
  ) {
    paths.push(
      ...release.collections
        .filter(({ status }) => status === "published")
        .map(({ slug }) => `/collections/${slug}`),
    );
  }
  return [...new Set(paths)];
}

export function resolveThemeRoute(
  path: string,
  routes: readonly ThemeRouteContract[],
  release?: CanonicalCatalogRelease,
  mode?: ThemePresentationMode,
): ResolvedThemeRouteContract | undefined {
  const normalized = normalizeThemeRoutePath(path);
  const exact = routes.find(
    (route) =>
      availableInMode(route, mode) &&
      (route.family === undefined || route.family === "exact") &&
      route.path === normalized,
  );
  if (exact) return exact;
  if (!release) return undefined;
  for (const route of routes) {
    if (!availableInMode(route, mode)) continue;
    if (route.family === "catalog-product" && normalized.startsWith("/products/")) {
      const slug = normalized.slice("/products/".length);
      const product = release.products.find(
        (entry) =>
          entry.slug === slug &&
          entry.status === "published" &&
          entry.variants.some(({ status }) => status === "active"),
      );
      if (product) return { ...route, parameters: { productId: product.id, slug } };
    }
    if (route.family === "catalog-collection" && normalized.startsWith("/collections/")) {
      const slug = normalized.slice("/collections/".length);
      const collection = release.collections.find(
        (entry) => entry.slug === slug && entry.status === "published",
      );
      if (collection) return { ...route, parameters: { collectionId: collection.id, slug } };
    }
  }
  return undefined;
}
