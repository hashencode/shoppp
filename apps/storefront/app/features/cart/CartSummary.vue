<script setup lang="ts">
import type { Cart } from "@shoppp/contracts";

withDefaults(defineProps<{ cart: Cart; disabled?: boolean; headingLevel?: "h1" | "h2" }>(), {
  headingLevel: "h2",
});
const emit = defineEmits<{
  remove: [variantId: string];
  update: [variantId: string, quantity: number];
}>();

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);
</script>

<template>
  <section aria-labelledby="cart-heading">
    <component :is="headingLevel" id="cart-heading">Your bag</component>
    <p v-if="cart.lines.length === 0">Your bag is ready for the next journey.</p>
    <ul v-else class="cart-lines">
      <li v-for="line in cart.lines" :key="line.variantId">
        <div>
          <p class="cart-item-title">{{ line.productName }}</p>
          <p>
            {{ line.variantName }} · {{ money(line.unitPrice.amount, line.unitPrice.currency) }}
          </p>
        </div>
        <label>
          Quantity
          <input
            :value="line.quantity"
            type="number"
            min="1"
            :max="Math.min(20, line.availableQuantity)"
            :disabled="disabled"
            @change="
              emit('update', line.variantId, Number(($event.target as HTMLInputElement).value))
            "
          />
        </label>
        <strong>{{ money(line.lineTotal.amount, line.lineTotal.currency) }}</strong>
        <button type="button" :disabled="disabled" @click="emit('remove', line.variantId)">
          Remove
        </button>
      </li>
    </ul>
    <dl class="totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{{ money(cart.totals.subtotal, cart.currency) }}</dd>
      </div>
      <div>
        <dt>Shipping</dt>
        <dd>{{ money(cart.totals.shippingTotal, cart.currency) }}</dd>
      </div>
      <div>
        <dt>Tax</dt>
        <dd>{{ money(cart.totals.taxTotal, cart.currency) }}</dd>
      </div>
      <div class="total">
        <dt>Total</dt>
        <dd>{{ money(cart.totals.grandTotal, cart.currency) }}</dd>
      </div>
    </dl>
  </section>
</template>
