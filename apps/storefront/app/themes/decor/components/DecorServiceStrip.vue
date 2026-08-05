<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  items: { assetId: string; detail: string; label: string }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
</script>
<template>
  <section v-if="data" class="decor-services">
    <article v-for="item in data.items" :key="item.assetId">
      <img :src="p.resolveAsset(item.assetId)" alt="" width="60" height="50" loading="lazy" />
      <div>
        <h2>{{ item.label }}</h2>
        <span class="decor-service-detail">{{ item.detail }}</span>
      </div>
    </article>
  </section>
</template>
