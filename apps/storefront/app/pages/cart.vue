<script setup lang="ts">
import CartSummary from "~/features/cart/CartSummary.vue";
import { useGuestCart } from "~/features/cart/use-guest-cart";

const { acknowledge, busy, cart, ensure, error, remove, update } = useGuestCart();

useSeoMeta({ title: "Your bag | Shoppp", robots: "noindex, nofollow" });
onMounted(() => ensure().catch(() => undefined));
</script>

<template>
  <div class="commerce-shell">
    <p class="eyebrow">Guest cart · saved on this device</p>
    <p v-if="busy && !cart" role="status">Loading your bag…</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <template v-if="cart">
      <CartSummary
        :cart="cart"
        :disabled="busy"
        heading-level="h1"
        @remove="(variantId) => remove(variantId)"
        @update="(variantId, quantity) => update(variantId, { quantity })"
      />
      <section v-if="cart.adjustments.length" class="adjustments" aria-labelledby="adjustments">
        <h2 id="adjustments">Review changes</h2>
        <p v-for="item in cart.adjustments" :key="item.key">{{ item.message }}</p>
        <button
          v-if="cart.adjustments.some((item) => item.requiresAcknowledgement)"
          type="button"
          :disabled="busy"
          @click="
            acknowledge(
              cart.adjustments
                .filter((item) => item.requiresAcknowledgement)
                .map((item) => item.key),
            )
          "
        >
          Accept current prices
        </button>
      </section>
      <NuxtLink v-if="cart.lines.length > 0" class="cta" to="/checkout">
        Check delivery options
      </NuxtLink>
    </template>
  </div>
</template>
