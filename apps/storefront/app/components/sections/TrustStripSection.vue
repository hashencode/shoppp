<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
defineProps<{ viewModel: PresentationViewModel }>();
</script>

<template>
  <aside v-if="viewModel.kind === 'trust-strip'" class="section" aria-label="Fixture assurances">
    <ul>
      <li v-for="item in viewModel.items" :key="item">{{ item }}</li>
    </ul>
    <slot />
  </aside>
</template>
