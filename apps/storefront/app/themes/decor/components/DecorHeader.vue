<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { recordPreviewIntent } from "../../../theme-engine/actions";

const properties = defineProps<{ viewModel: PresentationViewModel }>();
const model = computed(() =>
  properties.viewModel.kind === "navigation" ? properties.viewModel : null,
);
</script>

<template>
  <template v-if="model">
    <a class="skip-link" href="#preview-content">Skip to content</a>
    <header class="decor-header">
      <NuxtLink class="decor-wordmark" to="/" aria-label="Decor preview home">
        {{ model.brand }}
      </NuxtLink>
      <nav class="decor-desktop-nav" aria-label="Primary navigation">
        <NuxtLink
          v-for="item in model.items"
          :key="item.id"
          :to="item.target"
          @click="recordPreviewIntent(item, 'decor.header')"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
      <details class="decor-mobile-menu">
        <summary>Explore</summary>
        <nav aria-label="Mobile navigation">
          <NuxtLink
            v-for="item in model.items"
            :key="item.id"
            :to="item.target"
            @click="recordPreviewIntent(item, 'decor.header')"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
      </details>
    </header>
    <slot />
  </template>
</template>
