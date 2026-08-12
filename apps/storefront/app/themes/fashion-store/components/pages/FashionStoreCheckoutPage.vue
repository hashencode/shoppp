<script setup lang="ts">
import type { Cart, ShippingMethodQuote, ShippingQuoteRequest } from "@shoppp/contracts";

import CheckoutAddress from "~/features/checkout/address.vue";
import TurnstileChallenge from "~/features/checkout/TurnstileChallenge.vue";
import { recordPreviewIntent } from "../../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { storefrontCheckoutAdapterKey } from "../../../../theme-engine/checkout";
import { storefrontCartStateKey } from "../../../../theme-engine/cart-state";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { formatCommerceMoney } from "../../../../theme-engine/runtime-commerce";
import type { FashionStoreCheckoutData } from "../../fixtures/pages/checkout";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const isLive = computed(() => properties.viewModel.kind === "checkout");
const initialFixtureData =
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as FashionStoreCheckoutData)
    : undefined;
const fixtureLinesByVariant = new Map(
  (initialFixtureData?.lines ?? []).map((line) => [line.variantId, line]),
);
const checkoutAdapter = inject(storefrontCheckoutAdapterKey);
const form = ref<HTMLFormElement>();
const ownerCart = inject(storefrontCartStateKey);
const localCart = ref<Cart | null>(null);
const cart = computed(() => ownerCart?.value ?? localCart.value);
const firstName = ref("");
const lastName = ref("");
const company = ref("");
const email = ref("");
const accountOpen = ref(false);
const accountUsername = ref("");
const accountPassword = ref("");
const alternateShippingOpen = ref(false);
const orderNotes = ref("");
const helperPanel = ref<"coupon" | "login" | null>(null);
const helperValue = ref("");
const helperInvalid = ref(false);
const selectedMethod = ref(initialFixtureData?.shipping[0]?.id);
const paymentOptions: FashionStoreCheckoutData["payment"] = initialFixtureData?.payment ?? [
  {
    detail: "You will continue to the platform's secure hosted payment page.",
    id: "hosted-payment",
    label: "Secure payment",
  },
];
const selectedPayment = ref(paymentOptions[0]?.id ?? "hosted-payment");
const countryOptions = initialFixtureData?.countries ?? [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
];
const termsAccepted = ref(false);
const submitting = ref(false);
const shippingBusy = ref(false);
const loadError = ref("");
const loadNotice = ref("");
const submitError = ref("");
const shippingError = ref("");
const securityConfigurationLoading = ref(true);
const securityConfigurationError = ref("");
const turnstileRequired = ref(true);
const turnstileSiteKey = ref("");
const turnstileToken = ref("");
const turnstileRenderKey = ref(0);
const localActionCount = ref(0);
const sessionCount = ref(0);
let disposed = false;
let shippingTimer: ReturnType<typeof setTimeout> | undefined;
let shippingSequence = 0;

const billingAddress = reactive<ShippingQuoteRequest["shippingAddress"]>({
  city: "",
  countryCode: "US",
  line1: "",
  line2: "",
  name: "",
  phone: "",
  postalCode: "",
  region: "",
});
const alternateAddress = reactive<ShippingQuoteRequest["shippingAddress"]>({
  city: "",
  countryCode: "US",
  line1: "",
  line2: "",
  name: "",
  phone: "",
  postalCode: "",
  region: "",
});

const activeShippingAddress = computed<ShippingQuoteRequest["shippingAddress"]>(() => {
  const address = alternateShippingOpen.value ? alternateAddress : billingAddress;
  return {
    ...address,
    name: alternateShippingOpen.value
      ? address.name.trim()
      : `${firstName.value} ${lastName.value}`.trim(),
  };
});
const shippingAddressComplete = computed(() => {
  const address = activeShippingAddress.value;
  return Boolean(
    address.name.trim() &&
    address.line1.trim() &&
    address.city.trim() &&
    address.countryCode &&
    address.postalCode.trim(),
  );
});
const shippingAddressFingerprint = computed(() => JSON.stringify(activeShippingAddress.value));
const cartContentsFingerprint = computed(() =>
  JSON.stringify(
    cart.value?.lines.map(({ quantity, unitPrice, variantId }) => ({
      quantity,
      unitPrice,
      variantId,
    })) ?? [],
  ),
);

