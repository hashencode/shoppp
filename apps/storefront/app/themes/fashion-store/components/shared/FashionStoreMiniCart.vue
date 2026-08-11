<script setup lang="ts">
import { storefrontActionAdapterKey } from "../../../../theme-engine/actions";
import { storefrontCheckoutAdapterKey } from "../../../../theme-engine/checkout";
import {
  formatCommerceMoney,
  liveCommerceModeKey,
} from "../../../../theme-engine/runtime-commerce";
import { fashionStoreRoutePaths } from "../../page-contracts";

const properties = defineProps<{
  sourceAsset: (sourcePath: string) => string;
}>();

const cartOpen = ref(false);
const actionAdapter = inject(storefrontActionAdapterKey);
const checkoutAdapter = inject(storefrontCheckoutAdapterKey);
const liveCommerceMode = inject(liveCommerceModeKey, false);
const liveCart = ref<{
  canCheckout: boolean;
  count: number;
  currency: string;
  lines: { name: string; quantity: number; unitPrice: number; variantId: string }[];
  subtotal: number;
} | null>(null);
const liveCartError = ref("");
const liveCartNotice = ref("");
const liveCartBusy = ref(false);
let cartActivationPrepared = false;
let cartOpenBeforeActivation = false;
let touchActivation = false;

function handleCartFocusOut(event: FocusEvent): void {
  const cart = event.currentTarget;
  if (!(cart instanceof HTMLElement)) return;
  if (!(event.relatedTarget instanceof Node) || !cart.contains(event.relatedTarget)) {
    cartOpen.value = false;
  }
}

function prepareCartToggle(event: KeyboardEvent | PointerEvent): void {
  if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
  touchActivation = event instanceof PointerEvent && event.pointerType === "touch";
  cartOpenBeforeActivation = cartOpen.value;
  cartActivationPrepared = true;
}

function toggleCart(): void {
  cartOpen.value = cartActivationPrepared ? !cartOpenBeforeActivation : !cartOpen.value;
  cartActivationPrepared = false;
  if (!cartOpen.value) touchActivation = false;
}

function handleCartMouseLeave(): void {
  if (!touchActivation) cartOpen.value = false;
}

function closeCart(): void {
  cartOpen.value = false;
  cartActivationPrepared = false;
  touchActivation = false;
}

function applyLiveCart(cart: {
  canCheckout: boolean;
  currency: string;
  lines: {
    productName: string;
    quantity: number;
    unitPrice: { amount: number };
    variantId: string;
  }[];
  totals: { subtotal: number };
}): void {
  liveCart.value = {
    canCheckout: cart.canCheckout,
    count: cart.lines.reduce((total, line) => total + line.quantity, 0),
    currency: cart.currency,
    lines: cart.lines.map((line) => ({
      name: line.productName,
      quantity: line.quantity,
      unitPrice: line.unitPrice.amount,
      variantId: line.variantId,
    })),
    subtotal: cart.totals.subtotal,
  };
}

function money(amount: number, currency: string): string {
  return formatCommerceMoney(amount, currency);
}

async function removeLiveLine(variantId: string): Promise<void> {
  if (!actionAdapter || liveCartBusy.value) return;
  liveCartBusy.value = true;
  liveCartError.value = "";
  try {
    applyLiveCart(
      await actionAdapter({
        context: "fashion-store.live-mini-cart.remove",
        kind: "cart.remove",
        variantId,
      }),
    );
  } catch {
    liveCartError.value =
      checkoutAdapter?.status().error ?? "The cart could not be updated. Try again.";
  } finally {
    liveCartBusy.value = false;
  }
}

onMounted(async () => {
  if (!liveCommerceMode || !checkoutAdapter) return;
  try {
    applyLiveCart(await checkoutAdapter.ensure());
    liveCartNotice.value = checkoutAdapter.status().notice ?? "";
  } catch {
    liveCartError.value =
      checkoutAdapter.status().error ?? "Your current cart is unavailable. Try again.";
  }
});

const sourceAsset = (sourcePath: string) => properties.sourceAsset(sourcePath);

defineExpose({ closeCart });
</script>

