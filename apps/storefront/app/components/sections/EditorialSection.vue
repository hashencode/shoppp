<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <article v-if="viewModel.kind === 'editorial'" class="section">
    <img
      v-if="viewModel.media"
      :src="viewModel.media.src"
      :alt="viewModel.media.alt"
      :width="viewModel.media.width"
      :height="viewModel.media.height"
      loading="lazy"
    />
    <div class="prose">
      <h2>{{ viewModel.heading }}</h2>
      <p>{{ viewModel.body }}</p>
    </div>
    <slot />
  </article>
</template>
