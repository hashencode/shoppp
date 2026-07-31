<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface CategoryData {
  items: { assetId: string; name: string }[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as CategoryData)
    : null,
);
</script>
<template>
  <section v-if="data" id="fashion-categories" class="fashion-categories">
    <a v-for="item in data.items" :key="item.assetId" href="/#fashion-bestsellers"
      ><img
        :src="properties.resolveAsset(item.assetId)"
        :alt="`${item.name} collection`"
        width="480"
        height="600"
        loading="lazy"
      /><span>{{ item.name }}</span></a
    >
  </section>
</template>
