<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface PromiseData {
  items: string[];
}

const properties = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as PromiseData)
    : null,
);
</script>

<template>
  <section v-if="data" class="fashion-promises" aria-label="Shopping promises">
    <p v-for="item in data.items" :key="item">{{ item }}</p>
  </section>
</template>
