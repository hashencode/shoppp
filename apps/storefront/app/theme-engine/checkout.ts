import type { InjectionKey } from "vue";

import type { StorefrontCart, StorefrontShippingAddress } from "./cart-state";

export interface StorefrontCheckoutRequest {
  acceptTerms: true;
  cartId: string;
  countryCode: string;
  currency: string;
  email: string;
  idempotencyKey: string;
  shippingAddress: StorefrontShippingAddress;
  shippingMethodId: string;
}

export interface StorefrontCheckoutSession {
  attemptId: string;
  checkoutUrl: string;
  orderAccessToken: string;
}

export interface StorefrontRuntimeConfiguration {
  turnstile: { required: boolean; siteKey: string | null };
}

export interface StorefrontShippingMethodQuote {
  amount: number;
  currency: string;
  estimatedDaysMax?: number;
  estimatedDaysMin?: number;
  id: string;
  name: string;
}

export interface StorefrontShippingQuoteRequest {
  shippingAddress: StorefrontShippingAddress;
  shippingMethodId?: string;
}

export interface StorefrontCheckoutAdapter {
  begin(
    input: StorefrontCheckoutRequest,
    turnstileToken?: string,
  ): Promise<StorefrontCheckoutSession>;
  complete(session: StorefrontCheckoutSession): void;
  configuration(): Promise<StorefrontRuntimeConfiguration>;
  ensure(): Promise<StorefrontCart>;
  shipping(input: StorefrontShippingQuoteRequest): Promise<StorefrontCart>;
  status(): { error: string | null; notice: string | null };
}

export const storefrontCheckoutAdapterKey = Symbol(
  "storefront-checkout-adapter",
) as InjectionKey<StorefrontCheckoutAdapter>;
