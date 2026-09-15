<script setup lang="ts">
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import { resolveLiveHomeData } from "./home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const viewModel = computed(() => resolveLiveHomeData(properties.viewModel));
</script>

<template>
  <section
    data-home-section="featured-products"
    class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 md-pb-5 xs-px-0"
  >
    <div class="container-fluid">
      <div class="text-center mb-40px">
        <p class="alt-font text-uppercase fs-12 fw-600 mb-5px text-dark-gray">The latest edit</p>
        <h2 class="alt-font fw-600 text-dark-gray">Featured products</h2>
      </div>
      <p v-if="!viewModel.featuredProduct && viewModel.products.length === 0" role="status">
        This collection does not have published products yet.
      </p>
      <ul
        v-else
        class="shop-modern shop-wrapper grid grid-4col lg-grid-3col md-grid-2col xs-grid-1col gutter-extra-large text-center"
        aria-label="Featured products"
      >
        <FashionStoreProductCard
          v-for="product in viewModel.featuredProduct
            ? [viewModel.featuredProduct]
            : viewModel.products"
          :key="`featured-${product.productId}`"
          :product="product"
          :resolve-asset="resolveAsset"
        />
      </ul>
    </div>
  </section>
</template>
