<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { resolveFashionStoreEditorMedia } from "../../resources";
import type { FashionStoreContentStatePresentation } from "../../contracts/content-presentation";
import FashionStorePageTitle from "../shared/FashionStorePageTitle.vue";
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";

const properties = defineProps<{
  presentation: FashionStoreContentStatePresentation;
  resolveAsset: ThemeAssetResolver;
}>();

const mediaSource = computed(() =>
  properties.presentation.media
    ? resolveFashionStoreEditorMedia(properties.resolveAsset, properties.presentation.media)
    : undefined,
);
</script>

<template>
  <FashionStorePageTitle :title="presentation.heading" />
  <section
    class="pt-0 pb-70px"
    data-fashion-store-content-state
    :data-content-state="presentation.state"
  >
    <div class="container text-center">
      <img
        v-if="presentation.media && mediaSource"
        :src="mediaSource"
        :alt="presentation.media.alt"
        :width="presentation.media.width"
        :height="presentation.media.height"
        class="w-100 mb-25px"
      />
      <p
        class="mx-auto mb-25px text-dark-gray"
        :role="presentation.state === 'unavailable' ? 'status' : undefined"
      >
        {{ presentation.message }}
      </p>
      <div class="d-flex gap-15px justify-content-center flex-wrap">
        <a
          v-if="presentation.action?.target"
          :href="presentation.action.target"
          data-fashion-store-route
          class="btn btn-dark-gray btn-medium btn-round-edge"
          >{{ presentation.action.label }}</a
        >
        <a
          v-if="presentation.relatedAction?.target"
          :href="presentation.relatedAction.target"
          data-fashion-store-route
          class="btn btn-transparent-dark-gray btn-medium"
          >{{ presentation.relatedAction.label }}</a
        >
        <a href="/" data-fashion-store-route class="btn btn-transparent-dark-gray btn-medium">
          Return home
        </a>
      </div>
    </div>
  </section>
  <section
    v-if="presentation.products.length > 0"
    class="pt-0 pb-70px"
    aria-labelledby="fashion-store-content-recovery"
  >
    <div class="container">
      <h2 id="fashion-store-content-recovery" class="alt-font text-dark-gray fw-600 mb-30px">
        Continue shopping
      </h2>
      <ul
        class="shop-modern shop-wrapper grid grid-4col xl-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
      >
        <FashionStoreProductCard
          v-for="product in presentation.products"
          :key="product.productId"
          :product="product"
          :resolve-asset="resolveAsset"
        />
      </ul>
    </div>
  </section>
</template>
