<script setup lang="ts">
import type { ShippingQuoteRequest } from "@shoppp/contracts";

import CartSummary from "~/features/cart/CartSummary.vue";
import CheckoutAddress from "~/features/checkout/address.vue";
import CheckoutShipping from "~/features/checkout/shipping.vue";
import { storeOrderAccess } from "~/features/checkout/session";
import { useGuestCart } from "~/features/cart/use-guest-cart";

const { beginCheckout, busy, cart, ensure, error, shipping } = useGuestCart();
const address = reactive<ShippingQuoteRequest["shippingAddress"]>({
  city: "",
  countryCode: "US",
  line1: "",
  name: "",
  postalCode: "",
  region: "",
});
const email = ref("");
const selectedMethod = ref<string>();
const termsAccepted = ref(false);

useSeoMeta({ title: "Checkout | Shoppp", robots: "noindex, nofollow" });
useHead({ meta: [{ name: "referrer", content: "no-referrer" }] });
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

const continueToPayment = async () => {
  if (!cart.value || !selectedMethod.value || !termsAccepted.value) return;
  const idempotencyKey = `checkout-${crypto.randomUUID()}`;
  const session = await beginCheckout({
    acceptTerms: true,
    cartId: cart.value.id,
    countryCode: address.countryCode,
    currency: cart.value.currency,
    email: email.value,
    idempotencyKey,
    shippingAddress: address,
    shippingMethodId: selectedMethod.value,
  });
  storeOrderAccess({ attemptId: session.attemptId, token: session.orderAccessToken });
  window.location.assign(session.checkoutUrl);
};
</script>

<template>
  <div class="commerce-shell checkout-grid">
    <form @submit.prevent="continueToPayment">
      <p class="eyebrow">Secure guest checkout</p>
      <h1>Where should it go?</h1>
      <p>Availability, price, and delivery are checked again before Stripe opens.</p>
      <label class="checkout-field">
        Email
        <input v-model="email" type="email" required autocomplete="email" />
      </label>
      <CheckoutAddress v-model="address" />
      <button class="secondary-button" type="button" :disabled="busy" @click="refreshQuote">
        Refresh delivery options
      </button>
      <CheckoutShipping
        v-if="cart"
        v-model="selectedMethod"
        :currency="cart.currency"
        :methods="cart.shippingMethods"
        @change="refreshQuote"
      />
      <label class="policy-consent">
        <input v-model="termsAccepted" type="checkbox" required />
        <span>
          I agree to the <NuxtLink to="/policies/terms">terms</NuxtLink> and
          <NuxtLink to="/policies/returns">returns policy</NuxtLink>.
        </span>
      </label>
      <button
        class="buy-button"
        type="submit"
        :disabled="busy || !cart?.canCheckout || !selectedMethod || !termsAccepted"
      >
        Continue to secure payment
      </button>
      <p class="payment-note">
        Payment is completed on Stripe. Returning here cannot approve an order.
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </form>
    <aside v-if="cart" aria-label="Order quote">
      <CartSummary :cart="cart" :disabled="true" />
    </aside>
  </div>
</template>
