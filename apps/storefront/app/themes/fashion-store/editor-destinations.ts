import type { CanonicalCatalogRelease, StorefrontResourceReference } from "@shoppp/contracts";

import { fashionStorePageContracts } from "./page-contracts";

export function fashionStoreEditorDestinations(release: CanonicalCatalogRelease) {
  const routeDestinations = fashionStorePageContracts
    .filter(({ id }) => id !== "product" && id !== "collection")
    .map(({ id, path, variant }) => ({
      id:
        id === "article" ? "article.marketing-tips-and-tricks" : `page.${id.replaceAll("-", ".")}`,
      kind: id === "article" ? ("article" as const) : ("page" as const),
      name: variant.replaceAll("-", " "),
      path,
    }));
  return [
    ...routeDestinations,
    ...release.policies.map(({ slug, title }) => ({
      id: `policy.${slug}`,
      kind: "policy" as const,
      name: title,
      path: `/policies/${slug}`,
    })),
  ];
}

export function fashionStoreReferenceHref(
  release: CanonicalCatalogRelease,
  reference: StorefrontResourceReference,
): string | undefined {
  if (reference.kind === "product") {
    const product = release.products.find(({ id }) => id === reference.id);
    return product ? `/products/${product.slug}` : undefined;
  }
  if (reference.kind === "collection") {
    const collection = release.collections.find(({ id }) => id === reference.id);
    return collection ? `/collections/${collection.slug}` : undefined;
  }
  return fashionStoreEditorDestinations(release).find(
    ({ id, kind }) => id === reference.id && kind === reference.kind,
  )?.path;
}
