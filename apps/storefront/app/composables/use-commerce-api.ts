import type { Product } from "@shoppp/contracts";

export const useCommerceApi = () => {
  const config = useRuntimeConfig();
  const getLiveProduct = (slug: string) =>
    $fetch<{ data: Product }>(`/catalog/products/${encodeURIComponent(slug)}/live`, {
      baseURL: config.public.apiBase,
    });
  return { getLiveProduct };
};
