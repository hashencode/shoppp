<script setup lang="ts">
import type { Component } from "vue";

import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { normalizeThemeRoutePath } from "../../../../theme-engine/routes";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import {
  resolveFashionStoreContentPresentation,
  resolveFashionStoreLiveContactPresentation,
  type FashionStoreContentRouteKey,
} from "../../contracts/content-presentation";
import FashionStoreAccountPage from "./FashionStoreAccountPage.vue";
import FashionStoreAboutPage from "./FashionStoreAboutPage.vue";
import FashionStoreArticlePage from "./FashionStoreArticlePage.vue";
import FashionStoreContactPage from "./FashionStoreContactPage.vue";
import FashionStoreLiveContactPage from "./FashionStoreLiveContactPage.vue";
import FashionStoreFaqPage from "./FashionStoreFaqPage.vue";
import FashionStoreMagazinePage from "./FashionStoreMagazinePage.vue";
import FashionStoreWishlistPage from "./FashionStoreWishlistPage.vue";
import FashionStoreContentState from "./FashionStoreContentState.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  instance?: unknown;
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const router = useRouter();
const contentPages = {
  "/account": { component: FashionStoreAccountPage, route: "account" },
  "/about": { component: FashionStoreAboutPage, route: "about" },
  "/contact": { component: FashionStoreContactPage, route: "contact" },
  "/faq": { component: FashionStoreFaqPage, route: "faq" },
  "/magazine": { component: FashionStoreMagazinePage, route: "magazine" },
  "/magazine/marketing-tips-and-tricks": {
    component: FashionStoreArticlePage,
    route: "article",
  },
  "/wishlist": { component: FashionStoreWishlistPage, route: "wishlist" },
} as const;
const routePresentation = computed(() => {
  const path = normalizeThemeRoutePath(router.currentRoute.value.path);
  const resolved = contentPages[path as keyof typeof contentPages];
  if (!resolved) throw new Error(`Unknown Fashion Store content route: ${path}`);
  return {
    component: resolved.component as Component,
    content: resolveFashionStoreContentPresentation(
      properties.viewModel,
      resolved.route as FashionStoreContentRouteKey,
    ),
    liveContact: resolveFashionStoreLiveContactPresentation(properties.viewModel, resolved.route),
    route: resolved.route,
  };
});
</script>

<template>
  <FashionStoreLiveContactPage
    v-if="routePresentation.liveContact"
    :presentation="routePresentation.liveContact"
    :resolve-asset="resolveAsset"
  />
  <component
    :is="routePresentation.component"
    v-else-if="routePresentation.content.detail"
    :data="routePresentation.content.detail"
    :resolve-asset="resolveAsset"
  />
  <FashionStoreShell v-else :resolve-asset="resolveAsset" :show-sticky-socials="false">
    <main
      id="fashion-store-main"
      data-fashion-store-content
      :data-fashion-store-content-route="routePresentation.route"
    >
      <FashionStoreContentState
        :presentation="routePresentation.content.state"
        :resolve-asset="resolveAsset"
      />
    </main>
  </FashionStoreShell>
</template>
