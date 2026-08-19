<script setup lang="ts">
import type { OrderAccess } from "@shoppp/contracts";

import {
  checkoutReturnCartRefreshKey,
  markPaymentReturnVisit,
  PAYMENT_RETURN_POLL_DELAYS_MS,
  readOrderAccess,
  resolvePaymentReturnState,
  type PaymentReturnState,
  type StoredOrderAccess,
} from "~/features/checkout/session";
import { catalogRelease } from "~/generated/catalog";
import { canonicalUrl } from "~/utils/seo";

const api = useCommerceApi();
const route = useRoute();
const refreshAuthoritativeCart = inject(checkoutReturnCartRefreshKey, undefined);
const stored = ref<StoredOrderAccess | null>(null);
const access = ref<OrderAccess | null>(null);
const loading = ref(true);
const paymentState = ref<PaymentReturnState | null>(null);
const duplicateReturn = ref(false);
const heading = ref<HTMLElement | null>(null);
const cartRefreshFailed = ref(false);
let disposed = false;
let runVersion = 0;
let cancelDelay: (() => void) | undefined;
const returnIntent = computed<"canceled" | "success">(() =>
  route.query.return === "canceled" ? "canceled" : "success",
);
const message = computed(() => {
  if (loading.value || !paymentState.value) return "Checking verified payment status";
  const labels: Record<PaymentReturnState["kind"], string> = {
    canceled: "Payment was not confirmed",
    confirmed: "Payment confirmed",
    duplicate:
      access.value?.status === "paid"
        ? "Order already confirmed"
        : "Payment return already received",
    expired: "Payment session expired",
    failed: "Payment was not completed",
    invalid: "Payment status is unavailable",
    pending: "Payment confirmation is pending",
    retry: "Payment status could not be checked",
  };
  return labels[paymentState.value.kind];
});

useSeoMeta({ title: "Payment status | Shoppp", robots: "noindex, nofollow" });
useHead({
  link: [
    {
      rel: "canonical",
      href: canonicalUrl(catalogRelease.site.origin, "/checkout/complete"),
    },
  ],
  meta: [{ name: "referrer", content: "no-referrer" }],
});

async function focusResult(): Promise<void> {
  await nextTick();
  heading.value?.focus();
}

function waitForPollDelay(delay: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cancelDelay = undefined;
      resolve();
    }, delay);
    cancelDelay = () => {
      window.clearTimeout(timer);
      cancelDelay = undefined;
      resolve();
    };
  });
}

async function checkPaymentStatus(): Promise<void> {
  const currentRun = ++runVersion;
  cancelDelay?.();
  const isCurrent = () => !disposed && runVersion === currentRun;
  loading.value = true;
  paymentState.value = null;
  cartRefreshFailed.value = false;
  if (!stored.value) {
    paymentState.value = resolvePaymentReturnState({});
    loading.value = false;
    await focusResult();
    return;
  }
  const delays = returnIntent.value === "canceled" ? ([0] as const) : PAYMENT_RETURN_POLL_DELAYS_MS;
  let requestFailed = false;
  for (const delay of delays) {
    if (delay) await waitForPollDelay(delay);
    if (!isCurrent()) return;
    try {
      const nextAccess = (await api.getOrderAccess(stored.value.token)).data;
      if (!isCurrent()) return;
      access.value = nextAccess;
      if (access.value.status !== "pending") break;
    } catch {
      if (!isCurrent()) return;
      requestFailed = true;
      break;
    }
  }
  if (!isCurrent()) return;
  paymentState.value = resolvePaymentReturnState({
    ...(access.value ? { access: access.value } : {}),
    duplicateReturn: duplicateReturn.value,
    requestFailed,
    returnIntent: returnIntent.value,
  });
  if (paymentState.value.cartDisposition === "refresh" && refreshAuthoritativeCart) {
    try {
      await refreshAuthoritativeCart();
    } catch {
      if (!isCurrent()) return;
      cartRefreshFailed.value = true;
    }
  }
  if (!isCurrent()) return;
  loading.value = false;
  await focusResult();
}

onMounted(async () => {
  stored.value = readOrderAccess();
  if (stored.value) duplicateReturn.value = markPaymentReturnVisit(stored.value.attemptId);
  await checkPaymentStatus();
});

onBeforeUnmount(() => {
  disposed = true;
  runVersion += 1;
  cancelDelay?.();
});
</script>

<template>
  <main id="storefront-checkout-status-main" class="commerce-shell status-page">
    <p class="eyebrow">Provider-verified status</p>
    <section role="status" aria-live="polite" aria-atomic="true">
      <h1 ref="heading" tabindex="-1">{{ message }}</h1>
      <p v-if="loading">This page is waiting for the signed payment event.</p>
      <template v-else-if="paymentState">
        <p>{{ paymentState.announcement }}</p>
        <p v-if="cartRefreshFailed">
          Your order is confirmed, but the bag could not be refreshed. The order page remains
          authoritative.
        </p>
        <p v-if="access?.status === 'paid'">Order reference: {{ access.order.publicReference }}.</p>
      </template>
    </section>

    <NuxtLink
      v-if="stored && access?.status === 'paid'"
      class="cta"
      :to="`/orders/${stored.token}`"
    >
      View order
    </NuxtLink>
    <button
      v-if="
        !loading &&
        (paymentState?.kind === 'pending' ||
          paymentState?.kind === 'retry' ||
          (paymentState?.kind === 'duplicate' && access?.status === 'pending'))
      "
      type="button"
      class="cta"
      @click="checkPaymentStatus"
    >
      Retry status check
    </button>
    <NuxtLink v-if="!loading && (!access || access.status !== 'paid')" class="cta" to="/cart">
      Return to bag
    </NuxtLink>
  </main>
</template>
