<script setup lang="ts">
import { HeartHandshake, RotateCcw, ShieldCheck, Truck } from "@lucide/vue";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface ServiceData {
  items: string[];
}
const properties = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as ServiceData)
    : null,
);
const serviceIcons = [Truck, RotateCcw, ShieldCheck, HeartHandshake] as const;
</script>
<template>
  <section v-if="data" class="fashion-service-strip" aria-label="Store services">
    <p v-for="(item, index) in data.items" :key="item">
      <component :is="serviceIcons[index]" aria-hidden="true" :size="18" :stroke-width="1.7" />{{
        item
      }}
    </p>
  </section>
</template>
