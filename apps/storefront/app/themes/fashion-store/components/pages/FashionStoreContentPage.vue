<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreAccountPage from "./FashionStoreAccountPage.vue";
import FashionStoreArticlePage from "./FashionStoreArticlePage.vue";
import FashionStoreMagazinePage from "./FashionStoreMagazinePage.vue";
import FashionStoreWishlistPage from "./FashionStoreWishlistPage.vue";

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const router = useRouter();
const contentPages = {
  "/account": FashionStoreAccountPage,
  "/magazine": FashionStoreMagazinePage,
  "/magazine/marketing-tips-and-tricks": FashionStoreArticlePage,
  "/wishlist": FashionStoreWishlistPage,
} as const;
const page = computed(
  () =>
    contentPages[router.currentRoute.value.path as keyof typeof contentPages] ??
    FashionStoreWishlistPage,
);
</script>

<template>
  <component :is="page" :resolve-asset="resolveAsset" :view-model="viewModel" />
</template>
