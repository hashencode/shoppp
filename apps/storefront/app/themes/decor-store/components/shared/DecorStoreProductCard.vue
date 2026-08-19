<script setup lang="ts">
import type { DecorStoreShopProduct } from "../../fixtures/pages/shop";
import { decorStoreRoutePaths } from "../../page-contracts";

defineProps<{ placeholder: string; product: DecorStoreShopProduct; wished?: boolean }>();
const emit = defineEmits<{ wishlist: [id: string] }>();
</script>

<template>
  <li class="grid-item" :data-product-id="product.id">
    <div class="shop-box pb-25px">
      <div class="shop-image">
        <a :href="decorStoreRoutePaths.product" data-decor-store-route>
          <img :src="placeholder" alt="" />
          <span v-if="product.badge" class="lable new">{{ product.badge }}</span>
          <div class="product-overlay bg-gradient-extra-midium-gray-transparent"></div>
        </a>
        <div class="shop-hover d-flex justify-content-center">
          <button
            type="button"
            class="bg-white w-45px h-45px text-dark-gray rounded-circle"
            :aria-label="`Add ${product.name} to wishlist`"
            :aria-pressed="wished"
            @click="emit('wishlist', product.id)"
          >
            <i class="feather icon-feather-heart fs-15"></i>
          </button>
          <a
            :href="decorStoreRoutePaths.product"
            data-decor-store-route
            class="bg-white w-45px h-45px text-dark-gray d-flex align-items-center justify-content-center rounded-circle"
            aria-label="View product"
            ><i class="feather icon-feather-eye fs-15"></i
          ></a>
        </div>
      </div>
      <div class="shop-footer text-center pt-20px">
        <a
          :href="decorStoreRoutePaths.product"
          data-decor-store-route
          class="text-dark-gray fs-17 alt-font fw-600"
          >{{ product.name }}</a
        >
        <div class="fw-500 fs-15 lh-normal">
          <del v-if="product.originalPrice">${{ product.originalPrice.toFixed(2) }}</del
          >${{ product.price.toFixed(2) }}
        </div>
      </div>
    </div>
  </li>
</template>
