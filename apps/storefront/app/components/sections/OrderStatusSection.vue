<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <main v-if="viewModel.kind === 'order'" class="commerce-shell" aria-live="polite">
    <h1>{{ viewModel.heading }}</h1>
    <p v-if="viewModel.errorMessage" class="form-error" role="alert">
      {{ viewModel.errorMessage }}
    </p>
    <div v-else role="status">
      <p>{{ viewModel.statusLabel }}</p>
      <p>Reference {{ viewModel.reference }}</p>
    </div>
    <ul>
      <li v-for="line in viewModel.lines" :key="line">{{ line }}</li>
    </ul>
    <p class="price">{{ viewModel.totalLabel }}</p>
    <slot />
  </main>
</template>
