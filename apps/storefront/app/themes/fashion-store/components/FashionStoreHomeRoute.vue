<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import FashionStoreLiveCatalog from "./shared/FashionStoreLiveCatalog.vue";

const FashionStoreFixtureHome = defineAsyncComponent(() => import("./FashionStoreHome.vue"));

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
</script>

<template>
  <FashionStoreLiveCatalog
    v-if="viewModel.kind === 'collection-grid'"
    page="home"
    :resolve-asset="resolveAsset"
    :view-model="viewModel"
  />
  <FashionStoreFixtureHome v-else :resolve-asset="resolveAsset" :view-model="viewModel" />
</template>
