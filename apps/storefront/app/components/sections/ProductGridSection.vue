<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <section
    v-if="viewModel.kind === 'product-grid'"
    class="section"
    aria-labelledby="product-grid-title"
  >
    <h2 id="product-grid-title">{{ viewModel.heading }}</h2>
    <div class="product-grid">
      <article v-for="product in viewModel.products" :key="product.id" class="product-card">
        <NuxtLink :to="product.href">
          <img
            v-if="product.media"
            :src="product.media.src"
            :alt="product.media.alt"
            :width="product.media.width"
            :height="product.media.height"
            loading="lazy"
          />
          <span v-else class="product-media-placeholder" aria-hidden="true"></span>
          <div>
            <h3>{{ product.name }}</h3>
            <span>{{ product.priceLabel }}</span>
          </div>
        </NuxtLink>
      </article>
    </div>
    <slot />
  </section>
</template>
