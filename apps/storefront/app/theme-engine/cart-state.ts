import type { Cart } from "@shoppp/contracts";
import type { DeepReadonly, InjectionKey, Ref } from "vue";

export type StorefrontCartState = DeepReadonly<Ref<Cart | null>>;

export const storefrontCartStateKey = Symbol(
  "storefront-cart-state",
) as InjectionKey<StorefrontCartState>;
