<script setup lang="ts">
const properties = defineProps<{
  sourceAsset: (sourcePath: string) => string;
}>();

const cartOpen = ref(false);
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
        ><span class="cart-count alt-font text-white bg-dark-gray">2</span>
      </button>
      <ul class="cart-item-list">
        <li class="cart-item align-items-center">
          <button
            type="button"
            class="alt-font close fashion-store-source-action"
            aria-label="Remove Ribbed tank from preview cart"
          >
            ×
          </button>
          <div class="product-image">
            <a href="/" data-fashion-store-route
              ><img
                class="cart-thumb"
                alt=""
                v-bind:src="sourceAsset('images/demo-fashion-store-product-01.jpg')"
            /></a>
          </div>
          <div class="product-detail fw-600">
            <a href="/" data-fashion-store-route>Ribbed tank</a>
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
            <a href="/" data-fashion-store-route
              ><img
                class="cart-thumb"
                alt=""
                v-bind:src="sourceAsset('images/demo-fashion-store-product-02.jpg')"
            /></a>
          </div>
          <div class="product-detail fw-600">
            <a href="/" data-fashion-store-route>Pleated dress</a>
            <span class="item-ammount fw-400">2 x $15.00</span>
          </div>
        </li>
        <li class="cart-total">
          <div class="fs-18 alt-font mb-15px">
            <span class="w-50 fw-500 text-start">Subtotal:</span
            ><span class="w-50 text-end fw-700">$199.99</span>
          </div>
          <a
            href="/cart"
            data-fashion-store-route
            class="btn btn-large btn-transparent-light-gray border-color-extra-medium-gray"
            >View cart</a
          >
          <a
            href="/checkout"
            data-fashion-store-route
            class="btn btn-large btn-dark-gray btn-box-shadow"
            >Checkout</a
          >
        </li>
      </ul>
    </div>
  </div>
</template>
