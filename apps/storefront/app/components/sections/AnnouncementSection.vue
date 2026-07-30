<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <aside v-if="viewModel.kind === 'announcement'" aria-label="Announcement">
    <p>{{ viewModel.message }}</p>
    <slot />
  </aside>
</template>
