<script setup lang="ts">
import type { OrderAccess } from "@shoppp/contracts";

import { orderAccessMessage } from "~/features/checkout/session";

const route = useRoute();
const api = useCommerceApi();
const access = ref<OrderAccess | null>(null);
const error = ref<string | null>(null);
const token = computed(() => String(route.params.token ?? ""));
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);

useSeoMeta({ title: "Your order | Shoppp", robots: "noindex, nofollow" });
useHead({ meta: [{ name: "referrer", content: "no-referrer" }] });
onMounted(async () => {
  try {
    access.value = (await api.getOrderAccess(token.value)).data;
  } catch {
    error.value = "This secure order link is invalid or expired.";
  }
});
</script>

<template>
  <main class="commerce-shell order-page" aria-live="polite">
    <p class="eyebrow">Secure guest order</p>
    <h1 v-if="access">{{ orderAccessMessage(access) }}</h1>
    <h1 v-else>Loading order</h1>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <template v-else-if="access?.status === 'paid'">
      <p>Order {{ access.order.publicReference }} · {{ access.order.email }}</p>
      <ul class="order-lines">
        <li v-for="line in access.order.lines" :key="line.sku">
          <span>{{ line.productName }} · {{ line.variantName }} × {{ line.quantity }}</span>
          <strong>{{ money(line.lineTotalAmount, line.currency) }}</strong>
        </li>
      </ul>
      <dl class="totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{{ money(access.order.totals.subtotal, access.order.currency) }}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>{{ money(access.order.totals.shippingTotal, access.order.currency) }}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{{ money(access.order.totals.taxTotal, access.order.currency) }}</dd>
        </div>
        <div class="total">
          <dt>Total</dt>
          <dd>{{ money(access.order.totals.grandTotal, access.order.currency) }}</dd>
        </div>
      </dl>
      <section>
        <h2>Shipping to</h2>
        <address>
          {{ access.order.shippingAddress.name }}<br />
          {{ access.order.shippingAddress.line1 }}<br />
          {{ access.order.shippingAddress.city }}, {{ access.order.shippingAddress.region }}
          {{ access.order.shippingAddress.postalCode }}<br />
          {{ access.order.shippingAddress.countryCode }}
        </address>
      </section>
    </template>
  </main>
</template>
