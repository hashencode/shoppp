<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreAccountPage from "./FashionStoreAccountPage.vue";
import FashionStoreWishlistPage from "./FashionStoreWishlistPage.vue";

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const route = useRoute();
const page = computed(() =>
  route.path === "/account" ? FashionStoreAccountPage : FashionStoreWishlistPage,
);
</script>

<template>
  <component :is="page" :resolve-asset="resolveAsset" :view-model="viewModel" />
</template>
