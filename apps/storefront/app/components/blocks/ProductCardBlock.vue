<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";

const properties = defineProps<{ viewModel: PresentationViewModel }>();
const products = computed(() =>
  properties.viewModel.kind === "product-grid" ? properties.viewModel.products : [],
);
</script>

<template>
  <article
    v-for="product in products"
    :key="product.id"
    class="product-card"
    data-preview-block="product-card"
  >
    <NuxtLink :to="product.href">
      <img
        :src="product.media.src"
        :alt="product.media.alt"
        :width="product.media.width"
        :height="product.media.height"
        loading="lazy"
      />
      <div>
        <h3>{{ product.name }}</h3>
        <span>{{ product.priceLabel }}</span>
      </div>
    </NuxtLink>
  </article>
</template>
