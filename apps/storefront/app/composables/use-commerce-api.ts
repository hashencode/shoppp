import type {
  AddCartLineRequest,
  Cart,
  CreateCartRequest,
  Product,
  ShippingQuoteRequest,
  UpdateCartLineRequest,
} from "@shoppp/contracts";

interface ApiData<T> {
  data: T;
}

function mutationKey(scope: string): string {
  return `${scope}-${crypto.randomUUID()}`;
}

export const useCommerceApi = () => {
  const config = useRuntimeConfig();
  const api = <T>(path: string, options: Parameters<typeof $fetch<T>>[1] = {}) =>
    $fetch<T>(path, { baseURL: config.public.apiBase, ...options });
  const cartHeaders = (token: string, scope?: string) => ({
    Authorization: `CartToken ${token}`,
    ...(scope ? { "Idempotency-Key": mutationKey(scope) } : {}),
  });
  const getLiveProduct = (slug: string, currency: string) =>
    api<ApiData<Product>>(`/catalog/products/${encodeURIComponent(slug)}/live`, {
      query: { currency },
    });
  const createCart = (input: CreateCartRequest) =>
    api<ApiData<{ cart: Cart; token: string }>>("/cart", {
      body: input,
      headers: { "Idempotency-Key": mutationKey("cart-create") },
      method: "POST",
    });
  const getCart = (token: string) => api<ApiData<Cart>>("/cart", { headers: cartHeaders(token) });
  const addCartLine = (token: string, input: AddCartLineRequest) =>
    api<ApiData<Cart>>("/cart/lines", {
      body: input,
      headers: cartHeaders(token, "cart-add"),
      method: "POST",
    });
  const updateCartLine = (token: string, variantId: string, input: UpdateCartLineRequest) =>
    api<ApiData<Cart>>(`/cart/lines/${encodeURIComponent(variantId)}`, {
      body: input,
      headers: cartHeaders(token, "cart-update"),
      method: "PATCH",
    });
  const removeCartLine = (token: string, variantId: string) =>
    api<ApiData<Cart>>(`/cart/lines/${encodeURIComponent(variantId)}`, {
      headers: cartHeaders(token, "cart-remove"),
      method: "DELETE",
    });
  const acknowledgeCartAdjustments = (token: string, codes: string[]) =>
    api<ApiData<Cart>>("/cart/adjustments/acknowledge", {
      body: { codes },
      headers: cartHeaders(token, "cart-acknowledge"),
      method: "POST",
    });
  const quoteShipping = (token: string, input: ShippingQuoteRequest) =>
    api<ApiData<Cart>>("/cart/shipping", {
      body: input,
      headers: cartHeaders(token, "cart-shipping"),
      method: "PUT",
    });
  return {
    acknowledgeCartAdjustments,
    addCartLine,
    createCart,
    getCart,
    getLiveProduct,
    quoteShipping,
    removeCartLine,
    updateCartLine,
  };
};