const displayedLines = computed(() => {
  if (cart.value === null) return initialFixtureData?.lines ?? [];
  return cart.value.lines.map((line) => ({
    color: fixtureLinesByVariant.get(line.variantId)?.color ?? line.variantName,
    name: line.productName,
    quantity: line.quantity,
    total: money(line.lineTotal.amount, line.lineTotal.currency),
    variantId: line.variantId,
  }));
});
const displayedTotals = computed(() =>
  cart.value
    ? {
        subtotal: money(cart.value.totals.subtotal, cart.value.currency),
        tax: `(Includes ${money(cart.value.totals.taxTotal, cart.value.currency)} tax)`,
        total: money(cart.value.totals.grandTotal, cart.value.currency),
      }
    : (initialFixtureData?.totals ?? {
        subtotal: "$0.00",
        tax: "(Includes $0.00 tax)",
        total: "$0.00",
      }),
);
const shippingMethods = computed<ShippingMethodQuote[]>(() =>
  cart.value === null
    ? (initialFixtureData?.shipping ?? []).map((method) => ({
        amount: method.id === initialFixtureData?.shipping[1]?.id ? 1200 : 0,
        currency: "USD",
        estimatedDaysMax: 5,
        estimatedDaysMin: 3,
        id: method.id,
        name: method.label,
      }))
    : [...cart.value.shippingMethods],
);
watch(
  () => cart.value?.selectedShippingMethodId,
  (methodId) => {
    if (isLive.value) selectedMethod.value = methodId ?? undefined;
  },
  { immediate: true },
);

function money(amount: number, currency: string): string {
  return formatCommerceMoney(amount, currency);
}

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function applyCart(nextCart: Cart, hydrateAddress = false): void {
  if (!ownerCart) localCart.value = nextCart;
  if (hydrateAddress && nextCart.shippingAddress) {
    Object.assign(billingAddress, nextCart.shippingAddress);
    const nameParts = nextCart.shippingAddress.name.trim().split(/\s+/);
    firstName.value = nameParts.shift() ?? "";
    lastName.value = nameParts.join(" ");
  }
  selectedMethod.value = nextCart.selectedShippingMethodId ?? undefined;
}

function toggleHelper(panel: "coupon" | "login"): void {
  helperPanel.value = helperPanel.value === panel ? null : panel;
  helperInvalid.value = false;
  localActionCount.value += 1;
}

function validateHelper(): void {
  helperInvalid.value = helperValue.value.trim().length === 0;
  localActionCount.value += 1;
  if (helperInvalid.value) {
    void nextTick(() =>
      document.querySelector<HTMLInputElement>("#fashion-checkout-helper")?.focus(),
    );
  }
}

function toggleAccount(): void {
  accountOpen.value = !accountOpen.value;
  localActionCount.value += 1;
}

function toggleAlternateShipping(): void {
  alternateShippingOpen.value = !alternateShippingOpen.value;
  localActionCount.value += 1;
}

function selectPayment(id: string): void {
  selectedPayment.value = id;
  localActionCount.value += 1;
}

async function requestShipping(shippingMethodId?: string): Promise<void> {
  if (!isLive.value || !checkoutAdapter || !shippingAddressComplete.value) return;
  const sequence = ++shippingSequence;
  shippingBusy.value = true;
  shippingError.value = "";
  try {
    const nextCart = await checkoutAdapter.shipping({
      shippingAddress: { ...activeShippingAddress.value },
      ...(shippingMethodId ? { shippingMethodId } : {}),
    });
    if (sequence === shippingSequence) applyCart(nextCart);
  } catch {
    if (sequence === shippingSequence) {
      shippingError.value =
        checkoutAdapter.status().error ?? "Delivery options are unavailable. Please try again.";
    }
  } finally {
    if (sequence === shippingSequence) shippingBusy.value = false;
  }
}

function updateShipping(): void {
  if (shippingTimer) {
    clearTimeout(shippingTimer);
    shippingTimer = undefined;
  }
  shippingSequence += 1;
  void requestShipping(selectedMethod.value);
}

