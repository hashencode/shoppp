<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <section v-if="viewModel.kind === 'promotion'" class="section">
    <h2>{{ viewModel.heading }}</h2>
    <p>{{ viewModel.body }}</p>
    <NuxtLink
      :to="viewModel.action.target"
      class="cta"
      @click="recordPreviewIntent(viewModel.action, 'core.promotion')"
    >
      {{ viewModel.action.label }}
    </NuxtLink>
    <slot />
  </section>
</template>
