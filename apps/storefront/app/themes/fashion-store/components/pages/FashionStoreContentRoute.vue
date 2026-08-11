<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreLiveContentPage from "./FashionStoreLiveContentPage.vue";

const FashionStoreFixtureContentPage = defineAsyncComponent(
  () => import("./FashionStoreContentPage.vue"),
);

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
</script>

<template>
  <FashionStoreLiveContentPage
    v-if="viewModel.kind === 'state'"
    :resolve-asset="resolveAsset"
    :view-model="viewModel"
  />
  <FashionStoreFixtureContentPage v-else :resolve-asset="resolveAsset" :view-model="viewModel" />
</template>