watch([shippingAddressFingerprint, cartContentsFingerprint], () => {
  if (!isLive.value) return;
  if (shippingTimer) {
    clearTimeout(shippingTimer);
    shippingTimer = undefined;
  }
  shippingSequence += 1;
  if (!shippingAddressComplete.value) {
    selectedMethod.value = undefined;
    shippingBusy.value = false;
    return;
  }
  shippingTimer = setTimeout(() => {
    shippingTimer = undefined;
    void requestShipping();
  }, 300);
});

async function continueCheckout(): Promise<void> {
  submitError.value = "";
  if (!form.value?.reportValidity()) return;
  if (!checkoutAdapter || !cart.value?.canCheckout) {
    submitError.value = "Checkout is unavailable for this cart.";
    return;
  }
  if (!selectedMethod.value) {
    submitError.value = "Choose a delivery option before continuing.";
    await nextTick();
    document.querySelector<HTMLInputElement>(".shipping-methods input")?.focus();
    return;
  }
  if (turnstileRequired.value && !turnstileToken.value) return;
  if (submitting.value) return;

  const address = alternateShippingOpen.value ? alternateAddress : billingAddress;
  billingAddress.name = `${firstName.value} ${lastName.value}`.trim();
  if (initialFixtureData) {
    recordPreviewIntent(initialFixtureData.action, "fashion-store.checkout.session");
  }
  submitting.value = true;
  try {
    const session = await checkoutAdapter.begin(
      {
        acceptTerms: true,
        cartId: cart.value.id,
        countryCode: address.countryCode,
        currency: cart.value.currency,
        email: email.value,
        idempotencyKey: `fashion-checkout-${crypto.randomUUID()}`,
        shippingAddress: {
          ...address,
          name: alternateShippingOpen.value ? address.name : billingAddress.name,
        },
        shippingMethodId: selectedMethod.value,
      },
      turnstileToken.value || undefined,
    );
    if (disposed) return;
    sessionCount.value += 1;
    checkoutAdapter.complete(session);
  } catch {
    submitError.value =
      checkoutAdapter.status().error ?? "Checkout could not continue. Please try again.";
    turnstileToken.value = "";
    turnstileRenderKey.value += 1;
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  if (!checkoutAdapter) {
    loadError.value = "Checkout is unavailable for this cart.";
    securityConfigurationLoading.value = false;
    return;
  }
  const [cartResult, configurationResult] = await Promise.allSettled([
    checkoutAdapter.ensure(),
    checkoutAdapter.configuration(),
  ]);
  if (cartResult.status === "fulfilled") {
    applyCart(cartResult.value, true);
    loadNotice.value = checkoutAdapter.status().notice ?? "";
  } else {
    loadError.value = checkoutAdapter.status().error ?? "Checkout is unavailable for this cart.";
  }

  if (configurationResult.status === "fulfilled") {
    turnstileRequired.value = configurationResult.value.turnstile.required;
    turnstileSiteKey.value = configurationResult.value.turnstile.siteKey ?? "";
    if (turnstileRequired.value && !turnstileSiteKey.value) {
      securityConfigurationError.value =
        "Checkout security is not configured. Please try again later.";
    }
  } else {
    securityConfigurationError.value =
      "Checkout security could not be verified. Refresh the page before continuing.";
  }
  securityConfigurationLoading.value = false;
});

onBeforeUnmount(() => {
  disposed = true;
  if (shippingTimer) clearTimeout(shippingTimer);
  shippingSequence += 1;
});
</script>

