<script setup lang="ts">
import type { OrderAccess } from "@shoppp/contracts";

import {
  orderAccessMessage,
  readOrderAccess,
  type StoredOrderAccess,
} from "~/features/checkout/session";

const api = useCommerceApi();
const stored = ref<StoredOrderAccess | null>(null);
const access = ref<OrderAccess | null>(null);
const loading = ref(true);
const message = computed(() =>
  access.value ? orderAccessMessage(access.value) : "Checking verified payment status",
);

useSeoMeta({ title: "Payment status | Shoppp", robots: "noindex, nofollow" });
useHead({ meta: [{ name: "referrer", content: "no-referrer" }] });

onMounted(async () => {
  stored.value = readOrderAccess();
  if (!stored.value) {
    loading.value = false;
    return;
  }
  for (const delay of [0, 700, 1_500, 3_000, 5_000]) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    try {
      access.value = (await api.getOrderAccess(stored.value.token)).data;
      if (access.value.status !== "pending") break;
    } catch {
      break;
    }
  }
  loading.value = false;
});
</script>

<template>
  <main class="commerce-shell status-page" aria-live="polite">
    <p class="eyebrow">Provider-verified status</p>
    <h1>{{ message }}</h1>
    <p v-if="loading">This page is waiting for the signed payment event.</p>
    <p v-else-if="!stored">
      This return URL cannot confirm payment. Use the secure order link from your checkout session.
    </p>
    <template v-else-if="access?.status === 'paid'">
      <p>Your order {{ access.order.publicReference }} is confirmed.</p>
      <NuxtLink class="cta" :to="`/orders/${stored.token}`">View order</NuxtLink>
    </template>
    <p v-else-if="access?.status === 'pending'">
      Stripe has not confirmed payment yet. Refresh this page in a moment.
    </p>
    <NuxtLink v-else class="cta" to="/cart">Return to bag</NuxtLink>
  </main>
</template>
