<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { FashionStoreShopProduct } from "../../fixtures/pages/shop";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";

const properties = defineProps<{
  product: FashionStoreShopProduct;
  resolveAsset: ThemeAssetResolver;
}>();

defineEmits<{
  intent: [kind: "cart" | "quickView" | "wishlist"];
}>();

const productImage = computed(() =>
  properties.resolveAsset(fashionStoreAssetId(properties.product.sourceImage)),
);
const touchActionsOpen = ref(false);
const productLinkEnabled = ref(true);
let suppressNextProductLink = false;

function exposeTouchActions(event: PointerEvent): void {
  if (event.pointerType !== "touch" || touchActionsOpen.value) return;
  touchActionsOpen.value = true;
  productLinkEnabled.value = false;
  suppressNextProductLink = true;
}

function handleProductLink(event: MouseEvent): void {
  if (!suppressNextProductLink) return;
  event.preventDefault();
  suppressNextProductLink = false;
  void nextTick(() => {
    productLinkEnabled.value = true;
  });
}
</script>

<template>
  <li class="grid-item" :data-product-id="product.id">
    <div
      class="shop-box mb-10px"
      :class="{ 'actions-open': touchActionsOpen }"
      @pointerdown="exposeTouchActions"
    >
      <div class="shop-image mb-20px">
        <a
          :href="fashionStoreRoutePaths.product"
          :data-fashion-store-route="productLinkEnabled ? '' : undefined"
          @click="handleProductLink"
        >
          <img :src="productImage" :alt="product.name" width="600" height="765" />
          <span v-if="product.badge" class="lable" :class="product.badge.toLowerCase()">{{
            product.badge
          }}</span>
          <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
        </a>
        <div class="shop-buttons-wrap">
          <button
            type="button"
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
            aria-label="Add to cart"
            @click="$emit('intent', 'cart')"
          >
            <i class="feather icon-feather-shopping-bag"></i
            ><span class="quick-view-text button-text">Add to cart</span>
          </button>
        </div>
        <div class="shop-hover d-flex justify-content-center">
          <ul>
            <li>
              <button
                type="button"
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                aria-label="Add to wishlist"
                title="Add to wishlist"
                @click="$emit('intent', 'wishlist')"
              >
                <i class="feather icon-feather-heart fs-16"></i>
              </button>
            </li>
            <li>
              <button
                type="button"
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                aria-label="Quick shop"
                title="Quick shop"
                @click="$emit('intent', 'quickView')"
              >
                <i class="feather icon-feather-eye fs-16"></i>
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div class="shop-footer text-center">
        <a
          :href="fashionStoreRoutePaths.product"
          data-fashion-store-route
          class="alt-font text-dark-gray fs-19 fw-500"
          >{{ product.name }}</a
        >
        <div class="price lh-22 fs-16">
          <del>{{ product.originalPrice }}</del
          >{{ product.price }}
        </div>
      </div>
    </div>
  </li>
</template>
