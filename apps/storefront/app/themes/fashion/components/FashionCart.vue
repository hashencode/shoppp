<script setup lang="ts">
import { recordPreviewIntent } from "../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { fashionSourceContract } from "../source-contract";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const cart = computed(() => (properties.viewModel.kind === "cart" ? properties.viewModel : null));
const coupon = ref("");
const couponMessage = ref("");
const shippingMethod = ref(fashionSourceContract.cartPage.shipping[0]);

const displayLines = computed(() =>
  (cart.value?.lines ?? []).map((line, index) => ({
    ...line,
    color: fashionSourceContract.cartPage.items[index]?.color ?? "Natural",
    total: fashionSourceContract.cartPage.items[index]?.total ?? line.priceLabel,
  })),
);

function applyCoupon(): void {
  couponMessage.value = coupon.value.trim()
    ? `Coupon “${coupon.value.trim()}” is ready for preview validation.`
    : "Enter a coupon code first.";
}
</script>

<template>
  <main v-if="cart" class="fashion-cart-page">
    <header class="fashion-page-breadcrumb">
      <h1>{{ fashionSourceContract.cartPage.heading }}</h1>
      <nav aria-label="Breadcrumb"><NuxtLink to="/">Home</NuxtLink><span>Shopping cart</span></nav>
    </header>

    <div class="fashion-cart-layout">
      <section class="fashion-cart-products" aria-label="Cart products">
        <div class="fashion-cart-heading" aria-hidden="true">
          <span>Product</span><span>Price</span><span>Quantity</span><span>Total</span>
        </div>
        <article v-for="line in displayLines" :key="line.id">
          <button class="fashion-cart-delete" type="button" :aria-label="`Remove ${line.name}`">
            ×
          </button>
          <div class="fashion-cart-product">
            <NuxtLink to="/products/textured-sweater">{{ line.name }}</NuxtLink>
            <small>Color: {{ line.color }}</small>
          </div>
          <span class="fashion-cart-price" data-title="Price">{{ line.priceLabel }}</span>
          <div class="fashion-cart-quantity" aria-label="Preview quantity controls">
            <button
              type="button"
              :aria-label="`Decrease ${line.name} quantity`"
              @click="recordPreviewIntent(line.quantityActions[0]!, 'fashion.cart')"
            >
              −
            </button>
            <output :aria-label="`${line.name} quantity`">{{ line.quantity }}</output>
            <button
              type="button"
              :aria-label="`Increase ${line.name} quantity`"
              @click="recordPreviewIntent(line.quantityActions.at(-1)!, 'fashion.cart')"
            >
              +
            </button>
          </div>
          <span class="fashion-cart-line-total" data-title="Total">{{ line.total }}</span>
        </article>

        <div class="fashion-cart-actions">
          <form class="fashion-cart-coupon" @submit.prevent="applyCoupon">
            <label
              ><span class="sr-only">Coupon code</span
              ><input v-model="coupon" placeholder="Coupon code"
            /></label>
            <button type="submit">Apply</button>
          </form>
          <div>
            <button type="button">Empty cart</button>
            <button type="button">Update cart</button>
          </div>
        </div>
        <p v-if="couponMessage" class="fashion-form-message" aria-live="polite">
          {{ couponMessage }}
        </p>
      </section>

      <aside class="fashion-cart-totals" aria-labelledby="fashion-cart-totals-heading">
        <h2 id="fashion-cart-totals-heading">Cart totals</h2>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{{ fashionSourceContract.cartPage.subtotal }}</dd>
          </div>
          <div class="fashion-cart-shipping-row">
            <dt>Shipping</dt>
            <dd>
              <label v-for="method in fashionSourceContract.cartPage.shipping" :key="method">
                <input
                  v-model="shippingMethod"
                  type="radio"
                  name="shipping-option"
                  :value="method"
                />
                <span>{{ method }}</span>
              </label>
            </dd>
          </div>
          <div class="fashion-cart-calculate-row">
            <dt>
              <details>
                <summary>Calculate shipping</summary>
                <div class="fashion-cart-address">
                  <select aria-label="Country">
                    <option>Select a country</option>
                    <option>China</option>
                    <option>United Kingdom</option>
                    <option>United States</option>
                  </select>
                  <select aria-label="State">
                    <option>Select a state</option>
                    <option>State / province</option>
                  </select>
                  <input aria-label="Town or city" placeholder="Town/City" />
                  <input aria-label="ZIP" placeholder="ZIP" />
                  <button type="button">Update</button>
                </div>
              </details>
            </dt>
          </div>
          <div class="fashion-cart-grand-total">
            <dt>Total</dt>
            <dd>{{ fashionSourceContract.cartPage.total }}</dd>
          </div>
        </dl>
        <button type="button" @click="recordPreviewIntent(cart.checkoutAction, 'fashion.cart')">
          {{ cart.checkoutAction.label }}
        </button>
      </aside>
    </div>
  </main>
</template>
