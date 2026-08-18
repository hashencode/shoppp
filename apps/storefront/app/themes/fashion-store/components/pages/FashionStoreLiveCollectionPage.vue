<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreLiveCatalog from "../shared/FashionStoreLiveCatalog.vue";

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: Extract<PresentationViewModel, { kind: "collection-grid" }>;
}>();
</script>

<template>
  <FashionStoreLiveCatalog :resolve-asset="resolveAsset" :view-model="viewModel" />
</template>
