<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <section v-if="viewModel.kind === 'hero'" class="hero" aria-labelledby="preview-title">
    <div>
      <p class="eyebrow">{{ viewModel.eyebrow }}</p>
      <h1 id="preview-title">{{ viewModel.heading }}</h1>
      <p class="hero-copy">{{ viewModel.body }}</p>
      <NuxtLink
        v-if="viewModel.primaryAction?.target"
        class="cta"
        :to="viewModel.primaryAction.target"
        @click="recordPreviewIntent(viewModel.primaryAction, 'core.hero')"
      >
        {{ viewModel.primaryAction.label }}
      </NuxtLink>
    </div>
    <img
      v-if="viewModel.media"
      :src="viewModel.media.src"
      :alt="viewModel.media.alt"
      :width="viewModel.media.width"
      :height="viewModel.media.height"
    />
    <slot />
  </section>
</template>
