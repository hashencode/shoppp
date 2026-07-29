import type {
  AddCartLineRequest,
  Cart,
  ShippingQuoteRequest,
  UpdateCartLineRequest,
} from "@shoppp/contracts";

const TOKEN_KEY = "shoppp.guest-cart-token";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "data" in error) {
    const data = (error as { data?: { error?: { message?: string } } }).data;
    if (data?.error?.message) return data.error.message;
  }
  return "The cart could not be updated. Please try again.";
}

function isTerminalCartError(error: unknown): boolean {
  if (typeof error !== "object" || !error) return false;
  const response = error as {
    data?: { error?: { code?: string } };
    status?: number;
    statusCode?: number;
  };
  return (
    response.status === 401 ||
    response.statusCode === 401 ||
    response.data?.error?.code === "cart_expired" ||
    response.data?.error?.code === "cart_token_invalid"
  );
}

export function useGuestCart() {
  const cart = useState<Cart | null>("guest-cart", () => null);
  const busy = useState("guest-cart-busy", () => false);
  const error = useState<string | null>("guest-cart-error", () => null);
  const api = useCommerceApi();

  const token = () => (import.meta.client ? localStorage.getItem(TOKEN_KEY) : null);
  const withCart = async (operation: (cartToken: string) => Promise<{ data: Cart }>) => {
    busy.value = true;
    error.value = null;
    try {
      const cartToken = token();
      if (!cartToken) throw new Error("Cart token unavailable");
      const response = await operation(cartToken);
      cart.value = response.data;
      return response.data;
    } catch (cause) {
      error.value = errorMessage(cause);
      throw cause;
    } finally {
      busy.value = false;
    }
  };
  const ensure = async (currency = "USD") => {
    const existingToken = token();
    if (existingToken) {
      try {
        return await withCart((value) => api.getCart(value));
      } catch (cause) {
        if (!isTerminalCartError(cause)) throw cause;
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    busy.value = true;
    error.value = null;
    try {
      const response = await api.createCart({ currency });
      localStorage.setItem(TOKEN_KEY, response.data.token);
      cart.value = response.data.cart;
      return response.data.cart;
    } catch (cause) {
      error.value = errorMessage(cause);
      throw cause;
    } finally {
      busy.value = false;
    }
  };
  const add = async (input: AddCartLineRequest, currency: string) => {
    await ensure(currency);
    return withCart((value) => api.addCartLine(value, input));
  };
  const update = (variantId: string, input: UpdateCartLineRequest) =>
    withCart((value) => api.updateCartLine(value, variantId, input));
  const remove = (variantId: string) => withCart((value) => api.removeCartLine(value, variantId));
  const acknowledge = (codes: string[]) =>
    withCart((value) => api.acknowledgeCartAdjustments(value, codes));
  const shipping = (input: ShippingQuoteRequest) =>
    withCart((value) => api.quoteShipping(value, input));

  return { acknowledge, add, busy, cart, ensure, error, remove, shipping, update };
}
