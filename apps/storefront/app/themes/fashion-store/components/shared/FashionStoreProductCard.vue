<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreShopProduct } from "../../fixtures/pages/shop";
import { fashionStoreLiveCapabilities } from "../../capability-matrix";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";

type LiveProductCard = Extract<
  PresentationViewModel,
  { kind: "collection-grid" }
>["products"][number];

const properties = defineProps<{
  commerceDisabled?: boolean;
  product: FashionStoreShopProduct | LiveProductCard;
  resolveAsset: ThemeAssetResolver;
}>();

defineEmits<{
  intent: [kind: "cart" | "quickView" | "wishlist"];
}>();

const card = computed(() => {
  if ("href" in properties.product) {
    return {
      alt: properties.product.media?.alt ?? properties.product.name,
      badge: undefined,
      href: properties.product.href,
      id: properties.product.id,
      image: properties.product.media?.src,
      name: properties.product.name,
      originalPrice: "",
      price: properties.product.priceLabel,
    };
  }
  return {
    alt: properties.product.name,
    badge: properties.product.badge,
    href: fashionStoreRoutePaths.product,
    id: properties.product.id,
    image: properties.resolveAsset(fashionStoreAssetId(properties.product.sourceImage)),
    name: properties.product.name,
    originalPrice: properties.product.originalPrice,
    price: properties.product.price,
  };
});
const liveProduct = computed(() => "href" in properties.product);
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
  <li class="grid-item" data-fashion-store-product-card :data-product-id="card.id">
    <div
      class="shop-box mb-10px"
      :class="{ 'actions-open': touchActionsOpen }"
      @pointerdown="exposeTouchActions"
    >
      <div class="shop-image mb-20px">
        <a
          :href="card.href"
          :data-fashion-store-route="productLinkEnabled ? '' : undefined"
          @click="handleProductLink"
        >
          <img v-if="card.image" :src="card.image" :alt="card.alt" width="600" height="765" />
          <span v-else class="fashion-store-product-placeholder" aria-hidden="true"></span>
          <span v-if="card.badge" class="lable" :class="card.badge.toLowerCase()">{{
            card.badge
          }}</span>
          <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
        </a>
        <div class="shop-buttons-wrap">
          <button
            v-if="!commerceDisabled"
            type="button"
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
            aria-label="Add to cart"
            @click="$emit('intent', 'cart')"
          >
            <i class="feather icon-feather-shopping-bag"></i
            ><span class="quick-view-text button-text">Add to cart</span>
          </button>
          <a
            v-else
            :href="card.href"
            data-fashion-store-route
            class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
          >
            <span class="quick-view-text button-text">Choose options</span>
          </a>
        </div>
        <div
          v-if="
            !liveProduct ||
            fashionStoreLiveCapabilities.wishlist ||
            fashionStoreLiveCapabilities.productQuickView
          "
          class="shop-hover d-flex justify-content-center"
        >
          <ul>
            <li v-if="!liveProduct || fashionStoreLiveCapabilities.wishlist">
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
            <li v-if="!liveProduct || fashionStoreLiveCapabilities.productQuickView">
              <a
                v-if="liveProduct"
                :href="card.href"
                data-fashion-store-route
                class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                aria-label="View product details"
                title="View product details"
              >
                <i class="feather icon-feather-eye fs-16"></i>
              </a>
              <button
                v-else
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
          :href="card.href"
          data-fashion-store-route
          class="alt-font text-dark-gray fs-19 fw-500"
          >{{ card.name }}</a
        >
        <div class="price lh-22 fs-16">
          <del>{{ card.originalPrice }}</del
          >{{ card.price }}
        </div>
      </div>
    </div>
  </li>
</template>
