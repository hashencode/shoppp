<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  items: string[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
</script>
<template>
  <section v-if="data" class="decor-clients" aria-label="Selected partners">
    <img
      v-for="item in data.items"
      :key="item"
      :src="p.resolveAsset(item)"
      alt="Partner mark"
      width="220"
      height="90"
      loading="lazy"
    />
  </section>
</template>
