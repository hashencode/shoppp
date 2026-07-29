<script setup lang="ts">
import type { ShippingQuoteRequest } from "@shoppp/contracts";

import CartSummary from "~/features/cart/CartSummary.vue";
import CheckoutAddress from "~/features/checkout/address.vue";
import CheckoutShipping from "~/features/checkout/shipping.vue";
import { useGuestCart } from "~/features/cart/use-guest-cart";

const { busy, cart, ensure, error, shipping } = useGuestCart();
const address = reactive<ShippingQuoteRequest["shippingAddress"]>({
  city: "",
  countryCode: "US",
  line1: "",
  name: "",
  postalCode: "",
  region: "",
});
const selectedMethod = ref<string>();

useSeoMeta({ title: "Delivery | Shoppp", robots: "noindex, nofollow" });
onMounted(async () => {
  const current = await ensure().catch(() => null);
  if (current?.shippingAddress) Object.assign(address, current.shippingAddress);
  selectedMethod.value = current?.selectedShippingMethodId ?? undefined;
});

const refreshQuote = async () => {
  const quote = await shipping({
    shippingAddress: address,
    ...(selectedMethod.value ? { shippingMethodId: selectedMethod.value } : {}),
  });
  if (!selectedMethod.value && quote.shippingMethods[0]) {
    selectedMethod.value = quote.shippingMethods[0].id;
    await shipping({ shippingAddress: address, shippingMethodId: selectedMethod.value });
  }
};
</script>

<template>
  <div class="commerce-shell checkout-grid">
    <form @submit.prevent="refreshQuote">
      <p class="eyebrow">Authoritative delivery quote</p>
      <h1>Where should it go?</h1>
      <p>Availability, price, and delivery are checked by the commerce API.</p>
      <CheckoutAddress v-model="address" />
      <button class="buy-button" type="submit" :disabled="busy">Get delivery options</button>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </form>
    <aside v-if="cart" aria-label="Order quote">
      <CheckoutShipping
        v-model="selectedMethod"
        :currency="cart.currency"
        :methods="cart.shippingMethods"
        @change="refreshQuote"
      />
      <CartSummary :cart="cart" :disabled="true" />
    </aside>
  </div>
</template>
