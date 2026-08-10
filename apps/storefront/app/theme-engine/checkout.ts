import type {
  Cart,
  CheckoutRequest,
  CheckoutSession,
  PublicRuntimeConfiguration,
  ShippingQuoteRequest,
} from "@shoppp/contracts";
import type { InjectionKey } from "vue";

export interface PreviewCheckoutAdapter {
  begin(input: CheckoutRequest, turnstileToken?: string): Promise<CheckoutSession>;
  complete(session: CheckoutSession): void;
  configuration(): Promise<PublicRuntimeConfiguration>;
  ensure(): Promise<Cart>;
  shipping(input: ShippingQuoteRequest): Promise<Cart>;
}

export const previewCheckoutAdapterKey = Symbol(
  "preview-checkout-adapter",
) as InjectionKey<PreviewCheckoutAdapter>;
