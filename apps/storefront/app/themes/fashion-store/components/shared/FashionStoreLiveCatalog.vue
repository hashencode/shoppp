<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreProductCard from "./FashionStoreProductCard.vue";
import FashionStoreShell from "./FashionStoreShell.vue";

type CollectionGridViewModel = Extract<PresentationViewModel, { kind: "collection-grid" }>;

const properties = defineProps<{
  page: "collection" | "home";
  resolveAsset: ThemeAssetResolver;
  viewModel: CollectionGridViewModel;
}>();

const heading = computed(() =>
  properties.page === "home"
    ? `${properties.viewModel.heading} collection`
    : properties.viewModel.heading,
);
</script>

<template>
  <FashionStoreShell
    announcement="Catalog content is published; price and availability are verified before purchase."
    body-class=""
    :resolve-asset="resolveAsset"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-live-catalog
      :data-catalog-page="page"
      data-runtime-status="static"
    >
      <section class="top-space-margin half-section bg-gradient-very-light-gray">
        <div class="container text-center">
          <p class="alt-font text-uppercase fs-12 fw-600 mb-10px">Selected catalog release</p>
          <h1 class="alt-font fw-600 text-dark-gray mb-10px">{{ heading }}</h1>
        </div>
      </section>
      <section class="pt-70px pb-70px">
        <div class="container">
          <p v-if="viewModel.products.length === 0" role="status">
            This collection does not have published products yet.
          </p>
          <ul
            v-else
            class="shop-modern shop-wrapper grid-loading grid grid-4col xl-grid-4col lg-grid-3col md-grid-2col xs-grid-1col gutter-extra-large text-center"
            aria-label="Published products"
          >
            <FashionStoreProductCard
              v-for="product in viewModel.products"
              :key="product.id"
              :commerce-enabled="false"
              :product="product"
              :resolve-asset="resolveAsset"
            />
          </ul>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
