<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <section
    v-if="viewModel.kind === 'collection-grid'"
    class="section"
    aria-labelledby="collection-grid-title"
  >
    <h2 id="collection-grid-title">{{ viewModel.heading }}</h2>
    <ul>
      <li v-for="collection in viewModel.collections" :key="collection.id">
        <NuxtLink
          :to="collection.action.target"
          @click="recordPreviewIntent(collection.action, 'core.collection-grid')"
        >
          {{ collection.name }}
        </NuxtLink>
      </li>
    </ul>
    <slot />
  </section>
</template>
