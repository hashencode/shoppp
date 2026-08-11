import type {
  AddCartLineRequest,
  Cart,
  CheckoutRequest,
  ShippingQuoteRequest,
  UpdateCartLineRequest,
} from "@shoppp/contracts";

const TOKEN_KEY = "shoppp.guest-cart-token";

export class GuestCartCurrencyMismatchError extends Error {
  constructor(currentCurrency: string, requestedCurrency: string) {
    super(
      `Your cart uses ${currentCurrency}, but this storefront is using ${requestedCurrency}. Complete or clear the current cart before changing currency.`,
    );
    this.name = "GuestCartCurrencyMismatchError";
  }
}

export function assertGuestCartCurrency(cart: Cart, requestedCurrency: string): void {
  if (cart.currency !== requestedCurrency) {
    throw new GuestCartCurrencyMismatchError(cart.currency, requestedCurrency);
  }
}

export function guestCartErrorMessage(error: unknown): string {
  if (error instanceof GuestCartCurrencyMismatchError) return error.message;
  if (typeof error === "object" && error && "name" in error && error.name === "TimeoutError") {
    return "Commerce is taking too long to respond. Your cart is unchanged; try again.";
  }
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
  const notice = useState<string | null>("guest-cart-notice", () => null);
  const api = useCommerceApi();
  let ensureFlight: { currency: string; promise: Promise<Cart> } | undefined;

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
      error.value = guestCartErrorMessage(cause);
      throw cause;
    } finally {
      busy.value = false;
    }
  };
  const runEnsure = async (currency: string) => {
    const existingToken = token();
    let recoveredExpiredCart = false;
    if (existingToken) {
      try {
        const currentCart = await withCart((value) => api.getCart(value));
        assertGuestCartCurrency(currentCart, currency);
        return currentCart;
      } catch (cause) {
        if (!isTerminalCartError(cause)) {
          error.value = guestCartErrorMessage(cause);
          throw cause;
        }
        localStorage.removeItem(TOKEN_KEY);
        recoveredExpiredCart = true;
      }
    }
    busy.value = true;
    error.value = null;
    try {
      const response = await api.createCart({ currency });
      localStorage.setItem(TOKEN_KEY, response.data.token);
      cart.value = response.data.cart;
      notice.value = recoveredExpiredCart
        ? "Your previous cart expired. A new cart has been started."
        : null;
      return response.data.cart;
    } catch (cause) {
      error.value = guestCartErrorMessage(cause);
      throw cause;
    } finally {
      busy.value = false;
    }
  };
  const ensure = (currency = "USD"): Promise<Cart> => {
    if (ensureFlight?.currency === currency) return ensureFlight.promise;
    const promise = runEnsure(currency).finally(() => {
      if (ensureFlight?.promise === promise) ensureFlight = undefined;
    });
    ensureFlight = { currency, promise };
    return promise;
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
  const beginCheckout = async (input: CheckoutRequest, turnstileToken?: string) => {
    busy.value = true;
    error.value = null;
    try {
      const cartToken = token();
      if (!cartToken) throw new Error("Cart token unavailable");
      return (await api.createCheckoutSession(cartToken, input, turnstileToken)).data;
    } catch (cause) {
      error.value = guestCartErrorMessage(cause);
      throw cause;
    } finally {
      busy.value = false;
    }
  };

  return {
    acknowledge,
    add,
    beginCheckout,
    busy,
    cart,
    ensure,
    error,
    notice,
    remove,
    shipping,
    update,
  };
}