<template>
  <FashionStoreShell
    :announcement="initialFixtureData?.announcement ?? 'Checkout totals are verified by Commerce.'"
    body-class=""
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-checkout
      :data-runtime-status="loadError ? 'error' : cart ? 'ready' : 'loading'"
      :data-local-action-count="localActionCount"
      :data-session-count="sessionCount"
    >
      <section class="top-space-margin half-section bg-gradient-very-light-gray">
        <div class="container">
          <div class="row align-items-center justify-content-center">
            <div
              class="col-12 col-xl-8 col-lg-10 text-center position-relative page-title-extra-large"
            >
              <h1 class="alt-font fw-600 text-dark-gray mb-10px">Checkout</h1>
            </div>
            <nav
              class="col-12 breadcrumb breadcrumb-style-01 d-flex justify-content-center"
              aria-label="Breadcrumb"
            >
              <ul>
                <li><a :href="fashionStoreRoutePaths.home" data-fashion-store-route>Home</a></li>
                {{
                  " "
                }}
                <li>Checkout</li>
              </ul>
            </nav>
          </div>
        </div>
      </section>

      <section class="pt-0 fashion-checkout-body">
        <div class="container">
          <div
            class="row justify-content-center mb-8 lg-mb-10 align-items-center fashion-checkout-helpers"
          >
            <div class="col-auto icon-with-text-style-08 lg-mb-10px">
              <div class="feature-box feature-box-left-icon">
                <div class="feature-box-icon me-5px">
                  <i
                    class="feather icon-feather-user top-9px position-relative text-dark-gray icon-small"
                  ></i>
                </div>
                <div class="feature-box-content">
                  <span class="d-inline-block text-dark-gray align-middle alt-font fw-500"
                    >Returning customer?
                    <a
                      href="#"
                      class="text-decoration-line-bottom fw-600 text-dark-gray"
                      :aria-expanded="helperPanel === 'login'"
                      @click.prevent="toggleHelper('login')"
                      >Click here to login</a
                    ></span
                  >
                </div>
              </div>
            </div>
            <div class="col-auto d-none d-lg-inline-block">
              <span class="w-1px h-20px bg-extra-medium-gray d-block"></span>
            </div>
            <div class="col-auto icon-with-text-style-08">
              <div class="feature-box feature-box-left-icon">
                <div class="feature-box-icon me-5px">
                  <i
                    class="feather icon-feather-scissors top-9px position-relative text-dark-gray icon-small"
                  ></i>
                </div>
                <div class="feature-box-content">
                  <span class="d-inline-block text-dark-gray align-middle alt-font fw-500"
                    >Have a coupon?
                    <a
                      href="#"
                      class="text-decoration-line-bottom fw-600 text-dark-gray"
                      :aria-expanded="helperPanel === 'coupon'"
                      @click.prevent="toggleHelper('coupon')"
                      >Click here to enter your code</a
                    ></span
                  >
                </div>
              </div>
            </div>
            <div v-if="helperPanel" class="col-12 fashion-checkout-helper-panel mt-20px">
              <label class="visually-hidden" for="fashion-checkout-helper">{{
                helperPanel === "login" ? "Account email" : "Coupon code"
              }}</label>
              <input
                id="fashion-checkout-helper"
                v-model="helperValue"
                class="border-radius-4px input-small"
                :aria-invalid="helperInvalid"
                :type="helperPanel === 'login' ? 'email' : 'text'"
              />
              <button
                type="button"
                class="btn btn-dark-gray btn-small btn-round-edge"
                @click="validateHelper"
              >
                Apply
              </button>
            </div>
          </div>

          <form ref="form" class="row align-items-start" @submit.prevent="continueCheckout">
            <div class="col-lg-7 pe-50px md-pe-15px md-mb-50px xs-mb-35px fashion-checkout-billing">
              <span class="fs-26 alt-font fw-600 text-dark-gray mb-20px d-block"
                >Billing details</span
              >
              <div class="row">
                <div class="col-md-6 mb-20px">
                  <label class="mb-10px" for="fashion-first-name"
                    >First name <span class="text-red">*</span></label
                  >
                  <input
                    id="fashion-first-name"
                    v-model="firstName"
                    class="border-radius-4px input-small"
                    type="text"
                    required
                    autocomplete="given-name"
                  />
                </div>
                <div class="col-md-6 mb-20px">
                  <label class="mb-10px" for="fashion-last-name"
                    >Last name <span class="text-red">*</span></label
                  >
                  <input
                    id="fashion-last-name"
                    v-model="lastName"
                    class="border-radius-4px input-small"
                    type="text"
                    required
                    autocomplete="family-name"
                  />
                </div>
                <div class="col-12 mb-20px">
                  <label class="mb-10px" for="fashion-company">Company name (optional)</label>
                  <input
                    id="fashion-company"
                    v-model="company"
                    class="border-radius-4px input-small"
                    type="text"
                    autocomplete="organization"
                  />
                </div>
                <div class="col-12 mb-20px">
                  <label class="mb-10px" for="fashion-country"
                    >Country <span class="text-red">*</span></label
                  >
                  <select
                    id="fashion-country"
                    v-model="billingAddress.countryCode"
                    class="form-select select-small"
                    required
                    autocomplete="country"
                  >
                    <option value="">Select a country</option>
                    <option
                      v-for="country in countryOptions"
                      :key="country.code"
                      :value="country.code"
                    >
                      {{ country.label }}
                    </option>
                  </select>
                </div>
                <div class="col-12 mb-20px">
                  <label class="mb-10px" for="fashion-address"
                    >Street address <span class="text-red">*</span></label
                  >
                  <input
                    id="fashion-address"
                    v-model="billingAddress.line1"
                    class="border-radius-4px input-small mb-20px"
                    type="text"
                    required
                    autocomplete="shipping address-line1"
                    placeholder="House number and street name"
                  />
                  <input
                    v-model="billingAddress.line2"
                    class="border-radius-4px input-small"
                    type="text"
                    autocomplete="shipping address-line2"
                    placeholder="Apartment,suite,unit etc. (optional)"
                  />
                </div>
                <div class="col-12 mb-20px">
                  <label class="mb-10px" for="fashion-city"
                    >Town / City <span class="text-red">*</span></label
                  >
                  <input
                    id="fashion-city"
                    v-model="billingAddress.city"
                    class="border-radius-4px input-small"
                    type="text"
                    required
                    autocomplete="shipping address-level2"
                  />
                </div>
                <div class="col-12 mb-20px">
                  <label class="mb-10px" for="fashion-state"
                    >State <span class="text-red">*</span></label
                  >
                  <select
                    id="fashion-state"
                    v-model="billingAddress.region"
                    class="form-select select-small border-radius-4px"
                    required
                    autocomplete="shipping address-level1"
                  >
                    <option value="">Select a state</option>
                    <option value="CA">California</option>
                    <option value="NY">New York</option>
                    <option value="TX">Texas</option>
                  </select>
                </div>
                <div class="col-12 mb-20px">
                  <label class="mb-10px" for="fashion-postal"
                    >ZIP <span class="text-red">*</span></label
                  >
                  <input
                    id="fashion-postal"
                    v-model="billingAddress.postalCode"
                    class="border-radius-4px input-small"
                    type="text"
                    required
                    autocomplete="shipping postal-code"
                  />
                </div>
                <div class="col-12 mb-20px">
                  <label class="mb-10px" for="fashion-phone"
                    >Phone <span class="text-red">*</span></label
                  >
                  <input
                    id="fashion-phone"
                    v-model="billingAddress.phone"
                    class="border-radius-4px input-small"
                    type="tel"
                    required
                    autocomplete="tel"
                  />
                </div>
                <div class="col-12 mb-20px">
                  <label class="mb-10px" for="fashion-email"
                    >Email address <span class="text-red">*</span></label
                  >
                  <input
                    id="fashion-email"
                    v-model="email"
                    class="border-radius-4px input-small"
                    type="email"
                    required
                    autocomplete="email"
                  />
                </div>

                <div v-if="!isLive" class="col-md-12 mb-5px checkout-accordion">
                  <div
                    class="position-relative terms-condition-box text-start d-flex align-items-center"
                  >
                    <label>
                      <input
                        id="fashion-create-account"
                        :checked="accountOpen"
                        type="checkbox"
                        class="check-box align-middle"
                        @change="toggleAccount"
                      />
                      <span
                        class="box"
                        role="checkbox"
                        tabindex="0"
                        :aria-checked="accountOpen"
                        @keydown.space.prevent="toggleAccount"
                        >Create an account?</span
                      >
                    </label>
                  </div>
                  <div class="collapse" :class="{ show: accountOpen }">
                    <div class="ps-30px mb-30px mt-15px">
                      <label class="mb-10px" for="fashion-account-username"
                        >Account username <span class="text-red">*</span></label
                      >
                      <input
                        id="fashion-account-username"
                        v-model="accountUsername"
                        class="border-radius-4px input-small mb-15px"
                        type="email"
                        :required="accountOpen"
                        autocomplete="off"
                      />
                      <label class="mb-10px" for="fashion-account-password"
                        >Create account password <span class="text-red">*</span></label
                      >
                      <input
                        id="fashion-account-password"
                        v-model="accountPassword"
                        class="border-radius-4px input-small"
                        type="password"
                        :required="accountOpen"
                        autocomplete="new-password"
                      />
                    </div>
                  </div>
                </div>

                <div class="col-md-12 mb-20px checkout-accordion">
                  <div
                    class="position-relative terms-condition-box text-start d-flex align-items-center"
                  >
                    <label>
                      <input
                        id="fashion-alternate-shipping"
                        :checked="alternateShippingOpen"
                        type="checkbox"
                        class="check-box align-middle"
                        @change="toggleAlternateShipping"
                      />
                      <span
                        class="box"
                        role="checkbox"
                        tabindex="0"
                        :aria-checked="alternateShippingOpen"
                        @keydown.space.prevent="toggleAlternateShipping"
                        >Ship to a different address?</span
                      >
                    </label>
                  </div>
                  <div class="collapse" :class="{ show: alternateShippingOpen }">
                    <div class="ps-30px mb-30px mt-15px">
                      <CheckoutAddress
                        v-model="alternateAddress"
                        :disabled="!alternateShippingOpen"
                        :show-legend="false"
                      />
                    </div>
                  </div>
                </div>

                <div class="col-12">
                  <label class="mb-10px" for="fashion-order-notes">Order notes (optional)</label>
                  <textarea
                    id="fashion-order-notes"
                    v-model="orderNotes"
                    class="border-radius-4px textarea-small"
                    rows="5"
                    cols="5"
                    placeholder="Notes about your order, e.g. special notes for delivery."
                  ></textarea>
                </div>
              </div>
            </div>

            <div class="col-lg-5">
              <div class="bg-very-light-gray border-radius-6px p-50px lg-p-25px your-order-box">
                <span class="fs-26 alt-font fw-600 text-dark-gray mb-5px d-block">Your order</span>
                <table class="w-100 total-price-table your-order-table">
                  <tbody>
                    <tr>
                      <th class="w-60 lg-w-55 xs-w-50 fw-600 text-dark-gray alt-font">Product</th>
                      <td class="fw-600 text-dark-gray alt-font">Total</td>
                    </tr>
                    <tr v-for="line in displayedLines" :key="line.variantId" class="product">
                      <td class="product-thumbnail">
                        <a
                          :href="fashionStoreRoutePaths.product"
                          data-fashion-store-route
                          class="text-dark-gray fw-500 d-block lh-initial"
                          >{{ line.name }} x {{ line.quantity }}</a
                        >
                        <span class="fs-14 d-block">Color: {{ line.color }}</span>
                      </td>
                      <td class="product-price" data-title="Price">{{ line.total }}</td>
                    </tr>
                    <tr>
                      <th class="w-50 fw-600 text-dark-gray alt-font">Subtotal</th>
                      <td class="text-dark-gray fw-600">{{ displayedTotals.subtotal }}</td>
                    </tr>
                    <tr class="shipping">
                      <th class="fw-600 text-dark-gray alt-font">Shipping</th>
                      <td data-title="Shipping">
                        <ul class="shipping-methods fashion-checkout-shipping-methods p-0">
                          <li v-if="isLive && !shippingAddressComplete" role="status">
                            Complete the shipping address to calculate delivery automatically.
                          </li>
                          <li v-else-if="isLive && shippingBusy" role="status">
                            Calculating delivery options…
                          </li>
                          <li
                            v-for="method in isLive && !shippingAddressComplete
                              ? []
                              : shippingMethods"
                            :key="method.id"
                            class="d-flex align-items-center"
                          >
                            <input
                              :id="`fashion-checkout-shipping-${method.id}`"
                              v-model="selectedMethod"
                              type="radio"
                              name="shipping-method"
                              class="d-block w-auto mb-0 me-10px p-0"
                              :value="method.id"
                              @change="updateShipping"
                            />
                            <label
                              class="md-line-height-18px"
                              :for="`fashion-checkout-shipping-${method.id}`"
                              >{{ method.name
                              }}<template v-if="method.amount > 0"
                                >: {{ money(method.amount, method.currency) }}</template
                              ></label
                            >
                          </li>
                        </ul>
                      </td>
                    </tr>
                    <tr class="total-amount">
                      <th class="fw-600 text-dark-gray alt-font">Total</th>
                      <td data-title="Total">
                        <h6 class="d-block fw-700 mb-0 text-dark-gray alt-font">
                          {{ displayedTotals.total }}
                        </h6>
                        <span class="fs-14">{{ displayedTotals.tax }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="shippingError" class="form-error" role="alert">{{ shippingError }}</p>

                <div
                  class="p-40px lg-p-25px bg-white border-radius-6px box-shadow-large mt-10px mb-30px sm-mb-25px checkout-accordion"
                >
                  <div id="fashion-payment-accordion" class="w-100">
                    <div
                      v-for="payment in paymentOptions"
                      :key="payment.id"
                      class="fashion-payment-option"
                    >
                      <div class="heading active-accordion">
                        <label class="mb-5px">
                          <input
                            v-model="selectedPayment"
                            class="d-inline w-auto me-5px mb-0 p-0"
                            type="radio"
                            name="payment-option"
                            :value="payment.id"
                            @change="selectPayment(payment.id)"
                          />
                          <span class="d-inline-block text-dark-gray fw-500"
                            >{{ payment.label }}
                            <img
                              v-if="payment.sourceImage"
                              :src="sourceAsset(payment.sourceImage)"
                              class="w-120px ms-10px"
                              alt=""
                          /></span>
                        </label>
                      </div>
                      <div class="collapse" :class="{ show: selectedPayment === payment.id }">
                        <div class="p-25px bg-very-light-gray mt-20px mb-20px fs-14 lh-24">
                          {{ payment.detail }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <p class="fs-14 lh-24">
                  Your personal data will be used to process your order, support your experience
                  throughout this website, and for other purposes described in our
                  <a
                    class="text-decoration-line-bottom text-dark-gray fw-500"
                    href="/policies/privacy"
                    data-fashion-store-route
                    >privacy policy.</a
                  >
                </p>
                <div
                  class="position-relative terms-condition-box text-start d-flex align-items-center"
                >
                  <label>
                    <input
                      v-model="termsAccepted"
                      type="checkbox"
                      required
                      class="check-box align-middle"
                    />
                    <span class="box fs-14 lh-28"
                      >I have agree to the website
                      <a
                        href="/policies/terms"
                        data-fashion-store-route
                        class="text-decoration-line-bottom text-dark-gray fw-500"
                        >terms and conditions.</a
                      ></span
                    >
                  </label>
                </div>
                <TurnstileChallenge
                  v-if="!securityConfigurationLoading && turnstileRequired && turnstileSiteKey"
                  :key="turnstileRenderKey"
                  v-model="turnstileToken"
                  :sitekey="turnstileSiteKey"
                />
                <p v-if="securityConfigurationError" class="form-error" role="alert">
                  {{ securityConfigurationError }}
                </p>
                <button
                  class="fashion-checkout-submit btn btn-dark-gray btn-large btn-switch-text btn-round-edge btn-box-shadow w-100 mt-30px"
                  type="submit"
                  :disabled="
                    submitting ||
                    shippingBusy ||
                    securityConfigurationLoading ||
                    Boolean(securityConfigurationError) ||
                    !cart?.canCheckout ||
                    (turnstileRequired && !turnstileToken)
                  "
                >
                  <span
                    ><span class="btn-double-text" data-text="Place order">Place order</span></span
                  >
                </button>
                <p v-if="loadError || submitError" class="form-error mt-15px" role="alert">
                  {{ loadError || submitError }}
                </p>
                <p v-if="loadNotice" class="mt-15px" role="status" aria-live="polite">
                  {{ loadNotice }}
                </p>
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
