<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";

const properties = defineProps<{ viewModel: PresentationViewModel }>();
const model = computed(() =>
  properties.viewModel.kind === "navigation" ? properties.viewModel : null,
);
</script>

<template>
  <template v-if="model">
    <a class="skip-link" href="#preview-content">Skip to content</a>
    <header class="site-header">
      <NuxtLink class="wordmark" to="/" aria-label="Fixture preview home">
        {{ model.brand }}
      </NuxtLink>
      <nav aria-label="Primary navigation">
        <NuxtLink
          v-for="item in model.items"
          :key="item.id"
          :to="item.target"
          @click="recordPreviewIntent(item, 'core.navigation')"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </header>
    <slot />
  </template>
</template>
