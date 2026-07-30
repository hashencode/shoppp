<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface ServiceData { items: string[] }
const properties = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed(() => properties.viewModel.kind === "theme-section" ? properties.viewModel.data as unknown as ServiceData : null);
</script>
<template><section v-if="data" class="fashion-service-strip" aria-label="Store services"><p v-for="(item, index) in data.items" :key="item"><b>{{ ["↗", "↺", "✓", "♡"][index] }}</b>{{ item }}</p></section></template>
