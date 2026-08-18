import type { DeepReadonly, InjectionKey, Ref } from "vue";

export interface StorefrontMoney {
  amount: number;
  currency: string;
}

export interface StorefrontShippingAddress {
  city: string;
  countryCode: string;
  line1: string;
  line2?: string;
  name: string;
  phone?: string;
  postalCode: string;
  region?: string;
}

export interface StorefrontCart {
  adjustments: readonly { message: string }[];
  canCheckout: boolean;
  currency: string;
  id: string;
  lines: readonly {
    lineTotal: StorefrontMoney;
    productName: string;
    quantity: number;
    unitPrice: StorefrontMoney;
    variantId: string;
    variantName: string;
  }[];
  selectedShippingMethodId: string | null;
  shippingAddress: StorefrontShippingAddress | null;
  shippingMethods: readonly {
    amount: number;
    currency: string;
    id: string;
    name: string;
  }[];
  totals: {
    grandTotal: number;
    subtotal: number;
    taxTotal: number;
  };
}
export type StorefrontCartState = DeepReadonly<Ref<StorefrontCart | null>>;

export const storefrontCartStateKey = Symbol(
  "storefront-cart-state",
) as InjectionKey<StorefrontCartState>;
