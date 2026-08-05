<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <article v-if="viewModel.kind === 'product'" class="product-page">
    <div class="product-media">
      <img
        v-for="item in viewModel.media"
        :key="item.src"
        :src="item.src"
        :alt="item.alt"
        :width="item.width"
        :height="item.height"
      />
    </div>
    <div class="product-info">
      <h1>{{ viewModel.heading }}</h1>
      <p class="hero-copy">{{ viewModel.description }}</p>
      <p class="price">{{ viewModel.priceLabel }}</p>
      <div class="controls">
        <p>Fixture variants</p>
        <button
          v-for="action in viewModel.actions"
          :key="action.id"
          class="buy-button"
          type="button"
          @click="recordPreviewIntent(action, 'core.product')"
        >
          {{ action.label }}
        </button>
      </div>
      <slot />
    </div>
  </article>
</template>
