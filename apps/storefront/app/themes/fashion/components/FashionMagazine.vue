<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface MagazineData { heading: string; items: { assetId: string; title: string }[] }
const properties = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() => properties.viewModel.kind === "theme-section" ? properties.viewModel.data as unknown as MagazineData : null);
</script>
<template><section v-if="data" class="fashion-magazine"><h2>{{ data.heading }}</h2><div><article v-for="item in data.items" :key="item.assetId"><img :src="properties.resolveAsset(item.assetId)" :alt="item.title" width="700" height="480" loading="lazy" /><small>Editorial · 4 min read</small><h3>{{ item.title }}</h3></article></div></section></template>
