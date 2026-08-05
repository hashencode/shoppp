<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <main v-if="viewModel.kind === 'state'" class="not-found">
    <div
      :role="
        viewModel.state === 'validation-error' || viewModel.state === 'unavailable'
          ? 'alert'
          : 'status'
      "
    >
      <h1>{{ viewModel.heading }}</h1>
      <p>{{ viewModel.message }}</p>
    </div>
    <NuxtLink
      v-if="viewModel.action?.intent === 'navigation'"
      class="cta"
      :to="viewModel.action.target"
      @click="recordPreviewIntent(viewModel.action, 'core.state')"
    >
      {{ viewModel.action.label }}
    </NuxtLink>
    <slot />
  </main>
</template>
