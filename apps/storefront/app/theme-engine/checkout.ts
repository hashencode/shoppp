import type {
  Cart,
  CheckoutRequest,
  CheckoutSession,
  PublicRuntimeConfiguration,
  ShippingQuoteRequest,
} from "@shoppp/contracts";
import type { InjectionKey } from "vue";

export interface StorefrontCheckoutAdapter {
  begin(input: CheckoutRequest, turnstileToken?: string): Promise<CheckoutSession>;
  complete(session: CheckoutSession): void;
  configuration(): Promise<PublicRuntimeConfiguration>;
  ensure(): Promise<Cart>;
  shipping(input: ShippingQuoteRequest): Promise<Cart>;
  status(): { error: string | null; notice: string | null };
}

export const storefrontCheckoutAdapterKey = Symbol(
  "storefront-checkout-adapter",
) as InjectionKey<StorefrontCheckoutAdapter>;
