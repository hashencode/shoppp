import type { CanonicalCatalogRelease, PageTemplate } from "@shoppp/contracts";

export interface ThemeRouteContract {
  family?: "catalog-collection" | "catalog-product" | "exact";
  id: string;
  pageType: PageTemplate["pageType"];
  path: string;
  variant: string;
}

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

export function resolveThemeRoute(
  path: string,
  routes: readonly ThemeRouteContract[],
  release?: CanonicalCatalogRelease,
): ResolvedThemeRouteContract | undefined {
  const normalized = normalizeThemeRoutePath(path);
  const exact = routes.find(
    (route) =>
      (route.family === undefined || route.family === "exact") && route.path === normalized,
  );
  if (exact) return exact;
  if (!release) return undefined;
  for (const route of routes) {
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
