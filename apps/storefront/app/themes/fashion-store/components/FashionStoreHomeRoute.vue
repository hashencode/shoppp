<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
const FashionStoreFixtureHome = defineAsyncComponent(() => import("./FashionStoreHome.vue"));
const FashionStoreLiveHome = defineAsyncComponent(() => import("./FashionStoreLiveHomePage.vue"));

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
</script>

<template>
  <FashionStoreLiveHome
    v-if="viewModel.kind === 'home'"
    :resolve-asset="resolveAsset"
    :view-model="viewModel"
  />
  <FashionStoreFixtureHome v-else :resolve-asset="resolveAsset" :view-model="viewModel" />
</template>
