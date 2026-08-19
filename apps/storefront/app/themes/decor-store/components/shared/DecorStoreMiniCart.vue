<script setup lang="ts">
import { decorStoreRoutePaths } from "../../page-contracts";

defineProps<{ placeholder: string }>();
</script>

<template>
  <ul class="cart-item-list" role="dialog" aria-label="Cart preview">
    <li
      v-for="item in ['Table clock', 'Ceramic mug']"
      :key="item"
      class="cart-item align-items-center"
    >
      <div class="product-image">
        <a :href="decorStoreRoutePaths.product" data-decor-store-route tabindex="-1">
          <img :src="placeholder" class="cart-thumb" alt="" />
        </a>
      </div>
      <div class="product-detail alt-font fw-600">
        <a :href="decorStoreRoutePaths.product" data-decor-store-route>{{ item }}</a>
        <span class="item-ammount fw-500">1 x $23.00</span>
      </div>
    </li>
    <li class="cart-total">
      <div class="alt-font mb-15px">
        <span class="w-50 fw-500">Subtotal:</span><span class="w-50 text-end fw-700">$199.99</span>
      </div>
      <a
        :href="decorStoreRoutePaths.cart"
        data-decor-store-route
        class="btn btn-large btn-transparent-base-color border-color-extra-medium-gray btn-round-edge"
        >View cart</a
      >
      <a
        :href="decorStoreRoutePaths.checkout"
        data-decor-store-route
        class="btn btn-large btn-base-color btn-box-shadow btn-round-edge"
        >Checkout</a
      >
    </li>
  </ul>
</template>
