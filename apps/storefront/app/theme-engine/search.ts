import type { CanonicalCatalogRelease } from "@shoppp/contracts";
import type { InjectionKey } from "vue";

interface CatalogSearchIndexedEntry {
  href: string;
  id: string;
  kind: "collection" | "product";
  label: string;
  searchText: string;
}

export interface CatalogSearchIndex {
  entries: readonly CatalogSearchIndexedEntry[];
  releaseId: string;
}

export type CatalogSearchResult = Omit<CatalogSearchIndexedEntry, "searchText">;
export type CatalogSearchState =
  | { results: readonly []; status: "idle" | "loading" | "empty" | "unavailable" }
  | { results: readonly CatalogSearchResult[]; status: "results" };

function searchable(...parts: string[]): string {
  return parts.join(" ").normalize("NFKD").toLocaleLowerCase();
}

export function buildCatalogSearchIndex(release: CanonicalCatalogRelease): CatalogSearchIndex {
  const collections = release.collections
    .filter(({ status }) => status === "published")
    .map(
      ({ description, id, name, seoDescription, seoTitle, slug }): CatalogSearchIndexedEntry => ({
        href: `/collections/${slug}`,
        id,
        kind: "collection",
        label: name,
        searchText: searchable(name, description, seoTitle, seoDescription),
      }),
    );
  const products = release.products
    .filter(
      ({ status, variants }) =>
        status === "published" && variants.some((variant) => variant.status === "active"),
    )
    .map(
      ({ description, id, name, seoDescription, seoTitle, slug }): CatalogSearchIndexedEntry => ({
        href: `/products/${slug}`,
        id,
        kind: "product",
        label: name,
        searchText: searchable(name, description, seoTitle, seoDescription),
      }),
    );
  return Object.freeze({
    entries: Object.freeze([...collections, ...products]),
    releaseId: release.releaseId,
  });
}

export function searchCatalogIndex(
  index: CatalogSearchIndex,
  query: string,
  limit = 8,
): CatalogSearchResult[] {
  const terms = searchable(query).split(/\s+/).filter(Boolean);
  const normalizedLimit = Math.max(0, Math.floor(limit));
  if (terms.length === 0 || normalizedLimit === 0) return [];
  const results: CatalogSearchResult[] = [];
  for (const { searchText, ...result } of index.entries) {
    if (!terms.every((term) => searchText.includes(term))) continue;
    results.push(result);
    if (results.length === normalizedLimit) break;
  }
  return results;
}

export function resolveCatalogSearchState(
  index: CatalogSearchIndex | null,
  query: string,
): CatalogSearchState {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { results: [], status: "empty" };
  if (!index) return { results: [], status: "unavailable" };
  const results = searchCatalogIndex(index, normalizedQuery);
  return results.length > 0 ? { results, status: "results" } : { results: [], status: "empty" };
}

export const catalogSearchIndexKey = Symbol(
  "catalog-search-index",
) as InjectionKey<CatalogSearchIndex | null>;