<template>
  <div class="header-cart-icon icon">
    <div
      class="header-cart dropdown"
      :class="{ open: cartOpen }"
      @mouseenter="cartOpen = true"
      @mouseleave="handleCartMouseLeave"
      @focusout="handleCartFocusOut"
    >
      <button
        type="button"
        class="fashion-store-source-action"
        aria-label="Open preview cart"
        :aria-expanded="cartOpen"
        @click="toggleCart"
        @keydown="prepareCartToggle"
        @pointerdown="prepareCartToggle"
      >
        <i class="feather icon-feather-shopping-bag"></i
        ><span class="cart-count alt-font text-white bg-dark-gray">{{
          liveCommerceMode ? (liveCart?.count ?? 0) : 2
        }}</span>
      </button>
      <ul v-if="liveCommerceMode" class="cart-item-list" aria-live="polite">
        <li v-if="liveCartError" class="cart-item" role="alert">{{ liveCartError }}</li>
        <li v-else-if="liveCartNotice" class="cart-item" role="status">
          {{ liveCartNotice }}
        </li>
        <li v-else-if="!liveCart" class="cart-item" role="status">Loading cart…</li>
        <li v-else-if="liveCart.lines.length === 0" class="cart-item" role="status">
          Your cart is empty.
        </li>
        <li
          v-for="line in liveCart?.lines ?? []"
          :key="line.variantId"
          class="cart-item align-items-center"
        >
          <button
            type="button"
            class="alt-font close fashion-store-source-action"
            :aria-label="`Remove ${line.name} from cart`"
            :disabled="liveCartBusy"
            @click="removeLiveLine(line.variantId)"
          >
            ×
          </button>
          <div class="product-detail fw-600">
            <span>{{ line.name }}</span>
            <span class="item-ammount fw-400">
              {{ line.quantity }} × {{ money(line.unitPrice, liveCart!.currency) }}
            </span>
          </div>
        </li>
        <li v-if="liveCart" class="cart-total">
          <div class="fs-18 alt-font mb-15px">
            <span class="w-50 fw-500 text-start">Subtotal:</span>
            <span class="w-50 text-end fw-700">{{
              money(liveCart.subtotal, liveCart.currency)
            }}</span>
          </div>
          <a
            :href="fashionStoreRoutePaths.cart"
            data-fashion-store-route
            class="btn btn-large btn-transparent-light-gray border-color-extra-medium-gray"
            >View cart</a
          >
          <a
            v-if="liveCart.canCheckout"
            :href="fashionStoreRoutePaths.checkout"
            data-fashion-store-route
            class="btn btn-large btn-dark-gray btn-box-shadow"
            >Checkout</a
          >
        </li>
      </ul>
      <ul v-else class="cart-item-list">
        <li class="cart-item align-items-center">
          <button
            type="button"
            class="alt-font close fashion-store-source-action"
            aria-label="Remove Ribbed tank from preview cart"
          >
            ×
          </button>
          <div class="product-image">
            <a :href="fashionStoreRoutePaths.product" data-fashion-store-route
              ><img
                class="cart-thumb"
                alt=""
                v-bind:src="sourceAsset('images/demo-fashion-store-product-01.jpg')"
            /></a>
          </div>
          <div class="product-detail fw-600">
            <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>Ribbed tank</a>
            <span class="item-ammount fw-400">1 x $23.00</span>
          </div>
        </li>
        <li class="cart-item align-items-center">
          <button
            type="button"
            class="alt-font close fashion-store-source-action"
            aria-label="Remove Pleated dress from preview cart"
          >
            ×
          </button>
          <div class="product-image">
            <a :href="fashionStoreRoutePaths.product" data-fashion-store-route
              ><img
                class="cart-thumb"
                alt=""
                v-bind:src="sourceAsset('images/demo-fashion-store-product-02.jpg')"
            /></a>
          </div>
          <div class="product-detail fw-600">
            <a :href="fashionStoreRoutePaths.product" data-fashion-store-route>Pleated dress</a>
            <span class="item-ammount fw-400">2 x $15.00</span>
          </div>
        </li>
        <li class="cart-total">
          <div class="fs-18 alt-font mb-15px">
            <span class="w-50 fw-500 text-start">Subtotal:</span
            ><span class="w-50 text-end fw-700">$199.99</span>
          </div>
          <a
            :href="fashionStoreRoutePaths.cart"
            data-fashion-store-route
            class="btn btn-large btn-transparent-light-gray border-color-extra-medium-gray"
            >View cart</a
          >
          <a
            :href="fashionStoreRoutePaths.checkout"
            data-fashion-store-route
            class="btn btn-large btn-dark-gray btn-box-shadow"
            >Checkout</a
          >
        </li>
      </ul>
    </div>
  </div>
</template>
