<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { normalizeThemeRoutePath } from "../../../../theme-engine/routes";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreAccountPage from "./FashionStoreAccountPage.vue";
import FashionStoreAboutPage from "./FashionStoreAboutPage.vue";
import FashionStoreArticlePage from "./FashionStoreArticlePage.vue";
import FashionStoreContactPage from "./FashionStoreContactPage.vue";
import FashionStoreFaqPage from "./FashionStoreFaqPage.vue";
import FashionStoreMagazinePage from "./FashionStoreMagazinePage.vue";
import FashionStoreWishlistPage from "./FashionStoreWishlistPage.vue";

defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const router = useRouter();
const contentPages = {
  "/account": FashionStoreAccountPage,
  "/about": FashionStoreAboutPage,
  "/contact": FashionStoreContactPage,
  "/faq": FashionStoreFaqPage,
  "/magazine": FashionStoreMagazinePage,
  "/magazine/marketing-tips-and-tricks": FashionStoreArticlePage,
  "/wishlist": FashionStoreWishlistPage,
} as const;
const page = computed(() => {
  const path = normalizeThemeRoutePath(router.currentRoute.value.path);
  const resolved = contentPages[path as keyof typeof contentPages];
  if (!resolved) throw new Error(`Unknown Fashion Store content route: ${path}`);
  return resolved;
});
</script>

<template>
  <component :is="page" :resolve-asset="resolveAsset" :view-model="viewModel" />
</template>
