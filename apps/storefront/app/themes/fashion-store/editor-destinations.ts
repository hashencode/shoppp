import type {
  CanonicalCatalogRelease,
  CatalogReleaseV3,
  StorefrontResourceReference,
} from "@shoppp/contracts";

type StorefrontCatalogRelease = CanonicalCatalogRelease | CatalogReleaseV3;

import { fashionStorePageContracts } from "./page-contracts";

export function fashionStoreEditorDestinations(release: StorefrontCatalogRelease) {
  const releasedContent =
    release.schemaVersion === 3
      ? release.content
          .filter(({ kind }) => kind === "article" || kind === "page")
          .map(({ id, kind, route, title }) => ({ id, kind, name: title, path: route }))
      : [];
  const fixedSystemDestinations = fashionStorePageContracts
    .filter(({ id }) => id !== "product" && id !== "collection")
    .filter(({ id }) => !["about", "article", "contact", "faq", "magazine"].includes(id))
    .map(({ id, path, variant }) => ({
      id: `page.${id.replaceAll("-", ".")}`,
      kind: "page" as const,
      name: variant.replaceAll("-", " "),
      path,
    }));
  return [
    ...(release.schemaVersion === 3
      ? [...fixedSystemDestinations, ...releasedContent]
      : fashionStorePageContracts
          .filter(({ id }) => id !== "product" && id !== "collection")
          .map(({ id, path, variant }) => ({
            id:
              id === "article"
                ? "article.marketing-tips-and-tricks"
                : `page.${id.replaceAll("-", ".")}`,
            kind: id === "article" ? ("article" as const) : ("page" as const),
            name: variant.replaceAll("-", " "),
            path,
          }))),
    ...release.policies.map(({ slug, title }) => ({
      id: `policy.${slug}`,
      kind: "policy" as const,
      name: title,
      path: `/policies/${slug}`,
    })),
  ];
}

export function fashionStoreReferenceHref(
  release: StorefrontCatalogRelease,
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
