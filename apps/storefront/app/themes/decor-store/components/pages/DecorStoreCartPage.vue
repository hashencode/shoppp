<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreCartData, type DecorStoreCartLine } from "../../fixtures/pages/commerce";
import { decorStoreRoutePaths } from "../../page-contracts";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

defineProps<{ resolveAsset: ThemeAssetResolver }>();
const lines = ref<DecorStoreCartLine[]>(structuredClone(decorStoreCartData.lines));
const subtotal = computed(() =>
  lines.value.reduce((sum, line) => sum + line.price * line.quantity, 0),
);
const total = computed(
  () => subtotal.value + (lines.value.length ? decorStoreCartData.shipping : 0),
);
function change(id: string, delta: number): void {
  const line = lines.value.find((item) => item.id === id);
  if (line) line.quantity = Math.min(9, Math.max(1, line.quantity + delta));
}
function remove(id: string): void {
  lines.value = lines.value.filter((line) => line.id !== id);
}
</script>

<template>
  <DecorStoreShell
    active-page="cart"
    :announcement="decorStoreCartData.announcement"
    :resolve-asset="resolveAsset"
  >
    <DecorStorePageTitle breadcrumb="shopping cart" title="Shopping cart" />
    <section class="pb-80px">
      <div class="container">
        <p v-if="lines.length === 0" role="status">Your cart is empty.</p>
        <div v-else class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Total</th>
                <th><span class="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in lines" :key="line.id" :data-cart-line="line.id">
                <td>
                  <strong>{{ line.name }}</strong
                  ><br />Color: {{ line.color }}
                </td>
                <td>${{ line.price.toFixed(2) }}</td>
                <td>
                  <button
                    type="button"
                    :aria-label="`Decrease ${line.name} quantity`"
                    @click="change(line.id, -1)"
                  >
                    −</button
                  ><output :aria-label="`${line.name} quantity`">{{ line.quantity }}</output
                  ><button
                    type="button"
                    :aria-label="`Increase ${line.name} quantity`"
                    @click="change(line.id, 1)"
                  >
                    +
                  </button>
                </td>
                <td>${{ (line.price * line.quantity).toFixed(2) }}</td>
                <td>
                  <button
                    type="button"
                    :aria-label="`Remove ${line.name}`"
                    @click="remove(line.id)"
                  >
                    ×
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="row mt-40px">
          <div class="col-lg-6">
            <label>Coupon code <input type="text" /></label><button type="button">Apply</button
            ><button type="button" @click="lines = []">Empty cart</button>
          </div>
          <div class="col-lg-5 offset-lg-1">
            <h2>Cart totals</h2>
            <p>
              Subtotal <strong>${{ subtotal.toFixed(2) }}</strong>
            </p>
            <p>
              Shipping
              <strong>${{ lines.length ? decorStoreCartData.shipping.toFixed(2) : "0.00" }}</strong>
            </p>
            <p>
              Total <strong>${{ total.toFixed(2) }}</strong>
            </p>
            <a
              :href="decorStoreRoutePaths.checkout"
              data-decor-store-route
              class="btn btn-base-color"
              >Proceed to checkout</a
            >
          </div>
        </div>
      </div>
    </section>
  </DecorStoreShell>
</template>
