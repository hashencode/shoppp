<script setup lang="ts">
import FashionStoreIcon from "./FashionStoreIcon.vue";
import { storefrontActionAdapterKey } from "../../../../theme-engine/actions";
import { storefrontCartStateKey, type StorefrontCart } from "../../../../theme-engine/cart-state";
import { storefrontCheckoutAdapterKey } from "../../../../theme-engine/checkout";
import {
  formatCommerceMoney as money,
  liveCommerceModeKey,
} from "../../../../theme-engine/runtime-commerce";
import { useFashionStorePreviewCart } from "../../composables/useFashionStorePreviewCart";
import { fashionStoreRoutePaths } from "../../page-contracts";

const properties = defineProps<{
  sourceAsset: (sourcePath: string) => string;
}>();

const cartOpen = ref(false);
const actionAdapter = inject(storefrontActionAdapterKey);
const checkoutAdapter = inject(storefrontCheckoutAdapterKey);
const liveCommerceMode = inject(liveCommerceModeKey, false);
const liveCart = inject(storefrontCartStateKey, readonly(ref<StorefrontCart | null>(null)));
const previewCart = useFashionStorePreviewCart(liveCommerceMode ? [] : undefined);
const liveCartCount = computed(
  () => liveCart.value?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0,
);
const cartCount = computed(() =>
  liveCommerceMode ? liveCartCount.value : previewCart.count.value,
);
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

async function removeLine(variantId: string): Promise<void> {
  if (!liveCommerceMode) {
    previewCart.remove(variantId);
    return;
  }
  if (!actionAdapter || liveCartBusy.value) return;
  liveCartBusy.value = true;
  liveCartError.value = "";
  try {
    await actionAdapter({
      context: "fashion-store.live-mini-cart.remove",
      kind: "cart.remove",
      variantId,
    });
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
    await checkoutAdapter.ensure();
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
      :data-fashion-store-commerce-mode="liveCommerceMode ? 'live' : 'fixture'"
      @mouseenter="cartOpen = true"
      @mouseleave="handleCartMouseLeave"
      @focusout="handleCartFocusOut"
    >
      <button
        type="button"
        class="fashion-store-source-action"
        aria-label="Open cart"
        :aria-expanded="cartOpen"
        @click="toggleCart"
        @keydown="prepareCartToggle"
        @pointerdown="prepareCartToggle"
      >
        <FashionStoreIcon name="shopping-bag" /><span
          class="cart-count alt-font text-white bg-dark-gray"
          >{{ cartCount }}</span
        >
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
            :aria-label="`Remove ${line.productName} from cart`"
            :disabled="liveCartBusy"
            @click="removeLine(line.variantId)"
          >
            ×
          </button>
          <div class="product-detail fw-600">
            <span>{{ line.productName }}</span>
            <span class="item-ammount fw-400">
              {{ line.quantity }} × {{ money(line.unitPrice.amount, liveCart!.currency) }}
            </span>
          </div>
        </li>
        <li v-if="liveCart" class="cart-total">
          <div class="fs-18 alt-font mb-15px">
            <span class="w-50 fw-500 text-start">Subtotal:</span>
            <span class="w-50 text-end fw-700">{{
              money(liveCart.totals.subtotal, liveCart.currency)
            }}</span>
          </div>
          <NuxtLink
            :to="fashionStoreRoutePaths.cart"
            data-fashion-store-route
            class="btn btn-large btn-transparent-light-gray border-color-extra-medium-gray"
            >View cart</NuxtLink
          >
          <NuxtLink
            v-if="liveCart.canCheckout"
            :to="fashionStoreRoutePaths.checkout"
            data-fashion-store-route
            class="btn btn-large btn-dark-gray btn-box-shadow"
            >Checkout</NuxtLink
          >
        </li>
      </ul>
      <ul v-else class="cart-item-list" aria-live="polite">
        <li v-if="previewCart.lines.value.length === 0" class="cart-item" role="status">
          Your cart is empty.
        </li>
        <template v-else>
          <li
            v-for="line in previewCart.lines.value"
            :key="line.variantId"
            class="cart-item align-items-center"
          >
            <button
              type="button"
              class="alt-font close fashion-store-source-action"
              :aria-label="`Remove ${line.name} from cart`"
              @click="removeLine(line.variantId)"
            >
              ×
            </button>
            <div class="product-image">
              <NuxtLink :to="fashionStoreRoutePaths.product" data-fashion-store-route
                ><img class="cart-thumb" :alt="line.name" :src="sourceAsset(line.sourceImage)"
              /></NuxtLink>
            </div>
            <div class="product-detail fw-600">
              <NuxtLink :to="fashionStoreRoutePaths.product" data-fashion-store-route>{{
                line.name
              }}</NuxtLink>
              <span class="item-ammount fw-400">{{ line.quantity }} × {{ line.price }}</span>
            </div>
          </li>
        </template>
        <li v-if="previewCart.lines.value.length" class="cart-total">
          <div class="fs-18 alt-font mb-15px">
            <span class="w-50 fw-500 text-start">Subtotal:</span
            ><span class="w-50 text-end fw-700">{{
              money(Math.round(previewCart.subtotal.value * 100), "USD")
            }}</span>
          </div>
          <NuxtLink
            :to="fashionStoreRoutePaths.cart"
            data-fashion-store-route
            class="btn btn-large btn-transparent-light-gray border-color-extra-medium-gray"
            >View cart</NuxtLink
          >
          <NuxtLink
            :to="fashionStoreRoutePaths.checkout"
            data-fashion-store-route
            class="btn btn-large btn-dark-gray btn-box-shadow"
            >Checkout</NuxtLink
          >
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.fashion-store-source-action {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  padding: 0;
}

.header-cart > .fashion-store-source-action {
  position: relative;
  padding-left: 14px;
  color: var(--dark-gray);
  font-size: 17px;
}

.cart-item .fashion-store-source-action.close {
  min-width: 32px;
  min-height: 32px;
  line-height: 32px;
}
</style>
