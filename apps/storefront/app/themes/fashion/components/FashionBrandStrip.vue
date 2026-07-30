<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface BrandData {
  items: string[];
}

const properties = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as BrandData)
    : null,
);
</script>

<template>
  <section v-if="data" class="fashion-brands" aria-label="Featured fashion labels">
    <span v-for="item in data.items" :key="item">{{ item }}</span>
  </section>
</template>
