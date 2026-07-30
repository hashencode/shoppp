<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface ServiceData {
  items: { assetId: string; detail: string; label: string }[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as ServiceData)
    : null,
);
</script>
<template>
  <section v-if="data" class="fashion-service-strip" aria-label="Store services">
    <article v-for="item in data.items" :key="item.assetId">
      <img
        :src="properties.resolveAsset(item.assetId)"
        alt=""
        width="48"
        height="48"
        loading="eager"
      />
      <p>
        <strong>{{ item.label }}</strong
        ><span>{{ item.detail }}</span>
      </p>
    </article>
  </section>
</template>
