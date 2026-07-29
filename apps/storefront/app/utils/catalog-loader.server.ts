import type { StorefrontCollectionPage, StorefrontProductPage } from "../types/catalog-release";

const productModules = import.meta.glob<{ default: StorefrontProductPage }>(
  "../generated/products/*.ts",
);
const collectionModules = import.meta.glob<{ default: StorefrontCollectionPage }>(
  "../generated/collections/*.ts",
);

async function loadPage<Page>(
  modules: Record<string, () => Promise<{ default: Page }>>,
  kind: "collections" | "products",
  slug: string,
): Promise<Page | undefined> {
  const load = modules[`../generated/${kind}/${slug}.ts`];
  return load ? (await load()).default : undefined;
}

export function loadProductPage(slug: string): Promise<StorefrontProductPage | undefined> {
  return loadPage(productModules, "products", slug);
}

export function loadCollectionPage(slug: string): Promise<StorefrontCollectionPage | undefined> {
  return loadPage(collectionModules, "collections", slug);
}
