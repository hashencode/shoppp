<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreLiveProductPage from "./FashionStoreLiveProductPage.vue";

const FashionStoreFixtureProductPage = defineAsyncComponent(
  () => import("./FashionStoreProductPage.vue"),
);

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
</script>

<template>
  <FashionStoreLiveProductPage
    v-if="viewModel.kind === 'product'"
    :resolve-asset="resolveAsset"
    :view-model="viewModel"
  />
  <FashionStoreFixtureProductPage v-else :resolve-asset="resolveAsset" :view-model="viewModel" />
</template>
